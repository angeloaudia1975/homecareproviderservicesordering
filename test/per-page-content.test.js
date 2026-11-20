/* Per-page content (2026-11-16). Runs the REAL mergeCatalogEdits lifted from the shop page with Supabase and the
   static content file answered by stubs. A visible database page wins for its page_key / SKUs / variant groups; every
   other visible static page of the line still fills in; a line with no visible database page reads its static file
   exactly as before. */
const fs = require('fs'), path = require('path');
const withLayers = require('./_layers.js');
const SRC = process.argv[2] || process.env.SHOP || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(SRC, 'utf8');
const a1 = html.indexOf('/* Pure. The same rule as images-api.js'), a1b = html.indexOf('async function mergeCatalogEdits(slug, prods){');
const start = a1 >= 0 ? a1 : a1b, end = html.indexOf('async function loadProducts(slug){');
const c1 = html.indexOf('const COLOR_SUFFIX='), c2 = html.indexOf('/* ---------- render tabs');
const body = html.slice(start, end) + '\n' + html.slice(c1, c2);
function shop(tables, staticFile, opt) {
  const L = withLayers(tables);
  const f = new Function('fetch', 'window', 'console', 'document',
    `const CONFIG={SUPABASE_URL:'https://db.test',SUPABASE_ANON:'anon',CONTENT_APPROVED_ONLY:true};
     const state={manufacturers:[{slug:'L'}]}; const AUTH={session:{access_token:'dealer-token'},status:'approved'}; const PREVIEW=null;
     ${body}
     return {mergeCatalogEdits};`);
  const fetchStub = async (url) => {
    const la = L.answer(url); if (la) return la;
    if (/\/data\/content\/L\.json/.test(String(url))) {
      if (opt && opt.staticFails) throw new Error('network');
      if (staticFile == null) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(staticFile)) };
    }
    const m = /rest\/v1\/([a-z_]+)\?/.exec(String(url)); const t = m && m[1];
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify((tables || {})[t] || [])) };
  };
  const S = f(fetchStub, {}, { warn() {}, log() {} }, {}); return { mergeCatalogEdits: L.wrap(S.mergeCatalogEdits) };
}
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
const pg = (k, skus, x) => Object.assign({ page_key: k, status: 'published', name: k, skus, image: null, images_gallery: [] }, x || {});
const cat = () => ['A1', 'A2', 'K1', 'S1', 'S2', 'S3', 'V1', 'H1', 'D1', 'D2', 'Z9'].map(c => ({ code: c, name: c, description: 'CATALOG ' + c, base_price: 1 }));
const STATIC = { pages: {
  a: pg('a', [{ sku: 'K1' }], { description: 'STATIC A' }),                         // same page_key as a DB page (even with other SKUs) → DB wins
  s1: pg('s1', [{ sku: 'S1' }], { description: 'STATIC S1' }),                       // untouched static page → still shown
  s2: pg('s2', [{ sku: 'S2' }, { sku: 'A2' }], { description: 'STATIC S2' }),        // shares SKU A2 with a DB page → left out WHOLE
  s3: pg('s3', [{ sku: 'S3' }], { description: 'STATIC S3', variant_group: 'grpX' }), // shares a variant group with a DB page → left out
  h: pg('h', [{ sku: 'H1' }], { description: 'STATIC HIDDEN', status: 'hidden' }),   // not visible → never added
  off: pg('off', [{ sku: 'Z9' }], { description: 'STATIC OFF', disabled: true }),    // switched off → never added
  d: pg('d', [{ sku: 'D1' }, { sku: 'D2', disabled: true }], { description: 'STATIC D' }), // its own switched-off SKU still hides
} };
const DB = { product_content: [pg('a', [{ sku: 'A1' }, { sku: 'A2' }], { description: 'DB A' }), pg('v', [{ sku: 'V1' }], { description: 'DB V', variant_group: 'grpX|grpY' })] };
(async () => {
  const by = async (t, s, o) => Object.fromEntries((await shop(t, s, o).mergeCatalogEdits('L', cat())).map(p => [p.code, p]));
  const m = await by(DB, STATIC);
  ok(m.A1.description === 'DB A' && m.A2.description === 'DB A', 'a database page wins for its page_key and its SKUs');
  ok(m.K1.description === 'CATALOG K1', 'a static page with the same page_key as a database page is left out');
  ok(m.S1.description === 'STATIC S1', 'an untouched static page still fills in when another page of the line is in the database');
  ok(m.S2.description === 'CATALOG S2', 'a static page sharing a SKU with a database page is left out whole (never half-merged)');
  ok(m.S3.description === 'CATALOG S3', 'a static page sharing a variant group with a database page is left out');
  ok(m.V1.description === 'DB V', 'the database variant page keeps its SKU');
  ok(m.H1.description === 'CATALOG H1', 'a static page that is not visible is never added');
  ok(m.Z9.description === 'CATALOG Z9', 'a switched-off static page is never added');
  ok(m.D1 && m.D1.description === 'STATIC D' && !m.D2, 'a filled-in static page keeps its own switched-off SKU hidden');
  // no visible database page → exactly the static file, as before
  const s = await by({ product_content: [] }, STATIC);
  ok(s.K1.description === 'STATIC A' && s.S2.description === 'STATIC S2' && s.S3.description === 'STATIC S3', 'a line with no database page reads its static file as before');
  // static file missing / unreadable → database pages only, as before
  const n = await by(DB, null); const f2 = await by(DB, STATIC, { staticFails: true });
  ok(n.S1.description === 'CATALOG S1' && n.A1.description === 'DB A', 'no static file → database pages only, as before');
  ok(f2.S1.description === 'CATALOG S1' && f2.A1.description === 'DB A', 'an unreadable static file never breaks the database pages');
  // commercial data untouched by content: same price fields on every product
  ok(Object.values(m).every(p => Number(p.base_price) === 1), 'content merging never changes a price');
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASS'); process.exit(fail ? 1 : 0);
})();
