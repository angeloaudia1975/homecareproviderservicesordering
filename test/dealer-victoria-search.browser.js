/* Victoria's product search and navigation (owner 2026-11-20 23:31) on the REAL storefront page with the REAL Dalton
   catalog file (see _shop-harness.js: everything answered locally). Dalton is on the synthetic dealer's account.
   - "hospital beds" / "hospital bed" find the beds, complete beds before rails, tables and trapezes;
   - "semi electric" / "semi-electric" (with or without "hospital beds", with "show me … ones") find the semi-electric bed;
   - Victoria's screen facts: the Shop search on screen, numbered results, the result the dealer picked;
   - one clear match opens its product page and reports it only once the page is on screen; several show the results;
   - an item number on another line opens that line's product page.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… node test/dealer-victoria-search.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }
const ACC = /\b(rails?|trapeze|tables?|boards?|carts?|transporter|cabinets?|stands?|bars?|storage)\b/i;

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(browser, w, h, { access: { your_accounts: ['dalton', 'access4u'], available: ['bemis'], request_access: [], golden: 'None' },
        html: (src) => src.replace('Object.assign(window,{dvProbe});', 'Object.assign(window,{dvProbe,dvOpenSearch,dvOpenProduct,dvContext,dvOpenView,dvOpenReimb});') });   // probe: the panel's own functions
      const S = (q) => page.evaluate((q) => window.gsSearchAll(q).then((r) => r.map((x) => ({ code: x.x.p.code, name: x.x.p.name, slug: x.x.slug, score: x.score }))), q);
      const beds = await S('hospital beds');
      await t(`${label}: "hospital beds" finds the beds (it found nothing before), complete beds before rails / tables / trapezes`, () => {
        ok(beds.length >= 8, 'n ' + beds.length);
        const firstAcc = beds.findIndex((r) => ACC.test(String(r.name).split(/\s(?:with|without)\s|[(,]/i)[0]));
        const lastBed = beds.map((r) => /\bbed\b/i.test(r.name) && !ACC.test(String(r.name).split(/\s(?:with|without)\s|[(,]/i)[0])).lastIndexOf(true);
        ok(firstAcc > lastBed, 'an accessory ranks before a bed: ' + beds.slice(0, 14).map((r) => r.code).join(','));
        ok(['BED1200i', 'BED1300i', 'BED-B730', 'BED4200'].every((c) => beds.slice(0, 16).some((r) => r.code === c)), beds.slice(0, 16).map((r) => r.code).join(','));
      });
      const one = await S('hospital bed');
      await t(`${label}: "hospital bed" and "hospital beds" give the same list`, () => ok(one.map((r) => r.code).join() === beds.map((r) => r.code).join(), one.length + ' vs ' + beds.length));
      for (const q of ['semi electric hospital beds', 'semi-electric hospital beds', 'semi-electric', 'semi electric', 'show me the semi electric ones']) {
        const r = await S(q);
        await t(`${label}: "${q}" → the iSeries Semi Electric Bed`, () => ok(r.length >= 1 && r[0].code === 'BED1200i' && r.every((x) => /semi/i.test(x.name)), JSON.stringify(r.slice(0, 4))));
      }
      const rails = await S('bed rails');
      await t(`${label}: rails the dealer asks for come first`, () => ok(rails.length && /rail/i.test(rails[0].name), rails.slice(0, 3).map((r) => r.name).join('|')));
      const cart = await S('R-CART-6');
      await t(`${label}: an item number with hyphens still answers that item first`, () => ok(cart[0] && cart[0].code === 'R-CART-6', JSON.stringify(cart[0])));

      // Victoria's journey, through the same functions the panel calls (DV.openSearch / openProduct / context)
      await page.evaluate(() => showP360('dash')); await page.waitForTimeout(300);
      const s1 = await page.evaluate(() => dvOpenSearch('hospital beds'));
      const c1 = await page.evaluate(() => dvContext());
      await t(`${label}: "show me hospital beds" from Dealer Overview → Shop Products results on screen, counted; Victoria sees them numbered by name`, () => {
        ok(s1.ok && !s1.opened && s1.count === beds.length && s1.top.length >= 2, JSON.stringify(s1));
        ok(c1.view === 'shop_search' && c1.search.query === 'hospital beds' && c1.search.count === beds.length && c1.search.results.length === 8 && c1.search.results[0].n === 1 && c1.search.results[0].name, JSON.stringify(c1).slice(0, 400));
      });
      const s2 = await page.evaluate(() => dvOpenSearch('semi electric hospital beds'));
      const pd2 = await page.evaluate(() => { const pd = document.querySelector('#content .pd'); return pd && pd.getAttribute('data-pd-code'); });
      await t(`${label}: "just the semi-electric ones" — one clear match opens its product page, confirmed only once it is on screen`, () => ok(s2.ok && s2.opened && s2.opened.code === 'BED1200i' && pd2 === 'BED1200i', JSON.stringify(s2) + ' ' + pd2));
      const c2 = await page.evaluate(() => dvContext());
      await t(`${label}: on the product page Victoria sees its item number and manufacturer (for "what's my price?")`, () => ok(c2.view === 'product' && c2.product.code === 'BED1200i' && /Dalton/i.test(c2.product.line_name), JSON.stringify(c2).slice(0, 300)));
      // several → pick one → "open that one"
      await page.evaluate(() => dvOpenSearch('hospital beds'));
      await page.focus('.sl-search .gsr2:nth-child(3)');
      const c3 = await page.evaluate(() => dvContext());
      await t(`${label}: the result the dealer picked is known ("open that one")`, () => ok(c3.search.selected && c3.search.selected.n === 3 && c3.search.selected.code === c3.search.results[2].code, JSON.stringify(c3.search.selected)));
      const o3 = await page.evaluate((r) => dvOpenProduct(r.slug, r.code), c3.search.selected);
      const pd3 = await page.evaluate(() => document.querySelector('#content .pd') && document.querySelector('#content .pd').getAttribute('data-pd-code'));
      await t(`${label}: it opens, and dvOpenProduct reports ok only with that product's page on screen`, () => ok(o3.ok && o3.code === c3.search.selected.code && pd3 === o3.code, JSON.stringify(o3) + ' ' + pd3));
      // "take me there" → the reimbursement panel; "what am I looking at" is read fresh (scrolling / navigating away is seen)
      await page.evaluate(() => window.scrollTo(0, 0));
      const top = await page.evaluate(() => dvContext().product.section_in_view);
      const rb = await page.evaluate(() => dvOpenReimb());
      const at = await page.evaluate(() => dvContext().product);
      await t(`${label}: "take me there" scrolls the product's reimbursement panel into view, and Victoria then sees it on screen`, () => ok(top === 'product details' && rb.ok && at.section_in_view === 'reimbursement panel' && at.reimbursement_panel && at.reimbursement_panel.in_view === true, JSON.stringify({ top, rb, at: at.reimbursement_panel })));
      await page.evaluate(() => showP360('dash')); await page.waitForTimeout(300);
      const away = await page.evaluate(() => dvContext());
      await t(`${label}: after navigating away by hand the old product is gone from what Victoria sees`, () => ok(away.view === 'dash' && !away.product, JSON.stringify(away)));
      const none = await page.evaluate(() => dvOpenReimb());
      await t(`${label}: with no product page, the reimbursement panel is never reported open`, () => ok(none.ok === false, JSON.stringify(none)));
      const bad = await page.evaluate(() => dvOpenProduct('dalton', 'NO-SUCH-ITEM'));
      await t(`${label}: an item that is not there is never reported open`, () => ok(bad.ok === false, JSON.stringify(bad)));
      const ord = await page.evaluate(() => dvOpenView('orders'));
      await t(`${label}: order confirmations → Orders & Tracking is on screen`, () => ok(ord.ok, JSON.stringify(ord)));
      const sf = await page.evaluate(() => dvOpenView('storefront'));
      await t(`${label}: the storefront website builder opens`, () => ok(sf.ok, JSON.stringify(sf)));
      const sc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      await t(`${label}: no horizontal scroll`, () => ok(sc.sw <= sc.cw + 1, JSON.stringify(sc)));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\ndealer victoria search: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
