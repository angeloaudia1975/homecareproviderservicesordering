/* SHOP PRODUCTS — back to results + product layout (owner 2026-11-19 18:11). The REAL storefront page in Chromium
   (_shop-harness.js: everything answered locally; nothing reaches HCPS, Supabase or Dalton), at 1280 and 390 px:
   - open a product from a filtered Dalton list (search, category, sort, page 2, scrolled) → "Back to results" returns to the
     same line, search, category, sort, page and scroll position; the browser Back button does the same;
   - a product reached directly (not from a list) offers "Back to Shop Products";
   - desktop: images then Provider Reimbursement on the left; name, pricing and purchase actions on the right;
     phone: images, then name / pricing / purchase actions, then reimbursement; no sideways scroll.
   PLAYWRIGHT_MODULE=… node test/pd-back-layout.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }

async function daltonList(page) {
  await page.evaluate(async () => { window.needsAccess = () => false; await selectManufacturer('dalton'); });
  await page.waitForFunction(() => document.querySelector('#cv2Grid .card'), null, { timeout: 20000 });
}
const listState = (page) => page.evaluate(() => ({ line: state.active, q: cvQuery(), cat: cvCat(), sort: CUI.sort, page: CUI.page, y: Math.round(window.scrollY),
  cards: document.querySelectorAll('#cv2Grid .card').length, onList: !!document.querySelector('#cv2'), onPd: !!document.querySelector('#content .pd') }));

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(browser, w, h, { prices: { dalton: 100 } });
      await daltonList(page);
      /* a filtered list: search "chair", sort by name, page 2 when there is one, scrolled down */
      await page.evaluate(() => { const s = document.getElementById('search'); s.value = 'chair'; CUI.sort = 'name'; CUI.page = 1; renderProducts(); });
      await page.waitForTimeout(300);
      let st = await listState(page);
      const pages = await page.evaluate(() => document.querySelectorAll('#cv2Pager button[data-v]').length);
      if (pages > 3) { await page.evaluate(() => { CUI.page = 2; renderProducts(); }); await page.waitForTimeout(200); }
      await page.evaluate(() => { const c = document.querySelectorAll('#cv2Grid .card'); const el = c[Math.min(5, c.length - 1)]; window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200); });
      await page.waitForTimeout(250);
      const before = await listState(page); console.log("     list before:", JSON.stringify(before));
      const code = await page.evaluate(() => { const c = document.querySelectorAll('#cv2Grid .card'); const el = c[Math.min(5, c.length - 1)]; return el.getAttribute('data-code'); });
      await page.evaluate((c) => { CUI.lastCode = c; openProductDetail(c); }, code);
      await page.waitForSelector('#content .pd .pd-back', { timeout: 10000 });

      await t(`${label}: a product opened from a filtered list offers "Back to results"`, async () => {
        const txt = await page.$eval('#content .pd-back', (e) => e.textContent.trim()); ok(txt === '← Back to results', txt);
        const bh = await page.$eval('#content .pd-back', (e) => e.getBoundingClientRect().height); ok(bh >= 44, 'touch target ' + bh);
      });
      await t(`${label}: layout — ${w > 820 ? 'reimbursement under the images on the left; pricing and actions under the name on the right' : 'images, then name / pricing / actions, then reimbursement'}`, async () => {
        const L = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + window.scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
          return { gal: r('.pd-hero .pd-gal'), info: r('.pd-hero .pd-info'), h1: r('.pd-info h1'), price: r('.pd-info .pd-pricebox'), buy: r('.pd-info .pd-pricebox .pd-buy, .pd-info .pd-pricebox .pd-disc, .pd-info .pd-pricebox .pd-broch'), reimb: r('#pdReimb'),
            sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
        ok(L.gal && L.info && L.price && L.reimb, JSON.stringify(L));
        ok(L.price.y >= L.h1.y && L.price.y - (L.h1.y + L.h1.h) < 120, 'pricing directly below the name: ' + JSON.stringify([L.h1, L.price]));
        if (L.buy) ok(L.buy.y >= L.price.y, 'actions after pricing');
        if (w > 820) { ok(L.reimb.x < L.info.x && Math.abs(L.reimb.x - L.gal.x) < 4, 'reimbursement on the left: ' + JSON.stringify([L.gal, L.reimb, L.info]));
          ok(L.reimb.y > L.gal.y + L.gal.h - 2, 'reimbursement beneath the images'); }
        else { ok(L.info.y > L.gal.y && L.reimb.y > L.info.y + L.info.h - 2, 'phone order: ' + JSON.stringify([L.gal, L.info, L.reimb])); }
        ok(L.sw <= L.cw + 1, 'horizontal scroll ' + L.sw + '/' + L.cw);
      });
      await t(`${label}: "Back to results" returns to the same line, search, sort, page and scroll position`, async () => {
        await page.click('#content .pd-back'); await page.waitForFunction(() => document.querySelector('#cv2Grid .card') && !document.querySelector('#content .pd'), null, { timeout: 10000 });
        await page.waitForTimeout(250); const a = await listState(page);
        ok(a.line === before.line && a.q === before.q && a.cat === before.cat && a.sort === before.sort && a.page === before.page, JSON.stringify([before, a]));
        ok(Math.abs(a.y - before.y) < 40, 'scroll ' + before.y + ' → ' + a.y);
      });
      await t(`${label}: the browser Back button returns to the same results`, async () => {
        await page.evaluate((c) => openProductDetail(c), code); await page.waitForSelector('#content .pd .pd-back');
        await page.goBack(); await page.waitForFunction(() => document.querySelector('#cv2Grid .card') && !document.querySelector('#content .pd'), null, { timeout: 10000 });
        await page.waitForTimeout(250); const a = await listState(page);
        ok(a.q === before.q && a.sort === before.sort && a.page === before.page && Math.abs(a.y - before.y) < 40, JSON.stringify([before, a]));
        ok(/hcpsonlineordering|deploy-preview/.test(page.url()), 'still in the portal: ' + page.url());
      });
      await t(`${label}: a category filter survives the round trip`, async () => {
        const cat = await page.evaluate(() => { const b = document.querySelector('#cv2Nav [data-cv="cat"][data-v]:not([data-v=""])'); return b ? b.getAttribute('data-v') : ''; });
        await page.evaluate((v) => { document.getElementById('search').value = ''; cvSetCat(v); }, cat); await page.waitForTimeout(200);
        const b0 = await listState(page); const c2 = await page.evaluate(() => document.querySelector('#cv2Grid .card').getAttribute('data-code'));
        await page.evaluate((c) => openProductDetail(c), c2); await page.waitForSelector('#content .pd .pd-back');
        await page.click('#content .pd-back'); await page.waitForFunction(() => document.querySelector('#cv2Grid .card'), null, { timeout: 10000 });
        const a = await listState(page); ok(a.cat === b0.cat && a.cat === cat, JSON.stringify([b0, a]));
      });
      await t(`${label}: a product reached directly offers "Back to Shop Products"`, async () => {
        const c2 = await page.evaluate(() => document.querySelector('#cv2Grid .card').getAttribute('data-code'));
        await page.evaluate((c) => { document.getElementById('content').innerHTML = '<div id="x"></div>'; openProductDetail(c); }, c2);
        await page.waitForSelector('#content .pd .pd-back');
        ok((await page.$eval('#content .pd-back', (e) => e.textContent.trim())) === '← Back to Shop Products', 'label');
        await page.click('#content .pd-back'); await page.waitForFunction(() => !document.querySelector('#content .pd'), null, { timeout: 10000 });
      });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nproduct page back + layout: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
