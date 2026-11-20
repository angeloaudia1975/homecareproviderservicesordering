/* "Edit this product" on the Shop product page (owner 2026-11-19 / 2026-11-20): shown ONLY in a Manage Dealer session opened by
   the President; never for a dealer login, View as Dealer, another staff role or Golden. The link names the line, the SKU on
   screen and the option on screen. node test/pd-edit-link.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const { ctx, page } = await open(b, w, h, { prices: { dalton: 109 } });
      await page.evaluate(async () => { await selectManufacturer('dalton'); }); await page.waitForFunction(() => document.querySelector('#cv2Grid .card'), null, { timeout: 20000 });
      const look = (manage) => page.evaluate(async (m) => { MANAGE = m; const old = document.querySelector('#content .pd'); if (old) old.remove(); openProductDetail('K2DK16F'); for (let i = 0; i < 40 && !document.querySelector('#content .pd[data-pd-code="K2DK16F"]'); i++) await new Promise((r) => setTimeout(r, 100)); const a = document.querySelector('#content .pd .pd-edit');
        if (!a) return null; const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), target: a.target, rel: a.rel, h: r.height, w: r.width, text: a.textContent.trim() }; }, manage);
      const pres = await look({ token: 'x', staff: { name: 'Angelo', role: 'president' }, actions: [] });
      await t(`${w}px: President in a Manage Dealer session — "Edit this product" opens the editor on this line, SKU and option`, () => {
        ok(pres && pres.href === 'https://www.homecareproviderservices.org/admin/catalog-editor.html?line=dalton&code=K2DK16F&variant=K2DK16F' && pres.target === '_blank' && /noopener/.test(pres.rel) && pres.h >= 44 && /Edit this product/.test(pres.text), JSON.stringify(pres)); });
      const others = [];
      for (const m of [null, { token: 'x', staff: { name: 'Lori', role: 'relations' }, actions: [] }, { token: 'x', staff: { name: 'Greg', role: 'rep' }, actions: [] }, { token: 'x', actions: [] }]) others.push(await look(m));
      await t(`${w}px: a dealer login / View as Dealer, Customer Relations, a rep, or an unknown staff role — no link`, () => ok(others.every((x) => x === null), JSON.stringify(others)));
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); await t(`${w}px: no sideways scroll`, () => ok(scroll));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\npd-edit-link: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
