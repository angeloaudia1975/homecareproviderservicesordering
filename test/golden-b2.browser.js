/* Golden ⇄ Partner 360 — B2 browser walkthrough of the REAL storefront page (public/index.html) on a deploy-preview
   address, as a staff "view as dealer". golden-proxy is answered from Golden's REAL catalog data file
   (GOLDEN_REPO/repo/functions/lib/golden-catalog-data.json, built with Golden's own builder, no prices) — nothing
   reaches Golden or HCPS. Checks the Golden line in catalog-v2 at 390 / 768 / 1280 px: cards render, no broken image,
   no horizontal scroll, category navigation, search, product page with the size picker, no add-to-cart, no link to the
   Golden platform. Saves screenshots to SHOTS (default /tmp/golden-b2-shots).
   PLAYWRIGHT_MODULE=… GOLDEN_REPO=… node test/golden-b2.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const SHOTS = process.env.SHOTS || '/tmp/golden-b2-shots'; fs.mkdirSync(SHOTS, { recursive: true });
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

(async () => {
  const browser = await chromium.launch();
  const goldenHits = [], ytHits = [], ytTracking = [];
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
      const page = await ctx.newPage();
      await page.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (/goldenonlineordering\.netlify\.app/.test(u.host) && !/\.(jpg|webp|png)$/i.test(u.pathname)) { goldenHits.push(u.href); return route.fulfill({ status: 599, body: '' }); }
        if (u.origin === HOST) {
          let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
          if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
          return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        }
        if (/\/functions\/dealer-auth/.test(u.pathname) && route.request().method() === 'POST') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: 'd-test', name: 'TEST — Golden Sandbox', email: 't@example.invalid' }, lines: [], access: { your_accounts: [], available: [], golden: 'None' }, prices: {} }) });
        }
        if (/\/functions\/golden-proxy/.test(u.pathname)) {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
          const hdr = route.request().headers(); const b = JSON.parse(route.request().postData() || '{}');
          if (hdr['x-hcps-golden-env'] !== 'preview' || !hdr['x-hcps-preview']) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"ok":false,"error":"preview_not_allowed"}' });
          const base = { ok: true, enabled: true, available: true, preview: true };
          const ans = b.action === 'eligibility' ? Object.assign(base, { state: 'none', capabilities: { see_prices: false, order: false, history: false } })
            : b.action === 'catalog' ? Object.assign(base, { prices_visible: false, linked: false, products })
            : b.action === 'family' ? Object.assign(base, familyAnswer(String(b.family || '')))
            : b.action === 'config' ? Object.assign(base, configAnswer(b, false))
            : Object.assign(base, inv);
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ans) });
        }
        if (/youtube-nocookie\.com$/.test(u.host)) { ytHits.push(u.href); return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="background:#111"></body></html>' }); }
        if (/youtube\.com$|ytimg\.com$/.test(u.host)) { ytTracking.push(u.href); return route.fulfill({ status: 204, body: '' }); }
        if (/^(cdn\.wdgtsrc\.com|d3325uqufdmhie\.cloudfront\.net|fonts\.(googleapis|gstatic)\.com)$/.test(u.host) || /goldenonlineordering/.test(u.host)) return route.continue();
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      });
      await page.goto(HOST + '/?preview=' + 'p'.repeat(48), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => selectManufacturer(CONFIG.GOLDEN_SLUG));
      await page.waitForSelector('.gcard', { timeout: 20000 });
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => {
        const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const cards = [...document.querySelectorAll('.gcard')];
        return { cards: cards.length, total: (document.querySelector('.cv2-count, .cv2-tot, #cv2Count') || {}).textContent || document.body.innerText.match(/(\d+) products/)?.[1] || '', broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && vis(i) && i.getAttribute('src')).map(i => i.src).slice(0, 3),
          scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
          addBtns: document.querySelectorAll('.gcard .addbtn').length, goldenLinks: [...document.querySelectorAll('#content a[href*="goldenonlineordering"]')].length,
          cats: [...document.querySelectorAll('#cv2Nav .cv2-cat span')].map(x => x.textContent.trim()), first: (document.querySelector('.gcard .pname') || {}).textContent || '', text: document.body.innerText };
      });
      await t(`${label}: the Golden line renders as catalog-v2 family cards (24 a page, 53 families)`, () => { ok(r.cards === 24, 'cards ' + r.cards); ok(/53 products/.test(r.text), 'family count'); });
      await t(`${label}: Golden's sections in Golden's order, lift chairs first`, () => { ok(JSON.stringify(r.cats.slice(1)) === JSON.stringify(['Lift Chairs','Scooters','Power Wheelchairs','Beds']), r.cats.join('|')); ok(/EZ Sleeper/.test(r.first), 'first card ' + r.first); });
      await t(`${label}: no broken image, no horizontal scroll`, () => { ok(!r.broken.length, r.broken.join(', ')); ok(r.scrollW <= r.clientW + 1, r.scrollW + '>' + r.clientW); });
      await t(`${label}: no add-to-cart and no link out to the Golden platform`, () => { ok(r.addBtns === 0, 'add buttons'); ok(r.goldenLinks === 0, 'golden links'); });
      await t(`${label}: unlinked preview shows no dealer price`, () => ok(/Dealer price shows once your Golden account is linked/.test(r.text) && !/Your Golden price/.test(r.text)));
      await page.screenshot({ path: path.join(SHOTS, `golden-catalog-${label}.png`), fullPage: false });
      // product page with the size picker
      await page.evaluate(() => openProductDetail('PR535-MED'));
      await page.waitForTimeout(1500);
      const d = await page.evaluate(() => ({ sel: [...document.querySelectorAll('.pd-varsel option')].map(o => o.textContent.trim()), addBtns: document.querySelectorAll('.pd .addbtn').length,
        note: (document.querySelector('.gcfg') || {}).textContent || '', h1: (document.querySelector('.pd h1') || {}).textContent || '' }));
      await t(`${label}: product page — one family, size picker, Golden note, no add to cart`, () => {
        ok(/MaxiComforter/.test(d.h1), d.h1); ok(d.sel.length === 6, 'sizes ' + d.sel.join('|')); ok(d.addBtns === 0); ok(/Configure this chair/.test(d.note), d.note.slice(0, 80)); });
      await page.screenshot({ path: path.join(SHOTS, `golden-product-${label}.png`), fullPage: false });
      // the enriched product page: Golden gallery, size-specific specs, documents, videos, fabrics, compare
      for (const code of ['PR511-LAR', 'GA541D', 'BD100A-QB']) {
        await page.evaluate(c => openProductDetail(c), code);
        await page.waitForFunction(() => document.querySelector('.pd') && document.querySelectorAll('.pd-sect').length > 3, null, { timeout: 15000 });
        await page.waitForTimeout(2500);
        const e = await page.evaluate(() => {
          const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
          return { thumbs: document.querySelectorAll('.pd-thumb').length, main: (document.querySelector('#pdMain img') || {}).src || '',
            broken: [...document.querySelectorAll('.pd img')].filter(i => i.complete && i.naturalWidth === 0 && vis(i)).map(i => i.src),
            heads: [...document.querySelectorAll('.pd-sect h2')].map(h => h.textContent.trim()),
            specCols: [...document.querySelectorAll('table.gspec thead th')].map(x => x.textContent.trim()), onCols: document.querySelectorAll('table.gspec td.on').length,
            weight: [...document.querySelectorAll('table.gspec tr')].filter(r => /^Weight Capacity$/.test((r.querySelector('td.k') || {}).textContent || '')).map(r => [...r.querySelectorAll('td.v')].map(x => x.textContent.trim()))[0] || null,
            docs: [...document.querySelectorAll('.gdoc')].map(a => a.href), vids: [...document.querySelectorAll('.gvf iframe')].map(f => f.src),
            fabrics: document.querySelectorAll('.gfab').length, cmp: document.querySelectorAll('[data-gcmp]').length,
            scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, add: document.querySelectorAll('.pd .addbtn').length,
            goldenLinks: [...document.querySelectorAll('.pd a[href*="goldenonlineordering"]')].length, text: document.querySelector('.pd').innerText };
        });
        await t(`${label}: ${code} — Golden gallery, no broken image, no horizontal scroll`, () => {
          ok(e.thumbs >= 3, 'thumbs ' + e.thumbs); ok(/^https:\/\/d3325uqufdmhie\.cloudfront\.net\//.test(e.main), 'main ' + e.main);
          ok(!e.broken.length, e.broken.join(', ')); ok(e.scrollW <= e.clientW + 1, e.scrollW + '>' + e.clientW); ok(e.add === 0 && e.goldenLinks === 0); });
        await t(`${label}: ${code} — sections, documents from Golden, sources shown`, () => {
          ok(e.heads.includes('Specifications') && e.heads.includes('Documents & downloads'), e.heads.join('|'));
          ok(e.docs.length >= 1 && e.docs.every(u => /^https:\/\/(d3325uqufdmhie\.cloudfront\.net|www\.dropbox\.com\/scl\/fo\/|www\.flipsnack\.com\/oldforge\/)/.test(u)), e.docs.join(' '));
          ok(/Source:/.test(e.text) && /Product content from Golden Technologies/.test(e.text)); ok(e.vids.every(v => /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/.test(v)), e.vids.join(' ')); });
        if (code === 'PR511-LAR') {
          await t(`${label}: PR511 — size table from Golden's sell sheet, the chosen size marked, fabrics, compare`, () => {
            ok(e.specCols.length === 5, e.specCols.join('|')); ok(e.onCols > 20, 'highlighted ' + e.onCols);
            ok(JSON.stringify(e.weight) === JSON.stringify(['400 LBS', '400 LBS', '400 LBS', '600 LBS']), JSON.stringify(e.weight));
            ok(e.fabrics >= 5, 'fabrics ' + e.fabrics); ok(e.cmp >= 1, 'compare'); ok(e.heads.includes('Videos'), 'videos'); });
          await page.click('[data-gcmp]'); await page.waitForTimeout(1500);
          const cmpRows = await page.evaluate(() => document.querySelectorAll('#gcmpOut tr').length);
          await t(`${label}: compare another Golden model side by side`, () => ok(cmpRows > 5, 'rows ' + cmpRows));
          await page.screenshot({ path: path.join(SHOTS, `golden-pr511-${label}.png`), fullPage: true });
        } else await page.screenshot({ path: path.join(SHOTS, `golden-${code.toLowerCase()}-${label}.png`), fullPage: true });
      }
      if (label === 'desktop') {
        await page.evaluate(() => renderProducts());
        await page.waitForTimeout(800);
        const s = await page.$('.cv2-search input');
        if (s) { await s.fill('maxicomforter'); await page.waitForTimeout(1200); }
        const n = await page.evaluate(() => document.querySelectorAll('.gcard').length);
        await t('desktop: search narrows the Golden line', () => ok(s && n >= 1 && n <= 3, 'search box ' + !!s + ', cards ' + n));
        await page.screenshot({ path: path.join(SHOTS, `golden-search-desktop.png`), fullPage: false });
      }
      await ctx.close();
    }
    await t('the browser never called Golden directly', () => ok(!goldenHits.length, goldenHits.slice(0, 3).join(', ')));
    await t('videos use only the privacy-enhanced youtube-nocookie player', () => ok(ytHits.length > 0 && ytHits.every(u => /youtube-nocookie\.com\/embed\//.test(u)), ytHits.slice(0, 2).join(' ')));
  } finally { await browser.close(); }
  console.log(`\ngolden b2 browser: ${pass} passed, ${fail} failed · screenshots in ${SHOTS}`);
  process.exit(fail ? 1 : 0);
})();
