/* FEATURED THIS MONTH on the REAL portal page (owner milestone 2026-11-22 §4), at 1280 / 768 / 390:
   - Dealer Overview and the first Shop Products screen show the month's products with the existing featured cards, in order;
   - a product on a line this dealer can't see (Dalton: request access only) is left out and the next alternate takes its place;
   - prices are the dealer's own catalog prices (none where the line has none);
   - one featured_view per card per placement per visit; opening a card records featured_open and opens that product;
   - nothing is shown (no heading) when the month has no products; no sideways scroll; cards reachable by keyboard. */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
let MONTH_EMPTY = false;
const MONTH = { ok: true, month: '2026-11', items: [{ manufacturer: 'access4u', code: 'RS1x36', name: 'Ramp section' }, { manufacturer: 'dalton', code: 'BED1200i', name: 'Bed' }, { manufacturer: 'bemis', code: '7YR05310TSS', name: 'Seat' }, { manufacturer: 'pedifix', code: 'P15', name: 'Pad' }],
  alternates: [{ manufacturer: 'pedifix', code: 'P16', name: 'Pad 2' }, { manufacturer: 'bemis', code: '7YE05310TSS', name: 'Seat 2' }] };

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [768, 1000, 'tablet'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, { prices: { access4u: 120 } });
      const ev = []; let month = MONTH;
      await page.route('**/featured-month-api*', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(month) }));
      await page.route('**/events-api', (r) => { try { ev.push(...JSON.parse(r.request().postData() || '{}').events); } catch (e) {} return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }); });
      await page.evaluate(() => { if (!AUTH.session) AUTH.session = { access_token: 'tok' }; DASH.ftm = null; });
      await page.evaluate(() => showShop());
      await page.waitForSelector('#ftmShop .fcard', { timeout: 20000 });
      const cards = (sel) => page.$$eval(sel + ' .fcard', (e) => e.map((x) => ({ code: x.dataset.ftmCode, slot: x.dataset.ftmSlot, text: x.innerText.replace(/\s+/g, ' ') })));
      await t(`${label}: Shop Products shows the month in order; the Dalton product (no catalog access) is replaced by the first alternate`, async () => {
        const c = await cards('#ftmShop'); ok(JSON.stringify(c.map((x) => x.code)) === JSON.stringify(['RS1x36', '7YR05310TSS', 'P15', 'P16']), JSON.stringify(c.map((x) => x.code)));
        ok(c[3].slot === 'alt1' && !c.some((x) => x.code === 'BED1200i'));
        ok(/\$120/.test(c[0].text) && !/\$/.test(c[1].text), 'prices: ' + JSON.stringify(c.map((x) => x.text)));
        ok(/Featured this month/.test(await page.innerText('#ftmShop')), 'heading'); });
      await t(`${label}: one featured_view per card for the Shop placement, with month and slot`, async () => {
        await page.waitForTimeout(400); const v = ev.filter((e) => e.type === 'featured_view');
        ok(v.length === 4 && v.every((e) => e.meta.placement === 'shop' && e.meta.month === '2026-11') && v[3].meta.slot === 'alt1', JSON.stringify(v));
        await page.evaluate(() => showShop()); await page.waitForSelector('#ftmShop .fcard'); await page.waitForTimeout(300);
        ok(ev.filter((e) => e.type === 'featured_view').length === 4, 'counted twice in one visit'); });
      await t(`${label}: no sideways scroll; a card opens by keyboard`, async () => {
        ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'overflow');
        const tab = await page.$eval('#ftmShop .fcard', (e) => e.getAttribute('tabindex') === '0' && e.getAttribute('role') === 'button'); ok(tab); });
      await t(`${label}: opening a card records featured_open and opens that product's line`, async () => {
        await page.click('#ftmShop .fcard >> nth=2'); await page.waitForTimeout(1500);
        const o = ev.filter((e) => e.type === 'featured_open'); ok(o.length === 1 && o[0].product === 'P15' && o[0].manufacturer === 'pedifix' && o[0].meta.placement === 'shop', JSON.stringify(o));
        ok(await page.evaluate(() => state.active === 'pedifix'), 'line not opened'); });
      await t(`${label}: Dealer Overview shows the same four, counted under its own placement`, async () => {
        await page.evaluate(() => { DASH.ftm = null; showP360('dash'); }); await page.waitForSelector('#ftmDash .fcard', { timeout: 20000 });
        const c = await cards('#ftmDash'); ok(c.length === 4 && c[0].code === 'RS1x36', JSON.stringify(c.map((x) => x.code)));
        await page.waitForTimeout(300); ok(ev.filter((e) => e.type === 'featured_view' && e.meta.placement === 'overview').length === 4); });
      await t(`${label}: an empty month shows nothing (no heading)`, async () => {
        month = { ok: true, month: '2026-12', items: [], alternates: [] }; MONTH_EMPTY = true; await page.evaluate(() => { DASH.ftm = null; showShop(); }); await page.waitForTimeout(1500);
        ok((await page.innerHTML('#ftmShop')) === '', await page.innerHTML('#ftmShop')); });
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`featured-month: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
