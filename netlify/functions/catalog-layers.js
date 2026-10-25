// HCPS Partner 360 — CATALOG LAYERS. The commercial half of a line's catalog, for someone entitled to it.
//
//   GET /.netlify/functions/catalog-layers?manufacturer=<slug>&identity=<sha256 of the public file's rows>
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
// VERSION-EXACT (P0 review, 2026-10-23). The browser sends the identity of the public catalog file it
// actually loaded (catalogIdentity: the SHA-256 of its rows' identity fingerprints). Only the stored
// commercial record with that SAME identity is answered — several versions may sit side by side while
// a new catalog file is being rolled out (seed first, deploy second, prune last). A public file newer
// or older than every stored record: 503 catalog_version_not_seeded, never the nearest version. The
// record is checked internally (validOverlayRecord: every entry fingerprinted, identity recomputed),
// and the browser then checks every row's fingerprint again as it restores.
//
// Never cached: private, no-store, and it varies on the credential. No CORS: only the
// storefront's own origin calls it.
const FEED = require("./catalog-feed.js");
const CC = require("./_catalog_commercial.js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

/* The exact columns the storefront always read with the public key — kept identical so the
   merged products are the same as before (test/p0parity.test.js). */
const LAYER_SELECT = {
  custom_products: "code,name,category,base_price,msrp,map,image,description,active,tiers,price_note",
  product_overrides: "code,patch",
};
/* Every stored version of the line — the right one is picked by identity below (never by position). */
const COMMERCIAL_SELECT = "manufacturer,identity_sha256,rows";
const STAFF_ROLES = ["president", "admin", "owner"];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEX64 = /^[0-9a-f]{64}$/;

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

/* Pure: is this a well-formed commercial record? One entry per row {k, h, order, f}, every entry
   fingerprinted, and the record's identity equal to its fingerprints (shared rule, _catalog_commercial.js). */
function validOverlay(rows, identity) {
  return CC.validOverlayRecord({ rows, identity_sha256: identity });
}
/* Pure: of a line's stored versions, the one for the public file the browser holds — or why not. */
function pickVersion(recs, identity) {
  const list = Array.isArray(recs) ? recs : [];
  if (!list.length) return { error: "this line has no commercial record yet" };
  const row = list.find(r => r && r.identity_sha256 === identity);
  if (!row) return { error: "catalog_version_not_seeded" };
  if (!validOverlay(row.rows, row.identity_sha256)) return { error: "this line's commercial record is malformed" };
  return { row };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "GET only" });
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json(503, { error: "pricing_unavailable", reason: "server not configured" });
    const slug = String((event.queryStringParameters || {}).manufacturer || "").trim();
    const who = await FEED.caller(event);
    const gate = authorizeLayers(who, slug);
    if (!gate.ok) return json(gate.status, { error: gate.error });
    const identity = String((event.queryStringParameters || {}).identity || "").trim();
    if (!HEX64.test(identity)) return json(400, { error: "identity required (the public catalog file's identity)" });

    const e = encodeURIComponent;
    let rec, custom, overrides;
    try {
      [rec, custom, overrides] = await Promise.all([
        sb(`catalog_file_commercial?manufacturer=eq.${e(slug)}&select=${COMMERCIAL_SELECT}`),
        sb(`custom_products?manufacturer=eq.${e(slug)}&select=${LAYER_SELECT.custom_products}`),
        sb(`product_overrides?manufacturer=eq.${e(slug)}&select=${LAYER_SELECT.product_overrides}`),
      ]);
    } catch (err) {
      return json(503, { error: "pricing_unavailable", reason: "a pricing layer could not be read" });
    }
    const v = pickVersion(rec, identity);
    if (!v.row) return json(503, { error: "pricing_unavailable", reason: v.error });
    const row = v.row;
    if (!Array.isArray(custom) || !Array.isArray(overrides))
      return json(503, { error: "pricing_unavailable", reason: "a pricing layer could not be read" });

    return json(200, {
      ok: true,
      manufacturer: slug,
      generated_at: new Date().toISOString(),
      identity_sha256: row.identity_sha256,
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
module.exports.pickVersion = pickVersion;
module.exports.COMMERCIAL_SELECT = COMMERCIAL_SELECT;
module.exports.LAYER_SELECT = LAYER_SELECT;
