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

      return reply(400, { ok: false, error: 'unknown action' });
    }

    return reply(405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    return reply(500, { ok: false, error: String(e && e.message || e) });
  }
};
