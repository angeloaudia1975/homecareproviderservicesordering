/* C3-07 Stage 4 — the three customer pricing choices on a brochure, browser walkthrough of the REAL storefront page
   (see _shop-harness.js; nothing reaches HCPS, Supabase or a mail provider). The brochure is rendered by the REAL
   netlify/functions/brochure.js (html action only — nothing is emailed); the saved-retail API is answered locally.
   Checks: no price / verified MSRP / saved retail / one-time price reach the brochure exactly; a 2×-derived MSRP is never
   offered as the manufacturer's MSRP; "Save as my retail price" saves through dealer-retail-api; dealer cost never appears.
   PLAYWRIGHT_MODULE=… node test/brochure-price.browser.js */
const { chromium, open, path } = require('./_shop-harness.js');
const B = require(path.join(__dirname, '..', 'netlify', 'functions', 'brochure.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }

(async () => {
  const browser = await chromium.launch();
  try {
    const { ctx, page } = await open(browser, 1280, 900, { prices: { bemis: 54.99 } });
    const saved = {}, brochures = [], retailCalls = [];
    await page.route('**/.netlify/functions/brochure', async route => {
      const body = JSON.parse(route.request().postData() || '{}'); brochures.push(body);
      const r = await B.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(Object.assign({}, body, { action: 'html' })) });
      return route.fulfill({ status: r.statusCode, contentType: 'application/json', body: r.body });
    });
    await page.route('**/functions/dealer-retail-api', async route => {
      const b = JSON.parse(route.request().postData() || '{}'); retailCalls.push(b);
      if (b.action === 'retail_list') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ok: true, self_id: 'd-test', prices: Object.keys(saved).map(k => ({ manufacturer: k.split('|')[0], code: k.split('|')[1], location_id: null, price: saved[k] })) }) });
      if (b.action === 'retail_set') { b.rows.forEach(r => { saved[r.manufacturer + '|' + r.code] = r.price; }); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, saved: b.rows.length }) }); }
      return route.fulfill({ status: 400, body: '{}' });
    });
    await page.evaluate(() => { PREVIEW = null; window.__PREVIEW__ = null; AUTH.session = { access_token: 'tok' }; window.ensureFreshSession = async () => {}; });
    await page.evaluate(() => showShop('bemis'));
    await page.waitForFunction(() => state.active === 'bemis' && state.products.length > 0, null, { timeout: 20000 });
    const code = await page.evaluate(() => { const p = state.products.find(x => x.code === '7YE05310TSS') || state.products[0]; p.msrp = 159.99; p._msrp_suggested = false; return p.code; });
    const pick = async v => { await page.check(`input[name="brPrice"][value="${v}"]`); };
    const print = async () => { const n = brochures.length; await page.evaluate(() => brochurePrint()); await page.waitForFunction(k => window.__n === undefined || true, n); await page.waitForTimeout(700); return brochures[brochures.length - 1]; };

    await page.evaluate(c => openBrochure(c), code); await page.waitForSelector('#brPriceBox input[name="brPrice"]');
    let b = await print();
    await t('default: no price on the brochure', () => ok(b.product.quote_price == null && !b.include_msrp, JSON.stringify({ q: b.product.quote_price, m: b.include_msrp })));
    await pick('msrp'); b = await print();
    await t('verified MSRP: MSRP only', () => ok(b.include_msrp === true && b.product.quote_price == null && b.product.msrp === 159.99));
    await pick('once'); await page.fill('#brOnce', '$149.50'); b = await print();
    await t('one-time price: on THIS brochure only, nothing saved', () => { ok(b.product.quote_price === 149.5 && !b.include_msrp); ok(!retailCalls.some(x => x.action === 'retail_set'), 'saved'); });
    /* owner 2026-11-12: the server prints a dealer offer only after checking it against the manufacturer's MAP (signed in) —
       the renderer itself is checked here; the MAP check is covered by test/brochure-auth.test.js */
    const html = B.renderBrochure(b.product, {});
    await t('the page sends the price choice (once) and the comparison / expiry options', () => ok(b.price_basis === 'once' && b.compare === true && b.offer_expires === '', JSON.stringify({ p: b.price_basis, c: b.compare, e: b.offer_expires })));
    await t('the brochure shows $149.50 and never the dealer cost ($54.99)', () => { ok(html.includes('$149.50'), 'price'); ok(!html.includes('54.99'), 'cost leaked'); });
    await t('dealer cost is not even sent to the renderer', () => ok(!JSON.stringify(b.product).includes('54.99'), 'cost in payload'));
    await page.evaluate(() => brSaveRetail()); await page.waitForTimeout(800);
    await t('"Save as my retail price" saves through dealer-retail-api', () => ok(saved['bemis|' + code] === 149.5, JSON.stringify(saved)));
    await pick('retail'); b = await print();
    await t('saved retail: the saved price', () => ok(b.product.quote_price === 149.5 && !b.include_msrp));
    // a derived (2×) MSRP is never offered as the manufacturer's MSRP
    await page.evaluate(() => closeBrochure());
    await page.evaluate(c => { const p = state.products.find(x => x.code === c); p._msrp_suggested = true; }, code);
    await page.evaluate(c => openBrochure(c), code); await page.waitForSelector('#brPriceBox input[name="brPrice"]'); await page.waitForTimeout(500);
    const dis = await page.evaluate(() => document.querySelector('input[name="brPrice"][value="msrp"]').disabled);
    await t('a 2×-derived MSRP is not offered (D3: verified MSRP only)', () => ok(dis === true));
    await ctx.close();
  } finally { await browser.close(); }
  console.log(`\nbrochure price: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
