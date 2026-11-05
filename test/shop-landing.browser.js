/* C3-07 Stage 1 — Partner 360 shop landing page, browser walkthrough of the REAL storefront page (public/index.html)
   as a staff "view as dealer" on a deploy-preview address. Every network call is answered locally: dealer-auth with a
   synthetic dealer, the website roster (/data/partners.json) and partner artwork from the admin repo's built site
   (ADMIN_REPO, default ../homecareproviderservices; run `npx @11ty/eleventy` there first), everything else empty.
   Nothing reaches HCPS, Golden or Supabase. Checks at 390 / 768 / 1280 px: Shop opens the landing page, 12 partners,
   2 a row (1 on a phone), artwork uncropped, no broken image, no horizontal scroll, no price text; each tile does what
   the account allows; Golden follows Golden's own answer; the roster failing falls back to the storefront's list;
   "All manufacturers" from a catalog returns to the landing page.
   PLAYWRIGHT_MODULE=… node test/shop-landing.browser.js */
const { chromium, open, ACCESS, path, fs } = require('./_shop-harness.js');
const SHOTS = process.env.SHOTS || '/tmp/shop-landing-shots'; fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }

const landingFacts = page => page.evaluate(() => {
  const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const tiles = [...document.querySelectorAll('.shopland .sl-tile')];
  const tops = [...new Set(tiles.map(x => Math.round(x.getBoundingClientRect().top)))];
  const firstRow = tiles.filter(x => Math.round(x.getBoundingClientRect().top) === tops[0]).length;
  const imgs = [...document.querySelectorAll('.shopland .sl-img img')];
  const cropped = imgs.filter(i => i.complete && i.naturalWidth && getComputedStyle(i).objectFit !== 'contain').map(i => i.src);
  const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && vis(i) && i.getAttribute('src')).map(i => i.getAttribute('src'));
  const by = s => tiles.find(x => x.getAttribute('data-sl') === s);
  const info = s => { const x = by(s); return x ? { tag: x.tagName, badge: (x.querySelector('.sl-badge') || {}).textContent, act: (x.querySelector('.sl-act') || {}).textContent.trim(), web: /homecareproviderservices\.org\/assets\/manufacturers\/partners\//.test((x.querySelector('img') || {}).src || '') } : null; };
  return { active: state.active, n: tiles.length, firstRow, broken, cropped, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    price: /\$\s?\d/.test((document.querySelector('#content') || {}).innerText || ''), shopTab: (document.querySelector('#tabs .navtab.active') || {}).textContent || '',
    names: tiles.map(x => x.getAttribute('data-sl')), a4u: info('access4u'), bemis: info('bemis'), dalton: info('dalton'), golden: info('golden-technologies'), yuwell: info('yuwell'), h1: document.querySelector('#mfrName').textContent };
});

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const { ctx, page, seen } = await open(browser, w, h, {});
      await page.evaluate(() => showShop());
      await page.waitForSelector('.shopland .sl-grid', { timeout: 20000 });
      await page.waitForTimeout(1500);
      const r = await landingFacts(page);
      await t(`${label}: Shop opens the landing page (Shop tab active), 12 partners from the website roster`, () => {
        ok(r.active === '__shopall__', r.active); ok(/Shop/.test(r.shopTab), r.shopTab); ok(r.n === 12, 'tiles ' + r.n + ' ' + r.names.join(','));
        ok(r.names[0] === 'golden-technologies' && r.names.includes('dalton') && !r.names.includes('ohio-medical'), r.names.join(',')); ok(r.a4u.web, 'website artwork'); });
      await t(`${label}: ${w < 641 ? 1 : 2} a row, artwork uncropped, no broken image, no horizontal scroll`, () => {
        ok(r.firstRow === (w < 641 ? 1 : 2), 'first row ' + r.firstRow); ok(!r.cropped.length, r.cropped.join(',')); ok(!r.broken.length, r.broken.join(',')); ok(r.scrollW <= r.clientW + 1, r.scrollW + '>' + r.clientW); });
      await t(`${label}: no price on the landing page`, () => ok(!r.price));
      await t(`${label}: each tile does what the account allows`, () => {
        ok(r.a4u.tag === 'BUTTON' && r.a4u.badge === 'Your account' && /Shop Access4U/.test(r.a4u.act), JSON.stringify(r.a4u));
        ok(r.bemis.tag === 'BUTTON' && r.bemis.badge === 'Available', JSON.stringify(r.bemis));
        ok(r.dalton.tag === 'DIV' && /Request access/.test(r.dalton.act), JSON.stringify(r.dalton));
        ok(r.yuwell.tag === 'DIV' && /ask your HCPS sales rep/.test(r.yuwell.act), JSON.stringify(r.yuwell));
        ok(r.golden.tag === 'BUTTON' && /Open a Golden account/.test(r.golden.act), JSON.stringify(r.golden)); });
      await page.screenshot({ path: path.join(SHOTS, `landing-${label}.png`), fullPage: false });
      // tile → catalog → All manufacturers → landing
      await page.click('.sl-tile[data-sl="access4u"]');
      await page.waitForFunction(() => state.active === 'access4u' && document.querySelector('#cv2Crumb a[data-cv="all"]'), null, { timeout: 20000 });
      await t(`${label}: Access4U tile opens its catalog; the breadcrumb offers All manufacturers`, () => ok(true));
      await page.evaluate(() => document.querySelector('#cv2Crumb a[data-cv="all"]').click());
      await page.waitForFunction(() => state.active === '__shopall__' && document.querySelectorAll('.shopland .sl-tile').length === 12, null, { timeout: 20000 });
      await t(`${label}: All manufacturers returns to the landing page`, () => ok(true));
      const fac = await page.evaluate(async () => { showShop('bemis'); await new Promise(r => setTimeout(r, 1500)); const b = document.querySelector('#cv2Side [data-cv="all"], .cv2-lines [data-cv="all"]'); return { active: state.active, all: !!b }; });
      await t(`${label}: the Manufacturer filter lists All manufacturers too`, () => { ok(fac.active === 'bemis', fac.active); ok(fac.all, 'no All manufacturers in the filter'); });
      await t(`${label}: no access request was sent to HCPS by browsing`, () => ok(!seen.tools.length, seen.tools.join('|')));
      await ctx.close();
    }
    // Golden: in-platform only when Golden says so
    { const { ctx, page } = await open(browser, 1280, 900, { golden: true });
      await page.waitForFunction(() => typeof goldenEntitled === 'function' && goldenEntitled(), null, { timeout: 20000 }).catch(() => {});
      await page.evaluate(() => showShop()); await page.waitForSelector('.shopland .sl-grid'); await page.waitForTimeout(800);
      const r = await landingFacts(page);
      await t('Golden eligible: the Golden tile opens Golden inside Partner 360', () => ok(r.golden && r.golden.tag === 'BUTTON' && /Shop Golden/.test(r.golden.act) && r.golden.badge === 'Your account', JSON.stringify(r.golden)));
      await ctx.close(); }
    // roster unreadable → storefront's own list
    { const { ctx, page } = await open(browser, 1280, 900, { rosterFails: true });
      await page.evaluate(() => showShop()); await page.waitForSelector('.shopland .sl-grid'); await page.waitForTimeout(1200);
      const r = await landingFacts(page);
      await t('website roster unreadable: the storefront list stands in (12 tiles, local logos, nothing broken)', () => {
        ok(r.n === 12, 'tiles ' + r.n + ' ' + r.names.join(',')); ok(!r.broken.length, r.broken.join(',')); ok(r.scrollW <= r.clientW + 1); });
      await ctx.close(); }
    // request access from a tile (preview mode: refused locally, nothing sent)
    { const { ctx, page, seen } = await open(browser, 390, 844, {});
      await page.evaluate(() => showShop()); await page.waitForSelector('.sl-tile[data-sl="dalton"] .sl-req');
      await page.click('.sl-tile[data-sl="dalton"] .sl-req'); await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({ active: state.active, req: (document.querySelector('.sl-tile[data-sl="dalton"] .sl-req') || {}).getBoundingClientRect().height }));
      await t('phone: Request access button is ≥44px, stays on the landing page, a preview never sends it', () => { ok(st.active === '__shopall__', st.active); ok(st.req >= 44, 'height ' + st.req); ok(!seen.tools.length, 'sent'); });
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(`\nshop landing: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
