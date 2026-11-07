/* C3-07 Stage 1 — Partner 360 shop landing page, browser walkthrough of the REAL storefront page (public/index.html)
   as a staff "view as dealer" on a deploy-preview address. Every network call is answered locally: dealer-auth with a
   synthetic dealer, the website roster (/data/partners.json) and partner artwork from the admin repo's built site
   (ADMIN_REPO, default ../homecareproviderservices; run `npx @11ty/eleventy` there first), everything else empty.
   Nothing reaches HCPS, Golden or Supabase. Checks at 390 / 768 / 1280 px: Shop opens the landing page, 12 partners,
   3 a row on desktop / 2 on a tablet / 1 on a phone; desktop has a sticky manufacturer sidebar, tablet and phone a drawer; artwork uncropped, no broken image, no horizontal scroll, no price text; each tile does what
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
  const info = s => { const x = by(s); return x ? { tag: x.tagName, badge: (x.querySelector('.sl-badge') || {}).textContent, act: (x.querySelector('.sl-act') || {}).textContent.trim(), label: x.getAttribute('aria-label') || '', web: /homecareproviderservices\.org\/assets\/manufacturers\/partners\//.test((x.querySelector('img') || {}).src || '') } : null; };
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
      await t(`${label}: Shop opens the landing page (Shop tab active) with ONLY the lines HCPS approved for this dealer (owner 2026-11-06)`, () => {
        ok(r.active === '__shopall__', r.active); ok(/Shop/.test(r.shopTab), r.shopTab); ok(r.n === 3, 'tiles ' + r.n + ' ' + r.names.join(','));
        ok(r.names.join() === 'access4u,bemis,pedifix' || ['access4u','bemis','pedifix'].every(x => r.names.includes(x)), r.names.join(','));
        ok(!r.names.includes('dalton') && !r.names.includes('yuwell') && !r.names.includes('golden-technologies') && !r.names.includes('ohio-medical'), 'unapproved lines shown: ' + r.names.join(',')); ok(r.a4u.web, 'website artwork'); });
      const cols = w < 641 ? 1 : w < 1200 ? 2 : 3;
      await t(`${label}: ${cols} a row, artwork uncropped, no broken image, no horizontal scroll`, () => {
        ok(r.firstRow === cols, 'first row ' + r.firstRow); ok(!r.cropped.length, r.cropped.join(',')); ok(!r.broken.length, r.broken.join(',')); ok(r.scrollW <= r.clientW + 1, r.scrollW + '>' + r.clientW); });
      await t(`${label}: no price on the landing page`, () => ok(!r.price));
      await t(`${label}: each tile does what the account allows`, () => {
        ok(r.a4u.tag === 'BUTTON' && r.a4u.badge === 'Your account' && /Shop now/.test(r.a4u.act) && /Shop Access4U/.test(r.a4u.label), JSON.stringify(r.a4u));
        ok(r.bemis.tag === 'BUTTON' && r.bemis.badge === 'Available', JSON.stringify(r.bemis));
        ok(!r.dalton && !r.yuwell && !r.golden, 'no Request access / Ask HCPS / Golden-account tile for lines the dealer is not approved for'); });
      await page.screenshot({ path: path.join(SHOTS, `landing-${label}.png`), fullPage: false });
      // ---- sidebar (desktop) / drawer (tablet, phone)
      const side = () => page.evaluate(() => { const sd = document.querySelector('#slSide'), b = sd.getBoundingClientRect(), btn = document.querySelector('.sl-drawerbtn');
        const items = [...sd.querySelectorAll('.sl-m')]; const hdr = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hdrH')) || 0;
        return { pos: getComputedStyle(sd).position, vis: getComputedStyle(sd).visibility, inView: b.right > 0 && b.left < innerWidth && b.top < innerHeight && b.bottom > 0, top: b.top, hdr,
          btn: btn && getComputedStyle(btn).display !== 'none' ? btn.getBoundingClientRect().height : 0, n: items.length, first: (items[0] || {}).textContent || '',
          minH: Math.min(...items.map(x => x.getBoundingClientRect().height || 99)), names: items.map(x => x.getAttribute('data-slm')) }; });
      const s0 = await side();
      await t(`${label}: manufacturer list has All manufacturers + the 3 approved lines`, () => { ok(s0.n === 4, 'items ' + s0.n + ' ' + s0.names.join(',')); ok(/All manufacturers/.test(s0.first), s0.first); });
      if (w >= 1200) {
        await t('desktop: sidebar shown beside the cards, no drawer button', () => { ok(s0.pos === 'sticky' && s0.inView, JSON.stringify(s0)); ok(!s0.btn, 'drawer button visible'); });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300);
        const s1 = await side();
        await t('desktop: sidebar stays on screen (sticky) after scrolling to the bottom', () => ok(s1.inView && s1.top >= 0, JSON.stringify({ top: s1.top, inView: s1.inView })));
        await page.evaluate(() => window.scrollTo(0, 0));
      } else {
        await t(`${label}: no persistent sidebar; a ≥44px Manufacturers button instead`, () => { ok(!s0.inView || s0.vis === 'hidden', JSON.stringify(s0)); ok(s0.btn >= 44, 'button ' + s0.btn); });
        await page.click('.sl-drawerbtn'); await page.waitForTimeout(400);
        const s1 = await side();
        await t(`${label}: the button opens the drawer; every row ≥44px`, () => { ok(s1.inView && s1.vis === 'visible', JSON.stringify(s1)); ok(s1.minH >= 44, 'row ' + s1.minH); });
        await page.keyboard.press('Escape'); await page.waitForTimeout(400);
        const s2 = await side(); const lock = await page.evaluate(() => document.body.classList.contains('cv2-lock'));
        await t(`${label}: Escape closes the drawer and unlocks the page`, () => { ok(!s2.inView || s2.vis === 'hidden', JSON.stringify(s2)); ok(!lock, 'page still locked'); });
        await page.click('.sl-drawerbtn'); await page.waitForTimeout(400);
      }
      // find box filters the list AND the cards
      await page.fill('#slFind', 'bem'); await page.waitForTimeout(150);
      const f = await page.evaluate(() => ({ list: [...document.querySelectorAll('#slSide .sl-m[data-slm]:not([hidden])')].map(x => x.getAttribute('data-slm')).filter(Boolean),
        cards: [...document.querySelectorAll('.sl-grid .sl-tile:not([hidden])')].map(x => x.getAttribute('data-sl')), count: document.querySelector('#slCount').textContent }));
      await t(`${label}: find box narrows list and cards to Bemis`, () => { ok(f.list.join() === 'bemis' && f.cards.join() === 'bemis', JSON.stringify(f)); ok(/1 of 3/.test(f.count), f.count); });
      await page.fill('#slFind', 'zzzz'); await page.waitForTimeout(150);
      const nm = await page.evaluate(() => !document.querySelector('#slNoMatch').hidden);
      await t(`${label}: no match says so`, () => ok(nm));
      await page.fill('#slFind', ''); await page.waitForTimeout(150);
      // an orderable line opens its catalog
      await page.click('#slSide .sl-m[data-slm="bemis"]');
      await page.waitForFunction(() => state.active === 'bemis', null, { timeout: 20000 });
      const lk = await page.evaluate(() => document.body.classList.contains('cv2-lock'));
      await t(`${label}: Bemis in the list opens the Bemis catalog (page not left locked)`, () => ok(!lk));
      await page.evaluate(() => showShop()); await page.waitForSelector('.shopland .sl-grid'); await page.waitForTimeout(600);
      // tile → catalog → All manufacturers → landing
      await page.click('.sl-tile[data-sl="access4u"]');
      await page.waitForFunction(() => state.active === 'access4u' && document.querySelector('#cv2Crumb a[data-cv="all"]'), null, { timeout: 20000 });
      await t(`${label}: Access4U tile opens its catalog; the breadcrumb offers All manufacturers`, () => ok(true));
      await page.evaluate(() => document.querySelector('#cv2Crumb a[data-cv="all"]').click());
      await page.waitForFunction(() => state.active === '__shopall__' && document.querySelectorAll('.shopland .sl-tile').length === 3, null, { timeout: 20000 });
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
      await t('Golden eligible: the Golden tile opens Golden inside Partner 360', () => ok(r.golden && r.golden.tag === 'BUTTON' && /Shop now/.test(r.golden.act) && /Shop Golden/.test(r.golden.label) && r.golden.badge === 'Your account', JSON.stringify(r.golden)));
      await ctx.close(); }
    // roster unreadable → storefront's own list
    { const { ctx, page } = await open(browser, 1280, 900, { rosterFails: true });
      await page.evaluate(() => showShop()); await page.waitForSelector('.shopland .sl-grid'); await page.waitForTimeout(1200);
      const r = await landingFacts(page);
      await t('website roster unreadable: the storefront list stands in (the 3 approved lines, local logos, nothing broken)', () => {
        ok(r.n === 3, 'tiles ' + r.n + ' ' + r.names.join(',')); ok(!r.broken.length, r.broken.join(',')); ok(r.scrollW <= r.clientW + 1); });
      await ctx.close(); }
    // owner 2026-11-06: no Request access / Ask HCPS tile anywhere for a line HCPS has not approved
    { const { ctx, page } = await open(browser, 390, 844, {});
      await page.evaluate(() => showShop()); await page.waitForSelector('.shopland .sl-grid'); await page.waitForTimeout(800);
      const st = await page.evaluate(() => ({ req: document.querySelectorAll('.shopland .sl-req').length, ask: /Ask HCPS|ask your HCPS sales rep/.test(document.querySelector('.shopland').innerText) }));
      await t('phone: no Request access or Ask HCPS tile for unapproved lines', () => { ok(!st.req && !st.ask, JSON.stringify(st)); });
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(`\nshop landing: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
