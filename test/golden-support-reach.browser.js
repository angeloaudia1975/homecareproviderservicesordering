/* Golden Service & Support — SECTION REACHABILITY (E3 visual revision; Command Center for Dealer Portal, #42).
   Independent of the look: whatever fonts, colours, spacing and navigation the revision uses, at phone (390), tablet (768)
   and desktop (1280) every one of the six support sections must be reachable by tapping its own control, show content,
   keep the page from scrolling sideways, and (below 700px) give every visible control a ≥44px tap target.
   GOLDEN_REPO=… node test/golden-support-reach.browser.js */
const path = require('path');
const { chromium, open } = require('./_shop-harness.js');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const S = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog.js'));
const DATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog-data.json'));
const TABS = ['troubleshoot', 'videos', 'parts', 'request', 'docs', 'labor'];
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 600)); } }
async function openSupport(browser, w, h) {
  const { ctx, page } = await open(browser, w, h, {});
  await page.route(/img\.youtube\.com|send-parts|goldentech\.com|resend\.com/, (r) => r.abort());
  await page.route('**/functions/golden-proxy', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const body = b.action === 'service_catalog' ? Object.assign({ ok: true, enabled: true, available: true, as_of: '2026-11-20T10:00:00Z' }, S.build(DATA, { seePrices: true, linked: true }))
      : { ok: true, enabled: false, reason: 'off' };
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await page.evaluate(() => showView('goldsvc'));
  await page.waitForFunction(() => { const h = document.querySelector('#gsvHost'); return h && h.shadowRoot && h.shadowRoot.querySelector('#tab-troubleshoot'); }, null, { timeout: 15000 });
  return { ctx, page };
}
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [768, 1024], [1280, 900]]) {
    const { ctx, page } = await openSupport(browser, w, h);
    for (const tab of TABS) await t(`${w}: “${tab}” is reachable by its own control and shows content`, async () => {
      const r = await page.evaluate((tab) => {
        const R = document.querySelector('#gsvHost').shadowRoot;
        const btn = [...R.querySelectorAll('button,a,[role=tab]')].find((x) => (x.getAttribute('onclick') || x.getAttribute('data-tab') || x.getAttribute('href') || '').includes(tab));
        if (!btn) return { err: 'no control for ' + tab };
        btn.scrollIntoView({ block: 'center', inline: 'center' });
        const br = btn.getBoundingClientRect();
        if (!(br.width > 0 && br.height > 0)) return { err: 'control hidden' };
        const hit = R.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2) || document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
        const covered = hit && hit !== btn && !btn.contains(hit) && !(hit.shadowRoot && hit === document.querySelector('#gsvHost'));
        btn.click();
        const p = R.getElementById('tab-' + tab); const pr = p && p.getBoundingClientRect();
        return { covered, cw: br.width, ch: br.height, shown: !!(p && pr.height > 20 && getComputedStyle(p).display !== 'none'), text: p ? p.innerText.trim().length : 0 };
      }, tab);
      ok(!r.err, r.err); ok(!r.covered, 'control is covered by another element'); ok(r.shown && r.text > 20, 'section did not show content');
      if (w <= 700) ok(r.ch >= 44, `control ${Math.round(r.ch)}px tall (< 44)`);
    });
    await t(`${w}: no sideways page scroll; every visible control ≥44px below 700px`, async () => {
      for (const tab of TABS) {
        const r = await page.evaluate((tab) => {
          const R = document.querySelector('#gsvHost').shadowRoot;
          const btn = [...R.querySelectorAll('button,a,[role=tab]')].find((x) => (x.getAttribute('onclick') || x.getAttribute('data-tab') || x.getAttribute('href') || '').includes(tab)); btn.click();
          const p = R.getElementById('tab-' + tab);
          const small = [...p.querySelectorAll('button,a.btn,a.btn-gold,select,input:not([type=hidden]),[role=button]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 44; }).map((e) => (e.textContent || e.name || e.tagName).trim().slice(0, 30));
          return { over: document.documentElement.scrollWidth - window.innerWidth, small };
        }, tab);
        ok(r.over <= 1, `${tab}: page overflows ${r.over}px`);
        if (w <= 700) ok(!r.small.length, `${tab}: under 44px: ${r.small.slice(0, 6).join(' | ')}`);
      }
    });
    await ctx.close();
  }
  await browser.close();
  console.log(`\ngolden-support-reach: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
