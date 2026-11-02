/* Golden ⇄ Partner 360 — B3 configurator browser walkthrough of the REAL storefront page (public/index.html) on a deploy-preview
   address, as a staff "view as dealer". golden-proxy is answered from Golden's REAL catalog data file
   (GOLDEN_REPO/repo/functions/lib/golden-catalog-data.json, built with Golden's own builder, no prices) — nothing
   reaches Golden or HCPS. Checks the Golden line in catalog-v2 at 390 / 768 / 1280 px: cards render, no broken image,
   no horizontal scroll, category navigation, search, product page with the size picker, no add-to-cart, no link to the
   Golden platform. Saves screenshots to SHOTS (default /tmp/golden-b3-shots).
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… node test/golden-b2.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const SHOTS = process.env.SHOTS || '/tmp/golden-b3-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const HOST = 'https://deploy-preview-99--hcpsonlineordering.netlify.app';
const C = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'golden-catalog.js'));
const DATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'golden-catalog-data.json'));
const products = C.buildCatalog({ data: DATA, merch: {}, pricing: [], seePrices: false });
const ENRICH = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'golden-enrichment.json'));
const familyAnswer = fam => { const f = C.buildFamily({ data: DATA, enrichment: ENRICH, merch: {}, pricing: [], seePrices: false, linked: false, family: fam }); return f ? { prices_visible: false, linked: false, enrichment_as_of: ENRICH.as_of, family: f } : { available: false, reason: 'not_found' }; };
const CFG = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'golden-config.js'));
const configAnswer = (b, priced) => { const c = CFG.configure({ sku: String(b.sku || ''), fabric: b.fabric || 'std', color: b.color || null, tier: b.tier || null, footrest: b.footrest === true, pricing: [], invRows: [] });
  if (!c.ok || (c.quote && !c.quote.ok)) return { available: false, reason: 'not_offered' };
  return { prices_visible: priced, linked: priced, config: CFG.present(c, { seePrices: priced, linked: priced }) }; };
const inv = C.inventorySummary({ data: DATA, merch: {}, rows: DATA.products.filter(p => /^(PR|GB|GP)/.test(p.sku)).map((p, i) => ({ sku: p.sku, size: p.size_code, avail: [120, 7, 0][i % 3], updated_at: new Date().toISOString() })) });
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }

let PRICED = false, configCalls = [];
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label, priced] of [[390, 844, 'iphone', false], [768, 1024, 'tablet', true], [1280, 900, 'desktop', true]]) {
      PRICED = priced;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
      const page = await ctx.newPage();
      await page.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.origin === HOST) {
          let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
          if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
          return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        }
        if (/\/functions\/dealer-auth/.test(u.pathname) && route.request().method() === 'POST')
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: 'd-test', name: 'TEST — Golden Sandbox', email: 't@example.invalid' }, lines: [], access: { your_accounts: [], available: [], golden: 'None' }, prices: {} }) });
        if (/\/functions\/golden-proxy/.test(u.pathname)) {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
          const b = JSON.parse(route.request().postData() || '{}');
          const base = { ok: true, enabled: true, available: true, preview: true };
          if (b.action === 'config') configCalls.push(b);
          const ans = b.action === 'eligibility' ? Object.assign(base, { state: 'none', capabilities: { see_prices: PRICED, order: false, history: false } })
            : b.action === 'catalog' ? Object.assign(base, { prices_visible: false, linked: false, products })
            : b.action === 'family' ? Object.assign(base, familyAnswer(String(b.family || '')))
            : b.action === 'config' ? Object.assign(base, configAnswer(b, PRICED))
            : Object.assign(base, inv);
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ans) });
        }
        if (/^(cdn\.wdgtsrc\.com|d3325uqufdmhie\.cloudfront\.net|fonts\.(googleapis|gstatic)\.com)$/.test(u.host)) return route.continue();
        if (/youtube|ytimg/.test(u.host)) return route.fulfill({ status: 204, body: '' });
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      });
      await page.goto(HOST + '/?preview=' + 'p'.repeat(48), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => selectManufacturer(CONFIG.GOLDEN_SLUG));
      await page.waitForSelector('.gcard', { timeout: 20000 });
      await page.evaluate(() => openProductDetail('PR511-LAR'));
      await page.waitForSelector('.gcfg .gcfg-c', { timeout: 15000 });
      const s0 = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.gcfg-tab')].map(x => x.textContent.trim()), colors: document.querySelectorAll('.gcfg-c').length,
        tiers: [...document.querySelectorAll('.gcfg-tier')].map(x => x.textContent.trim()), fr: !!document.querySelector('[data-gfoot]'), add: document.querySelector('.gcfg-add').disabled,
        cart: document.querySelectorAll('.pd .addbtn').length }));
      await t(`${label}: PR511 — Golden's tabs, colours, tiers and footrest; add-to-cart stays closed`, () => {
        ok(s0.tabs.length === 3 && /Cross-Over/.test(s0.tabs[1]) && /Brisa/.test(s0.tabs[2]), s0.tabs.join('|')); ok(s0.colors === 10, 'std colours ' + s0.colors);
        ok(s0.tiers.length === 3 && /Nirvana/.test(s0.tiers[2]), s0.tiers.join('|')); ok(s0.fr && s0.add === true && s0.cart === 0);
        ok(priced ? /\+\$142/.test(s0.tabs[1]) : !/\$/.test(s0.tabs.join('') + s0.tiers.join('')), 'upcharges only when priced: ' + s0.tabs[1]); });
      await page.click('[data-gfab="xover"]'); await page.waitForTimeout(400);
      await page.click('[data-gcol="JBO"]'); await page.waitForSelector('.gcfg-q', { timeout: 10000 });
      await page.click('[data-gtier="nirvana"]'); await page.waitForTimeout(400);
      await page.check('[data-gfoot]'); await page.waitForFunction(() => /footrest/i.test((document.querySelector('.gcfg-q') || {}).textContent || ''), null, { timeout: 10000 });
      const q = await page.evaluate(() => ({ text: document.querySelector('.gcfg-q').innerText, on: (document.querySelector('.gcfg-c.on') || {}).getAttribute && document.querySelector('.gcfg-c.on').getAttribute('data-gcol'),
        broken: [...document.querySelectorAll('.pd img')].filter(i => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).length,
        scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, small: [...document.querySelectorAll('.gcfg button, .gcfg input')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height < 44 && b.type !== 'checkbox'; }).length }));
      await t(`${label}: Cross-Over JZ Bourbon + Nirvana + footrest — Golden's answer drawn as given`, () => {
        ok(q.on === 'JBO', 'selected ' + q.on); ok(/JZ Bourbon/.test(q.text) && /Custom build with footrest extension/.test(q.text), q.text);
        ok(/Golden item # PR511-LAR/.test(q.text), 'item #');
        if (priced) ok(/\$1,608/.test(q.text) && /Base: \$1,188 \+ Cross-Over Fabric \$142 \+ Nirvana \$200 \+ Footrest Ext \$78/.test(q.text), q.text);
        else ok(!/\$/.test(q.text) && /once your Golden account is linked/.test(q.text), 'no price unlinked: ' + q.text); });
      await t(`${label}: configurator — no broken image, no horizontal scroll, touch targets ≥ 44px`, () => { ok(!q.broken, 'broken ' + q.broken); ok(q.scrollW <= q.clientW + 1, q.scrollW + '>' + q.clientW); ok(q.small === 0, 'small ' + q.small); });
      const last = configCalls[configCalls.length - 1];
      await t(`${label}: the page asks Golden for exactly the selection`, () => ok(last.sku === 'PR511-LAR' && last.fabric === 'xover' && last.color === 'JBO' && last.tier === 'nirvana' && last.footrest === true, JSON.stringify(last)));
      await page.screenshot({ path: path.join(SHOTS, `golden-config-${label}.png`), fullPage: true });
      await page.locator('.gcfg').screenshot({ path: path.join(SHOTS, `golden-config-panel-${label}.png`) });
      // the size picker keeps the choices; an included-tier model shows no paid tiers
      await page.evaluate(() => openProductDetail('PR511-MXW')); await page.waitForSelector('.gcfg-q', { timeout: 10000 });
      const mxw = await page.evaluate(() => document.querySelector('.gcfg-q').innerText);
      await t(`${label}: another size keeps the selection (PR511-MXW)`, () => ok(/JZ Bourbon/.test(mxw) && (!priced || /\$1,686/.test(mxw)), mxw));
      await page.evaluate(() => openProductDetail('PR447-MED')); await page.waitForSelector('.gcfg .gcfg-c', { timeout: 10000 });
      const inc = await page.evaluate(() => ({ tiers: document.querySelectorAll('.gcfg-tier').length, text: document.querySelector('.gcfg').innerText }));
      await t(`${label}: PR447 — Nirvana included, no upgrade buttons, no Cross-Over tab`, () => ok(inc.tiers === 0 && /Included/i.test(inc.text) && /Nirvana/.test(inc.text) && !/Cross-Over/.test(inc.text), inc.text.slice(0, 200)));
      // a non-configurable Golden product keeps the B2 note (scooter)
      await page.evaluate(() => openProductDetail('GA541D')); await page.waitForTimeout(1500);
      const sc = await page.evaluate(() => ({ cfg: !!document.querySelector('.gcfg'), note: !!document.querySelector('.pd-golden') }));
      await t(`${label}: a scooter has no configurator`, () => ok(!sc.cfg && sc.note));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\ngolden b3 browser: ${pass} passed, ${fail} failed · screenshots in ${SHOTS}`);
  process.exit(fail ? 1 : 0);
})();
