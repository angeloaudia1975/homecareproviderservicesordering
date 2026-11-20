/* Dalton NOV26 checkout — the REAL storefront page (_shop-harness.js) with the admin repo's REAL server pricing
   (_pricing.priceOrders + _dalton_nov26) answering the price check in-process. Promotional prices here are SYNTHETIC (the
   real ones live only in the private app_settings row). Checks: apply → server prices shown; R-CART-6 sold by the case of 6;
   lower price kept; a cart change asks to apply again; invalid code refused; remove restores regular prices; the order sent
   carries the code and the server-reviewed units. Nothing reaches HCPS.  ADMIN_REPO=<admin> node test/dalton-nov26.browser.js */
const path = require('path'), fs = require('fs');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const PRICING = require(path.join(ADM, 'netlify', 'functions', '_pricing.js'));
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 600)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CONFIG = { code: 'NOV26', ends_at: '2099-12-01T06:00:00Z', items: { 'R-CART-6': { price: 60, case_qty: 6 }, 'ASP-HD': { price: 95, case_qty: 1 }, 'AKN411AR': { price: 120, case_qty: 1 } } };
const CAT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'dalton.json'), 'utf8')).map((p) => Object.assign({}, p, { base_price: 100 }));
const priced = async (b) => {
  try {
    const r = await PRICING.priceOrders({ orders: b.orders, dealerId: 'd-test', promoEnabled: true, now: Date.now(),
      catalogFile: async () => CAT, contentFile: async () => ({ pages: {} }), manufacturersFile: async () => [{ slug: 'dalton', freight: null }],
      sb: async (_m, p) => p.startsWith('app_settings?key=eq.dalton_nov26') ? [{ value: CONFIG }] : p.startsWith('dealers?') ? [{ id: 'd-test' }] : [] });
    return { status: 200, body: { ok: true, preview: true, changed: r.changed, orders: r.orders.map((o) => ({ manufacturer_slug: o.manufacturer_slug, promo_code: o.promo_code || null, subtotal: o.subtotal,
      items: o.items.map((i) => ({ code: i.code, qty: i.qty, unit: i.unit, line_total: i.line_total, client_unit: i.client_unit, changed: !!i.changed, available: i.available !== false, uom: i.uom, case_qty: i.case_qty })) })) } };
  } catch (e) { if (e && e.constructor && e.constructor.name === 'PromoError') return { status: 422, body: { ok: false, status: 'promo_rejected', error: e.message } }; throw e; }
};
(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      const { page } = await open(b, w, h, { prices: { dalton: 100 }, access: { your_accounts: ['dalton'], available: [], request_access: [], golden: 'None' } });
      const checks = [];
      await page.route('**/orders-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); checks.push(x); const a = await priced(x);
        return r.fulfill({ status: a.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(a.body) }); });
      await page.evaluate(async () => { await selectManufacturer('dalton'); });
      await page.waitForFunction(() => (state.products || []).length > 100 || document.querySelectorAll('#cv2Grid .card').length, null, { timeout: 30000 });
      await page.evaluate(() => { const P = (c) => (state.products || []).find((p) => p.code === c);
        CART.clear(); addToCart(P('R-CART-6'), 2); addToCart(P('ASP-HD'), 1); addToCart(P('AKN411AR'), 1); addToCart(P('ASP-610-1'), 3); openCart(); });
      await page.waitForTimeout(800);
      const cartTxt = () => page.$eval('#drawer', (e) => e.textContent.replace(/\s+/g, ' '));
      const before = await cartTxt();
      await t(`${label}: R-CART-6 is sold by the case of 6 (case-unit correction)`, () => ok(/R-CART-6[^]*?(Case|case)[^]*?6/.test(before), before.slice(0, 600)));
      await page.fill('#dalton-promo', 'nov26'); await page.click('#dalton-promo-apply'); await page.waitForTimeout(1200);
      const applied = await cartTxt(); const units = await page.evaluate(() => Object.fromEntries((promoQuote() || { items: [] }).items.map((i) => [i.code, [i.unit, i.qty, i.case_qty || 1]])));
      await t(`${label}: applying NOV26 shows the server's prices — specials at the promo price, a non-promo line unchanged, a higher promo price never raises the regular one`, () => {
        ok(/NOV26 applied/.test(applied), applied.slice(0, 900));
        ok(units['R-CART-6'][0] === 60 && units['R-CART-6'][1] === 2 && units['R-CART-6'][2] === 6 && units['ASP-HD'][0] === 95 && units['ASP-610-1'][0] === 100, JSON.stringify(units));
        ok(/\$95\.00/.test(applied) && /\$60\.00/.test(applied), 'promo units shown: ' + applied.slice(0, 1200));
        const last = checks[checks.length - 1]; ok(last.orders[0].promo_code === 'NOV26', JSON.stringify(last).slice(0, 300)); });
      /* AKN411AR at 120 > regular 100 → regular kept */
      await t(`${label}: a lower regular price is kept (promo never raises it)`, () => ok(units['AKN411AR'][0] === 100, JSON.stringify(units)));
      await page.evaluate(() => { const k = [...CART.keys()].find((x) => /ASP-610-1/.test(x)); CART.get(k).qty = 4; updateCart(); });
      await page.waitForTimeout(400);
      await t(`${label}: changing the cart after applying asks to apply the code again (no stale promo price)`, async () => ok(/Apply the code again|cart changed/i.test(await cartTxt())));
      await page.fill('#dalton-promo', 'BOGUS'); await page.click('#dalton-promo-apply'); await page.waitForTimeout(1000);
      await t(`${label}: an invalid code is refused with the server's message`, async () => ok(/invalid/i.test(await cartTxt())));
      await page.fill('#dalton-promo', 'NOV26'); await page.click('#dalton-promo-apply'); await page.waitForTimeout(1000);
      await page.click('#dalton-promo-remove'); await page.waitForTimeout(600);
      const removed = await cartTxt();
      await t(`${label}: removing the code restores regular prices`, () => ok(!/NOV26 applied/.test(removed) && !/\$95\.00/.test(removed), removed.slice(0, 900)));
    }
  } finally { await b.close(); }
  console.log(`\ndalton nov26 checkout: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
