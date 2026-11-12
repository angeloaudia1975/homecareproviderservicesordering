/* Golden ⇄ Partner 360 — B5 Golden order history & tracking inside My Orders, browser walkthrough of the REAL page
   (public/index.html, the Partner 360 hub) on a deploy-preview address as a staff "view as dealer". The history / order
   calls run the REAL HCPS golden-proxy (HCPS_REPO, its allow-list cleaner) in-process, in front of a synthetic Golden
   /v1/history and /v1/orders/{ref} that answer in the contract 1.5.0 shape (Golden's own handlers are tested in the
   Golden repo). Synthetic data only; nothing reaches Golden, HCPS or an email provider; HCPS stores nothing.
   Checks at 390 / 768 / 1280 px: switched off = no section; list with Golden's statuses, PO, ship-to city, units,
   Golden's totals only when prices are visible; Load older (cursor sent); an order opens by click or keyboard and is
   refreshed from Golden (items, tracking as text, history); hostile text from Golden is shown as text; branch and
   "Golden unreachable → Try again" states; no horizontal scroll; touch targets ≥ 44px. Screenshots → SHOTS.
   PLAYWRIGHT_MODULE=… HCPS_REPO=… node test/golden-b5.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const HCPS = process.env.HCPS_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SHOTS = process.env.SHOTS || '/tmp/golden-b5-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://deploy-preview-99--hcpsonlineordering.netlify.app';
const hFN = path.join(HCPS, 'netlify', 'functions');
if (!fs.existsSync(path.join(hFN, 'golden-proxy.js')) || !/action === "history"/.test(fs.readFileSync(path.join(hFN, 'golden-proxy.js'), 'utf8'))) {
  console.log('skip  golden b5 browser: HCPS golden-proxy with B5 history not checked out'); process.exit(process.env.CI ? 1 : 0); }

const D_HQ = '11111111-2222-4333-8444-555555555555', PREVIEW_TOKEN = 'cd34'.repeat(12);
const GBASE = 'https://deploy-preview-283--goldenonlineordering.netlify.app';
const ORDER = o => Object.assign({ order_ref: 'P501', source: 'linked', status: 'shipped', placed_on: '2026-10-01', po_number: 'PO-77', so_numbers: ['SO1001'],
  ship_to: { city: 'Cincinnati', state: 'OH', address: 'LEAK street' }, expected_date: '2026-10-09', contact: 'LEAK contact', email: 'LEAK@x.invalid',
  items: [{ sku: 'PR511-LAR', description: 'Cloud Plus <img src=x onerror="window.__xss=1">', qty: 2, cost: 'LEAK', unit_price: 1300, ext_price: 2600, price_source: 'golden_so', so_number: 'SO1001' }],
  tracking: [{ so_number: 'SO1001', carrier: 'UPS', tracking_number: '1Z999', ship_date: '2026-10-08', url: 'javascript:LEAK' }],
  lifecycle: [{ type: 'submitted', at: '2026-10-01', label: 'Submitted' }, { type: 'shipped', at: '2026-10-08', so_number: 'SO1001', label: 'Shipped' }],
  totals: { subtotal: 2600, freight: 0, sh: 78, total: 2678, basis: 'golden_so_submitted_freight' } }, o || {});
const W = { mode: 'ready', pv: true, calls: [], hcpsWrites: 0, emails: 0, failNext: 0 };
function goldenAnswer(u) {
  const url = new URL(u); W.calls.push(url.pathname + url.search);
  if (W.failNext > 0) { W.failNext--; return [503, { error: { code: 'history_unavailable' } }]; }
  if (W.mode === 'branch') return [403, { error: { code: 'branch_history_not_permitted' } }];
  if (url.pathname.startsWith('/v1/orders/')) {
    const ref = decodeURIComponent(url.pathname.slice('/v1/orders/'.length));
    W.orderN = (W.orderN || 0) + 1;
    const tn = W.slowOrder ? (W.orderN === W.slowFirst ? '1Z1000' : '1Z2000') : '1Z1000';
    return [200, { contract_version: '1.5.0', request_id: 'req_o', prices_visible: W.pv, order: ref === 'P501'
      ? ORDER({ tracking: [{ so_number: 'SO1001', carrier: 'UPS', tracking_number: '1Z999', ship_date: '2026-10-08' }, { so_number: 'SO1001', carrier: 'UPS', tracking_number: tn, ship_date: '2026-10-09' }] })
      : ORDER({ order_ref: ref, status: 'acknowledged', source: 'golden', so_numbers: ['SO' + ref.slice(3)], tracking: [], lifecycle: [{ type: 'booked', at: '2026-10-02', label: '' }] }) }];
  }
  const before = url.searchParams.get('before');
  const page = before ? [ORDER({ order_ref: 'GSO0900', status: 'completed', source: 'golden', so_numbers: ['SO0900'], placed_on: '2026-08-12', po_number: '' })]
    : [ORDER(), ORDER({ order_ref: 'GSO1002', status: 'acknowledged', source: 'golden', so_numbers: ['SO1002'], placed_on: '2026-10-02', po_number: 'PO-78-' + 'X'.repeat(55), tracking: [], ship_to: { city: 'Columbus', state: 'OH' } })];
  return [200, { contract_version: '1.5.0', request_id: 'req_h', prices_visible: W.pv, orders: page, next_before: before ? null : 'GSO1002' }];
}
const fresh = (dir, m) => { Object.keys(require.cache).forEach(k => { if (k.startsWith(dir)) delete require.cache[k]; }); return require(path.join(dir, m)); };
let chain = Promise.resolve();
function runProxy(body, headers) {
  const job = chain.then(async () => {
    Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE: 'svc', SUPABASE_SERVICE_KEY: 'svc',
      GOLDEN_P360_KEY_ID: 'hcps-p360-1', GOLDEN_P360_SECRET: crypto.randomBytes(32).toString('hex'),
      GOLDEN_P360_TEST_KEY_ID: 'hcps-p360-test-1', GOLDEN_P360_TEST_SECRET: crypto.randomBytes(32).toString('hex'), GOLDEN_TEST_API_BASE: GBASE });
    const proxy = fresh(hFN, 'golden-proxy.js');
    const res = (status, b) => ({ ok: status < 400, status, json: async () => b, text: async () => JSON.stringify(b) });
    const saved = global.fetch;
    global.fetch = async (u, init) => {
      u = String(u); init = init || {};
      if (/resend|sendgrid|mailgun|smtp|graph\.microsoft/.test(u)) { W.emails++; throw new Error('no email may be sent'); }
      if (u.startsWith(GBASE + '/')) { if ((init.method || 'GET') !== 'GET') throw new Error('history is read-only'); const [s, b] = goldenAnswer(u); return res(s, b); }
      if (/dealer_preview_tokens/.test(u)) return res(200, [{ dealer_id: D_HQ, expires_at: new Date(Date.now() + 3600e3).toISOString() }]);
      if (/dealers\?id=eq\./.test(u)) return res(200, [{ id: D_HQ, parent_id: null }]);
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
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 500)); } }
const ghText = page => page.evaluate(() => (document.getElementById('goldenHist') || {}).innerText || '');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      Object.assign(W, { mode: 'ready', pv: true, calls: [], failNext: 0 });
      let proxyMode = 'real';   // 'off' = the switch-off answer golden-proxy gives
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
      const page = await ctx.newPage();
      const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e && e.message)));
      await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url());
        if (u.origin === HOST) {
          let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
          if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
          return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        }
        const H = { 'access-control-allow-origin': '*' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
        if (/\/functions\/dealer-auth/.test(u.pathname))
          return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: D_HQ, name: 'TEST — Golden Sandbox', email: 'sandbox@example.invalid', phone: '937-555-0100', contact_name: 'Pat Tester' }, lines: [], access: { your_accounts: [], available: [], golden: 'None' }, prices: {} }) });
        if (/\/functions\/order-history-api/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: true, orders: [] }) });
        if (/\/functions\/golden-proxy/.test(u.pathname)) {
          const b = JSON.parse(req.postData() || '{}');
          if (b.action === 'history' || b.action === 'order') {
            if (proxyMode === 'off') return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: true, enabled: false, reason: 'history_switched_off' }) });
            const hdr = await req.allHeaders();
            const out = await runProxy(b, { 'x-hcps-preview': hdr['x-hcps-preview'] || '', 'x-hcps-golden-env': hdr['x-hcps-golden-env'] || '', origin: hdr.origin || '' });
            if (W.slowOrder && b.action === 'order' && out.order && out.order.tracking.some(x => x.tracking_number === '1Z1000')) await new Promise(r => setTimeout(r, 2000));   // the older answer arrives last
            return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(out) });
          }
          const base = { ok: true, enabled: true, available: true, preview: true };
          const ans = b.action === 'eligibility' ? Object.assign(base, { state: 'account', capabilities: { see_prices: true, order: false, history: true } })
            : b.action === 'catalog' ? Object.assign(base, { prices_visible: true, linked: true, products: [] }) : Object.assign(base, { items: [] });
          return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify(ans) });
        }
        if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.host)) return route.continue();
        return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '[]' });
      });
      await page.goto(HOST + '/?preview=' + PREVIEW_TOKEN, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      const openOrders = async () => { await page.evaluate(() => showP360('orders')); await page.waitForSelector('#goldenHist', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(1200); };

      // 1 — switched off: no section
      proxyMode = 'off'; await openOrders();
      const offTxt = await ghText(page);
      await t(`${label}: history switched off → no Golden section, My Orders unchanged`, () => ok(offTxt.trim() === '' && pageErrors.length === 0, JSON.stringify({ offTxt, pageErrors })));

      // 2 — ready: list
      proxyMode = 'real'; await page.evaluate(() => showView('dash')); await page.waitForTimeout(300); await page.evaluate(() => showView('orders'));
      await page.waitForFunction(() => /PO-78/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      const list = await ghText(page);
      await t(`${label}: Golden's orders listed — status words, Golden SO numbers, PO, ship-to city, units, Golden's total`, () => {
        ok(/live from Golden Technologies/.test(list), list); ok(/SO1001/.test(list) && /SO1002/.test(list), list);
        ok(/Shipped/.test(list) && /Acknowledged by Golden/.test(list), list); ok(/PO-77/.test(list) && /Cincinnati, OH/.test(list) && /Columbus, OH/.test(list), list);
        ok(/\$2,678\.00/.test(list), 'total shown when prices visible: ' + list); ok(!/LEAK/.test(list), 'nothing outside the contract: ' + list); });
      const leakHtml = await page.evaluate(() => document.getElementById('goldenHist').innerHTML);
      await t(`${label}: no contact, email, street or cost reaches the page`, () => ok(!/LEAK/.test(leakHtml), 'LEAK in html'));

      // 3 — Load older
      await page.click('[data-ghmore]'); await page.waitForFunction(() => /SO0900/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      const older = await ghText(page);
      await t(`${label}: Load older sends Golden's cursor and appends the older page; the button goes when there is no more`, () => {
        ok(W.calls.some(c => /\/v1\/history\?.*before=GSO1002/.test(c)), W.calls.join(' | ')); ok(/SO1001/.test(older) && /SO0900/.test(older) && /Completed/.test(older), older);
        ok(!/Load older/.test(older), 'no more pages'); });

      // 3a — filters + print (search / status / date / location), over the orders already loaded; nothing sent
      const callsBefore = W.calls.length;
      await page.fill('#ghQ', 'PO-77'); await page.waitForTimeout(600);
      const fPo = await ghText(page); const fFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
      await page.fill('#ghQ', ''); await page.waitForTimeout(600);
      await page.selectOption('#ghS', 'completed'); await page.waitForTimeout(200); const fSt = await ghText(page);
      await page.click('[data-ghclear]'); await page.waitForTimeout(200);
      await page.fill('#ghFrom', '2099-01-01'); await page.dispatchEvent('#ghFrom', 'change'); await page.waitForTimeout(200); const fDate = await ghText(page);
      await page.click('[data-ghclear]'); await page.waitForTimeout(200); const fAll = await ghText(page);
      const printed = await page.evaluate(() => { let cls = null; const p = window.print; window.print = () => { cls = document.body.classList.contains('print-gh'); }; document.querySelector('[data-ghprint]').click(); window.print = p; return cls; });
      await t(`${label}: filters narrow the Golden orders (PO search keeps focus, status, date), Clear restores them, Print prints only the Golden section; no Golden call`, () => {
        ok(/PO-77/.test(fPo) && !/PO-78/.test(fPo) && /Showing 1 of 3/.test(fPo) && fFocus === 'ghQ', fPo.slice(0, 400) + ' focus=' + fFocus);
        ok(/Completed/.test(fSt) && !/PO-78/.test(fSt), fSt.slice(0, 300)); ok(/No Golden orders match these filters/.test(fDate), fDate.slice(0, 300));
        ok(/PO-77/.test(fAll) && /PO-78/.test(fAll) && !/Showing/.test(fAll), fAll.slice(0, 300)); ok(printed === true, 'print class'); ok(W.calls.length === callsBefore, 'filters call Golden'); });

      // 3b — a failed older page keeps the orders already shown
      await page.evaluate(() => showView('dash')); await page.waitForTimeout(200); await page.evaluate(() => showView('orders'));
      await page.waitForFunction(() => /PO-78/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      W.failNext = 1; await page.click('[data-ghmore]');
      await page.waitForFunction(() => /Couldn.t load older orders/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      const kept = await ghText(page); const fMore = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-ghmore'));
      const said = await page.evaluate(() => { const l = document.getElementById('goldenHistLive'); return l && l.getAttribute('aria-live') === 'polite' && l.textContent; });
      await page.click('[data-ghmore]'); await page.waitForFunction(() => /SO0900/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      const fNew = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-ghbtn'));
      await t(`${label}: a failed "Load older" keeps the list, is announced in the page's live region and offers Try again (focused); the retry appends and focuses the first new order`, () =>
        ok(/SO1001/.test(kept) && /SO1002/.test(kept) && fMore && fNew === 'GSO0900' && /could not be loaded/.test(said || ''), JSON.stringify({ fMore, fNew, said, kept: kept.slice(0, 300) })));

      // 4 — open an order by click, refreshed from Golden
      await page.click('[data-ghref="P501"]'); await page.waitForFunction(() => /1Z1000/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      const det = await ghText(page);
      const xss = await page.evaluate(() => window.__xss === 1 || !!document.querySelector('#goldenHist img'));
      await page.screenshot({ path: path.join(SHOTS, `golden-history-${label}.png`), fullPage: true });
      await t(`${label}: an order opens with items, tracking as text, history and Golden's totals — refreshed from Golden`, () => {
        ok(W.calls.some(c => c === '/v1/orders/P501'), W.calls.join(' | '));
        ok(/2 × PR511-LAR/.test(det) && /UPS · Tracking 1Z999/.test(det) && /1Z1000/.test(det) && /Booked by Golden|Submitted/.test(det), det);
        ok(/S&H \$78\.00/.test(det) && /Total \$2,678\.00/.test(det), det);
        ok(/\$1,300\.00 each · \$2,600\.00 · Golden sales order SO1001/.test(det), 'B5.1 line price from Golden\'s SO: ' + det);
        ok(/freight and S&H as quoted when you ordered/.test(det), 'totals basis: ' + det);
        ok(!xss, 'hostile text from Golden must stay text'); ok(/<img src=x/.test(det), 'shown as text'); });
      const noLink = await page.evaluate(() => !document.querySelector('#goldenHist a[href]'));
      await t(`${label}: tracking numbers are not turned into links`, () => ok(noLink));

      // 5 — keyboard: the order-number button toggles with Enter; aria-expanded follows; focus stays on the button
      await page.focus('[data-ghbtn="GSO1002"]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('[data-ghbtn="GSO1002"]').getAttribute('aria-expanded') === 'true' && /Not shipped yet/.test(document.getElementById('goldenHist').innerText), null, { timeout: 15000 });
      const kf = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-ghbtn'));
      await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const closed = await page.evaluate(() => document.querySelector('[data-ghbtn="GSO1002"]').getAttribute('aria-expanded') === 'false' && !document.querySelector('.gh-detail'));
      const kf2 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-ghbtn'));
      await t(`${label}: keyboard opens and closes an order from its button; aria-expanded follows; focus stays on it`, () => ok(kf === 'GSO1002' && closed && kf2 === 'GSO1002', JSON.stringify({ kf, closed, kf2 })));

      // 5b — a stale per-order refresh never overwrites a newer one (open → close → open quickly)
      W.slowOrder = 1; W.slowFirst = (W.orderN || 0) + 1;
      await page.evaluate(() => { document.querySelector('[data-ghbtn="P501"]').click(); });
      await page.waitForTimeout(50);
      await page.evaluate(() => { document.querySelector('[data-ghbtn="P501"]').click(); document.querySelector('[data-ghbtn="P501"]').click(); });
      await page.waitForFunction(() => /1Z2000/.test(document.getElementById('goldenHist').innerText), null, { timeout: 20000 });
      await page.waitForTimeout(2500);   // the slow (older) answer arrives after the newer one
      const stale = await ghText(page);
      await t(`${label}: an older refresh answering last does not replace the newer one`, () => ok(/1Z2000/.test(stale) && !/1Z1000/.test(stale), stale.slice(0, 600)));
      W.slowOrder = 0;
      await page.evaluate(() => document.querySelector('[data-ghbtn="P501"]').click()); await page.waitForTimeout(200);

      // 6 — layout
      const lay = await page.evaluate(() => { const bad = [...document.querySelectorAll('#goldenHist button')].filter(b => b.getBoundingClientRect().height && b.getBoundingClientRect().height < 44).length;
        const card = document.querySelector('#goldenHist .card'), cw = card ? card.getBoundingClientRect().right : 1e9;
        const wide = [...document.querySelectorAll('#goldenHist td')].filter(td => td.getBoundingClientRect().right > cw + 1).length;
        return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, bad, wide: getComputedStyle(document.querySelector('#goldenHist table')).display === 'block' ? wide : 0 }; });
      await t(`${label}: no horizontal page scroll; a 60-character PO wraps inside the card on phones; Golden buttons ≥ 44px`, () => ok(lay.over <= 1 && lay.bad === 0 && lay.wide === 0, JSON.stringify(lay)));

      // 7 — prices hidden
      W.pv = false; await page.evaluate(() => showView('dash')); await page.waitForTimeout(200); await page.evaluate(() => showView('orders'));
      await page.waitForFunction(() => /PO-78/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      const npv = await ghText(page);
      await t(`${label}: no amounts when Golden says prices are not visible`, () => ok(!/\$/.test(npv) && !/Total/.test(npv), npv));
      W.pv = true;

      // 8 — branch
      W.mode = 'branch'; await page.evaluate(() => showView('dash')); await page.waitForTimeout(200); await page.evaluate(() => showView('orders'));
      await page.waitForFunction(() => /head-office/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      await t(`${label}: a branch is told history is on the head-office account`, async () => ok(/head-office account/.test(await ghText(page))));
      W.mode = 'ready';

      // 9 — Golden unreachable → Try again
      W.failNext = 1; await page.evaluate(() => showView('dash')); await page.waitForTimeout(200); await page.evaluate(() => showView('orders'));
      await page.waitForSelector('[data-ghretry]', { timeout: 15000 });
      const rh = await page.evaluate(() => document.querySelector('[data-ghretry]').getBoundingClientRect().height);
      await page.click('[data-ghretry]');
      await page.waitForFunction(() => /PO-78/.test((document.getElementById('goldenHist') || {}).innerText || ''), null, { timeout: 15000 });
      await t(`${label}: Golden unreachable → "Try again" (≥ 44px) loads the history`, () => ok(rh >= 44, 'height ' + rh));

      await t(`${label}: HCPS stored nothing, no email, every Golden call was a read, no page errors`, () => ok(W.hcpsWrites === 0 && W.emails === 0 && pageErrors.length === 0, JSON.stringify({ w: W.hcpsWrites, e: W.emails, pageErrors })));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
