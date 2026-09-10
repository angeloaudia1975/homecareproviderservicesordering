// HCPS Partner 360 — CATALOG FEED. Commercial facts, straight from the master record.
//
//   GET /.netlify/functions/catalog-feed?manufacturer=<slug>
//   Authorization: Bearer <supabase JWT>
//
// WHY THIS EXISTS
//   Partner 360 currently reads custom_products and product_overrides straight
//   from Supabase with the anon key — and that key ships in the page source.
//   Every dealer price on the platform is therefore readable by anyone who opens
//   the shop and looks at the network tab, whether or not they are a dealer, and
//   for every manufacturer rather than the ones they buy from. The "Log in for
//   pricing" message on a card is a client-side courtesy, not a control.
//
//   Phase 4 of the catalog rebuild has to rewrite the read path anyway, so it is
//   rewritten through here: the service role reads product_skus server-side, the
//   caller is identified, and prices go back only to someone entitled to see
//   them. product_skus stays closed to the anon key permanently.
//
// WHO MAY CALL IT
//   · an APPROVED dealer  — only the manufacturers they are entitled to
//   · HCPS staff          — any manufacturer, for admin screens and validation
//   Anyone else gets 401 and no prices. An entitled-but-wrong line gets 403,
//   which is deliberately distinguishable from 404: a dealer asking for a line
//   they do not carry should be told so, not told it does not exist.
//
// WHAT IT RETURNS
//   Commercial facts ONLY — price, MSRP, MAP, tiers, unit of measure, status.
//   Not the name, not the category, not the image. Those belong to the
//   enrichment record and the category map, and this feed deliberately cannot
//   contradict them. One master record per fact is the whole point of the
//   rebuild; a feed that carried names would immediately become a second one.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};
const json = (c, o) => ({
  statusCode: c,
  headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  body: JSON.stringify(o),
});
const H = () => ({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` });

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H() });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t}`);
  return t ? JSON.parse(t) : null;
}

/* ── WHO IS ASKING ─────────────────────────────────────────────────────────
   The caller's own JWT is verified against Supabase auth; everything after
   that is read with the service role. Staff are recognised the same way the
   admin API recognises them, dealers the same way dealer-auth does, so there
   is no third notion of identity invented here. */
async function caller(event) {
  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const tok = auth.replace(/^Bearer\s+/i, "").trim();
  if (!tok) return null;

  let u;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${tok}` },
    });
    if (!r.ok) return null;
    u = await r.json();
  } catch (e) { return null; }
  if (!u || !u.id) return null;

  const email = u.email ? String(u.email).toLowerCase() : "";
  if (email) {
    const staff = await sb(`staff_users?email=eq.${encodeURIComponent(email)}&select=role,active`).catch(() => []);
    const s = staff && staff[0];
    if (s && s.active !== false) return { kind: "staff", role: s.role || "rep", email };
  }

  const du = await sb(`dealer_users?uid=eq.${encodeURIComponent(u.id)}&select=status,dealer_id`).catch(() => []);
  const d = du && du[0];
  if (!d || d.status !== "approved") return null;

  const dm = await sb(
    `dealer_manufacturers?dealer_id=eq.${encodeURIComponent(d.dealer_id)}&active=eq.true&select=manufacturer`
  ).catch(() => []);
  return {
    kind: "dealer",
    dealer_id: d.dealer_id,
    lines: (dm || []).map(x => String(x.manufacturer)),
  };
}

/* Pure: may this caller see this line? Split out so it can be tested without
   a network, and so the rule is stated in one readable place. */
function authorize(who, slug) {
  if (!who) return { ok: false, status: 401, error: "unauthorized" };
  if (!slug) return { ok: false, status: 400, error: "manufacturer required" };
  if (who.kind === "staff") return { ok: true };
  if (who.kind === "dealer") {
    return (who.lines || []).indexOf(slug) >= 0
      ? { ok: true }
      : { ok: false, status: 403, error: "not entitled to this manufacturer" };
  }
  return { ok: false, status: 401, error: "unauthorized" };
}

/* Pure: the wire shape. Nulls are dropped rather than sent as null so the
   payload says what it knows and stays quiet about what it does not — and so
   a consumer cannot mistake "no MAP recorded" for "MAP is zero". */
function feedRows(rows) {
  const n = v => (v == null || v === "" ? null : Number(v));
  const out = [];
  (rows || []).forEach(r => {
    const o = { code: String(r.code) };
    if (r.option_label) o.option_label = r.option_label;
    if (n(r.base_price) != null) o.base_price = n(r.base_price);
    if (n(r.msrp) != null) o.msrp = n(r.msrp);
    if (r.msrp_auto === true) o.msrp_auto = true;
    if (n(r.map) != null) o.map = n(r.map);
    if (Array.isArray(r.tiers) && r.tiers.length) {
      o.tiers = r.tiers
        .map(t => ({ min_qty: Number(t.min_qty), price: Number(t.price) }))
        .filter(t => isFinite(t.min_qty) && isFinite(t.price))
        .sort((a, b) => a.min_qty - b.min_qty);
      if (!o.tiers.length) delete o.tiers;
    }
    if (r.price_note) o.price_note = r.price_note;
    if (r.uom) o.uom = r.uom;
    if (r.hcpcs) o.hcpcs = r.hcpcs;
    if (n(r.case_qty) != null) o.case_qty = n(r.case_qty);
    out.push(o);
  });
  out.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") return json(405, { error: "GET only" });
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE)
      return json(500, { error: "Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_ROLE)" });

    const slug = String((event.queryStringParameters || {}).manufacturer || "").trim();
    const who = await caller(event);
    const gate = authorize(who, slug);
    if (!gate.ok) return json(gate.status, { error: gate.error });

    const e = encodeURIComponent;
    /* HAS THIS LINE BEEN MIGRATED?
       An empty answer and an unmigrated line look identical from the shop's
       side, and getting that wrong would empty a manufacturer off the
       storefront — PediFix has 497 SKUs and no rows here yet. So the feed says
       so explicitly, and the presence of ANY row is what says it: the record
       itself is the record of its own migration, rather than a second list
       somewhere that has to be kept in step with it. */
    const anyRow = await sb(`product_skus?manufacturer=eq.${e(slug)}&select=code&limit=1`).catch(() => []);
    const migrated = Array.isArray(anyRow) && anyRow.length > 0;
    if (!migrated) {
      return json(200, { ok: true, manufacturer: slug, source: "product_skus",
        generated_at: new Date().toISOString(), migrated: false, count: 0, skus: [], superseded: [] });
    }

    const [active, dead] = await Promise.all([
      sb(`product_skus?manufacturer=eq.${e(slug)}&status=eq.active` +
         `&select=code,option_label,base_price,msrp,msrp_auto,map,tiers,price_note,uom,hcpcs,case_qty` +
         `&order=code&limit=5000`),
      /* Retired part numbers a dealer may still order by. Carries the pointer
         and nothing else — no price, because the order line already stores the
         price it was sold at. */
      sb(`product_skus?manufacturer=eq.${e(slug)}&superseded_by=not.is.null` +
         `&select=code,superseded_by&order=code&limit=5000`),
    ]);

    const skus = feedRows(active);
    return json(200, {
      ok: true,
      manufacturer: slug,
      source: "product_skus",
      generated_at: new Date().toISOString(),
      migrated: true,
      count: skus.length,
      skus,
      superseded: (dead || []).map(r => ({ code: String(r.code), superseded_by: String(r.superseded_by) })),
    });
  } catch (err) {
    return json(500, { error: String((err && err.message) || err) });
  }
};

// Exported for the test suite. The handler is what Netlify runs.
module.exports.authorize = authorize;
module.exports.feedRows = feedRows;
