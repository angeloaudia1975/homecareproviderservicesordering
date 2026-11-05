/* C3-07 Stage 2 — Partner 360 universal quick search, browser walkthrough of the REAL storefront page (see
   _shop-harness.js: everything answered locally, nothing reaches HCPS / Golden / Supabase). Synthetic dealer with
   Access4U (account), Bemis + PediFix (available), Dalton (request access), no Golden. Bemis is given a synthetic
   list price so the dealer's own price can be checked; the other lines have none.
   PLAYWRIGHT_MODULE=… node test/quick-search.browser.js */
const { chromium, open, path, fs } = require('./_shop-harness.js');
const SHOTS = process.env.SHOTS || '/tmp/quick-search-shots'; fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const rows = page => page.evaluate(() => {
  const box = document.querySelector('#gsresults'); const r = box.getBoundingClientRect();
  return { on: box.classList.contains('on'), rect: { l: r.left, r: r.right, t: r.top, b: r.bottom }, vw: innerWidth, vh: innerHeight,
    rows: [...box.querySelectorAll('.gsr2')].map(x => ({ slug: x.dataset.slug, code: x.dataset.code, name: (x.querySelector('b') || {}).textContent, sub: (x.querySelector('.gst span') || {}).textContent, price: (x.querySelector('.gsp') || {}).textContent || '', img: !!x.querySelector('.gsi img,.gsi-ph') })),
    all: (box.querySelector('.gsall') || {}).textContent || '', text: box.innerText, html: box.innerHTML,
    broken: [...box.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
});
async function type(page, q) {
  await page.evaluate(() => { const b = document.querySelector('#gsresults'); b.innerHTML = ''; b.classList.remove('on'); });
  await page.fill('#gsearch', ''); await page.type('#gsearch', q, { delay: 20 });
  await page.waitForFunction(() => { const b = document.querySelector('#gsresults'); return b.classList.contains('on') && !/Searching your lines/.test(b.innerText); }, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return rows(page);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const { ctx, page, seen } = await open(browser, w, h, { prices: { bemis: 100 } });
      const vis = await page.evaluate(() => { const b = document.querySelector('#gsearch').getBoundingClientRect(); return b.width > 100 && b.height > 0; });
      await t(`${label}: the search box is on screen`, () => ok(vis));
      let r = await type(page, 'ra');
      await t(`${label}: suggestions from 2 characters, each with a photo or placeholder and its manufacturer`, () => {
        ok(r.on && r.rows.length > 0 && r.rows.length <= 8, 'rows ' + r.rows.length); ok(r.rows.every(x => x.img), 'image'); ok(r.rows.every(x => /Item #/.test(x.sub) && /(Access4U|BEMIS|PediFix)/.test(x.sub)), r.rows.map(x => x.sub).join('|')); });
      await t(`${label}: suggestions stay on screen, no horizontal scroll, nothing broken`, () => {
        ok(r.rect.l >= 0 && r.rect.r <= r.vw + 1, JSON.stringify(r.rect)); ok(r.scrollW <= r.clientW + 1, r.scrollW + '>' + r.clientW); ok(!r.broken, 'broken'); });
      if (label === 'iphone' || label === 'desktop') await page.screenshot({ path: path.join(SHOTS, `suggest-${label}.png`) });
      r = await type(page, '7yr05310');
      await t(`${label}: a part number ranks first`, () => ok(r.rows[0] && r.rows[0].code === '7YR05310TSS', JSON.stringify(r.rows[0])));
      r = await type(page, 'toilet seat riser');
      await t(`${label}: synonyms — "toilet seat riser" finds Bemis raised toilet seats`, () => ok(r.rows.some(x => /Raised Toilet Seat/.test(x.name) && x.slug === 'bemis'), r.rows.map(x => x.name).join('|')));
      await t(`${label}: the dealer's own price shows where the line is priced, nowhere else`, () => {
        ok(r.rows.filter(x => x.slug === 'bemis').every(x => /\$100\.00/.test(x.price) && /Your price/.test(x.price)), r.rows.map(x => x.slug + ':' + x.price).join('|'));
        ok(r.rows.filter(x => x.slug !== 'bemis').every(x => !x.price), 'unpriced line shows a price'); });
      r = await type(page, 'ramp section');
      await t(`${label}: Access4U ramps found; one row per product family; View all link`, () => {
        ok(r.rows.length && r.rows.every(x => x.slug === 'access4u'), r.rows.map(x => x.slug).join(',')); ok(new Set(r.rows.map(x => x.name)).size === r.rows.length, 'duplicate family rows'); ok(/View all \d+ result/.test(r.all), r.all); });
      r = await type(page, 'dalton');
      await t(`${label}: a line the dealer cannot order is never searched`, () => ok(!r.rows.some(x => x.slug === 'dalton'), 'dalton row'));
      r = await type(page, '<img src=x onerror=alert(1)>');
      await t(`${label}: the query is shown as text, never as markup`, () => ok(!/<img src="?x/i.test(r.html) && /No matches/.test(r.text), r.html.slice(0, 200)));
      // View all → Shop results page → open a result → product page
      await type(page, 'raised toilet');
      await page.click('#gsresults .gsall');
      await page.waitForFunction(() => state.active === '__shopall__' && document.querySelector('.sl-search .sl-results .gsr2'), null, { timeout: 20000 });
      const all = await page.evaluate(() => ({ h: document.querySelector('.sl-search h2').textContent, n: document.querySelectorAll('.sl-search .gsr2').length, tab: (document.querySelector('#tabs .navtab.active') || {}).textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      await t(`${label}: View all opens the full results on the Shop page`, () => { ok(/result.*raised toilet/.test(all.h), all.h); ok(all.n >= 3, 'n ' + all.n); ok(/Shop/.test(all.tab)); ok(all.sw <= all.cw + 1); });
      if (label === 'iphone' || label === 'desktop') await page.screenshot({ path: path.join(SHOTS, `all-${label}.png`) });
      await page.click('.sl-search .gsr2[data-slug="bemis"]');
      await page.waitForFunction(() => state.active === 'bemis' && document.querySelector('.pd h1, .pd-crumb'), null, { timeout: 20000 });
      await t(`${label}: a result opens its product page on its line`, () => ok(true));
      await page.evaluate(() => showShop()); await page.waitForSelector('.shopland .sl-grid');
      await t(`${label}: Shop again shows the manufacturer tiles, not the old results`, async () => ok(await page.evaluate(() => document.querySelectorAll('.shopland .sl-tile').length === 12)));
      // keyboard: Enter = view all
      await page.fill('#gsearch', ''); await page.type('#gsearch', 'ramp'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => state.active === '__shopall__' && document.querySelector('.sl-search'), null, { timeout: 20000 });
      await t(`${label}: Enter in the box opens all results`, () => ok(true));
      await t(`${label}: searching sends no access request`, () => ok(!seen.tools.length));
      // another dealer on the same tab (shared machine): the old index must not answer
      await page.evaluate(() => { AUTH.dealer = Object.assign({}, AUTH.dealer, { id: 'd-other' }); AUTH.access = { your_accounts: ['bemis'], available: [], request_access: [], golden: 'None' }; });
      r = await type(page, 'ramp');
      await t(`${label}: after the dealer changes, another dealer's lines are not searched`, () => ok(!r.rows.some(x => x.slug === 'access4u'), r.rows.map(x => x.slug).join(',')));
      r = await type(page, 'raised toilet');
      await t(`${label}: the new dealer's own line still searches`, () => ok(r.rows.some(x => x.slug === 'bemis'), r.rows.map(x => x.slug).join(',')));
      // Escape closes and a late paint never reopens it
      await page.fill('#gsearch', ''); await page.type('#gsearch', 'pad'); await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
      await t(`${label}: Escape closes the suggestions and they stay closed`, async () => ok(!(await page.evaluate(() => document.querySelector('#gsresults').classList.contains('on')))));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nquick search: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
