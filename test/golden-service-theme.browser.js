/* Golden Service & Support in the Dealer 360 theme (public/golden-support/d360-theme.css, owner 2026-11-15 request, built
   2026-11-22), in the REAL public/index.html (_shop-harness.js; nothing reaches HCPS, Golden or Supabase; nothing is submitted).
   At 390 / 768 / 1280: the theme is loaded after Golden's CSS; Golden's name, logo colour, support number and diagnostic colours
   stay; every section tab is visible without sideways scrolling and reachable; each tab opens; the Parts & Service Request form
   renders with 44 px controls and 16 px phone inputs; no horizontal page scroll. SHOTS=dir also saves before/after images.
   GOLDEN_REPO=… ADMIN_REPO=… node test/golden-service-theme.browser.js */
const path = require('path'), fs = require('fs');
const { chromium, open } = require('./_shop-harness.js');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const S = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog.js'));
const DATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog-data.json'));
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const CORS = { 'access-control-allow-origin': '*' };
async function fake(page, st, noTheme) {
  await page.route('**/functions/golden-proxy', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); st.calls.push(b.action);
    let body = { ok: true, enabled: false, reason: 'off' };
    if (b.action === 'service_catalog') body = Object.assign({ ok: true, enabled: true, available: true, as_of: '2026-11-13T10:00:00Z' }, S.build(DATA, { seePrices: true, linked: true }));
    if (b.action === 'service_submit') { st.submits.push(b); body = { ok: false }; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
  if (noTheme) await page.route('**/golden-support/d360-theme.css', (r) => r.fulfill({ status: 404, body: '' }));
}
async function openSvc(page) {
  await page.evaluate(() => showP360('resources')); await page.waitForSelector('#gsvcRow .rl', { timeout: 15000 }); await page.click('#gsvcRow .btn');
  await page.waitForFunction(() => { const x = document.querySelector('#gsvHost'); return x && x.shadowRoot && x.shadowRoot.querySelectorAll('.tab-btn').length === 7; }, null, { timeout: 15000 });
  await page.waitForTimeout(400);
}
const R = (page, fn, arg) => page.evaluate(([f, a]) => (new Function('root', 'a', f))(document.querySelector('#gsvHost').shadowRoot, a), [fn, arg]);
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'phone']]) {
      for (const before of SHOTS ? [true, false] : [false]) {
        const st = { calls: [], submits: [] }; const { ctx, page } = await open(browser, w, h, {}); await fake(page, st, before); await openSvc(page);
        const tag = (before ? 'before' : 'after') + '-' + label;
        if (!before) await t(label + ': theme loaded after Golden\'s CSS; Golden name, logo colour and support number kept; diagnostic colours unchanged', async () => {
          const r = await R(page, `const st=root.querySelectorAll('style'); const th=root.querySelector('style[data-d360-theme]');
            const cs=(s)=>getComputedStyle(root.querySelector(s)); return { order: st[1]===th && th.textContent.length>500, hdr: cs('.site-header').backgroundColor, logo: cs('.header-logo').backgroundColor,
            name: root.querySelector('.header-title').textContent, num: root.querySelector('.header-support-num').textContent, green: getComputedStyle(root.host).getPropertyValue('--green').trim(), red: getComputedStyle(root.host).getPropertyValue('--red').trim(), font: cs('.gsv-body').fontFamily }`);
          ok(r.order, 'theme style'); ok(r.hdr === 'rgb(255, 255, 255)', 'header ' + r.hdr); ok(r.logo === 'rgb(201, 151, 58)', 'logo ' + r.logo);
          ok(/Golden Technologies/.test(r.name), r.name); ok(/1-800-624-6374/.test(r.num), r.num); ok(r.green === '#2E7D52' && r.red === '#C0392B', r.green + r.red); ok(/Inter/.test(r.font), r.font);
        });
        if (!before) await t(label + ': all seven sections visible without sideways scrolling, each opens its panel', async () => {
          const r = await R(page, `const n=root.querySelector('.tab-nav'); const hostR=root.host.getBoundingClientRect(); return { scroll: n.scrollWidth-n.clientWidth, out: [...root.querySelectorAll('.tab-btn')].filter(b=>{const x=b.getBoundingClientRect(); return x.right>hostR.right+1||x.left<hostR.left-1||x.height<43.5;}).map(b=>b.textContent.trim()) }`);
          ok(r.scroll <= 1, 'tab nav scrolls ' + r.scroll); ok(!r.out.length, 'cut off / small: ' + r.out);
          const names = await R(page, `return [...root.querySelectorAll('.tab-btn')].map(b=>b.textContent.trim())`);
          for (let i = 0; i < names.length; i++) { await R(page, `root.querySelectorAll('.tab-btn')[a].click()`, i); await page.waitForTimeout(80);
            const on = await R(page, `const p=root.querySelector('.tab-panel.active'); return p && p.getBoundingClientRect().height>40 ? p.id : ''`); ok(on, names[i] + ' panel'); }
        });
        await R(page, `root.querySelectorAll('.tab-btn')[0].click()`); await page.waitForTimeout(150);
        /* screenshots only: the portal's own sticky header is laid flat so the module itself is in frame (layout tests above ran with it in place) */
        if (SHOTS) await page.addStyleTag({ content: '.shotflat{position:static!important}' });
        const off = SHOTS ? await page.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const p = getComputedStyle(e).position; if ((p === 'sticky' || p === 'fixed') && !e.closest('#gsvHost') && e.offsetHeight < 700) e.classList.add('shotflat'); } return 0; }) : await page.evaluate(() => { let m = 0; for (const e of document.querySelectorAll('body *')) { const p = getComputedStyle(e).position; if ((p === 'sticky' || p === 'fixed') && e.getBoundingClientRect().top < 5 && e.offsetHeight < 400) m = Math.max(m, e.getBoundingClientRect().bottom); } return m; });
        await page.evaluate((o) => { window.__off = o; const x = document.querySelector('#gsvHost'); window.scrollTo(0, x.getBoundingClientRect().top + window.scrollY - o - 8); }, off); await page.waitForTimeout(150);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, tag + '-troubleshoot.png'), fullPage: false });
        const fi = await R(page, `return [...root.querySelectorAll('.tab-btn')].findIndex(b=>/Parts & Service Request/.test(b.textContent))`);
        await R(page, `root.querySelectorAll('.tab-btn')[a].click()`, fi); await page.waitForTimeout(200);
        await page.evaluate(() => { const p = document.querySelector('#gsvHost').shadowRoot.querySelector('.tab-panel.active'); window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - (window.__off || 0) - 8); }); await page.waitForTimeout(150);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, tag + '-service-form.png'), fullPage: false });
        if (!before) await t(label + ': Parts & Service Request form renders — 44 px controls, 16 px phone inputs, no page overflow; nothing submitted', async () => {
          const r = await R(page, `const p=root.querySelector('.tab-panel.active'); const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0}; const ins=[...p.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=file]),select')].filter(vis);
            return { n: ins.length, low: ins.filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.id||e.name).slice(0,5), tiny: ins.filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).length, btn: [...p.querySelectorAll('.submit-btn')].filter(vis).length }`);
          ok(r.n >= 5, 'fields ' + r.n); ok(!r.low.length, 'short ' + r.low); if (w < 980) ok(!r.tiny, 'tiny ' + r.tiny); ok(r.btn >= 1, 'submit button');
          const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(ov <= 1, 'overflow ' + ov); ok(!st.submits.length, 'submitted');
        });
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(`\ngolden-service-theme: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
