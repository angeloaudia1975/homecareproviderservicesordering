/* My Orders after placing an order (TEST acceptance 2026-11-15 found a stale list): once checkout records an order the
   Business Hub's cached history is dropped, so My Orders asks the server again. REAL page, nothing leaves it.
   node test/orders-refresh.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 300)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
(async () => {
  const b = await chromium.launch(); const { ctx, page } = await open(b, 1280, 900, {});
  let n = 0;
  await page.route('**/order-history-api', (r) => { const x = JSON.parse(r.request().postData() || '{}'); if (x.action === 'history') n++;
    const orders = n > 1 ? [{ id: 'o2', date: '2026-11-15', source: 'portal', status: 'pending_account_setup', manufacturer: 'yuwell', manufacturerName: 'Yuwell', lines: [{ code: 'YHT101', qty: 1 }], units: 1, cost: 9, total: 9 }] : [];
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x.action === 'history' ? { ok: true, orders } : { ok: true, ytd: {}, allTime: {}, byManufacturer: [], monthly: [], recent: [] }) }); });
  await page.waitForTimeout(1500);
  await t('the history cached before checkout is dropped after an order is recorded, and My Orders shows the new order', async () => {
    await page.evaluate(() => showP360('orders')); await page.waitForTimeout(1500);
    const n1 = n; await page.evaluate(() => showP360('dash')); await page.evaluate(() => showP360('orders')); await page.waitForTimeout(800);
    ok(n === n1, 'cached while nothing changed (' + n1 + ' → ' + n + ')');
    await page.evaluate(() => window.P360.invalidateHistory()); await page.evaluate(() => showP360('orders')); await page.waitForTimeout(1500);
    ok(n === n1 + 1, 'asked again after an order (' + n + ')');
    ok(/Yuwell/.test(await page.$eval('#view-orders', (e) => e.innerText)), 'new order listed');
  });
  await t('checkout calls it once an order is recorded', async () => {
    const src = await page.evaluate(() => submitOrder.toString()); ok(/P360\.invalidateHistory\(\)/.test(src), 'submitOrder does not refresh My Orders');
  });
  await ctx.close(); await b.close(); console.log(`\norders refresh (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
