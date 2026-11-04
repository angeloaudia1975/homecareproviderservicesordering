/* Golden ⇄ Partner 360 — B6 PLACE ORDER, browser walkthrough of the REAL storefront page (public/index.html) on a
   deploy-preview address, as a REAL dealer sign-in of a TEST dealership (the only sign-in golden-proxy lets place orders
   in Golden's preview environment). Every Golden call runs the REAL chain in-process: this page → HCPS golden-proxy
   (HCPS_REPO) → signed request → Golden's real /v1/ship-to, /v1/quote and /v1/orders (validate + submit) handlers
   (GOLDEN_REPO) over a synthetic Golden database whose placement is the atomic SQL contract (one order per key, mirrored).
   Golden runs in TEST mode: its two emails go only to the controlled test mailbox. Nothing reaches Golden, HCPS, Supabase
   or an email provider.
   Checks at 390 / 768 / 1280 px: the Place order button appears only after a valid validation; one click (double-click
   proof) places ONE order with the SAME Idempotency-Key as the validation; the confirmation shows Golden's order number;
   the cart empties only after Golden confirms; a lost answer keeps the attempt PENDING (frozen, survives a reload) and
   "Check again" repeats the SAME key → Golden's first answer, still one order; a price change at placement places
   nothing; the order shows once in My Orders; no HCPS order call; no horizontal scroll; touch targets ≥ 44px.
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… HCPS_REPO=… node test/golden-b6.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const HCPS = process.env.HCPS_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SHOTS = process.env.SHOTS || '/tmp/golden-b6-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://deploy-preview-99--hcpsonlineordering.netlify.app';
const gFN = path.join(GOLDEN, 'repo', 'functions'), hFN = path.join(HCPS, 'netlify', 'functions');
for (const f of [path.join(gFN, 'lib', 'golden-order-notify.js'), path.join(hFN, 'golden-proxy.js')]) if (!fs.existsSync(f)) { console.log('skip  golden b6 browser: ' + f + ' not checked out'); process.exit(process.env.CI ? 1 : 0); }

const C = require(path.join(gFN, 'lib', 'golden-catalog.js'));
const DATA = require(path.join(gFN, 'lib', 'golden-catalog-data.json'));
const PRICING = () => [{ sku: 'PR511-LAR', dealer_cost: W.cost }];
const products = C.buildCatalog({ data: DATA, merch: {}, pricing: [{ sku: 'PR511-LAR', dealer_cost: 1188 }], seePrices: true });

const { createMock } = require(path.join(GOLDEN, 'repo', 'tests', 'support', 'postgrest-mock.js'));
const gS = require(path.join(gFN, 'lib', 'hcps-s2s.js'));
const TEST_SECRET = crypto.randomBytes(32).toString('hex'), PROD_SECRET = crypto.randomBytes(32).toString('hex');
const D_HQ = '11111111-2222-4333-8444-555555555555', LOC_CIN = 'cccccccc-0000-4000-8000-000000000001';
const TEST_BOX = 'angelo@homecareproviderservices.us';
const W = { cost: 1188, recs: new Map(), orders: [], nextId: 1661, goldenCalls: [], hcpsWrites: 0, mail: [], dropNextPlace: 0, delayPlace: 0 };
// Golden's SQL contract (config/migrate-hcps-integration-v1-submit.sql), mirrored: records per key AND mode; one order per key.
const rk = (p, m) => p.idempotency_key + '|' + m;
const valOk = (v, p) => v && v.s === 'done' && v.st === 200 && v.resp.valid === true && v.h === p.validate_hash;
const idemRpc = {
  integration_order_claim: ({ p }) => { const k = rk(p, 'validate'), r = W.recs.get(k); if (!r) { const tok = crypto.randomUUID(); W.recs.set(k, { h: p.request_hash, s: 'pending', tok }); return { state: 'new', claim_token: tok }; }
    if (r.h !== p.request_hash) return { state: 'conflict' }; if (r.s === 'done') return { state: 'replay', status: r.st, response: r.resp }; return { state: 'in_progress' }; },
  integration_order_complete: ({ p }) => { const r = W.recs.get(rk(p, 'validate')); if (!r || r.tok !== p.claim_token) throw new Error('no pending claim'); r.s = 'done'; r.st = p.status; r.resp = p.response; return true; },
  integration_order_release: ({ p }) => { W.recs.delete(rk(p, 'validate')); return true; },
  integration_order_submit_lookup: ({ p }) => { const s = W.recs.get(rk(p, 'submit')); if (s) return s.h !== p.request_hash ? { state: 'conflict' } : { state: 'replay', status: s.st, response: s.resp, order_id: s.oid, email_open: false };
    const v = W.recs.get(rk(p, 'validate')); return valOk(v, p) ? { state: 'validated', po_number: v.resp.order.po_number, po_auto: v.resp.order.po_auto } : { state: 'not_validated' }; },
  integration_order_submit: ({ p }) => { const k = rk(p, 'submit'), s = W.recs.get(k);
    if (s) return s.h !== p.request_hash ? { state: 'conflict' } : { state: 'replay', status: s.st, response: s.resp, order_id: s.oid };
    if (!valOk(W.recs.get(rk(p, 'validate')), p)) return { state: 'not_validated' };
    if (p.refusal) { W.recs.set(k, { h: p.request_hash, st: p.refusal.status, resp: p.refusal.response }); return { state: 'refused', status: p.refusal.status, response: p.refusal.response }; }
    const id = W.nextId++; W.orders.push(Object.assign({}, p.order_row, { id, status: 'pending', order_source: 'online', created_at: new Date().toISOString(), sales_order_no: null }));
    const resp = Object.assign({}, p.response, { order_ref: 'P' + id, status: 'submitted', placed_at: new Date().toISOString() });
    W.recs.set(k, { h: p.request_hash, st: 201, resp, oid: id }); return { state: 'created', status: 201, response: resp, order_id: id, email_claim: crypto.randomUUID() }; },
  integration_order_email_claim: () => null, integration_order_email_done: () => true,
};
const fresh = (dir, m) => { Object.keys(require.cache).forEach(k => { if (k.startsWith(dir)) delete require.cache[k]; }); return require(path.join(dir, m)); };
function setEnv() {
  for (const k of ['P360_ORDER_ENV', 'CONTEXT']) delete process.env[k];
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE: 'svc', SUPABASE_SERVICE_KEY: 'svc', GOLDEN_P360_KEY_ID: 'hcps-p360-1', GOLDEN_P360_SECRET: PROD_SECRET,
    GOLDEN_P360_TEST_KEY_ID: 'hcps-p360-test-1', GOLDEN_P360_TEST_SECRET: TEST_SECRET, GOLDEN_TEST_API_BASE: 'https://deploy-preview-284--goldenonlineordering.netlify.app',
    GOLDEN_V1_API: 'true', GOLDEN_V1_ORDERS: 'true', P360_TEST_DEALERS: 'dealer-synth', P360_TEST_EMAIL_TO: TEST_BOX, RESEND_API_KEY: 're_test',
    HCPS_P360_KEYS: JSON.stringify({ 'hcps-p360-test-1': TEST_SECRET }), ORDER_EMAIL_TO: 'desk@golden.example', ORDER_EMAIL_FROM: 'portal@golden.example' });
}
let chain = Promise.resolve();
function runProxy(body, headers) {   // serialised: the in-process fetch world is global
  const job = chain.then(async () => {
    setEnv();
    const goldenSb = createMock({ tables: {
      integration_clients: [{ kid: 'hcps-p360-test-1', client_id: 'hcps-partner360', tenant_id: 'hcps', scopes: ['golden:read', 'golden:order', 'golden:history'], active: true, secret_fingerprint: gS.fingerprint(TEST_SECRET) }],
      dealer_integration_map: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', tenant_id: 'hcps', client_id: 'hcps-partner360', hcps_dealer_id: D_HQ, golden_dealer_id: 'dealer-synth', status: 'verified', price_visibility: 'dealer', golden_ordering_enabled: true, history_enabled: true }],
      dealer_integration_branch_map: [], dealers: [{ id: 'dealer-synth', active: true, customer_no: '900001' }], dealer_branches: [],
      dealer_ship_locations: [{ id: LOC_CIN, dealer_id: 'dealer-synth', label: 'Cincinnati showroom', ship_address: '1 Main St', ship_city: 'Cincinnati', ship_state: 'OH', ship_zip: '45202', created_at: '2026-01-01' }],
      dealer_locations: [], dealer_special_terms: [], orders: W.orders, golden_orders: [], golden_order_items: [], order_links: [],
      inventory: [{ sku: 'PR511-LAR', size: 'LAR', fabcode: 'SKN', color_code: 'SUM', avail: 4, pool: null }],
    }, rpc: Object.assign({
      integration_nonce_claim: () => true, integration_audit_log: () => null,
      get_dealer_portal_data: () => ({ dealer: { dealer_id: 'dealer-synth', name: 'Synthetic Test Dealer', customer_no: '900001', terms: 'Net 30' }, pricing: PRICING() }),
    }, idemRpc) });
    const handlers = { '/v1/quote': fresh(gFN, 'v1-quote.js').handler, '/v1/ship-to': fresh(gFN, 'v1-ship-to.js').handler, '/v1/orders': fresh(gFN, 'v1-orders.js').handler, '/v1/history': fresh(gFN, 'v1-history.js').handler };
    const proxy = fresh(hFN, 'golden-proxy.js');
    const res = (status, b) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) });
    const saved = global.fetch;
    global.fetch = async (u, init) => {
      u = String(u); init = init || {};
      if (/api\.resend\.com/.test(u)) { W.mail.push(JSON.parse(init.body)); return res(200, { id: 're_1' }); }
      if (/sendgrid|mailgun|smtp|graph\.microsoft/.test(u)) throw new Error('no other email path');
      if (u.startsWith('https://deploy-preview-284--goldenonlineordering.netlify.app/')) {
        const url = new URL(u); W.goldenCalls.push({ path: url.pathname, key: init.headers && init.headers['Idempotency-Key'], mode: init.body ? JSON.parse(init.body).mode : null });
        const ev = { httpMethod: init.method, rawUrl: u, path: url.pathname, headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), queryStringParameters: Object.fromEntries(url.searchParams), body: init.body || '', isBase64Encoded: false };
        const outer = global.fetch; global.fetch = (x, y) => /api\.resend\.com/.test(String(x)) ? outer(x, y) : goldenSb(String(x).replace('https://sb.test', 'http://sb.test'), y);
        process.env.SUPABASE_URL = 'http://sb.test';
        try { const r = await handlers[url.pathname](ev); return res(r.statusCode, JSON.parse(r.body)); }
        finally { global.fetch = outer; process.env.SUPABASE_URL = 'https://sb.test'; }
      }
      if (/auth\/v1\/user/.test(u)) return res(200, { id: 'uid-b6' });
      if (/dealer_users/.test(u)) return res(200, [{ status: 'approved', dealer_id: D_HQ }]);
      if (/app_settings/.test(u)) return res(200, [{ value: { golden_p360_preview_orders: true } }]);
      if (/dealers\?id=eq\./.test(u)) return res(200, [{ id: D_HQ, parent_id: null, is_test: true }]);
      if ((init.method || 'GET') !== 'GET') { W.hcpsWrites++; throw new Error('HCPS must store nothing'); }
      return res(200, []);
    };
    try { const r = await proxy.handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) }); return JSON.parse(r.body); }
    finally { global.fetch = saved; }
  });
  chain = job.catch(() => null);
  return job;
}

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }
const shot = async (page, name) => { await page.evaluate(() => { const ov = document.getElementById('gckView'); ov.dataset.st = ov.getAttribute('style') || ''; ov.style.position = 'absolute'; ov.style.bottom = 'auto'; ov.style.minHeight = '0'; ov.style.overflow = 'visible'; document.body.classList.remove('gck-lock'); window.scrollTo(0, 0); });
  await page.waitForTimeout(250); const hh = await page.evaluate(() => Math.ceil(document.getElementById('gckView').getBoundingClientRect().height));
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true, clip: { x: 0, y: 0, width: page.viewportSize().width, height: hh } });
  await page.evaluate(() => { const ov = document.getElementById('gckView'); ov.setAttribute('style', ov.dataset.st); document.body.classList.add('gck-lock'); }); };
const txt = (page, sel) => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
  const counts = { orders: 0, placeCalls: 0 };
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === HOST) {
      let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (/\/functions\/(orders-api|submit-order)/.test(u.pathname) && req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); if (/create|preview_order/.test(String(b.action)) || /submit-order/.test(u.pathname)) counts.orders++; }
    if (/\/functions\/dealer-auth/.test(u.pathname) && req.method() === 'POST')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: 'd-test', name: 'TEST — Golden Sandbox', email: 'sandbox@example.invalid', phone: '937-555-0100', contact_name: 'Pat Tester' }, lines: [], access: { your_accounts: [], available: [], golden: 'None' }, prices: {} }) });
    if (/\/functions\/golden-proxy/.test(u.pathname)) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
      const b = JSON.parse(req.postData() || '{}'), H = { 'access-control-allow-origin': '*' };
      if (['ship_to', 'quote', 'validate_order', 'place_order', 'history'].includes(b.action)) {
        const hdr = await req.allHeaders();
        if (b.action === 'place_order') counts.placeCalls++;
        if (b.action === 'place_order' && W.delayPlace) await new Promise(r => setTimeout(r, W.delayPlace));
        const out = await runProxy(b, { authorization: hdr.authorization || '', 'x-hcps-preview': hdr['x-hcps-preview'] || '', 'x-hcps-golden-env': hdr['x-hcps-golden-env'] || '', origin: hdr.origin || HOST });
        if (b.action === 'place_order' && W.dropNextPlace > 0) { W.dropNextPlace--; return route.abort('connectionreset'); }   // Golden placed it; the answer was lost
        return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(out) });
      }
      const base = { ok: true, enabled: true, available: true, preview: true };
      const ans = b.action === 'eligibility' ? Object.assign(base, { state: 'account', capabilities: { see_prices: true, order: true, history: true } })
        : b.action === 'catalog' ? Object.assign(base, { prices_visible: true, linked: true, products })
        : Object.assign(base, C.inventorySummary({ data: DATA, merch: {}, rows: [] }));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(ans) });
    }
    if (/^(fonts\.(googleapis|gstatic)\.com)$/.test(u.host)) return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  });
  await page.goto(HOST + '/?preview=' + 'ab12'.repeat(12), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  // Become a REAL dealer sign-in (bearer token) of the TEST dealership — the only sign-in allowed to place in preview.
  await page.evaluate(async () => { window.__PREVIEW__ = null; AUTH.session = { access_token: 'jwt-b6-test' }; try { localStorage.clear(); } catch (e) {} await goldenInit(); });
  return { ctx, page, errs, counts };
}
async function toValidated(page, po) {
  await page.evaluate(() => { GCART.items = []; goldenCartAdd('PR511-LAR', { fabric: 'std', color: 'SUM', tier: 'nirvana', footrest: false }, null); goldenCartShow(); });
  await page.waitForSelector('.gck-ship', { timeout: 15000 });
  await page.check(`.gck-ship input[value="${LOC_CIN}"]`);
  if (!(await page.$('.gck-tot'))) await page.click('[data-gck-quote]');   // a single ship-to is chosen for the dealer: ask for Golden's price
  try { await page.waitForSelector('.gck-tot', { timeout: 15000 }); } catch (e) { console.log('DEBUG cart:', await page.evaluate(() => [GCART.err, JSON.stringify(GCART.items), document.getElementById('gckView').innerText.slice(0, 600)])); throw e; }
  await page.fill('[data-f="po"]', po); await page.fill('[data-f="name"]', 'Pat Tester'); await page.fill('[data-f="phone"]', '937-555-0100');
  await page.click('[data-gck-validate]'); await page.waitForSelector('.gck-ok', { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      Object.assign(W, { cost: 1188, dropNextPlace: 0, delayPlace: 0 }); W.recs.clear(); W.orders.length = 0; W.goldenCalls.length = 0; W.mail.length = 0; W.nextId = 1661;
      const { ctx, page, errs, counts } = await boot(browser, w, h);
      await toValidated(page, 'PO-B6-1');
      const v = await page.evaluate(() => ({ btn: !!document.querySelector('[data-gck-place]'), test: /Test mode/.test(document.querySelector('.gck-ok').innerText), orders: GCART.result && GCART.result.ordering_enabled }));
      await t(`${label}: after a valid validation Golden says ordering is on → "Place order with Golden" + test-mode note`, () => ok(v.btn && v.test && v.orders === true, JSON.stringify(v)));
      await shot(page, `golden-place-ready-${label}.png`);
      // double-click: one placement call, frozen while Golden answers
      W.delayPlace = 1200;
      await page.evaluate(() => { const b = document.querySelector('[data-gck-place]'); b.click(); b.click(); });
      await page.waitForTimeout(300);
      const frozen = await page.evaluate(() => ({ busy: GCART.busy, pending: !!GCART.pending, recheck: (document.querySelector('[data-gck-recheck]') || {}).disabled }));
      await page.waitForSelector('.gck-done', { timeout: 20000 }); W.delayPlace = 0;
      const done = await page.evaluate(() => ({ text: document.querySelector('.gck-done').innerText, items: GCART.items.length, stored: localStorage.getItem(gckStoreKey()), pend: localStorage.getItem(gckPendKey()), placed: GCART.placed && GCART.placed.order_ref }));
      const keys = W.goldenCalls.filter(c => c.path === '/v1/orders');
      await t(`${label}: one click (double-click proof) → ONE place_order call; frozen while Golden answers`, () => ok(counts.placeCalls === 1 && frozen.busy && frozen.pending, JSON.stringify({ c: counts.placeCalls, frozen })));
      await t(`${label}: placement uses the SAME Idempotency-Key as the validation; Golden placed ONE order`, () => {
        ok(keys.length === 2 && keys[0].mode === 'validate' && keys[1].mode === 'submit' && keys[0].key === keys[1].key, JSON.stringify(keys)); ok(W.orders.length === 1, 'orders ' + W.orders.length); });
      await t(`${label}: confirmation shows Golden's order number, PO and TEST note; cart emptied only now; nothing pending`, () => {
        ok(/Order placed with Golden/.test(done.text) && /P1661/.test(done.text) && /PO-B6-1/.test(done.text) && /TEST order/.test(done.text), done.text.slice(0, 300));
        ok(done.items === 0 && done.stored === '[]' && done.pend === null && done.placed === 'P1661', JSON.stringify(done)); });
      await t(`${label}: Golden's emails went ONLY to the test mailbox, marked TEST — never the order desk or the dealer`, () => {
        ok(W.mail.length === 2 && W.mail.every(m => m.to.length === 1 && m.to[0] === TEST_BOX && /^\[TEST/.test(m.subject)), JSON.stringify(W.mail.map(m => [m.to, m.subject]))); });
      await shot(page, `golden-placed-${label}.png`);
      const geo = async () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        small: [...document.querySelectorAll('.gck-box button, .gck-box input:not([type=radio]), .gck-box textarea, .gck-box summary')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).map(b => b.className || b.tagName) }));
      const g1 = await geo();
      await t(`${label}: confirmation — no horizontal scroll, touch targets ≥ 44px`, () => { ok(g1.sw <= g1.cw + 1, JSON.stringify(g1)); ok(!g1.small.length, 'small: ' + g1.small.join(',')); });
      // My Orders shows the Golden order once
      await page.click('[data-gck-myorders]');
      await page.waitForFunction(() => /P1661/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 20000 });
      const hist = await page.evaluate(() => (document.getElementById('goldenHist').innerText.match(/P1661/g) || []).length);
      await t(`${label}: My Orders lists Golden's order P1661 (once) at once — before any sales order`, () => ok(hist >= 1 && W.orders.length === 1, 'mentions ' + hist));

      // ── lost answer: Golden placed it, the answer never arrived → PENDING, frozen, survives a reload; "Check again" replays ──
      await toValidated(page, 'PO-B6-2');
      W.dropNextPlace = 1;
      await page.click('[data-gck-place]');
      await page.waitForSelector('[data-gck-recheck]:not([disabled])', { timeout: 20000 });
      const pend = await page.evaluate(() => ({ text: document.getElementById('gckView').innerText, key: GCART.pending && GCART.pending.key, stored: JSON.parse(localStorage.getItem(gckPendKey()) || 'null'), items: GCART.items.length, pill: (document.getElementById('gcartPill') || {}).textContent }));
      await t(`${label}: lost answer → "could not confirm", attempt kept PENDING in the page AND local storage, cart kept, pill says confirming`, () => {
        ok(/could not confirm/.test(pend.text) && /can never create a second order/.test(pend.text), pend.text.slice(0, 200));
        ok(pend.key && pend.stored && pend.stored.key === pend.key && pend.items === 1 && /confirming/.test(pend.pill), JSON.stringify(pend)); ok(W.orders.length === 2, 'Golden placed it once: ' + W.orders.length); });
      await shot(page, `golden-place-pending-${label}.png`);
      // a reload while pending: the same attempt is checked again automatically (same key), never a new one
      await page.evaluate(async () => { GCART.pending = null; GCART.items = []; gckLoad(); goldenCartShow(); });
      await page.waitForSelector('.gck-done', { timeout: 20000 });
      const sub = W.goldenCalls.filter(c => c.path === '/v1/orders' && c.mode === 'submit').map(c => c.key);
      const after = await page.evaluate(() => ({ text: document.querySelector('.gck-done').innerText, pend: localStorage.getItem(gckPendKey()) }));
      await t(`${label}: after a reload the pending attempt is re-checked with the SAME key → Golden's first answer, still ONE order for it`, () => {
        ok(sub.length === 3 && sub[1] === sub[2] && sub[1] === pend.key, JSON.stringify(sub)); ok(W.orders.length === 2, 'orders ' + W.orders.length);
        ok(/already placed for this attempt/.test(after.text) && /P1662/.test(after.text) && after.pend === null, after.text.slice(0, 200)); });
      await page.click('[data-gck-done]');

      // ── a price change at placement: nothing placed, new totals for review, new attempt needed ──
      await toValidated(page, 'PO-B6-3');
      W.cost = 1250;
      await page.click('[data-gck-place]');
      await page.waitForFunction(() => /prices changed before the order was placed/.test((document.getElementById('gckView') || {}).innerText || ''), null, { timeout: 20000 });
      const pc = await page.evaluate(() => ({ placed: GCART.placed, pend: !!GCART.pending, attempt: GCART.attempt, btn: !!document.querySelector('[data-gck-place]'), items: GCART.items.length }));
      await t(`${label}: a price change at placement → nothing placed, the cart stays, a new validation is required`, () => {
        ok(W.orders.length === 2 && !pc.placed && !pc.pend && pc.attempt === null && !pc.btn && pc.items === 1, JSON.stringify(pc)); });
      const g2 = await geo();
      await t(`${label}: cart — no horizontal scroll, touch targets ≥ 44px`, () => { ok(g2.sw <= g2.cw + 1, JSON.stringify(g2)); ok(!g2.small.length, 'small: ' + g2.small.join(',')); });
      await t(`${label}: no HCPS order call, HCPS stored nothing, no page error`, () => { ok(counts.orders === 0 && W.hcpsWrites === 0, counts.orders + '/' + W.hcpsWrites); ok(!errs.length, errs.join(' | ')); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\ngolden b6 browser: ${pass} passed, ${fail} failed · screenshots in ${SHOTS}`);
  process.exit(fail ? 1 : 0);
})();
