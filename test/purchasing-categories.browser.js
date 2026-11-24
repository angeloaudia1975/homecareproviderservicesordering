/* Purchasing categories + Your Purchased Products in the REAL shop page (public/index.html). The purchasing-categories-api is
   answered locally (a MOCK — this proves the page's behaviour, not the deployed server); nothing reaches HCPS or Supabase.
   PLAYWRIGHT_MODULE=… node test/purchasing-categories.browser.js */
const { chromium, open, path, fs } = require('./_shop-harness.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }
const PROBE = h => { const a = 'window.P360={boot:boot'; if (!h.includes(a)) throw new Error('probe anchor missing'); return h.replace(a, 'window.__T=function(src){return eval(src)};' + a); };
const P = (code, name, category, extra) => Object.assign({ manufacturer: 'bemis', code, name, category, base_price: 10, tiers: [], group: code }, extra || {});
const PRODUCTS = [P('B1', 'Raised seat', 'Bath'), P('B2', 'Grab bar', 'Bath'), P('B3', 'Walker', 'Mobility'), P('B4', 'Commode', 'Bath', { _discontinued: true }), P('DUP', 'Twin A', 'Bath', { group: 'DUP-A' }), P('DUP', 'Twin B', 'Bath', { group: 'DUP-B', base_price: 99 }), P('B7', 'Cane', 'Mobility')];
const STRUCT = { bemis: { categories: [{ id: 'c_one', name: 'Seating', codes: ['B3', 'B1'] }, { id: 'c_two', name: 'Popular', codes: ['b1', 'B2'] }] } };
const BOUGHT = [{ manufacturer: 'bemis', code: 'B2', last: '2026-11-10', precision: 'day', times: 3 }, { manufacturer: 'bemis', code: 'B1', last: '2026-09-02', precision: 'day', times: 1 },
  { manufacturer: 'bemis', code: 'B4', last: '2026-11-11', precision: 'day', times: 1 }, { manufacturer: 'bemis', code: 'DUP', last: '2026-11-12', precision: 'day', times: 1 },
  { manufacturer: 'bemis', code: 'GONE', last: '2026-11-13', precision: 'day', times: 1 }, { manufacturer: 'pedifix', code: 'B3', last: '2026-11-14', precision: 'day', times: 1 }];
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) for (const mode of ['api', 'down']) {
      const { ctx, page, seen } = await open(browser, w, h, { html: PROBE });
      const calls = [], posts = [];
      await page.route('**/functions/purchasing-categories-api', async route => { const b = JSON.parse(route.request().postData() || '{}'); calls.push({ b, auth: route.request().headers()['authorization'] });
        if (mode === 'down') return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":false}' });
        const other = route.request().headers()['authorization'] === 'Bearer tok-OTHER'; if (!other) await new Promise((r) => setTimeout(r, 150));
        const body = b.action === 'structure' ? { ok: true, categories: other ? {} : STRUCT } : { ok: true, items: other ? [] : BOUGHT };
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) }); });
      await page.route('**/functions/submit-order*', route => { posts.push(1); return route.fulfill({ status: 500, body: '{}' }); });
      await page.evaluate(prods => { PREVIEW = null; window.__PREVIEW__ = null; AUTH.session = { access_token: 'tok-dealer' }; window.ensureFreshSession = async () => {}; window.__P = prods;
        __T(`state.active='bemis'; state.products=window.__P.map(p=>Object.assign({},p)); PCS.at=0; PCS.ok=false;`); }, PRODUCTS);
      await page.evaluate(() => __T(`(async()=>{ await pcsEnsure(); renderBanner(); renderProducts(); })()`)); await page.waitForTimeout(800);
      const nav = () => page.evaluate(() => [...document.querySelectorAll('#cv2Nav .cv2-cat')].map(b => b.querySelector('span').textContent + '|' + b.querySelector('em').textContent));
      const cards = () => page.evaluate(() => [...document.querySelectorAll('#cv2Grid .cv2-card')].map(c => ({ name: c.querySelector('.pname').textContent, last: (c.querySelector('.pcs-last') || {}).textContent || '', btn: (c.querySelector('.addbtn') || {}).textContent || '', price: (c.querySelector('.prow') || {}).textContent || '' })));
      const pick = v => page.evaluate(v => __T(`cvSetCat(${JSON.stringify(v)})`), v).then(() => page.waitForTimeout(300));
      if (mode === 'down') {
        await t(`${label}: API down → the Shop is exactly as before (catalog categories, no purchased list)`, async () => { const n = await nav(); ok(n[0].startsWith('All Products') && n.some(x => x.startsWith('Bath')) && !n.some(x => /Purchased|Seating/.test(x)), n.join(' / ')); ok((await cards()).length >= 5, 'cards'); });
        await ctx.close(); continue; }
      await t(`${label}: the dealer's own sign-in is what asks the server (Bearer token only — no dealer id sent)`, () => { ok(calls.length >= 2 && calls.every(c => c.auth === 'Bearer tok-dealer' && Object.keys(c.b).join() === 'action'), JSON.stringify(calls)); });
      await t(`${label}: Your Purchased Products is FIRST, then All Products, then the President's categories (not the catalog's own)`, async () => { const n = await nav(); ok(/^★ Your Purchased Products\|2$/.test(n[0]), n.join(' / ')); ok(n[1].startsWith('All Products') && n[2].startsWith('Seating') && n[3].startsWith('Popular') && n.length === 4, n.join(' / ')); });
      await pick('mine:');
      await t(`${label}: purchased = exact current products only — newest first; discontinued, ambiguous, missing and other-line entries are not shown`, async () => { const c = await cards(); ok(c.map(x => x.name).join() === 'Grab bar,Raised seat', c.map(x => x.name).join()); });
      await t(`${label}: shows the last purchase date, "Order Again", and TODAY's price (not history)`, async () => { const c = await cards(); ok(/Last ordered Nov 10, 2026/.test(c[0].last) && /Sep 2, 2026/.test(c[1].last), c[0].last + ' | ' + c[1].last); ok(c.every(x => x.btn === 'Order Again' && /\$10\.00/.test(x.price)), JSON.stringify(c)); });
      await t(`${label}: Order Again puts it in the cart for review and submits nothing`, async () => {
        await page.evaluate(() => document.querySelector('#cv2Grid .cv2-card .addbtn').click()); await page.waitForTimeout(400);
        const cart = await page.evaluate(() => __T(`[...CART.values()].map(x=>x.p.code+'×'+x.qty).join()`)); ok(cart === 'B2×1', cart); ok(posts.length === 0, 'submit-order was called');
        ok(await page.evaluate(() => document.querySelector('#drawer').classList.contains('open')), 'cart did not open for review'); });
      await pick('pc:c_one');
      await t(`${label}: a category shows the President's arrangement (Walker before Raised seat); a product may sit in several categories without duplicating`, async () => { const c = await cards(); ok(c.map(x => x.name).join() === 'Walker,Raised seat', c.map(x => x.name).join()); await pick('pc:c_two'); const d = await cards(); ok(d.map(x => x.name).join() === 'Raised seat,Grab bar', d.map(x => x.name).join());
        await pick(''); const all = await cards(); ok(all.filter(x => x.name === 'Raised seat').length === 1, 'duplicated in All'); ok(all.every(x => !x.last), 'badge outside purchased'); ok(all.every(x => x.btn === 'Add to cart' || x.btn === ''), JSON.stringify(all.map(x => x.btn))); });
      await t(`${label}: a login switch while loading drops the old answer (another login never sees this list)`, async () => {
        const r = await page.evaluate(() => __T(`(async()=>{ PCS.at=0; PCS.ok=false; const p=pcsEnsure(true); await new Promise(r=>setTimeout(r,60)); AUTH.session={access_token:'tok-OTHER'}; AUTH.dealer=Object.assign({},AUTH.dealer,{id:'d-OTHER'}); const q=pcsEnsure(); await Promise.all([p,q]); await new Promise(r=>setTimeout(r,400)); return JSON.stringify({n:PCS.purchased.length, s:Object.keys(PCS.structure).length}); })()`));
        ok(r === '{"n":0,"s":0}', r); });
      await t(`${label}: no horizontal scroll`, async () => { const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(o <= 1, 'overflow ' + o); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
