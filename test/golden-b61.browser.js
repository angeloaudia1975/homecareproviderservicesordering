/* Golden ⇄ Partner 360 — B6.1 UNIFIED SHOPPING EXPERIENCE, browser walkthrough of the REAL storefront page (public/index.html)
   on a deploy-preview address as a staff "view as dealer" (the B4 harness: Golden's real catalog / family / configurator data,
   the real HCPS golden-proxy → Golden /v1/ship-to + /v1/quote chain in-process over a synthetic Golden database).
   Checks at 390 / 768 / 1280 px:
   - a configured Golden chair shows the SAME actions as every HCPS line: quantity, orange "Add to cart", "Print Brochure",
     "Add to a quote" — no "Add to Golden cart"; a browse-only Golden product (scooter) says so and offers no Add to cart;
   - Add to cart (qty 2) puts the chair in the HCPS cart: header count, Golden order group with its own subtotal, shipping
     & handling and total once Golden prices it; quantity edit / remove; a mixed cart shows each manufacturer's group;
     Golden lines never become HCPS order lines; a Golden-only cart's main button opens Golden's review;
   - Print Brochure builds from Golden's own content with no dealer price, and links Golden's official sell sheet;
   - Add to a quote keeps model, size, fabric, colour and upgrades with Golden's official retail (chair + each upgrade),
     never a dealer cost; a configuration without a full retail figure reads "MSRP not provided";
   - a second tab adding a chair updates this tab's cart; no horizontal scroll; touch targets ≥ 44px; no script error.
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… HCPS_REPO=… node test/golden-b61.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const HCPS = process.env.HCPS_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SHOTS = process.env.SHOTS || '/tmp/golden-b61-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://deploy-preview-99--hcpsonlineordering.netlify.app';
const gFN = path.join(GOLDEN, 'repo', 'functions'), hFN = path.join(HCPS, 'netlify', 'functions');
for (const f of [path.join(gFN, 'v1-orders.js'), path.join(hFN, 'golden-proxy.js')]) if (!fs.existsSync(f)) { console.log('skip  golden b61 browser: ' + f + ' not checked out'); process.exit(process.env.CI ? 1 : 0); }

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
      await ctx.route('**/*', async route => {
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
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} GCART.items = []; gckChanged(); });
      await page.evaluate(() => selectManufacturer(CONFIG.GOLDEN_SLUG));
      await page.waitForSelector('.gcard', { timeout: 20000 });
      // ── 1. product page actions ──
      await page.evaluate(() => openProductDetail('PR511-LAR'));
      await page.waitForSelector('.gcfg .gcfg-c', { timeout: 15000 });
      const a0 = await page.evaluate(() => ({ txt: document.querySelector('.gcfg').innerText, add: document.querySelector('.gaddbtn').disabled, qty: !!document.querySelector('.gcfg [data-gqty]'),
        broch: !!document.querySelector('.gcfg [data-gbroch]'), quote: !!document.querySelector('.gcfg [data-gquote]'), quoteDis: document.querySelector('.gcfg [data-gquote]').getAttribute('aria-disabled') }));
      await t(`${label}: configured chair shows the standard HCPS actions (qty, Add to cart, Print Brochure, Add to a quote) — no "Golden cart"`, () => {
        ok(a0.qty && a0.broch && a0.quote && /Add to cart/.test(a0.txt) && /Print Brochure/.test(a0.txt) && /Add to a quote/.test(a0.txt), a0.txt.slice(-300));
        ok(!/Golden cart/i.test(a0.txt), 'no separate Golden cart wording'); ok(a0.add === true && a0.quoteDis === 'true', 'both wait for a colour'); });
      await page.click('[data-gfab="xover"]'); await page.waitForTimeout(400);
      await page.click('[data-gcol="JBO"]'); await page.waitForSelector('.gcfg-q', { timeout: 10000 });
      await page.click('[data-gtier="nirvana"]'); await page.waitForFunction(() => /Nirvana/.test((document.querySelector('.gcfg-q') || {}).textContent || ''), null, { timeout: 10000 });
      await page.check('[data-gfoot]'); await page.waitForFunction(() => /footrest/i.test((document.querySelector('.gcfg-q') || {}).textContent || ''), null, { timeout: 10000 });
      await page.waitForFunction(() => { const b = document.querySelector('.gaddbtn'); return b && !b.disabled; }, null, { timeout: 10000 });
      const btnStyle = await page.evaluate(() => { const b = document.querySelector('.gaddbtn'), r = b.getBoundingClientRect(); return { bg: getComputedStyle(b).backgroundImage, h: r.height }; });
      await t(`${label}: the Add to cart button is the HCPS orange button (≥ 44px)`, () => ok(/gradient/.test(btnStyle.bg) && btnStyle.h >= 44, JSON.stringify(btnStyle)));
      await page.fill('.gcfg [data-gqty]', '2'); await page.click('.gaddbtn'); await page.waitForTimeout(400);
      const c1 = await page.evaluate(() => ({ items: GCART.items.map(i => [i.sku, i.fabric, i.color, i.tier, i.footrest, i.qty]), badge: document.getElementById('cartCount').textContent, hcps: [...CART.values()].length, pill: !!document.getElementById('gcartPill') }));
      await t(`${label}: qty 2 → the configured chair is in the cart (header count 2), never an HCPS order line, no separate cart button`, () => {
        ok(JSON.stringify(c1.items) === JSON.stringify([['PR511-LAR', 'xover', 'JBO', 'nirvana', true, 2]]), JSON.stringify(c1.items)); ok(c1.badge === '2' && c1.hcps === 0 && !c1.pill, JSON.stringify(c1)); });
      // ── 2. Add to a quote: exact configuration + Golden's official retail (chair 2,992 + Cross-Over 286 + Nirvana 600 + footrest 156) ──
      await page.evaluate(() => { window.__showP360 = showP360; window.showP360 = v => { window.__p360 = v; }; });
      await page.click('.gcfg [data-gquote]'); await page.waitForTimeout(200);
      const q1 = await page.evaluate(() => { const r = P360Quote.picked().find(x => x.mfr === 'golden'); return { r, nav: window.__p360, paper: P360Quote.paper() }; });
      await t(`${label}: Add to a quote keeps model, size, fabric, colour and upgrades with Golden's official retail — never a dealer cost`, () => {
        ok(q1.r && /Cloud/.test(q1.r.name) && /Large/.test(q1.r.option) && /Cross-Over: JZ Bourbon/.test(q1.r.option) && /Nirvana/.test(q1.r.option) && /Footrest extension \(RM621FRE-L\)/.test(q1.r.option), JSON.stringify(q1.r));
        ok(q1.r.msrp === 2992 + 286 + 600 + 156, 'retail ' + q1.r.msrp); ok(q1.nav === 'quotes', 'opens the quote builder');
        ok(!/1,?608|1,?188|1,?266|dealer/i.test(q1.paper), 'no dealer price on the customer quote'); ok(/\$4,034/.test(q1.paper), 'quote shows the retail total'); });
      // a configuration whose upgrade has no Golden retail figure → "MSRP not provided" (never an estimate)
      const q2 = await page.evaluate(() => { const cur = JSON.parse(JSON.stringify(GCFG.cur)); cur.c.tabs.forEach(t => { if (t.key === 'xover') t.msrp = null; }); const p = state.products.find(x => x.code === 'PR511-LAR'); return goldenQuoteRecord(p, cur).rec; });
      await t(`${label}: no Golden retail figure for a chosen upgrade → MSRP not provided`, () => ok(q2.msrp === null, JSON.stringify(q2)));
      // ── 3. Print Brochure: Golden's own content, no dealer price, Golden's official sell sheet linked ──
      await page.click('.gcfg [data-gbroch]'); await page.waitForSelector('#brModal', { timeout: 10000 });
      const b1 = await page.evaluate(() => ({ modal: document.getElementById('brModal').innerText, links: [...document.querySelectorAll('#brModal a[href]')].map(a => a.href), pl: brochurePayload('PR511-LAR'),
        cfg: goldenQuoteRecord(state.products.find(x => x.code === 'PR511-LAR'), GCFG.cur).rec }));
      await t(`${label}: Print Brochure — Golden's photos, description, features and size specs; Golden's MSRP only; no dealer price; official sell sheet linked`, () => {
        const s = JSON.stringify(b1.pl);
        ok(b1.pl && b1.pl.images.length >= 1 && b1.pl.images.every(u => /^https:\/\/(d3325uqufdmhie\.cloudfront\.net|cdn\.wdgtsrc\.com|goldenonlineordering\.netlify\.app|(www\.)?goldentech\.com)\//.test(u)), 'Golden photos ' + s.slice(0, 200));
        ok(b1.pl.description.length > 40 && b1.pl.features.length > 3 && b1.pl.specs.length > 3, 'content'); ok(b1.pl.msrp === b1.cfg.msrp && b1.pl.msrp >= 2992 && b1.pl.quote_price === null, 'msrp ' + b1.pl.msrp + ' vs configured ' + b1.cfg.msrp);
        ok(b1.pl.tagline && b1.pl.tagline === b1.cfg.option, 'the brochure names the configuration: ' + b1.pl.tagline);
        ok(!/1188|1608|dealer_price|dealer_cost|unit_price/.test(s), 'no dealer price in the brochure payload');
        ok(b1.links.length >= 1 && b1.links.every(h => /^https:\/\//.test(h)) && /Sell Sheet/i.test(b1.modal), 'official sell sheet ' + JSON.stringify(b1.links)); });
      await page.evaluate(() => closeBrochure());
      // ── 4. browse-only Golden product ──
      await page.evaluate(() => openProductDetail('GA541D')); await page.waitForTimeout(1500);
      const sc = await page.evaluate(() => ({ cfg: !!document.querySelector('.gcfg'), note: (document.querySelector('.gbrowse') || {}).innerText || '', add: [...document.querySelectorAll('.pd .addbtn, .pd .gaddbtn')].length, broch: !!document.querySelector('.pd .pd-broch'), quote: /Add to a quote/.test(document.querySelector('.pd').innerText) }));
      await t(`${label}: a Golden scooter says "Browse only", offers no Add to cart, keeps Print Brochure and Add to a quote`, () => ok(!sc.cfg && /Browse only/.test(sc.note) && sc.add === 0 && sc.broch && sc.quote, JSON.stringify(sc)));
      const scq = await page.evaluate(() => { const a = document.querySelector('.pd [data-gb-quote]'); const h = a.getBoundingClientRect().height, inline = a.hasAttribute('onclick'); a.click();
        return { h, inline, picked: window.P360Quote.picked().map(r => r.sku), view: document.querySelector('#p360 .view.on, [data-view].on') ? 1 : 0 }; });
      await t(`${label}: the browse-only "Add to a quote" is a ≥ 44px control with no inline script, and adds the scooter to the quote`, () => ok(scq.h >= 44 && !scq.inline && scq.picked.includes('GA541D'), JSON.stringify(scq)));
      await page.evaluate(() => { if (typeof showView === 'function') try { showView('catalog'); } catch (e) {} if (typeof P360 !== 'undefined' && P360.show) try { P360.show('shop'); } catch (e) {} });
      // ── 5. the unified cart: Golden group + an HCPS line ──
      await page.evaluate(() => { const p = { manufacturer: 'strongback-mobility', code: '1019', name: 'Strongback Comfort Flip Arm Wheelchair 18"', base_price: 581, brand: 'Strongback' };
        CART.set(cartKey(p), { p, qty: 1 }); updateCart(); openCart(); });
      await page.waitForSelector('#cartGroups .gmgroup', { timeout: 10000 });
      const m1 = await page.evaluate(() => ({ groups: [...document.querySelectorAll('#cartGroups .mgroup')].map(g => g.querySelector('.mghead').innerText.replace(/\s+/g, ' ')), badge: document.getElementById('cartCount').textContent,
        gtxt: document.querySelector('.gmgroup').innerText, sum: getComputedStyle(document.getElementById('gSumRow')).display, btn: document.getElementById('submitOrder').textContent, orders: hcpsCartOrders().map(o => o.manufacturer_slug) }));
      await t(`${label}: mixed cart — Strongback and Golden groups side by side, header count 3, Golden priced by Golden, Golden never an HCPS order`, () => {
        ok(m1.groups.length === 2 && /Golden Technologies/.test(m1.groups[1]) && /2 chairs/.test(m1.groups[1]), m1.groups.join(' | ')); ok(m1.badge === '3', 'badge ' + m1.badge);
        ok(/Priced by Golden at review/.test(m1.gtxt) && /separate order/.test(m1.gtxt) && /Checkout Golden order/.test(m1.gtxt), m1.gtxt.slice(0, 300));
        ok(m1.sum !== 'none' && /Place order/.test(m1.btn) && JSON.stringify(m1.orders) === '["strongback-mobility"]', JSON.stringify(m1)); });
      // Golden prices the group for a ship-to → the group shows Golden's subtotal, S&H and total
      await page.click('#cartGroups [data-gckgo]'); await page.waitForSelector('.gck-ship', { timeout: 15000 });
      await page.check('.gck-ship input[value="primary"]'); await page.waitForSelector('.gck-tot', { timeout: 15000 });
      await page.click('[data-gck-close]'); await page.waitForTimeout(300);
      const m2 = await page.evaluate(() => ({ tot: document.querySelector('.gmgroup .mgtot').innerText, line: document.querySelector('.gmgroup .citem').innerText, sumv: document.getElementById('gSumVal').textContent }));
      await t(`${label}: after Golden prices it, the cart shows Golden's merchandise, shipping & handling and total for the group`, () => {
        ok(/Subtotal\s*\$[\d,]+\.\d\d/.test(m2.tot) && /Shipping & handling\s*\$[\d,]+\.\d\d/.test(m2.tot) && /Golden Technologies total\s*\$[\d,]+\.\d\d/.test(m2.tot), m2.tot);
        ok(/priced by Golden/.test(m2.line) && /^\$[\d,]+\.\d\d$/.test(m2.sumv), m2.line + ' / ' + m2.sumv); });
      // quantity edit in the cart drops Golden's earlier price (a change needs Golden's new price)
      await page.fill('.gmgroup [data-gq="0"]', '3'); await page.dispatchEvent('.gmgroup [data-gq="0"]', 'change'); await page.waitForTimeout(200);
      const m3 = await page.evaluate(() => ({ qty: GCART.items[0].qty, quote: !!GCART.quote, badge: document.getElementById('cartCount').textContent, tot: document.querySelector('.gmgroup .mgtot').innerText }));
      await t(`${label}: editing the Golden quantity in the cart updates the count and asks Golden to price it again`, () => ok(m3.qty === 3 && !m3.quote && m3.badge === '4' && /priced by Golden/.test(m3.tot), JSON.stringify(m3)));
      const geo = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        small: [...document.querySelectorAll('.gmgroup button, .gmgroup input')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).map(b => b.className || b.tagName) }));
      await t(`${label}: cart — no horizontal scroll; Golden group controls ≥ 44px`, () => { ok(geo.sw <= geo.cw + 1, JSON.stringify(geo)); ok(!geo.small.length, 'small: ' + geo.small.join(',')); });
      await page.screenshot({ path: path.join(SHOTS, `cart-mixed-${label}.png`), fullPage: false });
      // ── 6. Golden-only cart: the main button reviews Golden's order ──
      await page.evaluate(() => { CART.clear(); updateCart(); });
      const g1 = await page.evaluate(() => document.getElementById('submitOrder').textContent);
      await page.click('#submitOrder'); await page.waitForSelector('.gck-ship', { timeout: 15000 });
      await t(`${label}: a Golden-only cart's main button opens Golden's review (never the HCPS order API)`, () => ok(/Review Golden order/.test(g1) && ordersApi === 0 && submitOrder === 0, g1 + ' / ' + ordersApi + '/' + submitOrder));
      await page.click('[data-gck-close]');
      // ── 7. another tab adds a chair → this tab's cart follows ──
      const p2 = await ctx.newPage();
      await p2.goto(HOST + '/?preview=' + PREVIEW_TOKEN, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p2.waitForTimeout(2500);
      await p2.evaluate(() => { goldenCartAdd('PR511-LAR', { fabric: 'std', color: 'SUM', tier: null, footrest: false }, null, 1); });
      await page.waitForFunction(() => document.querySelectorAll('.gmgroup .citem').length === 2, null, { timeout: 10000 });
      const x1 = await page.evaluate(() => ({ badge: document.getElementById('cartCount').textContent, n: GCART.items.length }));
      await t(`${label}: a chair added in another tab appears in this tab's cart and count`, () => ok(x1.badge === '4' && x1.n === 2, JSON.stringify(x1)));
      await p2.close();
      // a dealer typing an HCPS PO while another tab changes the Golden cart keeps the field and every keystroke
      await page.evaluate(() => { const p = { manufacturer: 'strongback-mobility', code: '1019', name: 'Strongback Comfort Flip Arm Wheelchair 18"', base_price: 581, brand: 'Strongback' };
        CART.set(cartKey(p), { p, qty: 1 }); updateCart(); openCart(); });
      const poSel = '#cartGroups .mgroup:not(.gmgroup) input.po, #cartGroups .mgroup:not(.gmgroup) input[type=text]';
      const hasPo = await page.$(poSel);
      if (hasPo) {
        await page.focus(poSel); await page.keyboard.type('AB');
        await page.evaluate(() => { GCART.items[0].qty = 2; gckChanged(); });
        await page.keyboard.type('CD');
        const po = await page.evaluate(s => ({ v: document.querySelector(s).value, focus: document.activeElement === document.querySelector(s), g: document.querySelector('.gmgroup [data-gq="0"]').value }), poSel);
        await t(`${label}: typing an HCPS PO while the Golden cart changes keeps focus and every keystroke; the Golden group still updates`, () => ok(/ABCD$/.test(po.v) && po.focus && po.g === '2', JSON.stringify(po)));
      }
      // removing a Golden chair keeps keyboard focus inside the Golden group
      await page.focus('.gmgroup [data-grm="0"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const rf = await page.evaluate(() => ({ n: GCART.items.length, inG: !!(document.activeElement && document.activeElement.closest('.gmgroup')), tag: document.activeElement && document.activeElement.tagName }));
      await t(`${label}: removing a Golden chair from the cart keeps keyboard focus in the Golden group`, () => ok(rf.n === 1 && rf.inG, JSON.stringify(rf)));
      // ── 8. clear cart empties both ──
      await page.click('#clearCart'); await page.waitForTimeout(200);
      const e1 = await page.evaluate(() => ({ g: GCART.items.length, badge: getComputedStyle(document.getElementById('cartCount')).display, empty: /Your cart is empty/.test(document.getElementById('cartGroups').innerText) }));
      await t(`${label}: Clear cart empties the Golden chairs too`, () => ok(e1.g === 0 && e1.badge === 'none' && e1.empty, JSON.stringify(e1)));
      await t(`${label}: nothing ordered, nothing stored by HCPS, no email, no script error`, () => { ok(ordersApi === 0 && submitOrder === 0 && W.emails === 0 && W.hcpsWrites === 0, [ordersApi, submitOrder, W.emails, W.hcpsWrites].join('/')); ok(!pageErrors.length, pageErrors.join(' | ')); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\ngolden b61 browser: ${pass} passed, ${fail} failed · screenshots in ${SHOTS}`);
  process.exit(fail ? 1 : 0);
})();
