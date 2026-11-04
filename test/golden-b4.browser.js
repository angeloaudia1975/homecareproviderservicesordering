/* Golden ⇄ Partner 360 — B4 Golden cart + validate-only order review, browser walkthrough of the REAL storefront page
   (public/index.html) on a deploy-preview address as a staff "view as dealer". The cart's calls (ship_to, quote,
   validate_order) run the REAL chain in-process: this page → HCPS golden-proxy (HCPS_REPO) → signed request → Golden's
   real /v1/ship-to, /v1/quote and /v1/orders handlers (GOLDEN_REPO) over a synthetic Golden database (one synthetic
   linked dealer, two of Golden's own ship-to records, a special-terms waiver for one city). Catalog / family / config
   answers come from Golden's real data files, as in the B3 test. Nothing reaches Golden, HCPS or an email provider.
   Checks at 390 / 768 / 1280 px: add configured chairs, quantities, reference names, ship-to, PO, Golden's totals, the
   waiver only at Golden's qualifying ship-to, validate-only result with the exact email previews in sandboxed frames,
   a lost answer retried with the SAME Idempotency-Key, a price change shown for re-review with a NEW key, no HCPS cart
   line, no order recorded, no email sent, no horizontal scroll, touch targets ≥ 44px. Screenshots → SHOTS.
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… HCPS_REPO=… node test/golden-b4.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const HCPS = process.env.HCPS_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SHOTS = process.env.SHOTS || '/tmp/golden-b4-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://deploy-preview-99--hcpsonlineordering.netlify.app';
const gFN = path.join(GOLDEN, 'repo', 'functions'), hFN = path.join(HCPS, 'netlify', 'functions');
for (const f of [path.join(gFN, 'v1-orders.js'), path.join(hFN, 'golden-proxy.js')]) if (!fs.existsSync(f)) { console.log('skip  golden b4 browser: ' + f + ' not checked out'); process.exit(process.env.CI ? 1 : 0); }

// ── Golden catalog / config answers (real Golden data files, as in B3) ──
const C = require(path.join(gFN, 'lib', 'golden-catalog.js'));
const DATA = require(path.join(gFN, 'lib', 'golden-catalog-data.json'));
const ENRICH = require(path.join(gFN, 'lib', 'golden-enrichment.json'));
const CFG = require(path.join(gFN, 'lib', 'golden-config.js'));
const PRICING = [{ sku: 'PR511-LAR', dealer_cost: 1188 }, { sku: 'PR511-MXW', dealer_cost: 1266 }];
const products = C.buildCatalog({ data: DATA, merch: {}, pricing: PRICING, seePrices: true });
const familyAnswer = fam => { const f = C.buildFamily({ data: DATA, enrichment: ENRICH, merch: {}, pricing: PRICING, seePrices: true, linked: true, family: fam }); return f ? { prices_visible: true, linked: true, enrichment_as_of: ENRICH.as_of, family: f } : { available: false, reason: 'not_found' }; };
const configAnswer = b => { const c = CFG.configure({ sku: String(b.sku || ''), fabric: b.fabric || 'std', color: b.color || null, tier: b.tier || null, footrest: b.footrest === true, pricing: PRICING, invRows: [] });
  if (!c.ok || (c.quote && !c.quote.ok)) return { available: false, reason: 'not_offered' };
  return { prices_visible: true, linked: true, config: CFG.present(c, { seePrices: true, linked: true }) }; };

// ── The real chain: HCPS golden-proxy → Golden v1 handlers (synthetic Golden database) ──
const { createMock } = require(path.join(GOLDEN, 'repo', 'tests', 'support', 'postgrest-mock.js'));
const gS = require(path.join(gFN, 'lib', 'hcps-s2s.js'));
const TEST_SECRET = crypto.randomBytes(32).toString('hex'), PROD_SECRET = crypto.randomBytes(32).toString('hex');
const D_HQ = '11111111-2222-4333-8444-555555555555', LOC_CIN = 'cccccccc-0000-4000-8000-000000000001';
const PREVIEW_TOKEN = 'ab12'.repeat(12);
const W = { delayValidate: 0, cost: 1188, idem: new Map(), goldenCalls: [], hcpsWrites: 0, emails: 0, dropNextValidate: 0 };
const idemRpc = {
  integration_order_claim: ({ p }) => { const r = W.idem.get(p.idempotency_key); if (!r) { const tok = crypto.randomUUID(); W.idem.set(p.idempotency_key, { h: p.request_hash, s: 'pending', tok }); return { state: 'new', claim_token: tok }; }
    if (r.h !== p.request_hash) return { state: 'conflict' }; if (r.s === 'done') return { state: 'replay', status: r.st, response: r.resp }; return { state: 'in_progress' }; },
  integration_order_complete: ({ p }) => { const r = W.idem.get(p.idempotency_key); if (!r || r.tok !== p.claim_token) throw new Error('no pending claim'); r.s = 'done'; r.st = p.status; r.resp = p.response; return true; },
  integration_order_release: ({ p }) => { W.idem.delete(p.idempotency_key); return true; },
};
const fresh = (dir, m) => { Object.keys(require.cache).forEach(k => { if (k.startsWith(dir)) delete require.cache[k]; }); return require(path.join(dir, m)); };
function setEnv() {
  Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE: 'svc', SUPABASE_SERVICE_KEY: 'svc', GOLDEN_P360_KEY_ID: 'hcps-p360-1', GOLDEN_P360_SECRET: PROD_SECRET,
    GOLDEN_P360_TEST_KEY_ID: 'hcps-p360-test-1', GOLDEN_P360_TEST_SECRET: TEST_SECRET, GOLDEN_TEST_API_BASE: 'https://deploy-preview-282--goldenonlineordering.netlify.app',
    GOLDEN_V1_API: 'true', HCPS_P360_KEYS: JSON.stringify({ 'hcps-p360-test-1': TEST_SECRET }), ORDER_EMAIL_TO: 'desk@golden.example', ORDER_EMAIL_FROM: 'portal@golden.example' });
}
let chain = Promise.resolve();
function runProxy(body, headers) {   // serialised: the in-process fetch world is global
  const job = chain.then(async () => {
    setEnv();
    const goldenSb = createMock({ tables: {
      integration_clients: [{ kid: 'hcps-p360-test-1', client_id: 'hcps-partner360', tenant_id: 'hcps', scopes: ['golden:read'], active: true, secret_fingerprint: gS.fingerprint(TEST_SECRET) }],
      dealer_integration_map: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', tenant_id: 'hcps', client_id: 'hcps-partner360', hcps_dealer_id: D_HQ, golden_dealer_id: 'dealer-synth', status: 'verified', price_visibility: 'dealer', golden_ordering_enabled: false, history_enabled: false }],
      dealer_integration_branch_map: [], dealers: [{ id: 'dealer-synth', active: true, customer_no: '900001' }], dealer_branches: [],
      dealer_ship_locations: [{ id: LOC_CIN, dealer_id: 'dealer-synth', label: 'Cincinnati showroom', ship_address: '1 Main St', ship_city: 'Cincinnati', ship_state: 'OH', ship_zip: '45202', created_at: '2026-01-01' }],
      dealer_locations: [{ customer_no: '900001', is_primary: true, address_line1: '10 Warehouse Rd', city: 'Columbus', state: 'OH', zip: '43215' }],
      dealer_special_terms: [{ customer_no: '900001', waive_service_handling: true, qualifying_cities: [{ city: 'Cincinnati', state: 'OH' }], active: true }], orders: [],
      inventory: [{ sku: 'PR511-LAR', size: 'LAR', fabcode: 'SKN', color_code: 'SUM', avail: 4, pool: null }],
    }, rpc: Object.assign({
      integration_nonce_claim: () => true, integration_audit_log: () => null,
      get_dealer_portal_data: () => ({ dealer: { dealer_id: 'dealer-synth', name: 'Synthetic Test Dealer', customer_no: '900001', terms: 'Net 30' }, pricing: [{ sku: 'PR511-LAR', dealer_cost: W.cost }, { sku: 'PR511-MXW', dealer_cost: W.cost + 78 }] }),
    }, idemRpc) });
    const handlers = { '/v1/quote': fresh(gFN, 'v1-quote.js').handler, '/v1/ship-to': fresh(gFN, 'v1-ship-to.js').handler, '/v1/orders': fresh(gFN, 'v1-orders.js').handler };
    const proxy = fresh(hFN, 'golden-proxy.js');
    const res = (status, b) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) });
    const saved = global.fetch;
    global.fetch = async (u, init) => {
      u = String(u); init = init || {};
      if (/resend|sendgrid|mailgun|smtp|graph\.microsoft/.test(u)) { W.emails++; throw new Error('no email may be sent'); }
      if (u.startsWith('https://deploy-preview-282--goldenonlineordering.netlify.app/')) {
        const url = new URL(u); W.goldenCalls.push({ path: url.pathname, key: init.headers && init.headers['Idempotency-Key'] });
        const ev = { httpMethod: init.method, rawUrl: u, path: url.pathname, headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), queryStringParameters: Object.fromEntries(url.searchParams), body: init.body || '', isBase64Encoded: false };
        const outer = global.fetch; global.fetch = (x, y) => goldenSb(String(x).replace('https://sb.test', 'http://sb.test'), y);
        process.env.SUPABASE_URL = 'http://sb.test';
        try { const r = await handlers[url.pathname](ev); return res(r.statusCode, JSON.parse(r.body)); }
        finally { global.fetch = outer; process.env.SUPABASE_URL = 'https://sb.test'; }
      }
      if (/dealer_preview_tokens/.test(u)) return res(200, [{ dealer_id: D_HQ, expires_at: new Date(Date.now() + 3600e3).toISOString() }]);
      if (/dealers\?id=eq\./.test(u)) return res(200, [{ id: D_HQ, parent_id: null }]);
      if ((init.method || 'GET') !== 'GET') { W.hcpsWrites++; throw new Error('HCPS must store nothing'); }
      return res(200, []);
    };
    try { const r = await proxy.handler({ httpMethod: 'POST', headers: headers, body: JSON.stringify(body) }); return JSON.parse(r.body); }
    finally { global.fetch = saved; }
  });
  chain = job.catch(() => null);
  return job;
}

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }
const shotCart = async (page, name) => { await page.evaluate(() => { const ov = document.getElementById('gckView'); ov.dataset.st = ov.getAttribute('style') || ''; ov.dataset.sy = String(scrollY); ov.style.position = 'absolute'; ov.style.bottom = 'auto'; ov.style.minHeight = '0'; ov.style.overflow = 'visible'; document.body.classList.remove('gck-lock'); window.scrollTo(0, 0); });
  await page.waitForTimeout(300); const hh = await page.evaluate(() => Math.ceil(document.getElementById('gckView').getBoundingClientRect().height)); const ww = page.viewportSize().width;
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true, clip: { x: 0, y: 0, width: ww, height: hh } });
  await page.evaluate(() => { const ov = document.getElementById('gckView'); window.scrollTo(0, Number(ov.dataset.sy) || 0); ov.setAttribute('style', ov.dataset.st); document.body.classList.add('gck-lock'); }); };
const pageBody = async (page, sel) => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);

(async () => {
  const browser = await chromium.launch();
  const inv = C.inventorySummary({ data: DATA, merch: {}, rows: [] });
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      W.cost = 1188; W.idem.clear(); W.goldenCalls.length = 0; W.dropNextValidate = 0;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
      const page = await ctx.newPage();
      const pageErrors = []; page.on('pageerror', e => { pageErrors.push(String(e && e.message)); if (process.env.DBG) console.log('PAGEERROR', e && e.message); });
      let ordersApi = 0, submitOrder = 0;
      await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.origin === HOST) {
          let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
          if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
          return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        }
        if (/\/functions\/orders-api/.test(u.pathname) && req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); if (/create|preview_order/.test(String(b.action))) ordersApi++; }
        if (/\/functions\/submit-order/.test(u.pathname)) submitOrder++;
        if (/\/functions\/dealer-auth/.test(u.pathname) && req.method() === 'POST')
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: 'd-test', name: 'TEST — Golden Sandbox', email: 'sandbox@example.invalid', phone: '937-555-0100', contact_name: 'Pat Tester' }, lines: [], access: { your_accounts: [], available: [], golden: 'None' }, prices: {} }) });
        if (/\/functions\/golden-proxy/.test(u.pathname)) {
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
          const b = JSON.parse(req.postData() || '{}');
          const H = { 'access-control-allow-origin': '*' };
          if (['ship_to', 'quote', 'validate_order'].includes(b.action)) {
            const hdr = await req.allHeaders();
            const out = await runProxy(b, { 'x-hcps-preview': hdr['x-hcps-preview'] || '', 'x-hcps-golden-env': hdr['x-hcps-golden-env'] || '', origin: hdr.origin || '' });
            if (b.action === 'validate_order' && W.delayValidate) await new Promise(r => setTimeout(r, W.delayValidate));
            if (b.action === 'validate_order' && W.dropNextValidate > 0) { W.dropNextValidate--; return route.abort('connectionreset'); }   // Golden answered, the answer was lost
            return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(out) });
          }
          const base = { ok: true, enabled: true, available: true, preview: true };
          const ans = b.action === 'eligibility' ? Object.assign(base, { state: 'account', capabilities: { see_prices: true, order: false, history: false } })
            : b.action === 'catalog' ? Object.assign(base, { prices_visible: true, linked: true, products })
            : b.action === 'family' ? Object.assign(base, familyAnswer(String(b.family || '')))
            : b.action === 'config' ? Object.assign(base, configAnswer(b))
            : Object.assign(base, inv);
          return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(ans) });
        }
        if (/^(cdn\.wdgtsrc\.com|d3325uqufdmhie\.cloudfront\.net|fonts\.(googleapis|gstatic)\.com)$/.test(u.host)) return route.continue();
        if (/youtube|ytimg/.test(u.host)) return route.fulfill({ status: 204, body: '' });
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      });
      await page.goto(HOST + '/?preview=' + PREVIEW_TOKEN, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} GCART.items = []; });
      await page.evaluate(() => selectManufacturer(CONFIG.GOLDEN_SLUG));
      await page.waitForSelector('.gcard', { timeout: 20000 });
      // configure + add two chairs
      await page.evaluate(() => openProductDetail('PR511-LAR'));
      await page.waitForSelector('.gcfg .gcfg-c', { timeout: 15000 });
      const pre = await page.evaluate(() => ({ dis: document.querySelector('.gcfg-add').disabled, txt: document.querySelector('.gcfg-add').textContent }));
      await t(`${label}: "Add to Golden cart" waits for a colour`, () => ok(pre.dis && /Add to Golden cart/.test(pre.txt), JSON.stringify(pre)));
      await page.click('[data-gcol="SUM"]'); await page.waitForSelector('.gcfg-q', { timeout: 10000 });
      await page.click('[data-gtier="nirvana"]'); await page.waitForFunction(() => /Nirvana/.test((document.querySelector('.gcfg-q') || {}).textContent || ''), null, { timeout: 10000 });
      await page.waitForFunction(() => { const b = document.querySelector('.gcfg-add'); return b && !b.disabled; }, null, { timeout: 10000 });
      await page.click('.gcfg-add'); await page.waitForTimeout(500);
      await page.click('[data-gfab="xover"]'); await page.waitForTimeout(500);
      await page.click('[data-gcol="JBO"]'); await page.waitForFunction(() => /Bourbon/.test((document.querySelector('.gcfg-q') || {}).textContent || ''), null, { timeout: 10000 });
      await page.waitForFunction(() => { const b = document.querySelector('.gcfg-add'); return b && !b.disabled; }, null, { timeout: 10000 });
      await page.click('.gcfg-add'); await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({ items: GCART.items.map(i => [i.sku, i.fabric, i.color, i.tier, i.qty]), stored: localStorage.getItem(gckStoreKey()) || '', hcpsCart: (typeof state !== 'undefined' && state.cart ? Object.keys(state.cart).length : 0) + (typeof CART !== 'undefined' && CART && CART.length ? CART.length : 0), pill: (document.getElementById('gcartPill') || {}).textContent || '' }));
      await t(`${label}: two configured chairs in the SEPARATE Golden cart — no price stored, nothing in the HCPS cart`, () => {
        ok(JSON.stringify(st.items) === JSON.stringify([['PR511-LAR', 'std', 'SUM', 'nirvana', 1], ['PR511-LAR', 'xover', 'JBO', 'nirvana', 1]]), JSON.stringify(st.items));
        ok(!/price|cost|total|\$/i.test(st.stored), 'no price in local storage: ' + st.stored); ok(st.hcpsCart === 0, 'HCPS cart ' + st.hcpsCart); ok(/2 chairs/.test(st.pill), st.pill); });
      // open the review
      await page.click('#gcartPill'); await page.waitForSelector('.gck-ship', { timeout: 15000 });
      const f0 = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-gck-close'));
      await page.keyboard.press('Escape');
      const f1 = await page.evaluate(() => ({ hidden: document.getElementById('gckView').style.display === 'none', pill: document.activeElement && document.activeElement.id === 'gcartPill' }));
      await t(`${label}: dialog takes focus on open; Escape closes it and focus returns to the cart button`, () => ok(f0 && f1.hidden && f1.pill, JSON.stringify({ f0, f1 })));
      await page.click('#gcartPill'); await page.waitForSelector('.gck-ship', { timeout: 15000 });
      const sh = await page.evaluate(() => [...document.querySelectorAll('.gck-ship')].map(x => x.innerText.replace(/\s+/g, ' ')));
      await t(`${label}: ship-to = Golden's own two records (primary + saved location), no free-text address field`, () => {
        ok(sh.length === 2 && /Columbus/.test(sh[0]) && /Cincinnati showroom/.test(sh[1]), sh.join(' | ')); });
      const noAddrInput = await page.evaluate(() => !document.querySelector('.gck-box input[data-f*="addr"], .gck-box input[data-f="city"]'));
      await t(`${label}: no address can be typed`, () => ok(noAddrInput));
      // quantities + reference names
      await page.click('[data-dq="0"][data-d="1"]'); await page.waitForTimeout(100);
      await page.evaluate(() => { document.querySelectorAll('.gck-refs').forEach(d => d.open = true); });
      await page.fill('.gck-ref[data-ix="0"][data-k="0"]', 'Mrs. Smith'); await page.fill('.gck-ref[data-ix="0"][data-k="1"]', 'Room 12');
      // Columbus (primary) — standard S&H
      await page.check('.gck-ship input[value="primary"]'); await page.waitForSelector('.gck-tot', { timeout: 15000 });
      const t1 = await pageBody(page, '.gck-tot');
      await page.check(`.gck-ship input[value="${LOC_CIN}"]`); await page.waitForFunction(() => /waived/.test((document.querySelector('.gck-tot') || {}).textContent || ''), null, { timeout: 15000 });
      const t2 = await pageBody(page, '.gck-tot');
      await shotCart(page, `golden-cart-review-${label}.png`);
      const lines = await page.evaluate(() => [...document.querySelectorAll('.gck-lp')].map(x => x.innerText));
      await t(`${label}: Golden's totals; the S&H waiver applies only at Golden's qualifying ship-to (Cincinnati), not Columbus`, () => {
        ok(!/waived/.test(t1) && /Shipping & handling\s*\$\d/.test(t1) && !/\$0\.00/.test(t1.split('Shipping')[1].split('\n')[0]), 'Columbus: ' + t1);
        ok(/waived for this ship-to/.test(t2) && /\$0\.00/.test(t2), 'Cincinnati: ' + t2);
        ok(lines.length === 2 && /each/.test(lines[0]), lines.join('|')); });
      await page.fill('[data-f="po"]', 'PO-7780'); await page.fill('[data-f="notes"]', 'Deliver to the back dock');
      // while Golden is answering, the cart is frozen — nothing can change under the answer
      W.delayValidate = 2500; await page.click('[data-gck-validate]'); await page.waitForTimeout(400);
      const frozen = await page.evaluate(() => ({ plus: document.querySelector('[data-dq="0"][data-d="1"]').disabled, rm: document.querySelector('[data-rm="0"]').disabled, po: document.querySelector('[data-f="po"]').readOnly, ship: [...document.querySelectorAll('input[name=gckship]')].every(x => x.disabled), busy: GCART.busy }));
      await page.waitForSelector('.gck-ok', { timeout: 20000 }); W.delayValidate = 0;
      await t(`${label}: while Golden answers, quantities, remove, ship-to and fields are frozen`, () => ok(frozen.busy && frozen.plus && frozen.rm && frozen.po && frozen.ship, JSON.stringify(frozen)));
      await page.fill('[data-f="po"]', 'PO-7781');   // a new attempt for the lost-answer check below
      W.goldenCalls.length = 0;
      // validate — the first answer is lost on the way back; the retry reuses the SAME Idempotency-Key and gets Golden's stored result
      W.dropNextValidate = 1;
      await page.click('[data-gck-validate]'); await page.waitForFunction(() => /could not be reached/.test((document.querySelector('.gck-warn') || {}).textContent || ''), null, { timeout: 20000 });
      await page.click('[data-gck-validate]'); await page.waitForSelector('.gck-ok', { timeout: 20000 });
      const keys = W.goldenCalls.filter(c => c.path === '/v1/orders').map(c => c.key);
      const res = await page.evaluate(() => ({ text: document.querySelector('.gck-ok').innerText, frames: [...document.querySelectorAll('.gck-mail iframe')].map(f => ({ sb: f.getAttribute('sandbox'), len: (f.srcdoc || '').length, src: f.getAttribute('src') })),
        mail: (document.querySelector('iframe[data-gck-email="golden"]') || {}).srcdoc || '' }));
      await t(`${label}: lost answer → retry with the SAME Idempotency-Key → Golden's recorded result (replay), validation only`, () => {
        ok(keys.length === 2 && keys[0] === keys[1] && /^[0-9a-f-]{36}$/.test(keys[0]), JSON.stringify(keys));
        ok(/no order was placed/.test(res.text) && /already recorded/.test(res.text) && /PO-7781/.test(res.text) && /Cincinnati showroom/.test(res.text), res.text.slice(0, 300)); });
      const shots = [];
      for (const k of ['golden', 'dealer']) { const b = await page.locator(`iframe[data-gck-email="${k}"]`).screenshot({ path: path.join(SHOTS, `golden-email-${k}-${label}.png`) }); shots.push(b.length); }
      await t(`${label}: both email previews actually render (not a blank frame)`, () => ok(shots.every(n => n > 15000), 'png sizes ' + shots.join(',')));
      await t(`${label}: Golden's exact email previews render in sandboxed frames (no scripts, no same-origin)`, () => {
        ok(res.frames.length === 2 && res.frames.every(f => f.sb === '' && f.len > 200 && !f.src), JSON.stringify(res.frames));
        ok(/Mrs\. Smith/.test(res.mail) && /Room 12/.test(res.mail) && /1 Main St/.test(res.mail) && /PO-7781/.test(res.mail), 'golden email content');
        ok(!/desk@golden\.example/.test(res.mail + res.text), 'Golden order desk address never shown'); });
      await shotCart(page, `golden-cart-validated-${label}.png`);
      // Golden's price moves → re-review with Golden's new quote; the next validation is a NEW attempt (new key)
      W.cost = 1250;
      await page.fill('[data-f="po"]', 'PO-7782');
      await page.click('[data-gck-validate]'); await page.waitForFunction(() => /prices changed/.test((document.querySelector('.gck-warn') || {}).textContent || ''), null, { timeout: 20000 });
      const moved = await pageBody(page, '.gck-tot');
      await page.click('[data-gck-validate]'); await page.waitForSelector('.gck-ok', { timeout: 20000 });
      const keys2 = W.goldenCalls.filter(c => c.path === '/v1/orders').map(c => c.key);
      await t(`${label}: Golden's price change → new totals shown for review, then a NEW attempt key validates`, () => {
        ok(keys2.length === 4 && keys2[2] !== keys[0] && keys2[3] !== keys2[2], JSON.stringify(keys2));
        ok(/Golden total/.test(moved) && moved !== t2, moved); });
      // keyboard: Tab out of an email preview frame stays in the dialog; a control frozen while Golden answered gets focus back
      await page.locator('iframe[data-gck-email="dealer"]').focus();
      await page.evaluate(() => document.querySelector('#gckView [data-trap="end"]').focus());   // where Tab lands when it leaves the last email frame
      const trap = await page.evaluate(() => { const a = document.activeElement; return { inDialog: !!(a && document.getElementById('gckView').contains(a)), sentinel: !!(a && a.hasAttribute('data-trap')), close: !!(a && a.hasAttribute('data-gck-close')) }; });
      await t(`${label}: Tab from the last email preview wraps to the top of the dialog (never leaves it)`, () => ok(trap.inDialog && !trap.sentinel && trap.close, JSON.stringify(trap)));
      W.delayValidate = 1500; await page.fill('[data-f="attention"]', 'Receiving'); await page.focus('[data-gck-validate]'); await page.keyboard.press('Enter');
      await page.waitForSelector('.gck-ok', { timeout: 20000 }); W.delayValidate = 0; await page.waitForTimeout(200);
      const back = await page.evaluate(() => !!(document.activeElement && document.activeElement.hasAttribute('data-gck-validate')));
      await t(`${label}: after Golden answers, focus returns to the button that was used`, () => ok(back, 'focus was not returned to Validate'));
      const geo = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, boxW: document.querySelector('.gck-box').scrollWidth, boxC: document.querySelector('.gck-box').clientWidth,
        small: [...document.querySelectorAll('.gck-box button, .gck-box input:not([type=radio]), .gck-box textarea, .gck-box summary')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).map(b => b.className || b.tagName) }));
      await t(`${label}: no horizontal scroll, touch targets ≥ 44px`, () => { ok(geo.sw <= geo.cw + 1 && geo.boxW <= geo.boxC + 1, JSON.stringify(geo)); ok(!geo.small.length, 'small: ' + geo.small.join(',')); });
      await t(`${label}: nothing ordered — no HCPS order call, no Golden order row, no email, HCPS stored nothing`, () => {
        ok(ordersApi === 0 && submitOrder === 0, 'orders ' + ordersApi + '/' + submitOrder); ok(W.emails === 0 && W.hcpsWrites === 0, W.emails + '/' + W.hcpsWrites);
        ok(W.goldenCalls.every(c => ['/v1/ship-to', '/v1/quote', '/v1/orders'].includes(c.path))); });
      await shotCart(page, `golden-cart-repriced-${label}.png`);
      // remove everything → empty cart, pill gone
      await page.click('[data-rm="0"]'); await page.click('[data-rm="0"]'); await page.click('[data-gck-close]');
      const empty = await page.evaluate(() => ({ n: GCART.items.length, pill: !!document.getElementById('gcartPill') }));
      await t(`${label}: removing every chair empties the cart and hides the cart button`, () => ok(empty.n === 0 && !empty.pill, JSON.stringify(empty)));
      // sign-out: the Golden cart, its review and the cached ship-to addresses go with the dealer
      await page.evaluate(() => { goldenCartAdd('PR511-LAR', { fabric: 'std', color: 'SUM', tier: null, footrest: false }, null); goldenCartShow(); });
      await page.waitForSelector('.gck-ship', { timeout: 15000 });
      await page.evaluate(() => { GCART.shipList = null; goldenCartShow(); signOut(); });   // sign out while the ship-to request is in flight
      await page.waitForTimeout(1500);
      const out = await page.evaluate(() => ({ n: GCART.items.length, pill: !!document.getElementById('gcartPill'), dlg: !!document.getElementById('gckView'), ships: GCART.shipList, on: GOLDEN.on }));
      await t(`${label}: no script error on the page`, () => ok(!pageErrors.length, pageErrors.join(' | ')));
      await t(`${label}: sign-out clears the Golden cart, its dialog, ship-to cache and button`, () => ok(out.n === 0 && !out.pill && !out.dlg && out.ships === null && out.on === false, JSON.stringify(out)));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\ngolden b4 browser: ${pass} passed, ${fail} failed · screenshots in ${SHOTS}`);
  process.exit(fail ? 1 : 0);
})();
