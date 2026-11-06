/* Golden ⇄ HCPS Partner 360 — batch B8 browser test (contract 1.9.0): every Golden family ordered in Partner 360 through
   the REAL chain (HCPS golden-proxy + golden-addresses-api → Golden's real /v1 config / quote / orders handlers, in-process,
   synthetic data). Proves, at phone / tablet / desktop:
   • a scooter's order panel shows Golden's colours and accessory panel; Add to cart keeps only the selection;
   • a Passport bed: configuration, delivery (white-glove needs a complete set; rural only with white-glove), Add to cart;
   • checkout prices scooter + accessory + bed with Golden's freight (bed schedule) and S&H, and places ONE Golden order
     holding the portal's own items;
   • an oversized scooter: freight "To be quoted by Golden" (never $0) — the order can't be verified until the dealer ticks
     the freight box; the placed order tells Golden's desk; no horizontal scroll; touch targets ≥ 44px; no page errors.
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… HCPS_REPO=… node test/golden-b8.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const HCPS = process.env.HCPS_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SHOTS = process.env.SHOTS || '/tmp/golden-b8-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://hcpsonlineordering.netlify.app';
const gFN = path.join(GOLDEN, 'repo', 'functions'), hFN = path.join(HCPS, 'netlify', 'functions');
for (const f of [path.join(gFN, 'lib', 'golden-shipto.js'), path.join(hFN, 'golden-addresses-api.js'), path.join(HCPS, 'test', 'golden-b7-world.js')]) if (!fs.existsSync(f)) { console.log('skip  golden b7 browser: ' + f + ' not checked out'); process.exit(process.env.CI ? 1 : 0); }
if (!fs.existsSync(path.join(gFN, 'lib', 'golden-mobility.js'))) { console.log('skip  golden b8 browser: Golden B8 not checked out'); process.exit(process.env.CI ? 1 : 0); }

const C = require(path.join(gFN, 'lib', 'golden-catalog.js'));
const DATA = require(path.join(gFN, 'lib', 'golden-catalog-data.json'));
const products = C.buildCatalog({ data: DATA, merch: {}, pricing: [{ sku: 'PR511-LAR', dealer_cost: 1140 }], seePrices: true });
const { createMock } = require(path.join(GOLDEN, 'repo', 'tests', 'support', 'postgrest-mock.js'));
const gS = require(path.join(gFN, 'lib', 'hcps-s2s.js'));
const HW = require(path.join(HCPS, 'test', 'golden-b7-world.js'));
const PROD_SECRET = crypto.randomBytes(32).toString('hex');
const W = { recs: new Map(), orders: [], nextId: 1700, goldenBodies: [], mail: [], hcps: null };
// Golden's SQL contract (config/migrate-hcps-integration-v1-submit.sql), mirrored: records per key AND mode; one order per key.
const rk = (p, m) => p.idempotency_key + '|' + m;
const valOk = (v, p) => v && v.s === 'done' && v.st === 200 && v.resp.valid === true && v.h === p.validate_hash;
const idemRpc = {
  integration_order_claim: ({ p }) => { const k = rk(p, 'validate'), r = W.recs.get(k); if (!r) { const tok = crypto.randomUUID(); W.recs.set(k, { h: p.request_hash, s: 'pending', tok }); return { state: 'new', claim_token: tok }; }
    if (r.h !== p.request_hash) return { state: 'conflict' }; if (r.s === 'done') return { state: 'replay', status: r.st, response: r.resp }; return { state: 'in_progress' }; },
  integration_order_complete: ({ p }) => { const r = W.recs.get(rk(p, 'validate')); if (!r || r.tok !== p.claim_token) throw new Error('no pending claim'); r.s = 'done'; r.st = p.status; r.resp = p.response; return true; },
  integration_order_release: ({ p }) => { W.recs.delete(rk(p, 'validate')); return true; },
  integration_order_submit_find: ({ p }) => { const s = W.recs.get(rk(p, 'submit')); return s ? { found: true, request_hash: s.h, hcps_dealer_id: s.d, hcps_branch_id: s.b, golden_dealer_id: s.g,
    status: s.st, response: s.resp, order_id: s.oid == null ? null : s.oid, email_open: false } : { found: false }; },
  integration_order_submit_lookup: ({ p }) => { const s = W.recs.get(rk(p, 'submit')); if (s) return s.h !== p.request_hash ? { state: 'conflict' } : { state: 'replay', status: s.st, response: s.resp, order_id: s.oid, email_open: false };
    const v = W.recs.get(rk(p, 'validate')); return valOk(v, p) ? { state: 'validated', po_number: v.resp.order.po_number, po_auto: v.resp.order.po_auto } : { state: 'not_validated' }; },
  integration_order_submit: ({ p }) => { const k = rk(p, 'submit'), s = W.recs.get(k);
    if (s) return s.h !== p.request_hash ? { state: 'conflict' } : { state: 'replay', status: s.st, response: s.resp, order_id: s.oid };
    if (!valOk(W.recs.get(rk(p, 'validate')), p)) return { state: 'not_validated' };
    const ident = { d: p.hcps_dealer_id, b: p.hcps_branch_id || null, g: p.golden_dealer_id };
    if (p.refusal) { W.recs.set(k, Object.assign({ h: p.request_hash, st: p.refusal.status, resp: p.refusal.response }, ident)); return { state: 'refused', status: p.refusal.status, response: p.refusal.response }; }
    const id = W.nextId++; W.orders.push(Object.assign({}, p.order_row, { id, status: 'pending', order_source: 'online', created_at: new Date().toISOString(), sales_order_no: null }));
    const resp = Object.assign({}, p.response, { order_ref: 'P' + id, status: 'submitted', placed_at: new Date().toISOString() });
    W.recs.set(k, Object.assign({ h: p.request_hash, st: 201, resp, oid: id }, ident)); return { state: 'created', status: 201, response: resp, order_id: id, email_claim: crypto.randomUUID() }; },
  integration_order_email_claim: () => null, integration_order_email_done: () => true,
};
const fresh = (dir, m) => { Object.keys(require.cache).forEach(k => { if (k.startsWith(dir)) delete require.cache[k]; }); return require(path.join(dir, m)); };
function setEnv() {
  for (const k of ['P360_ORDER_ENV', 'CONTEXT', 'GOLDEN_API_BASE']) delete process.env[k];
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE: 'svc', SUPABASE_SERVICE_KEY: 'svc', GOLDEN_P360_KEY_ID: 'hcps-p360-1', GOLDEN_P360_SECRET: PROD_SECRET,
    GOLDEN_V1_API: 'true', GOLDEN_V1_ORDERS: 'true', P360_ACCOUNT_LINKS: 'true', P360_HCPS_SHIPTO: 'true', RESEND_API_KEY: 're_test', P360_TEST_DEALERS: 'dealer-riverbend', P360_TEST_EMAIL_TO: 'angelo@homecareproviderservices.us',
    HCPS_P360_KEYS: JSON.stringify({ 'hcps-p360-1': PROD_SECRET }), ORDER_EMAIL_TO: 'desk@golden.example', ORDER_EMAIL_FROM: 'portal@golden.example' });
}
let chain = Promise.resolve();
function runHcps(mod, body, headers) {   // serialised: the in-process fetch world is global
  const job = chain.then(async () => {
    setEnv();
    const goldenSb = createMock({ tables: {
      integration_clients: [{ kid: 'hcps-p360-1', client_id: 'hcps-partner360', tenant_id: 'hcps', scopes: ['golden:read', 'golden:order', 'golden:history'], active: true, secret_fingerprint: gS.fingerprint(PROD_SECRET) }],
      // Golden has a verified link ONLY for HQ1; the dealer signs in at HQ2 (another HCPS head office, same Golden number).
      dealer_integration_map: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', tenant_id: 'hcps', client_id: 'hcps-partner360', hcps_dealer_id: HW.HQ1, golden_dealer_id: 'dealer-riverbend', status: 'verified', price_visibility: 'dealer', golden_ordering_enabled: true, history_enabled: true }],
      dealer_integration_branch_map: [], dealers: [{ id: 'dealer-riverbend', active: true, customer_no: 'T90100', multi_location_enabled: false }], dealer_branches: [],
      dealer_ship_locations: [], dealer_locations: [], orders: W.orders, golden_orders: [], golden_order_items: [], order_links: [],
      dealer_special_terms: [{ customer_no: 'T90100', waive_service_handling: true, waive_liftgate: false, free_freight_unit_min: null, qualifying_cities: [{ city: 'Somerset', state: 'KY' }], active: true }],
      inventory: [{ sku: 'PR511-LAR', size: 'LAR', fabcode: 'SKN', color_code: 'SUM', avail: 4, pool: null }, { sku: 'GC340-STD-BL2', size: null, fabcode: null, color_code: 'BL2', avail: 9, pool: null }],
    }, rpc: Object.assign({
      integration_nonce_claim: () => true, integration_audit_log: () => null,
      get_dealer_portal_data: () => ({ dealer: { dealer_id: 'dealer-riverbend', name: 'Riverbend Medical', customer_no: 'T90100', terms: 'Net 30' }, pricing: [{ sku: 'PR511-LAR', dealer_cost: 1140 }] }),
    }, idemRpc) });
    const handlers = { '/v1/quote': fresh(gFN, 'v1-quote.js').handler, '/v1/orders': fresh(gFN, 'v1-orders.js').handler, '/v1/config': fresh(gFN, 'v1-config.js').handler };
    const fn = fresh(hFN, mod);
    const sb = HW.rest(W.hcps, W.hcpsWrites);
    const res = (status, b) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) });
    const saved = global.fetch;
    global.fetch = async (u, init) => {
      u = String(u); init = init || {};
      if (/api\.resend\.com/.test(u)) { W.mail.push(JSON.parse(init.body)); return res(200, { id: 're_1' }); }
      if (u.startsWith('https://goldenonlineordering.netlify.app/')) {
        const url = new URL(u); if (init.body) W.goldenBodies.push({ path: url.pathname, body: JSON.parse(init.body), deleg: JSON.parse(Buffer.from(init.headers['x-hcps-delegation'], 'base64url').toString('utf8')) });
        if (!handlers[url.pathname]) return res(404, {});
        const ev = { httpMethod: init.method, rawUrl: u, path: url.pathname, headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), queryStringParameters: Object.fromEntries(url.searchParams), body: init.body || '', isBase64Encoded: false };
        const outer = global.fetch; global.fetch = (x, y) => /api\.resend\.com/.test(String(x)) ? outer(x, y) : goldenSb(String(x).replace('https://sb.test', 'http://sb.test'), y);
        process.env.SUPABASE_URL = 'http://sb.test';
        try { const r = await handlers[url.pathname](ev); return res(r.statusCode, JSON.parse(r.body)); }
        finally { global.fetch = outer; process.env.SUPABASE_URL = 'https://sb.test'; }
      }
      if (/auth\/v1\/user/.test(u)) return res(200, { id: 'uid-1' });
      return sb(u, init);
    };
    try { const r = await fn.handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) }); return JSON.parse(r.body); }
    finally { global.fetch = saved; }
  });
  chain = job.catch(() => null);
  return job;
}
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 500)); } }

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
  page.on('dialog', d => d.accept());
  await ctx.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === HOST) {
      let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    const H = { 'access-control-allow-origin': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
    if (/\/functions\/dealer-auth/.test(u.pathname) && req.method() === 'POST')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: HW.HQ2, name: 'Riverbend Health LLC (DBA)', email: 'buyer@example.invalid', phone: '859-555-0100', contact_name: 'Pat Buyer' }, lines: [], access: { your_accounts: [], available: [], golden: 'Account' }, prices: {} }) });
    const hdr = await req.allHeaders(); const fh = { authorization: hdr.authorization || '', 'x-hcps-preview': hdr['x-hcps-preview'] || '', origin: hdr.origin || HOST };
    if (/\/functions\/golden-addresses-api/.test(u.pathname)) {
      const out = await runHcps('golden-addresses-api.js', JSON.parse(req.postData() || '{}'), fh);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(out) });
    }
    if (/\/functions\/golden-proxy/.test(u.pathname)) {
      const b = JSON.parse(req.postData() || '{}');
      if (['quote', 'validate_order', 'place_order', 'config'].includes(b.action)) {
        if (fh['x-hcps-golden-env']) throw new Error('production path expected');
        const out = await runHcps('golden-proxy.js', b, fh);
        return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(out) });
      }
      const base = { ok: true, enabled: true, available: true };
      const ans = b.action === 'eligibility' ? Object.assign(base, { state: 'account', capabilities: { see_prices: true, order: true, history: true } })
        : b.action === 'catalog' ? Object.assign(base, { prices_visible: true, linked: true, products })
        : b.action === 'history' ? Object.assign(base, { prices_visible: true, orders: [], next_before: null })
        : Object.assign(base, C.inventorySummary({ data: DATA, merch: {}, rows: [] }));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(ans) });
    }
    if (/^(fonts\.(googleapis|gstatic)\.com)$/.test(u.host)) return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '[]' });
  });
  await page.goto(HOST + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => { CONFIG.GOLDEN_ENABLED = true; CONFIG.GOLDEN_CHECKOUT_ENABLED = true; CONFIG.GOLDEN_ORDERING_ENABLED = true; window.__PREVIEW__ = null; AUTH.session = { access_token: 'jwt-b7-test' }; AUTH.dealer = { id: 'x', contact_name: 'Pat Buyer', phone: '859-555-0100', email: '' }; try { localStorage.clear(); } catch (e) {} await goldenInit(); });
  return { ctx, page, errs };
}
const geo = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  small: [...document.querySelectorAll('#gckView button, #gckView input:not([type=checkbox]):not([type=radio]), #gckView label.gck-ship')].filter(e => e.offsetParent !== null).map(e => [e.getAttribute('data-bk-def') ? 'def' : e.getAttribute('data-bk-edit') ? 'edit' : e.getAttribute('data-bk-rm') ? 'rm' : (e.className || e.tagName), Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44) }));
const shipped = () => W.goldenBodies.filter(x => x.body.ship_to).map(x => x.body.ship_to.hcps);

const gmGeo = (page, sel) => page.evaluate(s => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  small: [...document.querySelectorAll(s + ' button, ' + s + ' input.qtyin, ' + s + ' summary')].filter(e => e.offsetParent !== null && !e.disabled).map(e => [e.textContent.trim().slice(0, 20) || e.getAttribute('data-gaccq') || 'input', Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44) }), sel);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      W.recs.clear(); W.orders.length = 0; W.goldenBodies.length = 0; W.mail.length = 0; W.nextId = 1700; W.hcpsWrites = [];
      W.hcps = HW.db({ dealerId: HW.HQ2, defaults: [{ user_uid: 'uid-1', account_no: 'T90100', ref: `loc:${HW.HQ1}` }] });
      const { ctx, page, errs } = await boot(browser, w, h);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} GCART.items = []; gckChanged(); });
      await page.evaluate(() => selectManufacturer(CONFIG.GOLDEN_SLUG));
      await page.waitForSelector('.gcard', { timeout: 20000 });
      await t(`${label}: scooter cards say nothing about "Browse only"`, async () => {
        const v = await page.evaluate(() => ({ n: document.querySelectorAll('.gcard').length, browse: [...document.querySelectorAll('.gcard')].filter(c => /Browse only/.test(c.innerText)).length }));
        ok(v.n > 0 && v.browse === 0, JSON.stringify(v));
      });
      await t(`${label}: scooter order panel — Golden's colours + accessories; Add to cart keeps only the selection`, async () => {
        await page.evaluate(() => openProductDetail('GC340E'));
        await page.waitForSelector('#gmob [data-gmcol]', { timeout: 15000 });
        await page.click('#gmob [data-gmcol="BL2"]');
        await page.waitForFunction(() => /In stock|Low stock/.test(document.querySelector('#gmob').innerText), null, { timeout: 5000 });
        await page.click('#gmob [data-gmadd]');
        await page.click('#gmob .gacc > summary');
        await page.fill('#gmob [data-gaccq="MBA-RBASK"]', '2');
        await page.click('#gmob [data-gacc="MBA-RBASK"]');
        const v = await page.evaluate(() => ({ items: GCART.items.map(i => [i.kind, i.sku, i.color || i.for || null, i.qty]), badge: document.getElementById('cartCount').textContent }));
        ok(JSON.stringify(v.items) === JSON.stringify([['mobility', 'GC340E', 'BL2', 1], ['accessory', 'MBA-RBASK', 'GC340E', 2]]), JSON.stringify(v));
        ok(v.badge === '3', 'header count ' + v.badge);
        const g = await gmGeo(page, '#gmob'); ok(g.sw <= g.cw && !g.small.length, JSON.stringify(g));
        await page.screenshot({ path: path.join(SHOTS, label + '-1-scooter.png'), fullPage: false });
      });
      await t(`${label}: Passport bed — white-glove only with a complete set, rural only with white-glove; Add to cart`, async () => {
        await page.evaluate(() => openProductDetail('BD100A-QB'));
        await page.waitForSelector('#gmob [data-gbcfg]', { timeout: 15000 });
        await page.click('#gmob [data-gbcfg="base"]');
        ok(await page.evaluate(() => document.querySelector('#gmob [data-gbdlv="wg"]').disabled), 'white-glove disabled for a base only');
        await page.click('#gmob [data-gbcfg="set"]'); await page.click('#gmob [data-gbdlv="curbside"]');
        ok(!(await page.$('#gmob [data-gbrural]')), 'no rural option without white-glove');
        await page.click('#gmob [data-gmadd]');
        const v = await page.evaluate(() => GCART.items.map(i => [i.kind, i.sku, i.config || null, i.delivery || null]));
        ok(JSON.stringify(v[2]) === JSON.stringify(['bed', 'BD100A-QB', 'set', 'curbside']), JSON.stringify(v));
      });
      await t(`${label}: checkout prices scooter + accessory + bed with Golden's freight and S&H, and places ONE Golden order`, async () => {
        await page.evaluate(() => goldenCartShow());
        await page.waitForFunction(() => GCART.quote && !GCART.busy, null, { timeout: 20000 });
        const q = await page.evaluate(() => ({ lines: GCART.quote.lines.map(l => [l.kind, l.sku]), fq: GCART.quote.totals.freight_quote_required === true, frt: GCART.quote.totals.freight_total, txt: document.getElementById('gckView').innerText }));
        ok(JSON.stringify(q.lines) === JSON.stringify([['mobility', 'GC340E'], ['accessory', 'MBA-RBASK'], ['bed', 'BD100A-QB']]) && !q.fq && q.frt > 0, JSON.stringify(q).slice(0, 300));
        ok(/Your Golden items/.test(q.txt), 'items wording');
        await page.fill('[data-f="name"]', 'Pat Buyer'); await page.fill('[data-f="phone"]', '859-555-0100');
        await page.waitForFunction(() => GCART.result && GCART.result.valid === true && !GCART.busy && !GCART.auto, null, { timeout: 20000 });
        await page.waitForSelector('[data-gck-place]', { timeout: 10000 });
        await page.click('[data-gck-place]');
        await page.waitForSelector('.gck-done', { timeout: 15000 });
        ok(W.orders.length === 1, 'one order');
        const o = W.orders[0];
        ok(JSON.stringify(o.items.map(i => i.sku)) === JSON.stringify(['GC340E', 'MBA-RBASK', 'BD100A-QB']) && o.items[2].isBed === true && o.items[0].colorName === 'Blue', JSON.stringify(o.items).slice(0, 400));
        ok(!/FREIGHT TO BE QUOTED/.test(o.notes || ''), 'no freight-quote note');
        ok(o.freight_total === q.frt, 'stored freight = reviewed freight');
        const g = await geo(page); ok(g.sw <= g.cw, JSON.stringify(g));
      });
      await t(`${label}: oversized scooter — freight "To be quoted by Golden", never $0; tick the freight box, then verify + place`, async () => {
        await page.evaluate(() => { GCART.placed = null; goldenCartClose(); GCART.items = []; gckChanged(); openProductDetail('GA541D'); });
        await page.waitForSelector('#gmob [data-gmcol]', { timeout: 15000 });
        await page.click('#gmob [data-gmadd]');
        await page.evaluate(() => goldenCartShow());
        await page.waitForFunction(() => GCART.quote && !GCART.busy, null, { timeout: 20000 });
        await page.fill('[data-f="name"]', 'Pat Buyer'); await page.fill('[data-f="phone"]', '859-555-0100');
        await page.waitForTimeout(1800);
        const a = await page.evaluate(() => ({ txt: document.getElementById('gckView').innerText, result: !!GCART.result, box: !!document.querySelector('[data-gck-fq]') }));
        ok(a.box && !a.result, 'not verified before the acknowledgement: ' + JSON.stringify(a).slice(0, 200));
        ok(/To be quoted by Golden/.test(a.txt) && !/Freight\s*\n?\s*\$0\.00/.test(a.txt) && !/Free — Golden pays/.test(a.txt), a.txt.slice(0, 600));
        await page.screenshot({ path: path.join(SHOTS, label + '-2-freight-quote.png'), fullPage: false });
        await page.check('[data-gck-fq]');
        await page.waitForFunction(() => GCART.result && GCART.result.valid === true && !GCART.busy && !GCART.auto, null, { timeout: 20000 });
        await page.waitForSelector('[data-gck-place]', { timeout: 10000 });
        ok(/freight quoted by Golden/.test(await page.innerText('[data-gck-place]')), 'place button names the pending freight');
        await page.click('[data-gck-place]');
        await page.waitForSelector('.gck-done', { timeout: 15000 });
        ok(W.orders.length === 2 && /^FREIGHT TO BE QUOTED BY GOLDEN/.test(W.orders[1].notes || ''), 'the order desk is told: ' + (W.orders[1] && W.orders[1].notes));
        ok(/To be quoted by Golden/.test(await page.innerText('.gck-done')), 'the confirmation says freight is to be quoted');
        const g = await geo(page); ok(g.sw <= g.cw, JSON.stringify(g));
      });
      await t(`${label}: no page errors`, async () => { ok(!errs.length, errs.join(' | ')); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
