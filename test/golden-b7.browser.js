/* Golden ⇄ Partner 360 — B7 SHIPPING (owner directive 2026-11-05), browser walkthrough of the REAL storefront page
   (public/index.html) on the PRODUCTION path, as a REAL dealer sign-in. Every call runs the REAL chain in-process:
   this page → HCPS golden-addresses-api + golden-proxy (HCPS_REPO, account gate + address book switched on) → signed
   request (delegation acct) → Golden's real /v1/quote and /v1/orders handlers (GOLDEN_REPO, P360_ACCOUNT_LINKS +
   P360_HCPS_SHIPTO on) over synthetic databases. Nothing reaches HCPS, Golden, Supabase or an email provider.
   The dealer is a SEPARATE HCPS head office (HQ2) carrying the same Golden number as HQ1 — Golden has a verified link
   only for HQ1, so prices / ordering prove the account-number rule. Checks at 390 / 768 / 1280 px:
   • the shared book lists every location of the account + its saved addresses; the user's default is pre-selected and
     priced automatically; Golden prices S&H on the ACTUAL city (waived for the qualifying city, not for another);
   • "Add a new shipping address" validates, saves (no approval), selects it and prices it at once;
   • Make default / Remove work; a removed default forces a new choice;
   • placing sends ONE order whose address is the reviewed one; HCPS never sent a browser-typed address to Golden;
   • no horizontal scroll; touch targets ≥ 44px; no page errors.
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… HCPS_REPO=… node test/golden-b7.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const HCPS = process.env.HCPS_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SHOTS = process.env.SHOTS || '/tmp/golden-b7-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://hcpsonlineordering.netlify.app';
const gFN = path.join(GOLDEN, 'repo', 'functions'), hFN = path.join(HCPS, 'netlify', 'functions');
for (const f of [path.join(gFN, 'lib', 'golden-shipto.js'), path.join(hFN, 'golden-addresses-api.js'), path.join(HCPS, 'test', 'golden-b7-world.js')]) if (!fs.existsSync(f)) { console.log('skip  golden b7 browser: ' + f + ' not checked out'); process.exit(process.env.CI ? 1 : 0); }
if (!fs.readFileSync(path.join(gFN, 'lib', 'golden-shipto.js'), 'utf8').includes('hcpsShipTo')) { console.log('skip  golden b7 browser: Golden B7 not checked out'); process.exit(process.env.CI ? 1 : 0); }

const C = require(path.join(gFN, 'lib', 'golden-catalog.js'));
const DATA = require(path.join(gFN, 'lib', 'golden-catalog-data.json'));
const products = C.buildCatalog({ data: DATA, merch: {}, pricing: [{ sku: 'PR511-LAR', dealer_cost: 1188 }], seePrices: true });
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
    GOLDEN_V1_API: 'true', GOLDEN_V1_ORDERS: 'true', P360_ACCOUNT_LINKS: 'true', P360_HCPS_SHIPTO: 'true', RESEND_API_KEY: 're_test', P360_TEST_DEALERS: 'dealer-vann', P360_TEST_EMAIL_TO: 'angelo@homecareproviderservices.us',
    HCPS_P360_KEYS: JSON.stringify({ 'hcps-p360-1': PROD_SECRET }), ORDER_EMAIL_TO: 'desk@golden.example', ORDER_EMAIL_FROM: 'portal@golden.example' });
}
let chain = Promise.resolve();
function runHcps(mod, body, headers) {   // serialised: the in-process fetch world is global
  const job = chain.then(async () => {
    setEnv();
    const goldenSb = createMock({ tables: {
      integration_clients: [{ kid: 'hcps-p360-1', client_id: 'hcps-partner360', tenant_id: 'hcps', scopes: ['golden:read', 'golden:order', 'golden:history'], active: true, secret_fingerprint: gS.fingerprint(PROD_SECRET) }],
      // Golden has a verified link ONLY for HQ1; the dealer signs in at HQ2 (another HCPS head office, same Golden number).
      dealer_integration_map: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', tenant_id: 'hcps', client_id: 'hcps-partner360', hcps_dealer_id: HW.HQ1, golden_dealer_id: 'dealer-vann', status: 'verified', price_visibility: 'dealer', golden_ordering_enabled: true, history_enabled: true }],
      dealer_integration_branch_map: [], dealers: [{ id: 'dealer-vann', active: true, customer_no: '190100', multi_location_enabled: false }], dealer_branches: [],
      dealer_ship_locations: [], dealer_locations: [], orders: W.orders, golden_orders: [], golden_order_items: [], order_links: [],
      dealer_special_terms: [{ customer_no: '190100', waive_service_handling: true, waive_liftgate: false, free_freight_unit_min: null, qualifying_cities: [{ city: 'Somerset', state: 'KY' }], active: true }],
      inventory: [{ sku: 'PR511-LAR', size: 'LAR', fabcode: 'SKN', color_code: 'SUM', avail: 4, pool: null }],
    }, rpc: Object.assign({
      integration_nonce_claim: () => true, integration_audit_log: () => null,
      get_dealer_portal_data: () => ({ dealer: { dealer_id: 'dealer-vann', name: 'Vann Healthcare', customer_no: '190100', terms: 'Net 30' }, pricing: [{ sku: 'PR511-LAR', dealer_cost: 1188 }] }),
    }, idemRpc) });
    const handlers = { '/v1/quote': fresh(gFN, 'v1-quote.js').handler, '/v1/orders': fresh(gFN, 'v1-orders.js').handler };
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: HW.HQ2, name: 'Vann Medical LLC (DBA)', email: 'buyer@example.invalid', phone: '859-555-0100', contact_name: 'Pat Buyer' }, lines: [], access: { your_accounts: [], available: [], golden: 'Account' }, prices: {} }) });
    const hdr = await req.allHeaders(); const fh = { authorization: hdr.authorization || '', 'x-hcps-preview': hdr['x-hcps-preview'] || '', origin: hdr.origin || HOST };
    if (/\/functions\/golden-addresses-api/.test(u.pathname)) {
      const out = await runHcps('golden-addresses-api.js', JSON.parse(req.postData() || '{}'), fh);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(out) });
    }
    if (/\/functions\/golden-proxy/.test(u.pathname)) {
      const b = JSON.parse(req.postData() || '{}');
      if (['quote', 'validate_order', 'place_order'].includes(b.action)) {
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

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      W.recs.clear(); W.orders.length = 0; W.goldenBodies.length = 0; W.mail.length = 0; W.nextId = 1700; W.hcpsWrites = [];
      W.hcps = HW.db({ dealerId: HW.HQ2, defaults: [{ user_uid: 'uid-1', account_no: '190100', ref: `loc:${HW.HQ1}` }] });
      const { ctx, page, errs } = await boot(browser, w, h);
      await t(`${label}: the shared book lists the account's locations + saved addresses; my default is selected and priced (S&H waived in Somerset)`, async () => {
        await page.evaluate(() => { GCART.items = []; goldenCartAdd('PR511-LAR', { fabric: 'std', color: 'SUM', tier: 'nirvana', footrest: false }, null); goldenCartShow(); });
        await page.waitForSelector('.gck-ship', { timeout: 15000 });
        await page.waitForFunction(() => GCART.quote && !GCART.busy, null, { timeout: 15000 });
        const v = await page.evaluate(() => ({ refs: GCART.shipList.map(s => s.id), ship: GCART.ship, def: !!document.querySelector('.gck-def'), text: document.querySelector('.gck-ships').innerText, waived: GCART.quote.totals.sh_waived }));
        ok(v.refs.length === 5 && v.ship === v.refs.find(r => r.startsWith('loc:00000001')), JSON.stringify(v));
        ok(/Vann — London/.test(v.text) && /Mrs\. Patient Home/.test(v.text) && !/Atlanta|Corbin/.test(v.text), v.text);
        ok(v.def && v.waived === true, 'default badge + Golden waived S&H for the qualifying city');
        const d = W.goldenBodies[W.goldenBodies.length - 1].deleg;
        ok(d.acct === '190100' && d.sub_dealer === HW.HQ2, JSON.stringify(d));
        await page.screenshot({ path: path.join(SHOTS, label + '-1-book.png'), fullPage: false });
      });
      await t(`${label}: choosing another location re-prices it on that city (no waiver in London)`, async () => {
        await page.check(`.gck-ship input[value="loc:${HW.BR1}"]`);
        await page.waitForFunction(() => GCART.quote && !GCART.busy && GCART.ship.includes('00000002'), null, { timeout: 15000 });
        ok(await page.evaluate(() => GCART.quote.totals.sh_waived === false && GCART.quote.totals.sh_total > 0), 'London pays S&H');
      });
      await t(`${label}: add a new address — validated, saved without approval, selected and priced at once`, async () => {
        await page.click('[data-bk-new]');
        await page.fill('[data-af="name"]', 'John Doe Residence'); await page.fill('[data-af="address"]', '12 River Rd');
        await page.fill('[data-af="city"]', 'Somerset'); await page.fill('[data-af="state"]', 'K'); await page.fill('[data-af="zip"]', '42501');
        await page.click('[data-bk-save]');
        await page.waitForSelector('.gck-af [role=alert]', { timeout: 10000 });
        ok(/2-letter state/.test(await page.innerText('.gck-af [role=alert]')), 'state error shown, nothing saved');
        ok(W.hcps.golden_ship_addresses.length === 3, 'nothing saved yet');
        await page.fill('[data-af="state"]', 'ky'); await page.fill('[data-af="phone"]', '606-555-0199'); await page.check('[data-af="make_default"]');
        await page.click('[data-bk-save]');
        await page.waitForFunction(() => !GCART.af && GCART.ship && GCART.ship.startsWith('gs:') && GCART.quote && !GCART.busy, null, { timeout: 15000 });
        const row = W.hcps.golden_ship_addresses[3];
        ok(row && row.account_no === '190100' && row.state === 'KY' && row.created_dealer === HW.HQ2, JSON.stringify(row));
        ok(W.hcpsWrites.every(x => /^golden_ship_(addresses|defaults)$/.test(x.table)), 'only the address tables are written');
        const last = shipped().pop(); ok(last.name === 'John Doe Residence' && last.city === 'Somerset' && last.phone === '606-555-0199', JSON.stringify(last));
        ok(await page.evaluate(() => GCART.quote.totals.sh_waived === true && GCART.bookDefault === GCART.ship), 'priced on the real city; my new default');
        const g = await geo(page); ok(g.sw <= g.cw && !g.small.length, JSON.stringify(g));
        await page.screenshot({ path: path.join(SHOTS, label + '-2-added.png'), fullPage: false });
      });
      await t(`${label}: validate + place — one order, the reviewed address, Golden's own order number`, async () => {
        await page.fill('[data-f="name"]', 'Pat Buyer'); await page.fill('[data-f="phone"]', '859-555-0100');
        await page.waitForFunction(() => GCART.result && GCART.result.valid === true && !GCART.busy && !GCART.auto, null, { timeout: 20000 });
        await page.waitForSelector('[data-gck-place]', { timeout: 10000 });
        await page.evaluate(() => { const b = document.querySelector('[data-gck-place]'); b.click(); b.click(); });
        await page.waitForSelector('.gck-done', { timeout: 15000 });
        ok(W.orders.length === 1, 'one order: ' + W.orders.length);
        const o = W.orders[0]; ok(o.ship_address === '12 River Rd' && o.ship_city === 'Somerset' && o.ship_state === 'KY' && o.attention === 'John Doe Residence' && /Delivery phone: 606-555-0199/.test(o.notes || ''), JSON.stringify(o));
        ok(/P1700/.test(await page.innerText('.gck-done')), 'Golden order number shown');
        ok(shipped().every(a => a && a.ref), 'every address Golden received came from HCPS records (a ref)');
      });
      await t(`${label}: remove my default → it leaves the book; the next checkout asks me to choose`, async () => {
        await page.evaluate(() => { GCART.placed = null; goldenCartClose(); GCART.items = []; goldenCartAdd('PR511-LAR', { fabric: 'std', color: 'SUM', tier: 'nirvana', footrest: false }, null); GCART.shipList = null; GCART.ship = null; goldenCartShow(); });
        await page.waitForSelector('[data-bk-rm]', { timeout: 15000 });
        const ref = await page.evaluate(() => GCART.bookDefault);
        await page.click(`[data-bk-rm="${ref}"]`);
        await page.waitForFunction(r => GCART.shipList && !GCART.shipList.some(s => s.id === r), ref, { timeout: 15000 });
        const v = await page.evaluate(() => ({ ship: GCART.ship, stale: !!document.querySelector('.gck-warn') && /no longer available/.test(document.getElementById('gckView').innerText), quote: !!GCART.quote }));
        ok(v.ship === null && v.stale && !v.quote, JSON.stringify(v));
        ok(!!W.hcps.golden_ship_addresses[3].removed_at, 'kept, marked removed');
      });
      await t(`${label}: no page errors`, async () => { ok(!errs.length, errs.join(' | ')); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
