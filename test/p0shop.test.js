/* P0 (2026-10-23, issue #2) — the storefront side. Runs the REAL engine lifted from the shop page
   (mergeCatalogEdits → restore → layers → applyMasterPrices, unitPrice) and the REAL Business Hub
   price list loaders (public/index.html and public/dashboard.html), with the network answered by a
   stub that records every request.
   Usage: node test/p0shop.test.js [index.html] [dashboard.html] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SHOP = process.argv[2] || process.env.SHOP || path.join(ROOT, 'public', 'index.html');
const HUB = process.argv[3] || process.env.HUB || path.join(ROOT, 'public', 'dashboard.html');
const html = fs.readFileSync(SHOP, 'utf8'), hubHtml = fs.readFileSync(HUB, 'utf8');
const { engine } = require('./_engine.js');
const CC = require(path.join(ROOT, 'netlify', 'functions', '_catalog_commercial.js'));

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const copy = v => JSON.parse(JSON.stringify(v));

const FULL = [
  { manufacturer: 'L', code: 'A1', name: 'Alpha', group: 'G', base_price: 10, tiers: [{ min_qty: 3, price: 8 }], msrp: 25, map: 19.5, price_note: 'MAP $19.50' },
  { manufacturer: 'L', code: 'A2', name: 'Beta', group: 'G', base_price: 10, tiers: [{ min_qty: 3, price: 8 }], msrp: 25 },
  { manufacturer: 'L', code: 'H1', name: 'Hidden by an edit', base_price: 5 },
];
const SPLIT = CC.splitCatalogFile(FULL);
const IDENT = CC.catalogIdentity(SPLIT.public);
const LAYERS = () => ({ ok: true, manufacturer: 'L', identity_sha256: IDENT, file_overlay: copy(SPLIT.overlay),
  custom_products: [{ code: 'ADD1', name: 'Added', base_price: 30, active: true }],
  product_overrides: [{ code: 'H1', patch: { active: false } }, { code: 'A2', patch: { base_price: 11 } }] });

function net(over) {
  const calls = [];
  const f = async (url, opts) => {
    const u = String(url); calls.push({ url: u, headers: (opts && opts.headers) || {}, cache: opts && opts.cache });
    if (u.startsWith('/.netlify/functions/catalog-layers')) {
      if (over && over.layersStatus) return { ok: false, status: over.layersStatus, json: async () => ({ error: 'x' }) };
      if (over && over.layersThrow) throw new Error('network down');
      return { ok: true, status: 200, json: async () => (over && over.layers ? over.layers() : LAYERS()) };
    }
    if (u.startsWith('/.netlify/functions/catalog-feed')) return { ok: true, status: 200, json: async () => ({ migrated: false, skus: [] }) };
    if (/rest\/v1\//.test(u)) return { ok: true, status: 200, json: async () => [] };
    throw new Error('unexpected fetch ' + u);
  };
  return { f, calls };
}
const signedIn = { session: { access_token: 'tok-1' }, status: 'approved' };
const commercialRest = c => c.some(x => /rest\/v1\/(custom_products|product_overrides|catalog_file_commercial)/.test(x.url));

(async () => {
  await t('anonymous: nothing is listed, catalog-layers is not even asked, no legacy layer is read', async () => {
    const N = net(); const E = engine(html, { fetch: N.f });
    const out = await E.mergeCatalogEdits('L', copy(SPLIT.public));
    eq(out, [], 'products'); ok(!N.calls.some(c => /catalog-layers/.test(c.url)), 'layers asked'); ok(!commercialRest(N.calls), 'legacy layer read');
    eq(E.CATALOG_SOURCE.L.source, 'unavailable', 'source');
  });
  await t('signed-in dealer: layers asked with the dealer token, never cached, and never the public tables', async () => {
    const N = net(); const E = engine(html, { fetch: N.f, auth: signedIn });
    await E.mergeCatalogEdits('L', copy(SPLIT.public));
    const c = N.calls.find(x => /catalog-layers\?manufacturer=L&identity=[0-9a-f]{64}$/.test(x.url));
    ok(c, 'layers asked'); eq(c.headers.authorization, 'Bearer tok-1', 'token'); ok(!('x-hcps-preview' in c.headers), 'no preview header'); eq(c.cache, 'no-store', 'cache');
    ok(!commercialRest(N.calls), 'the public key never reads custom_products / product_overrides');
  });
  await t('staff preview: the preview token travels, no Authorization header', async () => {
    const N = net(); const E = engine(html, { fetch: N.f, auth: { session: null, status: 'approved' }, preview: { token: 'pv-9' } });
    const out = await E.mergeCatalogEdits('L', copy(SPLIT.public));
    const c = N.calls.find(x => /catalog-layers/.test(x.url)); eq(c.headers['x-hcps-preview'], 'pv-9'); ok(!c.headers.authorization, 'no auth'); ok(out.length > 0, 'listed');
  });
  await t('the dealer sees exactly the commercial facts the layers carry', async () => {
    const N = net(); const E = engine(html, { fetch: N.f, auth: signedIn });
    const by = Object.fromEntries((await E.mergeCatalogEdits('L', copy(SPLIT.public))).map(p => [p.code, p]));
    eq([by.A1.base_price, by.A1.msrp, by.A1.map, by.A1.tiers], [10, 25, 19.5, [{ min_qty: 3, price: 8 }]], 'A1');
    eq(by.A2.base_price, 11, 'a saved edit applies'); ok(!by.H1, 'a hidden product stays hidden'); eq(by.ADD1.base_price, 30, 'added product');
    eq(E.unitPrice(by.A1, 3), 8, 'quantity break from the overlay');
  });
  await t('a stale price still sitting in a public file is never used — the overlay wins', async () => {
    const pub = copy(SPLIT.public); pub[0].base_price = 1; pub[0].tiers = [{ min_qty: 1, price: 0.5 }]; pub[0].dealer_price = 0.1;
    const N = net(); const E = engine(html, { fetch: N.f, auth: signedIn });
    const a1 = (await E.mergeCatalogEdits('L', pub)).find(p => p.code === 'A1');
    eq(a1.base_price, 10); eq(a1.tiers, [{ min_qty: 3, price: 8 }]); ok(!('dealer_price' in a1), 'stale field dropped');
  });
  for (const [label, over] of [['403 (not entitled)', { layersStatus: 403 }], ['401', { layersStatus: 401 }], ['503 (pricing unavailable)', { layersStatus: 503 }],
                               ['a network failure', { layersThrow: true }], ['an answer without its layers', { layers: () => ({ ok: true, file_overlay: [] }) }],
                               ['ok:false', { layers: () => Object.assign(LAYERS(), { ok: false }) }],
                               ['an answer missing the added products', { layers: () => { const l = LAYERS(); delete l.custom_products; return l; } }],
                               ['an answer missing the saved edits', { layers: () => { const l = LAYERS(); delete l.product_overrides; return l; } }],
                               ['an overlay out of step with the public file', { layers: () => Object.assign(LAYERS(), { file_overlay: SPLIT.overlay.slice(1) }) }]]) {
    await t(`fails closed on ${label}: nothing listed, no price from anywhere else`, async () => {
      const N = net(over); const E = engine(html, { fetch: N.f, auth: signedIn });
      eq(await E.mergeCatalogEdits('L', copy(SPLIT.public)), [], 'products');
      eq(E.CATALOG_SOURCE.L.source, 'unavailable'); ok(!commercialRest(N.calls), 'fell back to a public table');
    });
  }
  await t('the catalog page says pricing could not be loaded (never "coming soon") when the line failed closed', async () => {
    const i = html.indexOf('function renderProducts(){'); const body = html.slice(i, html.indexOf('renderNextBatch();', i));
    ok(/_cs\.source==='unavailable'/.test(body) && /Pricing could not be loaded/.test(body), 'message');
  });
  /* P0 review — version integrity in the browser. */
  await t('the shop asks for the version of the EXACT public file it loaded (its identity)', async () => {
    const N = net(); const E = engine(html, { fetch: N.f, auth: signedIn });
    await E.mergeCatalogEdits('L', copy(SPLIT.public));
    const c = N.calls.find(x => /catalog-layers/.test(x.url)); ok(c && c.url.endsWith('&identity=' + IDENT), 'identity sent: ' + (c && c.url));
  });
  for (const [why, over, file] of [
    ['an answer for another version of the file', { layers: () => Object.assign(LAYERS(), { identity_sha256: 'e'.repeat(64) }) }],
    ['an answer with no identity', { layers: () => { const l = LAYERS(); delete l.identity_sha256; return l; } }],
    ['swapped duplicate-code rows in the public file', null, () => { const p = copy(SPLIT.public); p[1].code = 'A1'; p[0].code = 'A1'; return p; }],
    ['a public row changed since the record (same code, same count)', null, () => { const p = copy(SPLIT.public); p[0].name = 'Alpha (new)'; return p; }],
    ['an overlay entry without its fingerprint', { layers: () => { const l = LAYERS(); delete l.file_overlay[0].h; return l; } }]]) {
    await t(`fails closed on ${why}: nothing listed, no price`, async () => {
      const N = net(over || {}); const E = engine(html, { fetch: N.f, auth: signedIn });
      const p = file ? file() : copy(SPLIT.public);
      const l0 = file ? Object.assign(LAYERS(), { identity_sha256: CC.catalogIdentity(p) }) : null;
      const N2 = file ? net({ layers: () => l0 }) : N, E2 = file ? engine(html, { fetch: N2.f, auth: signedIn }) : E;
      const out = await E2.mergeCatalogEdits('L', p);
      eq(out, [], 'products'); eq(E2.CATALOG_SOURCE.L.source, 'unavailable', 'source');
    });
  }
  await t('nothing in the shop page reads custom_products or product_overrides with the public key any more', async () => {
    ok(!/rest\/v1\/custom_products/.test(html) && !/rest\/v1\/product_overrides/.test(html), 'a public read remains');
    ok(!/rest\/v1\/custom_products|rest\/v1\/product_overrides/.test(hubHtml), 'Business Hub still reads them');
  });

  /* ---- Business Hub price list (both pages) ---- */
  for (const [label, src, lift] of [
    ['shop page Business Hub', html, s => s.slice(s.indexOf('const CATALOG_COMMERCIAL_KEYS='), s.indexOf('\n}\n', s.indexOf('function restoreCatalogFile(')) + 3)
                                         + s.slice(s.indexOf('/* The credential catalog-layers accepts'), s.indexOf('function retailUnit('))],
    ['dashboard.html', hubHtml, s => s.slice(s.indexOf('const CATALOG_COMMERCIAL_KEYS='), s.indexOf('function retailUnit('))]]) {
    const run = async ({ session, preview, lines, layersStatus, layers }) => {
      const calls = [];
      const files = { 'manufacturers.json': [{ slug: 'L', name: 'Line L', hasData: true }, { slug: 'M', name: 'Line M', hasData: true }],
                      'L.json': copy(SPLIT.public), 'M.json': [{ manufacturer: 'M', code: 'M1', name: 'Other line', base_price: 77, msrp: 154 }] };
      const fetch = async (url, opts) => { const u = String(url); calls.push({ url: u, headers: (opts && opts.headers) || {} });
        if (u.startsWith('/data/')) return { ok: true, status: 200, json: async () => copy(files[u.slice(6)]) };
        if (u.startsWith('/.netlify/functions/catalog-layers')) return layersStatus ? { ok: false, status: layersStatus, json: async () => ({}) } : { ok: true, status: 200, json: async () => (layers ? layers() : LAYERS()) };
        throw new Error('unexpected ' + u); };
      const window = { __PREVIEW__: preview || null };
      const f = new Function('fetch', 'window', 'SESSION', 'LINES', 'refreshIfNeeded',
        'let PRICE=null, PRICELIST=null, MFRLIST=[];\n' + lift(src) + '\n;return (async()=>{ await loadPricing(); return {PRICE, PRICELIST}; })();');
      const r = await f(fetch, window, session || null, lines || [], async () => {});
      return Object.assign(r, { calls });
    };
    await t(`${label}: a carried line is priced from catalog-layers with the dealer token`, async () => {
      const r = await run({ session: { access_token: 'tok-1' }, lines: [{ slug: 'L' }] });
      eq([r.PRICE['L|A1'].cost, r.PRICE['L|A1'].map, r.PRICE['L|A1'].msrp], [10, 19.5, 25], 'A1');
      const c = r.calls.find(x => /catalog-layers\?manufacturer=L&identity=[0-9a-f]{64}$/.test(x.url)); eq(c && c.headers.authorization, 'Bearer tok-1');
    });
    await t(`${label}: a line the dealer does not carry lists names only — no price, and its layers are never asked for`, async () => {
      const r = await run({ session: { access_token: 'tok-1' }, lines: [{ slug: 'L' }] });
      eq([r.PRICE['M|M1'].cost, r.PRICE['M|M1'].map, r.PRICE['M|M1'].msrp], [null, null, null], 'M1 (even a stale public price is dropped)');
      ok(!r.calls.some(x => /catalog-layers\?manufacturer=M/.test(x.url)), 'asked for M');
    });
    await t(`${label}: pricing that cannot be loaded lists names only`, async () => {
      const r = await run({ session: { access_token: 'tok-1' }, lines: [{ slug: 'L' }], layersStatus: 503 });
      eq(r.PRICE['L|A1'].cost, null); eq(r.PRICE['L|A1'].name, 'Alpha');
    });
    await t(`${label}: an answer for another version of the file, or a fingerprint mismatch, lists names only`, async () => {
      for (const layers of [() => Object.assign(LAYERS(), { identity_sha256: 'e'.repeat(64) }),
                            () => { const l = LAYERS(); l.file_overlay[0].h = l.file_overlay[1].h; return l; }]) {
        const r = await run({ session: { access_token: 'tok-1' }, lines: [{ slug: 'L' }], layers });
        eq(r.PRICE['L|A1'].cost, null, 'priced'); eq(r.PRICE['L|A1'].msrp, null); eq(r.PRICE['L|A1'].name, 'Alpha');
      }
      const r = await run({ session: { access_token: 'tok-1' }, lines: [{ slug: 'L' }] });
      ok(r.calls.some(x => x.url.endsWith('&identity=' + IDENT)), 'identity of the loaded file sent');
    });
    await t(`${label}: signed out, nothing is priced and nothing is asked`, async () => {
      const r = await run({ lines: [{ slug: 'L' }] });
      ok(r.PRICELIST.every(p => p.cost == null && p.msrp == null && p.map == null), 'priced'); ok(!r.calls.some(x => /catalog-layers/.test(x.url)), 'asked');
    });
  }
  await t('shop page Business Hub: a staff preview prices the previewed dealer\'s lines with the preview token', async () => {
    const lift = s => s.slice(s.indexOf('const CATALOG_COMMERCIAL_KEYS='), s.indexOf('\n}\n', s.indexOf('function restoreCatalogFile(')) + 3)
                      + s.slice(s.indexOf('/* The credential catalog-layers accepts'), s.indexOf('function retailUnit('));
    const calls = [];
    const fetch = async (url, opts) => { const u = String(url); calls.push({ url: u, headers: (opts && opts.headers) || {} });
      if (u === '/data/manufacturers.json') return { ok: true, json: async () => [{ slug: 'L', name: 'L', hasData: true }] };
      if (u === '/data/L.json') return { ok: true, json: async () => copy(SPLIT.public) };
      return { ok: true, status: 200, json: async () => LAYERS() }; };
    const f = new Function('fetch', 'window', 'SESSION', 'LINES', 'refreshIfNeeded', 'let PRICE=null, PRICELIST=null, MFRLIST=[];\n' + lift(html) + '\n;return (async()=>{ await loadPricing(); return PRICE; })();');
    const P = await f(fetch, { __PREVIEW__: { token: 'pv-1' } }, null, [{ slug: 'L' }], async () => {});
    const c = calls.find(x => /catalog-layers/.test(x.url)); eq(c.headers['x-hcps-preview'], 'pv-1'); ok(!c.headers.authorization, 'auth sent'); eq(P['L|A1'].cost, 10);
  });
  console.log(`\np0 storefront: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})();
