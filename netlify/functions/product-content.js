/**
 * Partner 360 · product-content write/read API
 * - Public GET: returns ONLY approved content (no token needed) — same gate as RLS.
 * - Admin GET (x-admin-token): returns ALL rows (drafts + approved) for the review screen.
 * - Admin POST (x-admin-token): approve / reject / upsert / approve_all — writes via the
 *   SUPABASE_SERVICE_ROLE key, which bypasses RLS. The service key is a SERVER-ONLY secret.
 *
 * Env required (Netlify → Site settings → Environment):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE, CONTENT_ADMIN_TOKEN
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ADMIN_TOKEN  = process.env.CONTENT_ADMIN_TOKEN;
const { computeMerge } = require('./_content-merge.js');

const enc = encodeURIComponent;
// Map a product_content_sources row → the shape computeMerge expects for one source.
function mapSourceRow(r) {
  return {
    name: r.name, tagline: r.tagline, description: r.description,
    features: r.features || [], clinical_applications: r.clinical_applications || [],
    options: r.options || {}, billing_codes: r.billing_codes || [],
    images: r.images || [], sizing_rows: r.sizing_rows || [], sizing_note: r.sizing_note || '',
    source_url: r.source_url || ''
  };
}
// Fall back to the resolved product_content row as the "Current HCPS Data" source when no
// explicit hcps source row has been captured yet.
function hcpsFromContent(c) {
  if (!c) return null;
  var imgs = (c.images_gallery && c.images_gallery.length)
    ? c.images_gallery
    : (c.image ? [{ url: c.image, caption: 'Current catalog photo', source: 'hcps' }] : []);
  return {
    name: c.name, tagline: c.tagline, description: c.description,
    features: c.features || [], clinical_applications: c.clinical_applications || [],
    options: c.options || {}, billing_codes: c.billing_codes || [],
    images: imgs, sizing_rows: c.sizing_table || [], sizing_note: c.sizing_note || ''
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
  'Content-Type': 'application/json'
};
const reply = (code, body) => ({ statusCode: code, headers: CORS, body: JSON.stringify(body) });

function svcHeaders(extra) {
  return Object.assign({
    apikey: SERVICE_ROLE,
    authorization: 'Bearer ' + SERVICE_ROLE,
    'Content-Type': 'application/json'
  }, extra || {});
}
const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (!SUPABASE_URL || !SERVICE_ROLE) return reply(500, { ok: false, error: 'Supabase env not configured' });

  const isAdmin = (event.headers['x-admin-token'] || event.headers['X-Admin-Token']) === ADMIN_TOKEN && !!ADMIN_TOKEN;
  const qs = event.queryStringParameters || {};
  const mfr = qs.manufacturer || '';

  try {
    // ---------- READ ----------
    if (event.httpMethod === 'GET') {
      if (!mfr) return reply(400, { ok: false, error: 'manufacturer required' });
      // Admins get every row (for the review queue); the public gets approved only.
      const filter = isAdmin ? '' : '&status=eq.approved';
      const r = await fetch(rest(`product_content?manufacturer=eq.${encodeURIComponent(mfr)}${filter}&select=*&order=page_key`),
        { headers: svcHeaders() });
      const rows = await r.json();
      return reply(200, { ok: true, admin: isAdmin, rows });
    }

    // ---------- WRITE (admin only) ----------
    if (event.httpMethod === 'POST') {
      if (!isAdmin) return reply(401, { ok: false, error: 'admin token required' });
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
      const action = body.action;
      const who = body.reviewed_by || 'HCPS admin';

      if (action === 'approve' || action === 'reject') {
        if (!mfr && !body.manufacturer) return reply(400, { ok: false, error: 'manufacturer required' });
        const m = body.manufacturer || mfr;
        if (!body.page_key) return reply(400, { ok: false, error: 'page_key required' });
        const patch = Object.assign({}, body.patch || {}, {
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: who, updated_at: new Date().toISOString()
        });
        const r = await fetch(rest(`product_content?manufacturer=eq.${encodeURIComponent(m)}&page_key=eq.${encodeURIComponent(body.page_key)}`),
          { method: 'PATCH', headers: svcHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(patch) });
        const out = await r.json();
        return reply(r.ok ? 200 : 500, { ok: r.ok, rows: out });
      }

      if (action === 'approve_all') {
        const m = body.manufacturer || mfr;
        const r = await fetch(rest(`product_content?manufacturer=eq.${encodeURIComponent(m)}&status=eq.pending_review`),
          { method: 'PATCH', headers: svcHeaders({ Prefer: 'return=representation' }),
            body: JSON.stringify({ status: 'approved', reviewed_by: who, updated_at: new Date().toISOString() }) });
        const out = await r.json();
        return reply(r.ok ? 200 : 500, { ok: r.ok, approved: Array.isArray(out) ? out.length : 0 });
      }

      if (action === 'upsert') {
        // Importer pushes draft rows here. Accepts one row or an array of rows.
        const rows = Array.isArray(body.rows) ? body.rows : [body.row];
        rows.forEach(x => { if (x && !x.status) x.status = 'pending_review'; x.updated_at = new Date().toISOString(); });
        const r = await fetch(rest('product_content?on_conflict=manufacturer,page_key'),
          { method: 'POST', headers: svcHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows) });
        return reply(r.ok ? 200 : 500, { ok: r.ok, upserted: rows.length });
      }

      // ---- Capture one source (hcps / website / pdf) for a product page ----
      if (action === 'ingest_source') {
        const m = body.manufacturer || mfr;
        if (!m || !body.page_key || !body.source) return reply(400, { ok: false, error: 'manufacturer, page_key, source required' });
        if (['hcps', 'website', 'pdf'].indexOf(body.source) < 0) return reply(400, { ok: false, error: 'source must be hcps|website|pdf' });
        const d = body.data || {};
        const row = {
          manufacturer: m, page_key: body.page_key, source: body.source,
          source_label: body.source_label || null,
          source_url: body.source_url || d.source_url || null,
          name: d.name || null, tagline: d.tagline || null, description: d.description || null,
          features: d.features || [], clinical_applications: d.clinical_applications || [],
          options: d.options || {}, billing_codes: d.billing_codes || [],
          images: d.images || [], sizing_rows: d.sizing_rows || [], sizing_note: d.sizing_note || null,
          raw: d.raw || null, captured_at: new Date().toISOString()
        };
        const r = await fetch(rest('product_content_sources?on_conflict=manufacturer,page_key,source'),
          { method: 'POST', headers: svcHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(row) });
        if (!r.ok) { const t = await r.text(); return reply(500, { ok: false, error: t }); }
        return reply(200, { ok: true, ingested: { manufacturer: m, page_key: body.page_key, source: body.source } });
      }

      // ---- Reconcile the three captured sources into a flagged merge ----
      if (action === 'merge') {
        const m = body.manufacturer || mfr;
        if (!m || !body.page_key) return reply(400, { ok: false, error: 'manufacturer, page_key required' });
        const sr = await fetch(rest(`product_content_sources?manufacturer=eq.${enc(m)}&page_key=eq.${enc(body.page_key)}&select=*`), { headers: svcHeaders() });
        const srcRows = await sr.json();
        const byKey = {};
        (Array.isArray(srcRows) ? srcRows : []).forEach(function (r) { byKey[r.source] = mapSourceRow(r); });
        const pr = await fetch(rest(`product_content?manufacturer=eq.${enc(m)}&page_key=eq.${enc(body.page_key)}&select=*`), { headers: svcHeaders() });
        const prRows = await pr.json();
        const cur = (Array.isArray(prRows) && prRows[0]) || null;
        if (!byKey.hcps && cur) byKey.hcps = hcpsFromContent(cur);   // fall back to the catalog record
        const merged = computeMerge({ hcps: byKey.hcps || null, website: byKey.website || null, pdf: byKey.pdf || null });
        return reply(200, { ok: true, manufacturer: m, page_key: body.page_key, merge: merged, current: cur });
      }

      return reply(400, { ok: false, error: 'unknown action' });
    }

    return reply(405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    return reply(500, { ok: false, error: String(e && e.message || e) });
  }
};
