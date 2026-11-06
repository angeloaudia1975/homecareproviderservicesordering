/* C3-07 Stage 7 — dealer storefronts in a real browser (nothing reaches HCPS, Supabase or an email provider).
   PUBLIC PAGE (public/store.html at /store/<address>, storefront-public answered locally): at 390 / 768 / 1280 px the dealer's
   name, Call link and products show (escaped); MSRP vs "Call for Price"; search, brand chips and category filter; a broken
   product photo becomes a placeholder; opening a product counts one anonymous view (no visitor data); the request form needs
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
    { manufacturer: 'strongback', code: 'S1', name: 'Excursion chair', category: 'Wheelchairs', image: null, attributes: {}, price: null, price_label: 'Call for Price' },
    { manufacturer: 'bemis', code: 'B9', name: 'Seat case', category: 'Parts', image: null, attributes: {}, price: 120, price_label: 'MSRP', price_unit: 'per Case (2 each)' }],
  price_note: 'Prices shown are the manufacturer\'s suggested retail price (MSRP).', privacy: 'Your request is sent only to this dealer…' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/* the live Content-Security-Policy, read from netlify.toml — the page must work under it (no inline script) */
const CSP = (fs.readFileSync(path.join(PUB, '..', 'netlify.toml'), 'utf8').match(/for = "\/store\.html"[\s\S]*?Content-Security-Policy = "([^"]+)"/) || [])[1];
if (!CSP) { console.log('FAIL no CSP for /store.html in netlify.toml'); process.exit(1); }
async function publicPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
  const page = await ctx.newPage(); const st = { posts: [], csp: [] };
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text()); });
  await page.route('**/*', async (route) => { const req = route.request(), u = new URL(req.url());
    if (u.host === 'homecareproviderservices.netlify.app' && /storefront-public/.test(u.pathname)) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
      if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(PUBLIC) });
      const b = JSON.parse(req.postData() || '{}'); st.posts.push(b);
      if (b.action === 'inquiry' && b.consent !== true) return route.fulfill({ status: 400, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false, error: 'Please agree to the dealer contacting you about your request.' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"ok":true}' }); }
    if (u.origin === HOST && u.pathname.startsWith('/store/')) return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'content-security-policy': CSP }, body: fs.readFileSync(path.join(PUB, 'store.html')) });
    if (u.origin === HOST && u.pathname === '/store.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PUB, 'store.js')) });
    if (u.origin === HOST && u.pathname === '/assets/products/bemis/B1.jpg') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
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
      await t(label + ': public page shows the dealer (escaped), a Call link and products with MSRP or Call for Price', async () => {
        const r = await page.evaluate(() => [document.querySelector('h1').textContent, !!document.querySelector('h1 script'), document.querySelector('a[href^="tel:"]').getAttribute('href'), [...document.querySelectorAll('.card')].map((c) => c.querySelector('.price').textContent)]);
        ok(r[0] === 'Acme <script>x</script> Medical' && !r[1], 'name escaped'); ok(r[2] === 'tel:5550100100', r[2]); ok(JSON.stringify(r[3]) === JSON.stringify(['$99.99 MSRP', 'Call for Price', 'Call for Price', '$120.00 MSRP per Case (2 each)']), JSON.stringify(r[3]));
        ok(!st.csp.length, 'CSP violations: ' + st.csp.join(' | '));
      });
      await page.waitForTimeout(400);
      await t(label + ': a missing photo becomes a placeholder (never a broken image)', async () => ok(await page.evaluate(() => [...document.querySelectorAll('.card img')].every((i) => i.complete && i.naturalWidth > 0)), 'broken image'));
      await page.fill('#q', 'grab');
      await t(label + ': search, brand chips and category filter', async () => {
        ok(await page.$$eval('.card', (c) => c.length) === 1, 'search'); await page.fill('#q', '');
        await page.click('.chip[data-line="strongback"]'); ok((await page.$$eval('.card .nm', (c) => c.map((x) => x.textContent))).join() === 'Excursion chair', 'chip');
        await page.click('.chip[data-line=""]'); await page.selectOption('#cat', 'Bath Safety'); ok(await page.$$eval('.card', (c) => c.length) === 2, 'category'); });
      const L = await layout(page, '.btn, .chip, .tools input, .tools select');
      await t(label + ': no horizontal scroll; 44 px targets; 16 px inputs', () => { ok(L.overflow <= 1, 'overflow ' + L.overflow); ok(!L.small.length, 'small: ' + L.small.join('|')); ok(!L.tiny, 'tiny inputs'); });
      await page.click('.card[data-i="0"]'); await page.waitForSelector('.pd');
      await t(label + ': the product dialog takes focus, is named, keeps Tab inside and gives focus back on Escape', async () => {
        const f = await page.evaluate(() => [document.getElementById('ov').getAttribute('aria-label'), document.getElementById('dlg').contains(document.activeElement)]);
        ok(f[0] === 'Raised seat' && f[1], JSON.stringify(f));
        for (let i = 0; i < 6; i++) await page.keyboard.press('Tab'); ok(await page.evaluate(() => document.getElementById('dlg').contains(document.activeElement)), 'tab escaped the dialog');
        await page.keyboard.press('Escape'); ok(await page.evaluate(() => !document.getElementById('ov').classList.contains('on') && document.activeElement && document.activeElement.matches('.card[data-i="0"]')), 'focus not returned');
        await page.click('.card[data-i="0"]'); await page.waitForSelector('.pd'); });
      await t(label + ': a product opens with its details (escaped) and counts one anonymous view', async () => {
        ok(await page.evaluate(() => document.querySelector('.pd p').textContent === 'Nice <b>seat</b>' && !document.querySelector('.pd p b')), 'description escaped');
        await page.evaluate(() => dispatchEvent(new Event('pagehide'))); await page.waitForTimeout(300);
        const v = st.posts.filter((p) => p.action === 'view'); ok(v.length === 1 && JSON.stringify(v[0]) === JSON.stringify({ action: 'view', s: 'acme-medical', items: [{ manufacturer: 'bemis', code: 'B1' }] }), JSON.stringify(v)); });
      await page.click('.pd [data-ask]'); await page.waitForSelector('#f');
      await page.waitForTimeout(2600);
      await page.fill('#f [name=name]', 'Pat'); await page.fill('#f [name=email]', 'pat@example.com'); await page.fill('#f [name=message]', 'In stock?');
      await page.click('#fsend'); await page.waitForTimeout(400);
      await t(label + ': the request needs consent', async () => ok(/agree/.test(await page.textContent('#ferr')), 'consent error'));
      await page.check('#f [name=consent]'); await page.click('#fsend'); await page.waitForSelector('.ok');
      await t(label + ': the request sends only what was typed and thanks the customer', async () => {
        const q = st.posts.filter((p) => p.action === 'inquiry').pop();
        ok(JSON.stringify(Object.keys(q).sort()) === JSON.stringify(['action', 'consent', 'email', 'hp', 'message', 'name', 'phone', 'product', 's']) && q.hp === '' && q.product.code === 'B1', JSON.stringify(q)); });
      await t(label + ': no cookies and no browser storage', async () => { const r = await page.evaluate(() => [document.cookie, localStorage.length, sessionStorage.length]); ok(r[0] === '' && r[1] === 0 && r[2] === 0, JSON.stringify(r)); ok((await ctx.cookies()).length === 0, 'cookies'); });
      await ctx.close();
    }
    // ---- portal: My Storefront
    for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) {
      const S = { calls: [] };
      const { ctx, page } = await open(browser, w, h, {});
      const loc = (id, name, edit, sf) => ({ id, name, city: 'Dayton', state: 'OH', can_edit: edit, lines: [{ slug: 'bemis', name: 'Bemis' }, { slug: 'strongback', name: 'Strongback' }], default_email: 'hq@acme.test', default_phone: '555', storefront: sf, suggested_slug: 'acme-medical', link: sf ? HOST + '/store/' + sf.slug : null, live: !!(sf && sf.enabled) });
      await page.route('**/functions/dealer-storefront-api', async (route) => { const b = JSON.parse(route.request().postData() || '{}'); S.calls.push(b); const R = (o) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
        if (b.action === 'sf_get') return R({ ok: true, head_office: false, base: HOST + '/store/', locations: [loc('br', 'Acme Branch', true, null), loc('hq', 'Acme HQ', false, { slug: 'acme-hq', enabled: true, version: 3, lines: null, hidden_categories: [], price_mode: 'msrp' })] });
        if (b.action === 'sf_inquiries') return R({ ok: true, inquiries: [{ id: 'i1', dealer_id: 'br', created_at: '2026-11-06T10:00:00Z', name: 'Pat <b>', email: 'pat@example.com', phone: null, message: 'Hi', product_name: 'Seat', product_code: 'B1', status: 'new' }] });
        if (b.action === 'sf_save') return R({ ok: true, storefront: Object.assign({ version: 1, lines: b.settings.lines, hidden_categories: b.settings.hidden_categories, price_mode: b.settings.price_mode }, b.settings), link: HOST + '/store/' + b.settings.slug, live: b.settings.enabled });
        return R({ ok: true }); });
      await page.evaluate(() => { PREVIEW = null; window.__PREVIEW__ = null; window.confirm = () => true; });
      await page.evaluate(() => showP360('storefront')); await page.waitForSelector('#sfSlug');
      await t(label + ': the account\'s phone and email are never pre-filled — only placeholders, or the person taps "Use my account"', async () => {
        ok(await page.evaluate(() => document.getElementById('sfPhone').value === '' && document.getElementById('sfEmail').value === '' && /hq@acme\.test/.test(document.getElementById('sfEmail').placeholder)), 'pre-filled');
        await page.evaluate(() => sfUseAccount()); ok(await page.evaluate(() => document.getElementById('sfEmail').value === 'hq@acme.test'), 'use account');
        await page.evaluate(() => { document.getElementById('sfEmail').value = ''; document.getElementById('sfPhone').value = ''; }); });
      await t(label + ': My Storefront tab, settings save exactly what was typed', async () => {
        ok(await page.evaluate(() => [...document.querySelectorAll('.navtab span')].some((s) => s.textContent === 'My Storefront')), 'tab');
        await page.fill('#sfHead', 'Welcome'); await page.check('#sfOn'); await page.uncheck('#sfAll'); await page.uncheck('.sf-line[value="strongback"]'); await page.selectOption('#sfPrice', 'call');
        await page.evaluate(() => sfSave()); await page.waitForTimeout(400);
        const s = S.calls.filter((c) => c.action === 'sf_save').pop();
        ok(s && s.location_id === 'br' && s.settings.slug === 'acme-medical' && s.settings.enabled === true && s.settings.headline === 'Welcome' && JSON.stringify(s.settings.lines) === '["bemis"]' && s.settings.price_mode === 'call' && s.version === undefined, JSON.stringify(s));
        ok(/Saved — your storefront is live/.test(await page.textContent('#view-storefront')), 'saved message'); });
      await t(label + ': customer requests show escaped and can be marked handled', async () => {
        ok(await page.evaluate(() => /Pat <b>/.test(document.querySelector('.sf-inq b').textContent)), 'escaped');
        await page.evaluate(() => sfInq('i1', 'handled')); await page.waitForTimeout(300); ok(S.calls.some((c) => c.action === 'sf_inquiry_set' && c.status === 'handled'), 'handled'); });
      await page.evaluate(() => sfLoc('hq'));
      await t(label + ': the head office\'s storefront is read-only for a branch', async () => ok(await page.evaluate(() => document.getElementById('sfSlug').disabled && !document.getElementById('sfSave')), 'read only'));
      const L2 = await layout(page, '#view-storefront .btn, #view-storefront select');
      await t(label + ': My Storefront has no horizontal scroll' + (w < 768 ? '; 44 px targets' : ''), () => { ok(L2.overflow <= 1, 'overflow ' + L2.overflow); if (w < 768) ok(!L2.small.length, 'small: ' + L2.small.join('|')); });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nstorefront (browser): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
