/* C3-07 Stage 7 — dealer storefronts in a real browser (nothing reaches HCPS, Supabase or an email provider).
   PUBLIC PAGE (public/store.html at /store/<address>, storefront-public answered locally): at 390 / 768 / 1280 px the dealer's
   name, Call link, directions and hours show (escaped); MSRP vs "From" vs "Call for Price"; a product family is one card;
   image categories, search, manufacturer / price / capacity filters, chips, sort, list view; the product page (gallery, sizes,
   benefits, specifications, brochure, contact); a broken photo becomes a placeholder; one anonymous view per SKU; the request form needs
   consent, sends only what was typed (+ an empty hidden field) and thanks the customer; no cookies or browser storage; no
   horizontal scroll; 44 px targets; 16 px inputs. PORTAL (index.html → My Storefront, dealer-storefront-api answered
   locally): the tab exists, settings save exactly what was typed, a branch's view of its head office is read-only,
   customer requests can be marked handled.
   PLAYWRIGHT_MODULE=… node test/storefront.browser.js */
const path = require('path'), fs = require('fs');
const { chromium, open } = require('./_shop-harness.js');
const PUB = path.join(__dirname, '..', 'public');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const HOST = 'https://hcpsonlineordering.netlify.app';
const PUBLIC = { ok: true, dealer: { name: 'Acme <script>x</script> Medical', headline: 'Home care for Dayton', about: 'Family owned.', hours: 'Mon–Fri 9–5', logo: null, phone: '(555) 010-0100', email: 'shop@acme.test', address: { street: '1 Main', city: 'Dayton', state: 'OH', zip: '45402' } },
  lines: [{ slug: 'bemis', name: 'Bemis', count: 2 }, { slug: 'strongback', name: 'Strongback', count: 1 }],
  products: [{ manufacturer: 'bemis', code: 'B1', name: 'Raised seat', category: 'Bath Safety', description: 'Nice <b>seat</b>', image: '/assets/products/bemis/B1.jpg', attributes: { Width: '18"' }, price: 99.99, price_label: 'MSRP' },
    { manufacturer: 'bemis', code: 'B2', name: 'Grab bar', category: 'Bath Safety', image: '/assets/missing.jpg', attributes: {}, price: null, price_label: 'Call for Price' },
    { manufacturer: 'strongback', code: 'S1', name: 'Excursion chair', category: 'Wheelchairs', image: null, attributes: {}, features: ['450 lbs max', 'Holds 9 parts'], price: null, price_label: 'Call for Price' },
    { manufacturer: 'bemis', code: 'B9', name: 'Seat case', category: 'Parts', image: null, attributes: {}, price: 120, price_label: 'MSRP', price_unit: 'per Case (2 each)' },
    { manufacturer: 'golden-technologies', code: 'PR-501', name: 'Cloud lift chair (Small)', family: 'PR-501', family_name: 'Cloud lift chair', category: 'Lift Chairs', image: 'https://d3325uqufdmhie.cloudfront.net/pr501.jpg', gallery: ['https://d3325uqufdmhie.cloudfront.net/pr501.jpg', 'https://d3325uqufdmhie.cloudfront.net/pr501b.jpg'], documents: [{ title: 'Cloud brochure', url: 'https://www.homecareproviderservices.org/assets/docs/cloud.pdf' }], attributes: { Size: 'Small', 'Weight Capacity': '375 lb' }, features: ['Infinite position', 'Zero-gravity seating'], price: 1899, price_label: 'Price', price_unit: null },
    { manufacturer: 'golden-technologies', code: 'PR-501M', name: 'Cloud lift chair (Medium)', family: 'PR-501', family_name: 'Cloud lift chair', category: 'Lift Chairs', image: 'https://d3325uqufdmhie.cloudfront.net/pr501.jpg', gallery: [], documents: [{ title: 'Cloud brochure', url: 'https://www.homecareproviderservices.org/assets/docs/cloud.pdf' }], attributes: { Size: 'Medium', 'Weight Capacity': '450 lb' }, features: ['Infinite position', 'Zero-gravity seating'], price: 1999, price_label: 'Price', price_unit: null }],
  price_note: 'Prices shown are the manufacturer\'s suggested retail price (MSRP).', privacy: 'Your request is sent only to this dealer…' };
/* the full product page (enrichment upgrade 2026-11-07) — only PR-501 has one in the default fixture (others keep the summary) */
const DETAILS = { 'golden-technologies|PR-501': { tagline: 'Sleep-friendly <comfort>', paragraphs: ['The Cloud is <b>soft</b>.', 'Second paragraph.'], highlights: [{ label: 'Weight capacity', value: '375 LBS' }, { label: 'Comfort zones', value: '5' }],
  feature_groups: [{ title: 'Standard features', items: ['Twilight positioning', 'Lumbar'] }, { title: 'Benefits', items: ['Rest easy'] }], uses: ['Limited mobility'],
  options: [{ label: 'Upholstery', values: [{ name: 'Standard' }, { name: 'Cross-Over' }] }, { label: 'Standard colors', values: [{ name: 'Ivory', hex: '#eeeeee', swatch: 'https://d3325uqufdmhie.cloudfront.net/sw.jpg' }, { name: 'Bad hex', hex: 'red;background:url(x)' }] }, { label: 'Upgrades', values: [{ name: 'Heat & vibration' }], note: 'Heat available' }],
  option_note: 'Ask the dealer about available options, colors and upgrade pricing.',
  spec_table: { columns: [{ code: 'PR-501', label: 'Small' }, { code: 'PR-501M', label: 'Medium' }], rows: [{ label: 'Seat width', values: { 'PR-501': '20"', 'PR-501M': '21"' } }] }, specs: [],
  sizing: { columns: ['Size', 'Height'], rows: [['S', '5\'0"']] }, sizing_note: 'Measure seated.', warranty: ['Lifetime frame'],
  documents: [{ title: 'Sell sheet', url: 'https://goldentech.com/s.pdf' }], videos: [{ title: 'Tour', url: 'https://www.youtube.com/watch?v=abcdefghijk' }],
  gallery: ['https://d3325uqufdmhie.cloudfront.net/g2.jpg', 'https://d3325uqufdmhie.cloudfront.net/g3.jpg'], source: { label: 'Product information from Golden Technologies', url: 'https://goldentech.com/cloud' } } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/* the live Content-Security-Policy, read from netlify.toml — the page must work under it (no inline script) */
const CSP = (fs.readFileSync(path.join(PUB, '..', 'netlify.toml'), 'utf8').match(/for = "\/store\.html"[\s\S]*?Content-Security-Policy = "([^"]+)"/) || [])[1];
if (!CSP) { console.log('FAIL no CSP for /store.html in netlify.toml'); process.exit(1); }
async function publicPage(browser, w, h, data, details) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
  const page = await ctx.newPage(); const st = { posts: [], csp: [] };
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text()); });
  await page.route('**/*', async (route) => { const req = route.request(), u = new URL(req.url());
    if (u.host === 'homecareproviderservices.netlify.app' && /storefront-public/.test(u.pathname)) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
      if (req.method() === 'GET' && u.searchParams.get('d')) { st.details = (st.details || []).concat(u.searchParams.get('d')); const dd = (details || {})[u.searchParams.get('d')];
        return route.fulfill({ status: dd ? 200 : 404, contentType: 'application/json', headers: CORS, body: JSON.stringify(dd ? { ok: true, detail: dd } : { ok: false, error: 'Product not found.' }) }); }
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(data || PUBLIC) });
      const b = JSON.parse(req.postData() || '{}'); st.posts.push(b);
      if (b.action === 'inquiry' && b.consent !== true) return route.fulfill({ status: 400, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false, error: 'Please agree to the dealer contacting you about your request.' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"ok":true}' }); }
    if (u.origin === HOST && u.pathname.startsWith('/store/')) return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': CSP }, body: fs.readFileSync(path.join(PUB, 'store.html')) });
    if (u.origin === HOST && u.pathname === '/store.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PUB, 'store.js')) });
    if (u.origin === HOST && (u.pathname === '/assets/products/bemis/B1.jpg' || u.pathname === '/assets/logo-test.png')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.host === 'd3325uqufdmhie.cloudfront.net') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    return route.fulfill({ status: 404, body: '' }); });
  await page.goto(HOST + '/store/acme-medical'); await page.waitForSelector('.card');
  return { ctx, page, st };
}
const layout = (page, sel) => page.evaluate((sel) => {
  const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const small = [...document.querySelectorAll(sel)].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || e.tagName).trim().slice(0, 25));
  const tiny = [...document.querySelectorAll('input:not([type=checkbox]),select,textarea')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length;
  return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, tiny };
}, sel);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const { ctx, page, st } = await publicPage(browser, w, h);
      await t(label + ': public page shows the dealer (escaped), Call, directions, hours and every card with MSRP / From / Call for Price', async () => {
        const r = await page.evaluate(() => [document.querySelector('h1').textContent, !!document.querySelector('h1 script'), document.querySelector('a[href^="tel:"]').getAttribute('href'),
          Object.fromEntries([...document.querySelectorAll('.card')].map((c) => [c.querySelector('.nm').textContent, c.querySelector('.price').textContent])), !!document.querySelector('#info a[href^="https://www.google.com/maps/"]'), document.querySelector('#info').textContent]);
        ok(r[0] === 'Acme <script>x</script> Medical' && !r[1], 'name escaped'); ok(r[2] === 'tel:5550100100', r[2]); ok(r[4], 'directions link'); ok(/Mon–Fri 9–5/.test(r[5]), 'hours');
        ok(JSON.stringify(r[3]) === JSON.stringify({ 'Cloud lift chair': 'From$1,899.00', 'Excursion chair': 'Call for Price', 'Grab bar': 'Call for Price', 'Raised seat': '$99.99MSRP', 'Seat case': '$120.00MSRP per Case (2 each)' }), JSON.stringify(r[3]), 'a dealer / calculated price is never labelled MSRP');
        ok(!st.csp.length, 'CSP violations: ' + st.csp.join(' | '));
      });
      await t(label + ': SKUs of one product family are ONE card ("2 sizes"); different products are never merged; every SKU stays', async () => {
        const r = await page.evaluate(() => [document.querySelectorAll('.card').length, [...document.querySelectorAll('.card .opts')].map((x) => x.textContent), document.querySelector('.count').textContent]);
        ok(r[0] === 5 && JSON.stringify(r[1]) === '["2 sizes"]' && r[2] === '5 products', JSON.stringify(r)); });
      await page.waitForTimeout(400);
      await t(label + ': a missing photo becomes a placeholder (never a broken image)', async () => ok(await page.evaluate(() => [...document.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0)), 'broken image'));
      await t(label + ': image category tiles filter, and a second tap clears', async () => {
        ok(await page.$$eval('.cat', (c) => c.length) === 4, 'four categories');
        await page.click('.cat[data-cat="Bath Safety"]'); ok(await page.$$eval('.card', (c) => c.length) === 2, 'category');
        ok(/Bath Safety/.test(await page.textContent('.crumbs')), 'breadcrumb');
        await page.click('.cat[data-cat="Bath Safety"]'); ok(await page.$$eval('.card', (c) => c.length) === 5, 'cleared'); });
      await t(label + ': search, manufacturer, price, weight-capacity filters, chips and Clear all', async () => {
        await page.fill('#sq', 'grab'); await page.click('#sform button'); ok(await page.$$eval('.card', (c) => c.length) === 1, 'search');
        await page.click('.chip[data-rm="q"]'); ok(await page.$$eval('.card', (c) => c.length) === 5, 'chip removes search');
        if (w < 980) { await page.click('[data-fopen]'); ok(await page.evaluate(() => getComputedStyle(document.getElementById('filters')).display !== 'none'), 'drawer opens'); }
        await page.check('input[data-f="mfrs"][value="strongback"]'); ok((await page.$$eval('.card .nm', (c) => c.map((x) => x.textContent))).join() === 'Excursion chair', 'manufacturer');
        await page.click('aside [data-clear]');
        if (w < 980 && !(await page.isVisible('[data-fclose]'))) await page.click('[data-fopen]');
        await page.check('input[data-f="cap"][value="401–500"]'); ok((await page.$$eval('.card .nm', (c) => c.map((x) => x.textContent))).join() === 'Cloud lift chair,Excursion chair', 'capacity (a specification, or a feature that states it)');
        await page.click('aside [data-clear]');
        if (w < 980 && !(await page.isVisible('[data-fclose]'))) await page.click('[data-fopen]');
        await page.fill('#pmin', '100'); await page.dispatchEvent('#pmin', 'change'); ok((await page.$$eval('.card .nm', (c) => c.map((x) => x.textContent))).join() === 'Cloud lift chair,Seat case', 'price');
        await page.click('aside [data-clear]'); if (w < 980 && await page.isVisible('[data-fclose]')) await page.click('[data-fclose]'); ok(await page.$$eval('.card', (c) => c.length) === 5, 'clear all'); });
      await t(label + ': sort by price and list view', async () => {
        await page.selectOption('#sort', 'phl'); ok((await page.$$eval('.card .nm', (c) => c.map((x) => x.textContent))).slice(0, 2).join() === 'Cloud lift chair,Seat case', 'price high-low');
        await page.click('[data-view="list"]'); ok(await page.evaluate(() => document.querySelector('.grid').classList.contains('list')), 'list'); await page.click('[data-view="grid"]'); await page.selectOption('#sort', 'name'); });
      const L = await layout(page, '.btn, .cat, .tools input, .tools select, #sort, .chip');
      await t(label + ': no horizontal scroll; 44 px targets; 16 px inputs', () => { ok(L.overflow <= 1, 'overflow ' + L.overflow); ok(!L.small.length, 'small: ' + L.small.join('|')); ok(!L.tiny, 'tiny inputs'); });
      await page.click('.card .nm >> text=Cloud lift chair'); await page.waitForSelector('.pdp');
      await t(label + ': PRODUCT PAGE — gallery, sizes, benefits, specifications, brochure, related, dealer contact; shareable link', async () => {
        const r = await page.evaluate(() => [location.hash, document.querySelector('.pdp h2').textContent, document.querySelectorAll('.thumbs button').length, [...document.querySelectorAll('[data-opt]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
          [...document.querySelectorAll('.feats li')].map((x) => x.textContent), [...document.querySelectorAll('.attrs tr')].map((x) => x.textContent), [...document.querySelectorAll('.docs a')].map((a) => a.getAttribute('href')), document.querySelector('.contact').textContent, document.querySelector('.pdp .price').textContent, document.activeElement && document.activeElement.tagName]);
        ok(r[0] === '#product/' + encodeURIComponent('golden-technologies|PR-501'), r[0]); ok(r[1] === 'Cloud lift chair', r[1]); ok(r[2] === 2, 'gallery ' + r[2]);
        ok(JSON.stringify(r[3]) === '["Small*","Medium"]', JSON.stringify(r[3])); ok(r[4].join('|') === 'Infinite position|Zero-gravity seating', JSON.stringify(r[4]));
        ok(r[5].join('|') === 'SizeSmall|Weight Capacity375 lb', JSON.stringify(r[5])); ok(JSON.stringify(r[6]) === '["https://www.homecareproviderservices.org/assets/docs/cloud.pdf"]', JSON.stringify(r[6]));
        ok(/1 Main/.test(r[7]) && /\(555\) 010-0100/.test(r[7]), r[7]); ok(r[8] === '$1,899.00', r[8]); ok(r[9] === 'H2', 'focus on the heading');
        ok(!/in stock/i.test(await page.textContent('.pdp')), 'no stock implication'); });
      await t(label + ': choosing a size shows that SKU\'s own price and specifications', async () => {
        await page.click('[data-opt="PR-501M"]'); await page.waitForSelector('[data-opt="PR-501M"][aria-pressed="true"]');
        const r = await page.evaluate(() => [document.querySelector('.pdp .price').textContent, [...document.querySelectorAll('.attrs tr')].map((x) => x.textContent).join('|')]);
        ok(r[0] === '$1,999.00' && r[1] === 'SizeMedium|Weight Capacity450 lb', JSON.stringify(r)); });
      await t(label + ': the product page counts one anonymous view per SKU seen', async () => {
        await page.evaluate(() => dispatchEvent(new Event('pagehide'))); await page.waitForTimeout(300);
        const v = st.posts.filter((p) => p.action === 'view'); ok(v.length === 1 && JSON.stringify(v[0]) === JSON.stringify({ action: 'view', s: 'acme-medical', items: [{ manufacturer: 'golden-technologies', code: 'PR-501' }, { manufacturer: 'golden-technologies', code: 'PR-501M' }] }), JSON.stringify(v)); });
      await page.click('.pdp [data-ask]'); await page.waitForSelector('#f');
      await t(label + ': the request dialog takes focus, is named, keeps Tab inside', async () => {
        const f = await page.evaluate(() => [document.getElementById('ov').getAttribute('aria-label'), document.getElementById('dlg').contains(document.activeElement)]);
        ok(f[0] === 'Request information' && f[1], JSON.stringify(f));
        for (let i = 0; i < 9; i++) await page.keyboard.press('Tab'); ok(await page.evaluate(() => document.getElementById('dlg').contains(document.activeElement)), 'tab escaped the dialog'); });
      await page.waitForTimeout(2600);
      await page.fill('#f [name=name]', 'Pat'); await page.fill('#f [name=email]', 'pat@example.com'); await page.fill('#f [name=message]', 'In stock?');
      await page.click('#fsend'); await page.waitForTimeout(400);
      await t(label + ': the request needs consent', async () => ok(/agree/.test(await page.textContent('#ferr')), 'consent error'));
      await page.check('#f [name=consent]'); await page.click('#fsend'); await page.waitForSelector('.ok');
      await t(label + ': the request names the size chosen, sends only what was typed and thanks the customer', async () => {
        const q = st.posts.filter((p) => p.action === 'inquiry').pop();
        ok(JSON.stringify(Object.keys(q).sort()) === JSON.stringify(['action', 'consent', 'email', 'hp', 'message', 'name', 'phone', 'product', 's']) && q.hp === '' && q.product.code === 'PR-501M' && q.product.manufacturer === 'golden-technologies', JSON.stringify(q)); });
      await page.keyboard.press('Escape');
      await t(label + ': Back returns to the catalog', async () => { await page.goBack(); await page.goBack(); await page.waitForSelector('.card'); ok(!(await page.$('.pdp')), 'still on product'); });
      await t(label + ': "Ask about it" on a family card names the product, never a size the visitor did not choose', async () => {
        await page.click('.card:has(.nm:text("Cloud lift chair")) [data-askf]'); await page.waitForSelector('#f');
        ok(/About: Cloud lift chair/.test(await page.textContent('#dlg')) && /Cloud lift chair/.test(await page.inputValue('#f [name=message]')), 'family named'); await page.waitForTimeout(2600);
        await page.fill('#f [name=name]', 'Pat'); await page.fill('#f [name=email]', 'pat@example.com'); await page.check('#f [name=consent]'); await page.click('#fsend'); await page.waitForSelector('.ok');
        const q = st.posts.filter((p) => p.action === 'inquiry').pop(); ok(!('product' in q) && /Cloud lift chair/.test(q.message), JSON.stringify(q)); await page.keyboard.press('Escape');
        await page.click('.card:has(.nm:text("Grab bar")) [data-askf]'); await page.waitForSelector('#f'); ok(/#B2/.test(await page.textContent('#dlg')), 'one-option card names its SKU'); await page.keyboard.press('Escape'); });
      await t(label + ': a malformed or hostile link still shows the catalog', async () => {
        for (const h of ['#%E0%A4%A', '#product/constructor', '#product/__proto__', '#product/' + encodeURIComponent('nope|X')]) { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); ok(await page.$$eval('.card', (c) => c.length) > 0, 'blank page for ' + h); }
        await page.evaluate(() => { location.hash = ''; }); await page.waitForSelector('.card'); });
      await t(label + ': no cookies and no browser storage', async () => { const r = await page.evaluate(() => [document.cookie, localStorage.length, sessionStorage.length]); ok(r[0] === '' && r[1] === 0 && r[2] === 0, JSON.stringify(r)); ok((await ctx.cookies()).length === 0, 'cookies'); });
      await ctx.close();
    }
    // ---- DESIGN UPGRADE (owner 2026-11-07 14:53 CT): Professional / Modern / Classic, themes, category grid, logo, introduction
    const HLT = { local: 'Local service & support', showroom: 'Visit our showroom', delivery: 'Delivery & setup' };
    const TH = { blue: ['#0b2f5b', '#c2410c', '#ffffff'], green: ['#14532d', '#15803d', '#ffffff'], burgundy: ['#5c1a28', '#9b1c31', '#ffffff'], custom: ['#ffeb3b', '#777777', '#000000'] };   // as the server resolves them (_storefront.publicDesign)
    const design0 = (lay, theme, hl) => ({ layout: lay, theme, primary: TH[theme][0], accent: TH[theme][1], on_primary: TH[theme][2], on_accent: '#ffffff', link: TH[theme][1], cat_cols: 3, cat_order: ['Cat L', 'Lift Chairs'], highlights: hl.map((k) => ({ key: k, text: HLT[k] })) });
    const layoutCheck = (page) => layout(page, '.btn,.ccard,nav.mainnav a,nav.mainnav button,.chip');
    const many = []; for (let i = 0; i < 12; i++) many.push({ manufacturer: 'bemis', code: 'C' + i, name: 'Item ' + i, category: 'Cat ' + String.fromCharCode(65 + i), image: '/assets/products/bemis/B1.jpg', attributes: {}, price: 10 + i, price_label: 'MSRP' });
    for (const [lay, theme, w, h, logo, hl] of [['professional', 'blue', 1280, 900, true, ['local', 'showroom']], ['modern', 'green', 768, 1024, false, []], ['classic', 'burgundy', 390, 844, true, ['delivery']], ['professional', 'custom', 390, 844, false, []]]) {
      const design = design0(lay, theme, hl);
      const data = Object.assign({}, PUBLIC, { products: PUBLIC.products.concat(many), dealer: Object.assign({}, PUBLIC.dealer, { design, logo: logo ? HOST + '/assets/logo-test.png' : null }) });
      const { ctx, page, st } = await publicPage(browser, w, h, data); const lab = lay + '/' + theme + ' ' + w;
      await t(lab + ': one renderer — the same products, prices and inquiry; the layout and colors change only the presentation', async () => {
        ok(await page.evaluate((l) => document.body.classList.contains('lay-' + l), lay), 'layout class');
        const v = await page.evaluate(() => ({ brand: getComputedStyle(document.body).getPropertyValue('--brand').trim(), onb: getComputedStyle(document.body).getPropertyValue('--on-brand').trim(), nav: getComputedStyle(document.querySelector('nav.mainnav')).backgroundColor }));
        ok(v.brand === design.primary && v.onb === design.on_primary, JSON.stringify(v));
        ok((await page.$$('.card')).length > 0 && /Request information/.test(await page.textContent('#hdr')), 'cards + request');
        ok(await page.evaluate(() => !document.querySelector('nav.cats .cat')), 'no horizontal category strip');
      });
      await t(lab + ': category GRID (dealer order first, configured columns, View all categories) — no horizontal scrolling', async () => {
        const names = await page.$$eval('.ccard b', (b) => b.map((x) => x.textContent));
        ok(names[0] === 'Cat L' && names[1] === 'Lift Chairs', 'dealer order: ' + names.slice(0, 3));
        ok(names.length === 6, 'two rows of 3 first: ' + names.length);
        await page.click('[data-catall]'); ok((await page.$$('.ccard')).length === 16, 'all categories: ' + (await page.$$('.ccard')).length);
        const L = await layoutCheck(page); ok(L.overflow <= 0, 'overflow ' + L.overflow);
        if (w >= 768) { const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.cgrid')).gridTemplateColumns.split(' ').length); ok(cols === (w <= 820 ? 2 : lay === 'modern' ? 4 : 3), 'columns ' + cols); }
        await page.click('.ccard[data-cat="Cat L"]'); await page.waitForTimeout(150); ok(/Cat L/.test(await page.textContent('.res-head h2')) && !(await page.$('.home')), 'category page');
        await page.click('[data-home]'); await page.waitForSelector('.home'); });
      await t(lab + ': logo shown whole (or the business name as a clean wordmark); introduction is its own section; highlights only when the dealer chose them', async () => {
        if (logo) ok(await page.evaluate(() => { const i = document.querySelector('#hdr .lg img'); const s = getComputedStyle(i); return i && s.objectFit === 'contain' && i.getBoundingClientRect().height <= 96; }), 'logo contained');
        else ok(await page.evaluate(() => document.querySelector('#hdr .wordmark') && !document.querySelector('#hdr img')), 'wordmark fallback');
        ok(/About Acme/.test(await page.textContent('#about')) && /Family owned\./.test(await page.textContent('#about')), 'about section');
        ok(/Visit our showroom/.test(await page.textContent('#about')) === hl.includes('showroom') && (hl.includes('showroom') || /Get directions/.test(await page.textContent('#about'))), 'no showroom claim unless the dealer ticked it');
        const hls = await page.$$eval('.hls div', (d) => d.map((x) => x.textContent));
        ok(JSON.stringify(hls) === JSON.stringify(hl.map((k) => HLT[k])), 'highlights ' + JSON.stringify(hls));
        ok(!(await page.$('body script:not([src])')) && /Acme <script>x<\/script> Medical/.test(await page.textContent('#about h2')), 'escaped');
        const L = await layoutCheck(page); ok(L.small.length === 0, 'small targets: ' + L.small.join(', ')); ok(st.csp.length === 0, 'CSP: ' + st.csp.join(' ')); });
      await t(lab + ': Categories menu opens a grid, Escape closes it; search and Request information still work', async () => {
        await page.click('#catbtn'); ok(await page.isVisible('#catdrop'), 'menu open'); await page.keyboard.press('Escape'); ok(!(await page.isVisible('#catdrop')), 'closed');
        await page.fill('#sq', 'Item 3'); await page.press('#sq', 'Enter'); await page.waitForTimeout(150); ok(await page.textContent('.res-head .count') === '1 product', 'search: ' + await page.textContent('.res-head .count'));
        await page.click('#hdr [data-ask]'); ok(await page.isVisible('#dlg form'), 'request form'); await page.keyboard.press('Escape'); });
      await ctx.close();
    }

    // ---- the full product page (enrichment upgrade 2026-11-07)
    for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) {
      const { ctx, page, st } = await publicPage(browser, w, h, null, DETAILS);
      await page.click('.card .nm >> text=Cloud lift chair'); await page.waitForSelector('#pd-overview');
      await t(label + ': ENRICHED product page — tagline, key specs, overview, features & benefits, options (names + swatches), spec table, sizing, warranty, documents & videos — escaped, no price per option', async () => {
        const r = await page.evaluate(() => ({ tag: document.querySelector('.pd-tag').textContent, hl: [...document.querySelectorAll('.pd-hl div')].map((x) => x.textContent),
          nav: [...document.querySelectorAll('.pdnav a')].map((a) => a.textContent), ov: document.querySelector('#pd-overview').textContent, bold: !!document.querySelector('#pd-overview b:not(:first-child) ~ x, #pd-overview p b'),
          feats: [...document.querySelectorAll('#pd-features h4')].map((x) => x.textContent), opts: [...document.querySelectorAll('.pd-optg b')].map((x) => x.textContent),
          chips: [...document.querySelectorAll('.pd-chip')].map((x) => x.textContent), sw: [...document.querySelectorAll('.pd-sw')].map((x) => x.getAttribute('style') || ''),
          th: [...document.querySelectorAll('#pd-specs thead th')].map((x) => x.textContent + (x.classList.contains('on') ? '*' : '')), sizing: document.querySelector('#pd-sizing').textContent,
          war: document.querySelector('#pd-warranty').textContent, links: [...document.querySelectorAll('#pd-docs a')].map((a) => [a.getAttribute('href'), a.getAttribute('target')]),
          thumbs: document.querySelectorAll('.thumbs button').length, lead: document.querySelector('.pdp .lead') && document.querySelector('.pdp .lead').textContent, loading: !!document.getElementById('pdload'),
          iframes: document.querySelectorAll('iframe').length, text: document.querySelector('.pdp').innerText }));
        ok(r.tag === 'Sleep-friendly <comfort>', r.tag); ok(JSON.stringify(r.hl) === '["Weight capacity375 LBS","Comfort zones5"]', JSON.stringify(r.hl));
        ok(JSON.stringify(r.nav) === '["Overview","Features & benefits","Options & configurations","Specifications","Sizing","Warranty","Documents & videos"]', JSON.stringify(r.nav));
        ok(/The Cloud is <b>soft<\/b>\./.test(r.ov) && /Limited mobility/.test(r.ov) && !r.bold, 'overview escaped'); ok(r.feats.join('|') === 'Standard features|Benefits', r.feats.join('|'));
        ok(r.opts.join('|') === 'Upholstery|Standard colors|Upgrades', r.opts.join('|')); ok(r.chips.includes('Ivory') && r.chips.includes('Cross-Over'), r.chips.join('|'));
        ok(r.sw[0].includes('#eeeeee') && !r.sw.some((x) => /url\(/.test(x)), 'swatch colors validated: ' + JSON.stringify(r.sw));
        ok(JSON.stringify(r.th) === '["Specification","SmallPR-501*","MediumPR-501M"]', JSON.stringify(r.th)); ok(/Measure seated/.test(r.sizing) && /5'0"/.test(r.sizing), r.sizing); ok(/Lifetime frame/.test(r.war), r.war);
        ok(JSON.stringify(r.links) === JSON.stringify([['https://goldentech.com/s.pdf', '_blank'], ['https://www.homecareproviderservices.org/assets/docs/cloud.pdf', '_blank'], ['https://www.youtube.com/watch?v=abcdefghijk', '_blank']]), 'manufacturer + HCPS documents, then videos: ' + JSON.stringify(r.links));
        ok(r.thumbs === 4, 'gallery merged: ' + r.thumbs); ok(r.lead === 'The Cloud is <b>soft</b>.', 'short lead: ' + r.lead); ok(!r.loading, 'loading note gone'); ok(!r.iframes, 'nothing embedded');
        ok(/Ask the dealer about available options/.test(r.text) && !/\$\s?\d[\d,]*\.\d\d(?![\s\S]*From)/.test(r.text.replace(/\$1,899\.00/g, '')), 'option pricing is the dealer\'s');
        ok(!st.csp.length, 'CSP violations: ' + st.csp.join(' | ')); ok(JSON.stringify(st.details) === '["golden-technologies|PR-501"]', JSON.stringify(st.details));
      });
      await t(label + ': section links scroll within the page and keep the product address; no horizontal scroll; 44 px targets', async () => {
        const before = await page.evaluate(() => location.hash); await page.click('.pdnav a >> text=Specifications'); await page.waitForTimeout(400);
        ok(await page.evaluate(() => location.hash) === before, 'route kept'); ok(await page.$('#pd-specs'), 'still on the product');
        const L = await layout(page, '.pdnav a, .dlinks a, .pdp .btn'); ok(L.overflow <= 1, 'overflow ' + L.overflow); ok(!L.small.length, 'small: ' + L.small.join('|'));
      });
      await t(label + ': a product without a full page keeps its summary (no error, no loading note left)', async () => {
        await page.click('[data-opt="PR-501M"]'); await page.waitForSelector('[data-opt="PR-501M"][aria-pressed="true"]'); await page.waitForTimeout(300);
        const r = await page.evaluate(() => [!!document.getElementById('pdload'), !!document.getElementById('pd-overview'), [...document.querySelectorAll('.attrs tr')].length]);
        ok(!r[0] && !r[1] && r[2] > 0, JSON.stringify(r)); });
      await ctx.close();
    }

    // ---- portal: My Storefront
    for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) {
      const S = { calls: [] };
      const { ctx, page } = await open(browser, w, h, {});
      const THEMES = { blue: { name: 'Professional Blue', primary: '#0b2f5b', accent: '#c2410c' }, green: { name: 'Modern Green', primary: '#14532d', accent: '#15803d' }, burgundy: { name: 'Classic Burgundy', primary: '#5c1a28', accent: '#9b1c31' }, teal: { name: 'Healthcare Teal', primary: '#0f4c5c', accent: '#0e7490' }, purple: { name: 'Contemporary Purple', primary: '#3b1f63', accent: '#6d28d9' } };
      const HL = { local: 'Local service & support', showroom: 'Visit our showroom', guidance: 'Help choosing the right product', delivery: 'Delivery & setup', repair: 'Service & repair', rental: 'Rentals available' };
      const loc = (id, name, edit, sf, logo) => ({ id, name, city: 'Dayton', state: 'OH', can_edit: edit, lines: [{ slug: 'bemis', name: 'Bemis' }, { slug: 'strongback', name: 'Strongback' }], default_email: 'hq@acme.test', default_phone: '555', storefront: sf, suggested_slug: 'acme-medical', link: sf ? HOST + '/store/' + sf.slug : null, live: !!(sf && sf.enabled),
        logo: logo || { url: null, source: null, reason: 'none' }, design_ready: true, themes: THEMES, highlights: HL });
      await page.route('**/functions/dealer-storefront-api', async (route) => { const b = JSON.parse(route.request().postData() || '{}'); S.calls.push(b); const R = (o) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
        if (b.action === 'sf_get') return R({ ok: true, head_office: false, base: HOST + '/store/', locations: [loc('br', 'Acme Branch', true, null), loc('hq', 'Acme HQ', false, { slug: 'acme-hq', enabled: true, version: 3, lines: null, hidden_categories: [], price_mode: 'msrp' }), loc('off', 'Acme Off', true, { slug: 'acme-off', enabled: false, version: 1, lines: null, hidden_categories: [], price_mode: 'msrp' }), loc('live', 'Acme Live', true, { slug: 'acme-live', enabled: true, version: 4, lines: null, hidden_categories: [], price_mode: 'msrp', design: {}, draft: null, phone: '555' }, { url: HOST + '/assets/logo-test.png', source: 'head office', reason: null })] });
        if (b.action === 'sf_categories') return R({ ok: true, categories: [{ manufacturer: 'bemis', line: 'Bemis', category: 'Bath Safety', count: 5, shown: 5, image: null, display: false }, { manufacturer: 'bemis', line: 'Bemis', category: 'Parts', count: 2, shown: 2, image: null, display: false }, { manufacturer: 'bemis', line: 'Bemis', category: 'Displays & Merchandising', count: 3, shown: 0, image: null, display: true }, { manufacturer: 'strongback', line: 'Strongback', category: 'Wheelchairs', count: 4, shown: 4, image: null, display: false }, { manufacturer: 'strongback', line: 'Strongback', category: 'Parts', count: 1, shown: 1, image: null, display: false }] });
        if (b.action === 'sf_inquiries') return R({ ok: true, inquiries: [{ id: 'i1', dealer_id: 'br', created_at: '2026-11-06T10:00:00Z', name: 'Pat <b>', email: 'pat@example.com', phone: null, message: 'Hi', product_name: 'Seat', product_code: 'B1', status: 'new' }] });
        if (b.action === 'sf_prices') return R({ ok: true, head_office: true, can_edit: true, lines: [{ slug: 'golden-technologies', name: 'Golden Technologies' }, { slug: 'bemis', name: 'Bemis' }], policies: { 'golden-technologies': 'map', bemis: 'unknown' },
          flag_text: { below_map: 'Below the minimum advertised price (MAP).', rules_unknown: 'Rules not recorded yet.' }, products: [
            { manufacturer: 'golden-technologies', code: 'PR-501', name: 'Cloud <i>', category: 'Lift Chairs', price: 2499, price_label: 'MSRP', source: 'msrp', calculated: 2200, msrp: 2499, flags: [{ on: 'dealer', flag: 'below_map', map: 1999 }], your_price: 1500, your_price_here: null, company_price: 1500 },
            { manufacturer: 'bemis', code: 'B1', name: 'Seat', category: 'Bath Safety', price: null, price_label: 'Call for Price', source: 'call', calculated: 111, msrp: null, flags: [{ on: 'calculated', flag: 'rules_unknown' }], your_price: null, your_price_here: null, company_price: null }] });
        if (b.action === 'sf_detail') return b.code === 'PR-501' ? R({ ok: true, detail: Object.assign({}, DETAILS['golden-technologies|PR-501'], { tagline: 'Preview detail' }) }) : R({ ok: false, error: 'That product is not shown on this storefront.' });
        if (b.action === 'sf_preview') return R(Object.assign({}, PUBLIC, { preview: true, dealer: Object.assign({}, PUBLIC.dealer, { name: 'Preview Dealer' }), price_note: 'Preview — this is what customers see.' }));
        if (b.action === 'sf_save') { const draft = b.mode === 'draft'; const sf = Object.assign({ version: 1, lines: b.settings.lines, hidden_categories: b.settings.hidden_categories, price_mode: b.settings.price_mode }, draft ? { slug: 'acme-live', enabled: true, design: {}, draft: b.settings, draft_at: '2026-11-07T20:00:00Z' } : b.settings); return R({ ok: true, storefront: sf, link: HOST + '/store/' + sf.slug, live: draft ? true : b.settings.enabled, draft }); }
        return R({ ok: true }); });
      await page.route('**/functions/dealer-retail-api', async (route) => { const b = JSON.parse(route.request().postData() || '{}'); S.calls.push(Object.assign({ api: 'retail' }, b)); return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: true, saved: (b.rows || []).filter((r) => r.price != null).length, removed: (b.rows || []).filter((r) => r.price == null).length, prices: [] }) }); });
      await page.route('**/store.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': CSP }, body: fs.readFileSync(path.join(PUB, 'store.html')) }));
      await page.route('**/store.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PUB, 'store.js')) }));
      await page.route('**/assets/logo-test.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
      await page.evaluate(() => { PREVIEW = null; window.__PREVIEW__ = null; window.confirm = () => true; try { AUTH.session = { access_token: 'test-dealer-token', expires_at: Math.floor(Date.now() / 1000) + 3600 }; } catch (e) {} });
      await page.evaluate(() => showP360('storefront')); await page.waitForSelector('#sfSlug');
      await t(label + ': no promotion before the storefront has an address', async () => ok(await page.$$eval('.sf-promo', (b) => b.length) === 0, 'promo shown'));
      await t(label + ': the account\'s phone and email are never pre-filled — only placeholders, or the person taps "Use my account"', async () => {
        ok(await page.evaluate(() => document.getElementById('sfPhone').value === '' && document.getElementById('sfEmail').value === '' && /hq@acme\.test/.test(document.getElementById('sfEmail').placeholder)), 'pre-filled');
        await page.evaluate(() => sfUseAccount()); ok(await page.evaluate(() => document.getElementById('sfEmail').value === 'hq@acme.test'), 'use account');
        await page.evaluate(() => { document.getElementById('sfEmail').value = ''; document.getElementById('sfPhone').value = ''; }); });
      await t(label + ': My Storefront tab, settings save exactly what was typed', async () => {
        ok(await page.evaluate(() => [...document.querySelectorAll('.navtab span')].some((s) => s.textContent === 'My Storefront')), 'tab');
        await page.fill('#sfHead', 'Welcome'); await page.uncheck('#sfAll'); await page.uncheck('.sf-line[value="strongback"]'); await page.selectOption('#sfPrice', 'call');
        ok(await page.$('#sfPublish') && /Save without publishing/.test(await page.textContent('#sfSave')), 'publish and save-without-publishing offered');
        await page.evaluate(() => sfSave(false)); await page.waitForTimeout(400);
        const d = S.calls.filter((c) => c.action === 'sf_save').pop(); ok(d && d.settings.enabled === false && /not published/.test(await page.textContent('#view-storefront')), 'saved without publishing');
        await page.evaluate(() => sfSave(true)); await page.waitForTimeout(400);
        const s = S.calls.filter((c) => c.action === 'sf_save').pop();
        ok(s && s.location_id === 'br' && s.settings.slug === 'acme-medical' && s.settings.enabled === true && s.settings.headline === 'Welcome' && JSON.stringify(s.settings.lines) === '["bemis"]' && s.settings.price_mode === 'call' && s.version === 1, JSON.stringify(s));
        ok(/Saved — your storefront is live/.test(await page.textContent('#view-storefront')), 'saved message'); });
      const lastSave = () => S.calls.filter((c) => c.action === 'sf_save').pop();
      await t(label + ': CATEGORY MANAGER — every category with a checkbox; Displays & Merchandising hidden by default (opt-in); hide per manufacturer; reorder with ↑ ↓; Restore defaults', async () => {
        await page.waitForSelector('.sfx-cat', { timeout: 5000 }).catch(async () => { throw new Error('mgr: ' + await page.evaluate(() => (document.getElementById('sfCatMgr') || {}).innerHTML)); });
        const rows = await page.$$eval('.sfx-cat', (r) => r.map((x) => [x.dataset.cat, x.querySelector('input').checked]));
        ok(JSON.stringify(rows.find((r) => r[0] === 'Displays & Merchandising')) === '["Displays & Merchandising",false]' && rows.filter((r) => r[1]).length === rows.length - 1, JSON.stringify(rows));
        const saved = async () => { await page.evaluate(() => sfSave('publish')); await page.waitForTimeout(400); await page.waitForSelector('#sfCatMgr .sfx-tabs', { timeout: 5000 }).catch(async () => { throw new Error('after save: ' + await page.evaluate(() => (document.getElementById('sfCatMgr') || {}).innerHTML + ' | ' + (document.getElementById('sfMsg')||{}).textContent)); }); return lastSave().settings; };
        await page.uncheck('.sfx-cat[data-cat="Parts"] input'); let st = await saved(); ok(JSON.stringify(st.hidden_categories) === '["Parts"]', JSON.stringify(st.hidden_categories));
        await page.check('.sfx-cat[data-cat="Displays & Merchandising"] input'); st = await saved(); ok(JSON.stringify(st.hidden_categories) === '["Parts","+Displays & Merchandising"]', JSON.stringify(st.hidden_categories));
        ok(await page.isChecked('.sfx-cat[data-cat="Displays & Merchandising"] input') && !(await page.isChecked('.sfx-cat[data-cat="Parts"] input')), 'reopened with the saved choices');
        const first = await page.$eval('.sfx-cat', (x) => x.dataset.cat); await page.click('.sfx-cat .mv button[aria-label^="Move ' + first + ' down"]');
        st = await saved(); ok(st.design.cat_order[1] === first, JSON.stringify(st.design.cat_order));
        await page.evaluate(() => sfTab('mfr')); await page.uncheck('input[data-m="strongback"][data-c="Wheelchairs"]'); ok(await page.isDisabled('input[data-m="strongback"][data-c="Parts"]'), 'a category hidden for all lines is greyed out per line');
        st = await saved(); ok(st.hidden_categories.includes('@strongback/Wheelchairs') && st.hidden_categories.includes('Parts'), JSON.stringify(st.hidden_categories));
        await page.evaluate(() => sfTab('cat')); await page.evaluate(() => sfCatReset()); st = await saved();
        ok(JSON.stringify(st.hidden_categories) === '[]' && JSON.stringify(st.design.cat_order) === '[]', 'restored defaults: ' + JSON.stringify(st)); });
      await t(label + ': APPEARANCE & LAYOUT — Professional is the default for a new storefront; themes, custom HEX colors and layouts are saved as the design; nothing else changes', async () => {
        await page.evaluate(() => sfLoc('br')); await page.waitForSelector('.sfx-lay');
        ok(await page.isChecked('input[name="sfLay"][value="professional"]') && await page.isChecked('input[name="sfTheme"][value="blue"]'), 'defaults');
        ok(!(await page.$('input[name="sfLay"][value="standard"]')), 'no "current look" option for a storefront that was never published');
        await page.click('label.sfx-th:has(input[value="green"])'); await page.click('label.sfx-lay:has(input[value="modern"])');
        await page.selectOption('#sfCols', '3'); await page.evaluate(() => { document.querySelector('.sf-hl[value="showroom"]').checked = true; sfHl(); });
        await page.evaluate(() => sfSave('save')); await page.waitForTimeout(400); let d = lastSave().settings.design;
        ok(d.theme === 'green' && d.layout === 'modern' && d.cat_cols === 3 && JSON.stringify(d.highlights) === '["showroom"]' && !('primary' in d), JSON.stringify(d));
        await page.click('label.sfx-th:has(input[value="custom"])'); await page.fill('#sfPrim', '#123456'); await page.dispatchEvent('#sfPrim', 'change'); await page.fill('#sfAcc', '#ffcc00'); await page.dispatchEvent('#sfAcc', 'change');
        await page.evaluate(() => sfSave('save')); await page.waitForTimeout(400); d = lastSave().settings.design;
        ok(d.theme === 'custom' && d.primary === '#123456' && d.accent === '#ffcc00', JSON.stringify(d)); });
      await t(label + ': LIVE PREVIEW — the panel shows the public page for the settings on screen (never saved) at desktop / tablet / mobile size', async () => {
        const before = S.calls.filter((c) => c.action === 'sf_preview').length;
        await page.click('label.sfx-th:has(input[value="teal"])'); await page.waitForTimeout(1200);
        const pv = S.calls.filter((c) => c.action === 'sf_preview'); ok(pv.length > before && pv[pv.length - 1].settings.design.theme === 'teal', 'preview call with the screen design');
        ok(!S.calls.slice(-3).some((c) => c.action === 'sf_save' && c.settings.design.theme === 'teal'), 'nothing saved by previewing');
        await page.waitForFunction(() => { const f = document.getElementById('sfPvF'); return f && f.contentDocument && /Preview Dealer/.test(f.contentDocument.body.innerText); }, null, { timeout: 8000 });
        for (const [dev, wpx] of [['mobile', 390], ['tablet', 768], ['desktop', 1280]]) { await page.evaluate((d) => sfDev(d), dev); ok(await page.evaluate(() => parseInt(document.getElementById('sfPvF').style.width)) === wpx, dev); } });
      await t(label + ': PREVIEW full product page — the preview asks the portal (sf_detail, with the settings on screen) and shows the enriched sections', async () => {
        const f = await (await page.$('#sfPvF')).contentFrame(); await f.click('.card .nm >> text=Cloud lift chair'); await f.waitForSelector('#pd-overview', { timeout: 8000 });
        ok((await f.textContent('.pd-tag')) === 'Preview detail', 'detail from the portal');
        const c = S.calls.filter((x) => x.action === 'sf_detail').pop(); ok(c && c.manufacturer === 'golden-technologies' && c.code === 'PR-501' && c.settings && c.location_id, JSON.stringify(c)); });
      await t(label + ': LIVE storefront — Save draft keeps changes private (mode draft, no publish); Publish changes is explicit; Discard draft; the Account Center logo is shown', async () => {
        await page.evaluate(() => sfLoc('live')); await page.waitForSelector('#sfx-pub .sf-acts');
        ok(/Save draft/.test(await page.textContent('#sfSave')) && /Publish changes/.test(await page.textContent('#sfPublish')), 'draft + publish buttons');
        ok(await page.isChecked('input[name="sfLay"][value="standard"]'), 'a published storefront keeps its current look until a new design is published');
        ok(await page.$('.sfx-logo img') && /Logo loaded/.test(await page.textContent('.sfx-logo')) && /head office/.test(await page.textContent('#sfx-id')), 'logo + where it comes from');
        await page.fill('#sfHead', 'New banner'); await page.evaluate(() => sfSave('draft')); await page.waitForTimeout(400);
        let c = lastSave(); ok(c.mode === 'draft' && !('enabled' in c.settings) && c.settings.headline === 'New banner', JSON.stringify(c));
        ok(/Draft saved — customers still see your published storefront/.test(await page.textContent('#view-storefront')) && /Unpublished changes saved/.test(await page.textContent('#sfx-pub')), 'draft state shown');
        ok(await page.inputValue('#sfHead') === 'New banner', 'the draft is what the dealer keeps editing');
        await page.evaluate(() => sfSave('discard')); await page.waitForTimeout(400); ok(lastSave().mode === 'discard', 'discard');
        await page.evaluate(() => sfLoc('br')); await page.waitForSelector('#sfSlug'); });
      await t(label + ': STOREFRONT PRICES — each product\'s public price and its source, why a price is held, your own price saved (company or this location), bulk % of MSRP / calculated', async () => {
        await page.evaluate(() => sfPricesLoad()); await page.waitForSelector('.sfp tbody tr');
        const r = await page.evaluate(() => [...document.querySelectorAll('.sfp tbody tr')].map((tr) => tr.textContent.replace(/\s+/g, ' ').trim()));
        ok(/Cloud <i>.*\$2,499(\.00)? MSRP.*Below the minimum advertised price \(MAP\)\. MAP \$1,999(\.00)?.*HCPS calculated retail: \$2,200/.test(r[0]), r[0]);
        ok(/Seat.*Call for Price.*Rules not recorded yet/.test(r[1]), "row2: " + JSON.stringify(r));
        ok(await page.evaluate(() => document.querySelector('.sfp-in').value === '1500.00'), 'company price shown');
        await page.fill('.sfp-in[data-k="bemis|B1"]', '129.5'); await page.dispatchEvent('.sfp-in[data-k="bemis|B1"]', 'change');
        await page.evaluate(() => sfpSave()); await page.waitForTimeout(500);
        const sv = S.calls.filter((c) => c.api === 'retail' && c.action === 'retail_set').pop(); ok(sv && JSON.stringify(sv.rows) === JSON.stringify([{ manufacturer: 'bemis', code: 'B1', price: 129.5, location_id: null }]), "sv1: " + JSON.stringify(sv));
        await page.evaluate(() => sfpScope('location')); await page.evaluate(() => sfpF('m', 'golden-technologies'));
        await page.fill('#sfpPct', '90'); await page.evaluate(() => sfpBulk('pct')); await page.evaluate(() => sfpSave()); await page.waitForTimeout(500);
        const sv2 = S.calls.filter((c) => c.api === 'retail' && c.action === 'retail_set').pop(); ok(sv2 && JSON.stringify(sv2.rows) === JSON.stringify([{ manufacturer: 'golden-technologies', code: 'PR-501', price: 2249.1, location_id: 'br' }]), "sv2: " + JSON.stringify(sv2));
        ok(!S.calls.some((c) => c.action === 'sf_save' && c.settings && c.settings.enabled === undefined && !['draft', 'discard'].includes(c.mode)), 'prices never publish anything'); });
      await t(label + ': PREVIEW — the public page inside the portal with the settings on screen; nothing counted, requests off', async () => {
        await page.evaluate(() => sfPreview()); const fr = await (await page.waitForSelector('#sfPrevOv iframe')).contentFrame(); await fr.waitForSelector('.card');
        ok(await fr.evaluate(() => document.querySelector('h1').textContent === 'Preview Dealer'), 'preview content');
        const pv = S.calls.filter((c) => c.action === 'sf_preview').pop(); ok(pv && pv.settings && pv.settings.slug === 'acme-medical', 'sent the settings on screen');
        await fr.evaluate(() => document.querySelector('[data-ask]').click()); await fr.waitForSelector('#f'); await fr.waitForTimeout(2600);
        await fr.fill('#f [name=name]', 'X'); await fr.fill('#f [name=email]', 'x@x.co'); await fr.check('#f [name=consent]'); await fr.click('#fsend');
        ok(/preview/.test(await fr.textContent('#ferr')), 'requests off in preview');
        await page.click('#sfPrevClose'); ok(!(await page.$('#sfPrevOv')), 'closed'); });
      await t(label + ': customer requests show escaped and can be marked handled', async () => {
        ok(await page.evaluate(() => /Pat <b>/.test(document.querySelector('.sf-inq b').textContent)), 'escaped');
        await page.evaluate(() => sfInq('i1', 'handled')); await page.waitForTimeout(300); ok(S.calls.some((c) => c.action === 'sf_inquiry_set' && c.status === 'handled'), 'handled'); });
      await page.evaluate(() => sfLoc('hq'));
      await t(label + ': promotional downloads: three branded PNGs with the storefront address, downloaded — nothing posted', async () => {
        ok(await page.$$eval('.sf-promo .btn', (b) => b.length) === 3, 'three downloads');
        const before = S.calls.length;
        const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => sfPromo('square'))]);
        ok(dl.suggestedFilename() === 'acme-hq-square.png', dl.suggestedFilename());
        const b = fs.readFileSync(await dl.path()); ok(b.slice(1, 4).toString() === 'PNG' && b.readUInt32BE(16) === 1080 && b.readUInt32BE(20) === 1080, 'PNG 1080×1080');
        ok(S.calls.length === before, 'no server call');
        await page.evaluate(() => sfLoc('off')); ok(await page.$$eval('.sf-promo', (b) => b.length) === 0, 'promo for a storefront that is off'); await page.evaluate(() => sfLoc('hq')); });
      await t(label + ': the head office\'s storefront is read-only for a branch', async () => ok(await page.evaluate(() => document.getElementById('sfSlug').disabled && !document.getElementById('sfSave')), 'read only'));
      const L2 = await layout(page, '#view-storefront .btn, #view-storefront select');
      await t(label + ': My Storefront has no horizontal scroll' + (w < 768 ? '; 44 px targets' : ''), () => { ok(L2.overflow <= 1, 'overflow ' + L2.overflow); if (w < 768) ok(!L2.small.length, 'small: ' + L2.small.join('|')); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nstorefront (browser): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
