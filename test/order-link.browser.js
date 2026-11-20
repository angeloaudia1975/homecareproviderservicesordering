/* "View order" from the dealer's acknowledgment email (owner 2026-11-17): ?order=<id> opens My Orders with that order
   highlighted once the dealer is in, and leaves the address bar. REAL page (_shop-harness.js), nothing leaves it.
   PLAYWRIGHT_MODULE=… node test/order-link.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 300)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const ID = 'a1b2c3d4-0000-4000-8000-00000000d001';
const ORDERS = [{ id: 'other-1', date: '2026-11-10', source: 'portal', status: 'submitted', manufacturer: 'yuwell', manufacturerName: 'Yuwell', lines: [{ code: 'Y1', qty: 1 }], units: 1, cost: 9, total: 9 },
  { id: ID, date: '2026-11-17', source: 'portal', status: 'pending_account_setup', manufacturer: 'dalton', manufacturerName: 'Dalton Medical', po: 'PO-TEST1', lines: [{ code: 'BED1200i', qty: 1 }], units: 1, cost: 350, total: 395, services: [{ label: 'Liftgate service', fee: 45 }], services_fee: 45 }];
(async () => {
  const b = await chromium.launch();
  for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) {
    const { ctx, page } = await open(b, w, h, {});
    await page.route('**/order-history-api', (r) => { const x = JSON.parse(r.request().postData() || '{}');
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x.action === 'history' ? { ok: true, orders: ORDERS } : { ok: true, ytd: {}, allTime: {}, byManufacturer: [], monthly: [], recent: [] }) }); });
    await page.waitForTimeout(2500);
    /* the staff preview this harness opens never captures a link (a preview is not the dealer); run what a signed-in dealer's
       page runs: the address carries ?order=, it is captured, then consumed once the dealer is in */
    await page.evaluate((id) => { history.replaceState(null, '', location.pathname + '?order=' + id); capturePendingOrder(); consumePendingOrder(); }, ID);
    await page.waitForFunction(() => !!document.querySelector('#view-orders tr.order-hit'), null, { timeout: 20000 }).catch(() => {});
    const r = await page.evaluate(() => { const hit = document.querySelector('#view-orders tr.order-hit'); const v = document.querySelector('#view-orders');
      return { hit: hit && hit.getAttribute('data-order'), visible: !!(v && v.offsetParent), search: location.search, n: document.querySelectorAll('#view-orders tr.order-hit').length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    await t(`${label}: the link opens My Orders with exactly that order highlighted, and the order id leaves the address bar`, () => {
      ok(r.visible, 'My Orders not shown'); ok(r.hit === ID && r.n === 1, JSON.stringify(r)); ok(!/order=/.test(r.search), r.search); ok(r.sw <= r.cw + 1, 'horizontal scroll'); });
    await ctx.close();
  }
  { const { ctx, page } = await open(b, 1280, 900, {});
    await page.waitForTimeout(2500);
    await page.evaluate(() => { history.replaceState(null, '', location.pathname + '?order=' + encodeURIComponent('x"><img src=x onerror=alert(1)>')); capturePendingOrder(); consumePendingOrder(); });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({ stored: (() => { try { return sessionStorage.getItem('hcps_pending_order'); } catch (e) { return 'err'; } })(), hit: document.querySelectorAll('tr.order-hit').length }));
    await t('a malformed order id is ignored (never stored, nothing highlighted)', () => { ok(!r.stored && r.hit === 0, JSON.stringify(r)); });
    await ctx.close(); }
  await t('the dealer sign-in path captures the link before signing in and consumes it once the dealer is in (a staff preview never does)', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8');
    ok(/capturePendingProduct\(\); capturePendingOrder\(\);\n    AUTH\.session=loadStoredSession\(\);/.test(src), 'capture before sign-in');
    ok(/if\(!consumePendingOrder\(\)\) consumePendingProduct\(\);\}/.test(src), 'consume after sign-in');
    const pv = src.indexOf("const _pv=new URLSearchParams(location.search).get('preview');"), cap = src.indexOf('capturePendingProduct(); capturePendingOrder();');
    ok(pv > 0 && cap > pv, 'preview returns before capture'); });
  await b.close(); console.log(`\norder link (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
