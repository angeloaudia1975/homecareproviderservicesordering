/* Shared harness for the Partner 360 storefront browser walkthroughs (C3-07): serves the REAL public/index.html on a
   deploy-preview address as a staff "view as dealer" and answers every network call locally (synthetic dealer, the
   admin repo's built website for the roster/artwork, empty everything else). Nothing reaches HCPS, Golden or Supabase. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const SITE = path.join(ADM, '_site');
const HOST = 'https://deploy-preview-99--hcpsonlineordering.netlify.app';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const ACCESS = { your_accounts: ['access4u'], available: ['bemis', 'pedifix'], request_access: ['dalton'], golden: 'None' };

async function open(browser, w, h, opts) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
  const page = await ctx.newPage();
  const seen = { prices: 0, tools: [] };
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.host === 'www.homecareproviderservices.org') {
      if (u.pathname === '/data/partners.json' && opts.rosterFails) return route.fulfill({ status: 503, body: '' });
      const f = path.join(SITE, decodeURIComponent(u.pathname));
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
    }
    if (u.origin === (opts.host || HOST) && !u.pathname.startsWith('/.netlify/')) {
      let f = path.join(PUB, decodeURIComponent(u.pathname)); if (u.pathname === '/' || !path.extname(f)) f = path.join(PUB, 'index.html');
      if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      if (opts.html && f.endsWith('index.html')) return route.fulfill({ status: 200, contentType: 'text/html', body: opts.html(fs.readFileSync(f, 'utf8')) });   // a test may add a probe
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (/\/functions\/dealer-auth/.test(u.pathname) && req.method() === 'POST' && opts.manageAuth) {   // Manage Dealer session answers
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      if (/^manage_/.test(String(b.action))) { (seen.manage = seen.manage || []).push(b); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.manageAuth(b)) }); }
    }
    if (/\/functions\/submit-order/.test(u.pathname) && opts.submit && req.method() === 'POST') {
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      (seen.submits = seen.submits || []).push({ body: b, auth: req.headers()['authorization'] || '' });
      const ans = opts.submit(b); return route.fulfill({ status: ans.status || 200, contentType: 'application/json', body: JSON.stringify(ans.body || ans) });
    }
    if (/\/functions\/dealer-auth/.test(u.pathname) && req.method() === 'POST')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'approved', dealer: { id: 'd-test', name: 'TEST — Landing Sandbox', email: 't@example.invalid' }, lines: [], access: opts.access || ACCESS, prices: {} }) });
    if (/\/functions\/golden-proxy/.test(u.pathname)) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '' });
      const ans = opts.golden ? { ok: true, enabled: true, available: true, preview: false, state: 'account', capabilities: { see_prices: false } } : { ok: true, enabled: false, available: false, reason: 'off' };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ans) });
    }
    if (/\/functions\/catalog-layers/.test(u.pathname))   // layers answered empty (no prices in this test)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, identity_sha256: u.searchParams.get('identity'), file_overlay: [], custom_products: [], product_overrides: [] }) });
    if (/\/functions\/dealer-tools-api/.test(u.pathname) && /access_request/.test(req.postData() || '')) { seen.tools.push(req.postData()); }
    if (/\/functions\/dealer-tools-api/.test(u.pathname) && opts.tools && req.method() === 'POST') {
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      (seen.toolCalls = seen.toolCalls || []).push(b); (seen.toolAuth = seen.toolAuth || []).push(req.headers()['authorization'] || '');
      const ans = await opts.tools(b);
      if (ans) return route.fulfill({ status: ans.status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ans.body || ans) });
    }
    if (/fonts\.(googleapis|gstatic)\.com$/.test(u.host)) return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  });
  await page.goto((opts.host || HOST) + '/?preview=' + 'p'.repeat(48) + (opts.hash || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'approved' && (state.manufacturers || []).length > 5, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  // Pricing is not under test here: catalogs open with their public rows only (no prices), so navigation can be checked.
  // opts.prices: { slug: price } gives every product of that line a synthetic list price (to check the dealer's own price shows).
  await page.evaluate(pr => { window.mergeCatalogEdits = async (slug, prods) => (prods || []).map(p => Object.assign({}, p, pr && pr[slug] != null ? { base_price: pr[slug], tiers: [] } : {})); }, opts.prices || null);
  return { ctx, page, seen };
}
module.exports = { chromium, open, ACCESS, path, fs };
