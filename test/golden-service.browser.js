/* Golden Service & Support 360, Stage 2 — the native Dealer 360 view, in the REAL public/index.html (_shop-harness.js;
   nothing reaches HCPS, Golden or Supabase). golden-proxy "service_catalog" is answered with Golden's REAL extracted support
   data (golden-dealer-portal lib/service-catalog.js + service-catalog-data.json) passed through the admin repo's REAL proxy
   cleaner. At 390 / 768 / 1280: the Resources row appears only when the proxy answers enabled; the six areas; parts lookup
   is the original portal (test/golden-support-parity.browser.js compares it area by area); no horizontal scroll, 44 px buttons.
   GOLDEN_REPO=… ADMIN_REPO=… PLAYWRIGHT_MODULE=… node test/golden-service.browser.js */
const path = require('path');
const { chromium, open } = require('./_shop-harness.js');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const S = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog.js'));
const DATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog-data.json'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const CORS = { 'access-control-allow-origin': '*' };

function answer(pv, off) {
  if (off) return { ok: true, enabled: false, reason: 'service_switched_off' };
  // Golden's handler output → the proxy's own reply shape (same fields the proxy keeps)
  const g = S.build(DATA, { seePrices: pv, linked: true });
  return Object.assign({ ok: true, enabled: true, available: true, as_of: '2026-11-13T10:00:00Z' }, g);
}
async function fake(page, st) {
  await page.route('**/functions/golden-proxy', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); st.calls.push(b.action);
    let body = b.action === 'service_catalog' ? answer(st.pv, st.off) : { ok: true, enabled: false, reason: 'off' };
    if (b.action === 'service_cases') body = st.submit ? { ok: true, enabled: true, cases: st.cases || [] } : { ok: true, enabled: false, reason: 'service_submit_switched_off' };
    if (b.action === 'service_submit') { st.submits = (st.submits || []).concat([b]); if (st.failFirst && st.submits.length === 1) return route.fulfill({ status: 502, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false }) });
      st.cases = [{ case_no: 'GS-0A1B2C3D', kind: b.request.kind, what: '1 part', status: 'sent', created_at: '2026-11-13T10:00:00Z', routed_to: 'liftchairparts@goldentech.com', attachments: (b.request.attachments || []).length }];
      body = { ok: true, enabled: true, accepted: true, case_no: 'GS-0A1B2C3D', duplicate: st.submits.length > 1, routed_to: 'liftchairparts@goldentech.com', email: { status: 'sent' } }; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
}
const layout = (page) => page.evaluate(() => {
  const v = document.querySelector('#view-goldsvc'); const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  return { overflow: document.documentElement.scrollWidth - window.innerWidth, small: [...v.querySelectorAll('.btn')].filter(vis).filter(e => e.getBoundingClientRect().height < 43.5).map(e => e.textContent.trim()),
    imgs: v.querySelectorAll('img').length, tiny: [...v.querySelectorAll('select,input')].filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).length };
});
const txt = (page) => page.evaluate(() => document.querySelector('#view-goldsvc').textContent);

(async () => {
  const browser = await chromium.launch();
  try {
    { const st = { calls: [], off: true }; const { ctx, page } = await open(browser, 1280, 900, {}); await fake(page, st);
      await page.evaluate(() => showP360('resources')); await page.waitForTimeout(1200);
      await t('switch off: no Golden Service row on Resources; the view says not available', async () => {
        ok(!(await page.$('#gsvcRow .rl')), 'row shown while off'); ok(st.calls.includes('service_catalog'), 'asked once');
        await page.evaluate(() => showView('goldsvc')); await page.waitForTimeout(300); ok(/not available for your account/.test(await txt(page)), 'off message');
      });
      await ctx.close(); }
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const st = { calls: [], pv: true }; const { ctx, page } = await open(browser, w, h, {}); await fake(page, st);
      await page.evaluate(() => showP360('resources'));
      await page.waitForSelector('#gsvcRow .rl', { timeout: 15000 });
      await t(label + ': Resources shows Golden Service & Support; it opens the original portal (six areas + My Requests) inside Dealer 360 — no iframe, no redirect', async () => {
        await page.click('#gsvcRow .btn');
        await page.waitForFunction(() => { const x = document.querySelector('#gsvHost'); return x && x.shadowRoot && x.shadowRoot.querySelectorAll('.tab-btn').length === 7; }, null, { timeout: 15000 });
        const tabs = await page.evaluate(() => [...document.querySelector('#gsvHost').shadowRoot.querySelectorAll('.tab-btn')].map(b => b.textContent.trim()));
        for (const a of ['Troubleshoot', 'Training Videos', 'Parts Lookup & Order', 'Parts & Service Request', 'Service Documents', 'Labor Rate Request', 'My Requests']) ok(tabs.some(x => x.includes(a)), a);
        ok(!(await page.$('#view-goldsvc iframe')), 'iframe'); ok(/goldsvc|hcpsonlineordering|deploy-preview/.test(page.url()) && !/goldentechsupport/.test(page.url()), 'stayed in Dealer 360');
        ok(st.calls.filter(c => c === 'service_catalog').length === 1, 'one call, cached');
        const L = await layout(page); ok(L.overflow <= 1, 'overflow ' + L.overflow); ok(!L.small.length, 'small ' + L.small);
      });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
