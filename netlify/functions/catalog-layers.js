// HCPS Partner 360 — CATALOG LAYERS. The commercial half of a line's catalog, for someone entitled to it.
//
//   GET /.netlify/functions/catalog-layers?manufacturer=<slug>
//   Authorization: Bearer <supabase JWT>      (a signed-in, APPROVED dealer)
//   — or — X-HCPS-Preview: <preview token>     (HCPS staff viewing the shop as ONE dealer)
//
// P0 SECURITY (2026-10-23, issue #2). Until now every wholesale price reached the browser from
// public places: the static catalog files, and the custom_products / product_overrides tables,
// which the public key could read in full. This function is now the ONLY way a browser gets them:
//
//   · file_overlay      — the commercial fields of the static catalog file (price, breaks, MAP,
//                         MSRP, price notes, Access4U dealer/tier prices, per-item shipping),
//                         from the private table catalog_file_commercial;
//   · custom_products   — the added products, the exact columns the shop always read;
//   · product_overrides — the saved edits (their patches may carry prices).
//
// WHO MAY CALL IT
//   · an approved dealer — only the manufacturers on their own dealer_manufacturers list;
//   · a staff preview    — only the PREVIEWED dealer's lines (the token names one dealer);
//   · an HCPS administrator signed in with their own staff login (president / admin / owner) —
//     any line, for verification. Other staff roles are refused: they review the shop by preview.
//   Anyone else: 401. A line the caller is not entitled to: 403.
//
// FAILS CLOSED. Every read is strict: an unreadable table, a line with no commercial record, or a
// malformed record answers 503 pricing_unavailable — never an empty layer, never a partial
// answer. The storefront then shows no prices for that line; there is no public copy left to
// fall back to.
//
// Never cached: private, no-store, and it varies on the credential. No CORS: only the
// storefront's own origin calls it.
const FEED = require("./catalog-feed.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

/* The exact columns the storefront always read with the public key — kept identical so the
   merged products are the same as before (test/p0parity.test.js). */
const LAYER_SELECT = {
  custom_products: "code,name,category,base_price,msrp,map,image,description,active,tiers,price_note",
  product_overrides: "code,patch",
};
const STAFF_ROLES = ["president", "admin", "owner"];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const HEADERS = {
  "content-type": "application/json",
  "cache-control": "private, no-store, max-age=0",
  "vary": "Authorization, X-HCPS-Preview",
  "x-content-type-options": "nosniff",
};
const json = (c, o) => ({ statusCode: c, headers: HEADERS, body: JSON.stringify(o) });

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return t ? JSON.parse(t) : null;
}

/* Pure: may this caller have this line's commercial layers? */
function authorizeLayers(who, slug) {
  if (!who) return { ok: false, status: 401, error: "unauthorized" };
  if (!slug || !SLUG_RE.test(slug)) return { ok: false, status: 400, error: "manufacturer required" };
  if (who.kind === "staff")
    return STAFF_ROLES.indexOf(String(who.role || "")) >= 0
      ? { ok: true } : { ok: false, status: 403, error: "staff review the shop through a dealer preview" };
  if (who.kind === "dealer")
    return (who.lines || []).indexOf(slug) >= 0
      ? { ok: true } : { ok: false, status: 403, error: "not entitled to this manufacturer" };
  return { ok: false, status: 401, error: "unauthorized" };
}

/* Pure: is this a well-formed commercial record? (one entry per row: {k, order, f}) */
function validOverlay(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.every(o => o && typeof o.k === "string" && Array.isArray(o.order) && o.f && typeof o.f === "object" && !Array.isArray(o.f));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "GET only" });
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json(503, { error: "pricing_unavailable", reason: "server not configured" });
    const slug = String((event.queryStringParameters || {}).manufacturer || "").trim();
    const who = await FEED.caller(event);
    const gate = authorizeLayers(who, slug);
    if (!gate.ok) return json(gate.status, { error: gate.error });

    const e = encodeURIComponent;
    let rec, custom, overrides;
    try {
      [rec, custom, overrides] = await Promise.all([
        sb(`catalog_file_commercial?manufacturer=eq.${e(slug)}&select=manufacturer,rows`),
        sb(`custom_products?manufacturer=eq.${e(slug)}&select=${LAYER_SELECT.custom_products}`),
        sb(`product_overrides?manufacturer=eq.${e(slug)}&select=${LAYER_SELECT.product_overrides}`),
      ]);
    } catch (err) {
      return json(503, { error: "pricing_unavailable", reason: "a pricing layer could not be read" });
    }
    const row = Array.isArray(rec) && rec[0];
    if (!row) return json(503, { error: "pricing_unavailable", reason: "this line has no commercial record yet" });
    if (!validOverlay(row.rows)) return json(503, { error: "pricing_unavailable", reason: "this line's commercial record is malformed" });
    if (!Array.isArray(custom) || !Array.isArray(overrides))
      return json(503, { error: "pricing_unavailable", reason: "a pricing layer could not be read" });

    return json(200, {
      ok: true,
      manufacturer: slug,
      generated_at: new Date().toISOString(),
      file_overlay: row.rows,
      custom_products: custom,
      product_overrides: overrides,
    });
  } catch (err) {
    return json(503, { error: "pricing_unavailable", reason: "pricing could not be loaded" });
  }
};

module.exports.authorizeLayers = authorizeLayers;
module.exports.validOverlay = validOverlay;
module.exports.LAYER_SELECT = LAYER_SELECT;
