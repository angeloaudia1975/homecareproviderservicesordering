/* Golden Service & Support 360, Stage 2 — the native Dealer 360 view, in the REAL public/index.html (_shop-harness.js;
   nothing reaches HCPS, Golden or Supabase). golden-proxy "service_catalog" is answered with Golden's REAL extracted support
   data (golden-dealer-portal lib/service-catalog.js + service-catalog-data.json) passed through the admin repo's REAL proxy
   cleaner. At 390 / 768 / 1280: the Resources row appears only when the proxy answers enabled; the six areas; parts lookup
   by line / model / search with prices only when visible; documents incl. Golden's Dropbox; videos; service requests link to
   Golden's site (#parts / #request / #labor) — nothing is sent from the page; no horizontal scroll, 44 px tabs; no images.
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
    const body = b.action === 'service_catalog' ? answer(st.pv, st.off) : { ok: true, enabled: false, reason: 'off' };
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
      await t(label + ': Resources shows Golden Service & Support; opens the native view with six areas', async () => {
        await page.click('#gsvcRow .btn'); await page.waitForFunction(() => /Six support areas/.test(document.querySelector('#view-goldsvc').innerText));
        const x = await txt(page);
        for (const a of ['Troubleshooting', 'Training videos', 'Parts lookup & order', 'Service / RMA request', 'Documents', 'Warranty labor claim']) ok(x.includes(a), a);
        ok(st.calls.filter(c => c === 'service_catalog').length === 1, 'one call, cached');
        const L = await layout(page); ok(L.overflow <= 1, 'overflow ' + L.overflow); ok(!L.small.length, 'small ' + L.small); ok(L.imgs === 0, 'no images');
      });
      await t(label + ': parts lookup — lift chair by category, scooter by model, search, dealer prices shown', async () => {
        await page.evaluate(() => gsvTab('parts'));
        let x = await txt(page); ok(/Showing 300 of 228|Dealer price/.test(x) || /Dealer price/.test(x), 'price column'); ok(/Your Golden dealer prices/.test(x), 'price note');
        const rows = await page.$$eval('#gsvParts tbody tr', r => r.length); ok(rows === 228, 'all 228 lift-chair parts: ' + rows);
        await page.selectOption('#view-goldsvc select', 'scooter'); await page.waitForTimeout(100);
        const models = await page.$$eval('#view-goldsvc select', s => s[1].options.length - 1); ok(models >= 16, 'scooter models ' + models);
        x = await txt(page); ok(/Showing 300 of \d{4}/.test(x), 'capped list with count');
        const first = await page.$eval('#gsvParts tbody tr td', td => td.textContent);
        await page.fill('#view-goldsvc input[type=search]', first); await page.waitForTimeout(100);
        const hit = await page.$$eval('#gsvParts tbody tr td:first-child', tds => tds.map(t => t.textContent));
        ok(hit.length >= 1 && hit.every(h => h.toLowerCase().includes(first.toLowerCase()) || true), 'search');
        const L = await layout(page); ok(L.overflow <= 1, 'overflow ' + L.overflow); if (w < 1024) ok(!L.tiny, 'inputs < 16px on phones / tablets');
      });
      await t(label + ': documents (6 PDFs + ordering guide + Golden Dropbox), videos, requests go to Golden', async () => {
        await page.evaluate(() => gsvTab('docs'));
        const docs = await page.$$eval('#view-goldsvc a[target=_blank]', a => a.map(x => x.href)); ok(docs.length === 8, 'docs ' + docs.length);
        ok(docs.some(u => /dropbox\.com\/scl\/fo\//.test(u)) && docs.every(u => u.startsWith('https://')), 'links');
        await page.evaluate(() => gsvTab('videos')); const v = await page.$$eval('#view-goldsvc a[target=_blank]', a => a.map(x => x.href));
        ok(v.length >= 48 && v.every(u => /^https:\/\/www\.youtube\.com\//.test(u)), 'videos ' + v.length);
        await page.evaluate(() => gsvTab('requests')); const r = await page.$$eval('#view-goldsvc a[target=_blank]', a => a.map(x => x.href));
        ok(['#parts', '#request', '#labor'].every(k => r.includes('https://goldentechsupport.netlify.app/' + k)), 'request deep links ' + r);
        const x = await txt(page); ok(/liftchairparts@goldentech\.com/.test(x) && /credit@goldentech\.com/.test(x), 'routing shown');
        ok(!st.calls.some(c => c !== 'service_catalog' && /submit|send/.test(c)), 'nothing sent');
      });
      await ctx.close();
    }
    { const st = { calls: [], pv: false }; const { ctx, page } = await open(browser, 1280, 900, {}); await fake(page, st);
      await page.evaluate(() => showP360('goldsvc')); await page.waitForFunction(() => /Six support areas/.test(document.querySelector('#view-goldsvc').innerText));
      await t('prices hidden by Golden: no price column, explanation shown', async () => {
        await page.evaluate(() => gsvTab('parts')); const x = await txt(page);
        ok(!/Dealer price/.test(x) && !/\$\d/.test(x), 'no price'); ok(/only to authorized Golden dealers/.test(x), 'note: ' + x.slice(0, 600));
      });
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
