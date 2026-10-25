/* P0 (2026-10-23, issue #2) — catalog-layers: who gets a line's commercial layers.
   Loads the REAL catalog-layers.js and catalog-feed.js (its caller rules) and runs the handler
   against an in-memory Supabase (auth + PostgREST). Every assertion is on what the handler
   answered. Usage: node test/p0layers.test.js [catalog-layers.js] [catalog-feed.js] */
const fs = require('fs'), path = require('path');
const FN = path.join(__dirname, '..', 'netlify', 'functions');
const LAYERS_SRC = fs.readFileSync(process.argv[2] || process.env.CATALOG_LAYERS || path.join(FN, 'catalog-layers.js'), 'utf8');
const FEED_SRC = fs.readFileSync(process.argv[3] || process.env.CATALOG_FEED || path.join(FN, 'catalog-feed.js'), 'utf8');
const URL = 'https://db.test', KEY = 'service-key';
const CC = require(process.env.CC_MODULE || path.join(FN, '_catalog_commercial.js'));
/* P0 review: every stored record is a version of ONE public file — its identity and per-row fingerprints. */
const FILES = {
  'bemis': [{ code: '7Y1', name: 'Seat', base_price: 12.34 }],
  'strongback-mobility': [{ code: 'SB1', base_price: 5.67, tiers: [{ min_qty: 2, price: 5 }] }],
  'ovation-medical': [],
};
const PUB = slug => CC.splitCatalogFile(FILES[slug]).public;
const IDENT = slug => CC.catalogIdentity(PUB(slug));
const rec = slug => { const s = CC.splitCatalogFile(FILES[slug]); return { manufacturer: slug, identity_sha256: IDENT(slug), rows: s.overlay }; };
const Q = slug => ({ manufacturer: slug, identity: IDENT(slug) });
const PRICE_KEYS = ['base_price', 'tiers', 'dealer_price', 'tier_prices', 'msrp', 'map', 'price_note', 'unit_cost', 'shipping', 'patch'];

function world(over) {
  const db = Object.assign({
    staff_users: [{ email: 'boss@hcps.test', role: 'president', active: true }, { email: 'rep@hcps.test', role: 'rep', active: true },
                  { email: 'gone@hcps.test', role: 'admin', active: false }],
    dealer_users: [{ uid: 'u-ok', status: 'approved', dealer_id: 'D1' }, { uid: 'u-pend', status: 'pending', dealer_id: 'D1' },
                   { uid: 'u-two', status: 'approved', dealer_id: 'D2' }],
    dealer_manufacturers: [{ dealer_id: 'D1', manufacturer: 'bemis', active: true }, { dealer_id: 'D1', manufacturer: 'ovation-medical', active: false },
                           { dealer_id: 'D2', manufacturer: 'strongback-mobility', active: true }],
    dealer_preview_tokens: [{ token: 'pv-d2', dealer_id: 'D2', expires_at: '2999-01-01T00:00:00Z' },
                            { token: 'pv-old', dealer_id: 'D1', expires_at: '2000-01-01T00:00:00Z' }],
    catalog_file_commercial: [rec('bemis'), rec('strongback-mobility'), rec('ovation-medical'),
      { manufacturer: 'broken-line', identity_sha256: 'a'.repeat(64), rows: [{ k: 'X#0' }] }],
    custom_products: [{ manufacturer: 'bemis', code: '444DISPLAY', name: 'Display', base_price: 23.45, active: true },
                      { manufacturer: 'strongback-mobility', code: 'A1005', name: 'Pack', base_price: 50, active: true }],
    product_overrides: [{ manufacturer: 'bemis', code: '7Y1', patch: { base_price: 12.34, name: 'Seat' } }],
  }, over && over.db || {});
  const users = { 'jwt-dealer': { id: 'u-ok', email: 'buyer@dealer.test' }, 'jwt-pending': { id: 'u-pend', email: 'p@dealer.test' },
                  'jwt-two': { id: 'u-two', email: 'two@dealer.test' }, 'jwt-boss': { id: 'u-boss', email: 'boss@hcps.test' },
                  'jwt-rep': { id: 'u-rep', email: 'rep@hcps.test' }, 'jwt-gone': { id: 'u-gone', email: 'gone@hcps.test' },
                  'jwt-nobody': { id: 'u-none', email: 'who@else.test' } };
  const calls = [];
  const res = (st, body) => ({ ok: st >= 200 && st < 300, status: st, text: async () => JSON.stringify(body), json: async () => body });
  const fetch = async (u, opts) => {
    u = String(u); calls.push(u);
    const h = (opts && opts.headers) || {};
    if (u === URL + '/auth/v1/user') {
      const t = String(h.Authorization || h.authorization || '').replace(/^Bearer\s+/i, '');
      return users[t] ? res(200, users[t]) : res(401, { msg: 'bad jwt' });
    }
    if (!u.startsWith(URL + '/rest/v1/')) throw new Error('unexpected fetch ' + u);
    if ((h.apikey || '') !== KEY) return res(401, { message: 'no service key' });
    const rest = u.slice((URL + '/rest/v1/').length), q = rest.indexOf('?');
    const table = q < 0 ? rest : rest.slice(0, q);
    if (over && over.failRead && over.failRead(table)) return res(500, { message: 'down' });
    let rows = (db[table] || []).slice();
    (q < 0 ? '' : rest.slice(q + 1)).split('&').forEach(part => {
      const i = part.indexOf('='); if (i < 0) return;
      const k = decodeURIComponent(part.slice(0, i)), v = decodeURIComponent(part.slice(i + 1));
      if (['select', 'order', 'limit'].includes(k)) return;
      if (v.startsWith('eq.')) rows = rows.filter(r => String(r[k]) === v.slice(3));
    });
    return res(200, JSON.parse(JSON.stringify(rows)));
  };
  const proc = { env: { SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE: KEY } };
  const load = (src, req) => { const mod = { exports: {} };
    new Function('module', 'exports', 'require', 'process', 'fetch', src)(mod, mod.exports, req, proc, fetch); return mod.exports; };
  const feed = load(FEED_SRC, require);
  const layers = load(LAYERS_SRC, n => (/catalog-feed(\.js)?$/.test(n) ? feed : /_catalog_commercial(\.js)?$/.test(n) ? CC : require(n)));
  const call = async (q, headers, method) => {
    const r = await layers.handler({ httpMethod: method || 'GET', queryStringParameters: q || {}, headers: headers || {} });
    let body = null; try { body = JSON.parse(r.body || 'null'); } catch (e) {}
    return Object.assign(r, { json: body });
  };
  return { call, calls, layers };
}

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const noPrices = (r, m) => { const s = JSON.stringify(r.json || {}); PRICE_KEYS.forEach(k => ok(!s.includes('"' + k + '"'), (m || '') + ' leaked ' + k)); };
const BEMIS = Q('bemis');

(async () => {
  await t('anonymous request: 401, no layers, no commercial field', async () => {
    const W = world(); const r = await W.call(BEMIS, {});
    eq(r.statusCode, 401, 'status'); noPrices(r, 'anon'); ok(!W.calls.some(u => /catalog_file_commercial|custom_products|product_overrides/.test(u)), 'no layer read for anon');
  });
  await t('a forged / unknown JWT is anonymous: 401', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer forged' }); eq(r.statusCode, 401); noPrices(r);
  });
  await t('the public anon key is not a credential: 401', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer sb_publishable_x', apikey: 'sb_publishable_x' }); eq(r.statusCode, 401); noPrices(r);
  });
  await t('a pending (unapproved) dealer: 401', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer jwt-pending' }); eq(r.statusCode, 401); noPrices(r);
  });
  await t('a signed-in user who is neither staff nor dealer: 401', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer jwt-nobody' }); eq(r.statusCode, 401); noPrices(r);
  });
  await t('an approved dealer asking for a line they do not carry: 403, nothing read', async () => {
    const W = world(); const r = await W.call(Q('strongback-mobility'), { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 403); noPrices(r); ok(!W.calls.some(u => /catalog_file_commercial|custom_products|product_overrides/.test(u)), 'no layer read');
  });
  await t('an inactive line assignment does not entitle: 403', async () => {
    const r = await world().call(Q('ovation-medical'), { authorization: 'Bearer jwt-dealer' }); eq(r.statusCode, 403); noPrices(r);
  });
  await t('an entitled dealer gets exactly that line\'s layers', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 200, 'status'); eq(r.json.ok, true); eq(r.json.manufacturer, 'bemis');
    eq(r.json.file_overlay, rec('bemis').rows, 'overlay'); eq(r.json.identity_sha256, IDENT('bemis'), 'the version asked for');
    eq(r.json.custom_products.map(c => c.code), ['444DISPLAY'], 'only this line\'s added products');
    eq(r.json.product_overrides.map(c => c.code), ['7Y1'], 'only this line\'s overrides');
    ok(!JSON.stringify(r.json).includes('A1005') && !JSON.stringify(r.json).includes('SB1'), 'no other line leaks in');
  });
  await t('it reads the layers with the exact columns the shop always used', async () => {
    const W = world(); await W.call(BEMIS, { authorization: 'Bearer jwt-dealer' });
    ok(W.calls.some(u => u.includes('custom_products?manufacturer=eq.bemis&select=code,name,category,base_price,msrp,map,image,description,active,tiers,price_note')), 'custom select');
    ok(W.calls.some(u => u.includes('product_overrides?manufacturer=eq.bemis&select=code,patch')), 'override select');
  });
  await t('staff preview = the previewed dealer\'s lines only', async () => {
    const W = world();
    const a = await W.call(Q('strongback-mobility'), { 'x-hcps-preview': 'pv-d2' });
    eq(a.statusCode, 200, 'previewed dealer line'); eq(a.json.custom_products.map(c => c.code), ['A1005']);
    const b = await W.call(BEMIS, { 'x-hcps-preview': 'pv-d2' });
    eq(b.statusCode, 403, 'a line the previewed dealer does not carry'); noPrices(b);
  });
  await t('a preview token wins over a staff JWT sent alongside it (the preview never widens)', async () => {
    const r = await world().call(BEMIS, { 'x-hcps-preview': 'pv-d2', authorization: 'Bearer jwt-boss' }); eq(r.statusCode, 403); noPrices(r);
  });
  await t('an expired or unknown preview token: 401', async () => {
    const W = world();
    eq((await W.call(BEMIS, { 'x-hcps-preview': 'pv-old' })).statusCode, 401, 'expired');
    eq((await W.call(BEMIS, { 'x-hcps-preview': 'nope' })).statusCode, 401, 'unknown');
  });
  await t('an HCPS administrator signed in as staff may verify any line', async () => {
    const r = await world().call(Q('strongback-mobility'), { authorization: 'Bearer jwt-boss' }); eq(r.statusCode, 200);
  });
  await t('other staff roles are refused (they review through a dealer preview)', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer jwt-rep' }); eq(r.statusCode, 403); noPrices(r);
  });
  await t('a deactivated staff login is not staff (and not a dealer): 401', async () => {
    const r = await world().call(BEMIS, { authorization: 'Bearer jwt-gone' }); eq(r.statusCode, 401); noPrices(r);
  });
  for (const tb of ['catalog_file_commercial', 'custom_products', 'product_overrides']) {
    await t(`an unreadable ${tb} fails closed: 503, no partial answer`, async () => {
      const r = await world({ failRead: x => x === tb }).call(BEMIS, { authorization: 'Bearer jwt-dealer' });
      eq(r.statusCode, 503); eq(r.json.error, 'pricing_unavailable'); noPrices(r);
    });
  }
  await t('a line with no commercial record fails closed: 503', async () => {
    const r = await world({ db: { catalog_file_commercial: [] } }).call(BEMIS, { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 503); eq(r.json.error, 'pricing_unavailable'); noPrices(r);
  });
  /* P0 review — version integrity. */
  await t('identity is required: a request without the public file\'s identity is refused (400), nothing read', async () => {
    const W = world();
    for (const q of [{ manufacturer: 'bemis' }, { manufacturer: 'bemis', identity: 'abc' }, { manufacturer: 'bemis', identity: 'A'.repeat(64) }]) {
      const r = await W.call(q, { authorization: 'Bearer jwt-dealer' }); eq(r.statusCode, 400, JSON.stringify(q)); noPrices(r);
    }
    ok(!W.calls.some(u => /catalog_file_commercial/.test(u)), 'nothing read');
  });
  await t('out-of-sync deploy: a public file NEWER than every stored record is not priced (503 catalog_version_not_seeded)', async () => {
    const newer = CC.catalogIdentity([{ code: '7Y1', name: 'Seat (renamed)' }]);
    const r = await world().call({ manufacturer: 'bemis', identity: newer }, { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 503); eq(r.json.reason, 'catalog_version_not_seeded'); noPrices(r);
  });
  await t('out-of-sync deploy: a public file OLDER than the stored record (only the new version seeded) is not priced', async () => {
    const old = [{ code: '7Y1', name: 'Seat (old)', base_price: 1 }], s = CC.splitCatalogFile(old);
    const r = await world().call({ manufacturer: 'bemis', identity: CC.catalogIdentity(s.public) }, { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 503); eq(r.json.reason, 'catalog_version_not_seeded'); noPrices(r);
  });
  await t('two versions side by side (seed-before-deploy): each public file gets exactly its own version', async () => {
    const next = [{ code: '7Y1', name: 'Seat v2', base_price: 13.57 }], s = CC.splitCatalogFile(next), id2 = CC.catalogIdentity(s.public);
    const W = world({ db: { catalog_file_commercial: [rec('bemis'), { manufacturer: 'bemis', identity_sha256: id2, rows: s.overlay }] } });
    const a = await W.call(BEMIS, { authorization: 'Bearer jwt-dealer' });
    const b = await W.call({ manufacturer: 'bemis', identity: id2 }, { authorization: 'Bearer jwt-dealer' });
    eq(a.statusCode, 200); eq(b.statusCode, 200);
    eq(a.json.file_overlay[0].f.base_price, 12.34, 'old file → old version'); eq(b.json.file_overlay[0].f.base_price, 13.57, 'new file → new version');
  });
  await t('a record without row fingerprints (legacy shape) fails closed: 503', async () => {
    const r0 = rec('bemis'); r0.rows = r0.rows.map(o => ({ k: o.k, order: o.order, f: o.f }));
    const r = await world({ db: { catalog_file_commercial: [r0] } }).call(BEMIS, { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 503); noPrices(r);
  });
  await t('a record whose identity does not match its own fingerprints fails closed: 503', async () => {
    const r0 = rec('bemis'); r0.rows[0].h = 'b'.repeat(64);
    const r = await world({ db: { catalog_file_commercial: [r0] } }).call(BEMIS, { authorization: 'Bearer jwt-dealer' });
    eq(r.statusCode, 503); noPrices(r);
  });
  await t('a malformed commercial record fails closed: 503', async () => {
    const W = world({ db: { dealer_manufacturers: [{ dealer_id: 'D1', manufacturer: 'broken-line', active: true }] } });
    const r = await W.call({ manufacturer: 'broken-line', identity: 'a'.repeat(64) }, { authorization: 'Bearer jwt-dealer' }); eq(r.statusCode, 503); noPrices(r);
  });
  await t('an empty (but present) record is a real answer: 200 with no rows', async () => {
    const W = world({ db: { dealer_manufacturers: [{ dealer_id: 'D1', manufacturer: 'ovation-medical', active: true }] } });
    const r = await W.call(Q('ovation-medical'), { authorization: 'Bearer jwt-dealer' }); eq(r.statusCode, 200); eq(r.json.file_overlay, []);
  });
  await t('a slug that is not a slug is refused before any read', async () => {
    const W = world(); const r = await W.call({ manufacturer: 'bemis&select=*', identity: IDENT('bemis') }, { authorization: 'Bearer jwt-boss' });
    eq(r.statusCode, 400); ok(!W.calls.some(u => /catalog_file_commercial/.test(u)), 'nothing read');
  });
  await t('only GET', async () => {
    eq((await world().call(BEMIS, { authorization: 'Bearer jwt-dealer' }, 'POST')).statusCode, 405);
  });
  await t('never cached, varies on the credential, no cross-origin access', async () => {
    for (const h of [{ authorization: 'Bearer jwt-dealer' }, {}]) {
      const r = await world().call(BEMIS, h); const H = r.headers || {};
      ok(/no-store/.test(H['cache-control']) && /private/.test(H['cache-control']), 'cache-control ' + H['cache-control']);
      ok(/Authorization/i.test(H.vary || '') && /X-HCPS-Preview/i.test(H.vary || ''), 'vary');
      ok(!Object.keys(H).some(k => /access-control-allow-origin/i.test(k)), 'no CORS');
    }
  });
  await t('server not configured: 503, never an empty answer', async () => {
    const W = world(); const mod = { exports: {} };
    new Function('module', 'exports', 'require', 'process', 'fetch', LAYERS_SRC)(mod, mod.exports, n => ({ caller: async () => ({ kind: 'staff', role: 'president' }) }), { env: {} }, () => { throw new Error('no'); });
    const r = await mod.exports.handler({ httpMethod: 'GET', queryStringParameters: BEMIS, headers: {} }); eq(r.statusCode, 503);
  });
  console.log(`\np0 catalog-layers: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})();
