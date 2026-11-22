/* Records the "360 Dealer Portal — four-minute tour" (owner milestone 2026-11-22 §3) from the REAL portal page with
   DEMONSTRATION data only: the shop harness (test/_shop-harness.js) answers every call locally — example dealer, example
   orders, example prices, synthetic referral rows. Nothing reaches HCPS, Golden, CMS or Supabase.
   Output (OUT=dir, default ./tour-out): tour.webm (raw), tour.en.vtt (captions), tour-chapters.vtt, timing.json.
   Encode: ffmpeg -ss <trim> -i tour.webm -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p -movflags +faststart tour.mp4
   ADMIN_REPO=… node scripts/record-tour.js */
const path = require('path'), fs = require('fs');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
process.env.SUPABASE_URL = 'https://example.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'service';
const RF = require(path.join(ADM, 'netlify/functions/reimbursement-api.js'));
const realFetch = global.fetch;
global.fetch = async (url, o) => { const u = String(url); const okj = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => JSON.stringify(x) });
  if (u.endsWith('/auth/v1/user')) return okj({ id: 'u1' }); if (u.includes('/dealer_users?')) return okj([{ status: 'approved', dealer_id: 'd1' }]);
  if (u.includes('/dealers?')) return okj([{ state: 'KY', zip: '42101' }]); if (u.includes('dealer_preview_tokens')) return okj([{ dealer_id: 'd1', expires_at: '2099-01-01T00:00:00Z' }]);
  return realFetch(url, o); };
const { chromium, open } = require('../test/_shop-harness.js');
const OUT = process.env.OUT || path.join(process.cwd(), 'tour-out'); fs.mkdirSync(OUT, { recursive: true });
const NAME = 'Example Medical Supply';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const J = (r, body) => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

const MONTHLY = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((m, i) => ({ month: '2026-' + m, spend: [1240, 980, 1810, 1460, 2120, 1690, 1950, 1380, 2240, 1870, 1660][i] }));
const ORDERS = [
  { id: 'o1', date: '2026-11-18', source: 'portal', status: 'shipped', manufacturer: 'dalton', manufacturerName: 'Dalton Medical', po: 'PO 4417', lines: [{ code: 'K2DK16F', name: 'Lightweight wheelchair 16"', qty: 2 }], units: 2, itemsCount: 1, cost: 218, total: 218, preview: ['Lightweight wheelchair'], tracking: '1Z999AA10123456784' },
  { id: 'o2', date: '2026-11-12', source: 'portal', status: 'placed', manufacturer: 'pedifix', manufacturerName: 'PediFix', po: 'PO 4409', lines: [{ code: 'P83', name: 'Pedi-GEL pads', qty: 12 }], units: 12, itemsCount: 1, cost: 96, total: 96, preview: ['Pedi-GEL pads'] },
  { id: 'o3', date: '2026-11-03', source: 'portal', status: 'completed', manufacturer: 'dalton', manufacturerName: 'Dalton Medical', po: 'PO 4388', lines: [{ code: 'K2DK18F', name: 'Lightweight wheelchair 18"', qty: 1 }], units: 1, itemsCount: 1, cost: 109, total: 109, preview: ['Lightweight wheelchair'] }];
const SUMMARY = { ok: true, ytd: { spend: 18400, units: 214, orders: 37, year: 2026 }, allTime: { spend: 41250, orders: 88, sinceYear: '2025' },
  byManufacturer: [{ name: 'Dalton Medical', spend: 9200 }, { name: 'PediFix', spend: 5100 }, { name: 'Access4U', spend: 4100 }], monthly: MONTHLY, recent: ORDERS };
const DOCS = { version: 1, types: [{ id: 'catalog', label: 'Catalog' }, { id: 'manual', label: 'Owner / Service Manual' }, { id: 'service-warranty', label: 'Service / Warranty' }],
  items: [{ id: 'd1', title: 'Dalton Medical Catalog 2026', type: 'catalog', manufacturer: 'dalton', format: 'pdf', url: 'https://www.homecareproviderservices.org/assets/docs/example.pdf', description: 'The full Dalton line.', models: [], year: '2026', keywords: 'catalog', featured: true, sortPriority: 90 },
    { id: 'd2', title: 'Lightweight Wheelchair Owner’s Manual', type: 'manual', manufacturer: 'dalton', format: 'pdf', url: 'https://www.homecareproviderservices.org/assets/docs/example2.pdf', description: 'Set-up, use and care.', models: ['K2'], year: '', keywords: 'wheelchair', featured: false, sortPriority: 70 },
    { id: 'd3', title: 'PediFix Product Catalog', type: 'catalog', manufacturer: 'pedifix', format: 'pdf', url: 'https://www.homecareproviderservices.org/assets/docs/example3.pdf', description: 'Foot care products.', models: [], year: '', keywords: 'foot care', featured: false, sortPriority: 60 },
    { id: 'd4', title: 'Access4U Warranty', type: 'service-warranty', manufacturer: 'access4u', format: 'pdf', url: 'https://www.homecareproviderservices.org/assets/docs/example4.pdf', description: 'Ramp warranty terms.', models: [], year: '', keywords: 'warranty', featured: false, sortPriority: 50 }] };
const FIELDS = [{ key: 'model', label: 'Model / item number', required: true, max: 80 }, { key: 'part', label: 'Part number or description', required: true, max: 200 }, { key: 'quantity', label: 'Quantity', required: true, max: 6, kind: 'int' }];
const HOME = { ok: true, location: { id: 'L1', name: NAME, city: 'Bowling Green', state: 'KY', is_head_office: true }, locations: [{ id: 'L1', name: NAME }], staff: false,
  contact: { name: 'Jordan Example', email: 'jordan@example.com', phone: '270-555-0100' }, ship_to: NAME + ', 100 Example Way, Bowling Green KY 42101',
  lines: [{ slug: 'dalton', name: 'Dalton Medical', mode: 'standard', note: '', types: [
    { key: 'parts', label: 'Parts order or inquiry', blurb: 'Order a part or ask about one.', attachments: 'optional', ship_to: true, fields: FIELDS },
    { key: 'warranty', label: 'Warranty claim', blurb: 'A product failed under warranty.', attachments: 'recommended', ship_to: true, fields: FIELDS },
    { key: 'repair', label: 'Repair / technical help', blurb: 'Troubleshooting or a repair.', attachments: 'optional', ship_to: false, fields: FIELDS },
    { key: 'rma', label: 'Return (RMA)', blurb: 'Send a product back.', attachments: 'recommended', ship_to: true, fields: FIELDS }] }] };
const SLOTS = { ok: true, format: 'zoom', tz_abbr: 'CST', duration_min: 30, with: 'your HCPS team', days: [{ date: '2026-12-01', dayname: 'Tuesday', slots: [{ label: '10:00 AM', start_utc: '2026-12-01T16:00:00Z' }, { label: '10:30 AM', start_utc: '2026-12-01T16:30:00Z' }, { label: '2:00 PM', start_utc: '2026-12-01T20:00:00Z' }] }] };
const REQS = { ok: true, unavailable: [], items: [{ kind: 'case', ref: 'HCPS-SC-00012', title: 'Parts order or inquiry — Dalton Medical', detail: 'K2 armrest pad', status: 'Sent to manufacturer', at: '2026-11-20T15:00:00Z', location: NAME },
  { kind: 'appointment', ref: 'APPT-7F3A21C9', title: 'In-service / training: wheelchairs', detail: 'Tuesday 10:00 AM', status: 'Booked', at: '2026-11-19T16:00:00Z', location: NAME }] };
const DESC = 'Oxygen concentrator, portable, rental';
const REF = [['1000000021', 'Example Family Medicine', 'Family Practice', 18, 103, 0.6], ['1000000022', 'Sample Pulmonary Associates', 'Pulmonary Disease', null, 47, 1.4], ['1000000023', 'Demo Internal Medicine', 'Internal Medicine', 31, 64, 3.2], ['1000000024', 'Illustration Health Clinic', 'Nurse Practitioner', null, 22, 7.9], ['1000000025', 'Placeholder Medical Group', 'Family Practice', 12, 15, 18.4]]
  .map(([npi, org, sp, benes, claims, miles]) => ({ npi, last_org: org, first_name: '', mi: '', credentials: '', entity: 'O', street1: '100 Example Medical Way', street2: '', city: 'Bowling Green', state: 'KY', zip5: '42101', specialty: sp, hcpcs: 'E1392', hcpcs_desc: DESC, rental: 'Y', suppliers: 3, benes, claims, services: claims, miles, distance_basis: 'office' }));
function referralApi(b) {
  const loc = { id: 'L1', name: NAME, city: 'Bowling Green', state: 'KY', zip: '42101' };
  if (b.action === 'meta') return { ok: true, enabled: true, source: { url: 'https://data.cms.gov/' }, release: { data_year: 2024, version: 'v10', label: 'Original Medicare ordering activity · claims year 2024', file_name: 'mup_dme_ry26_p05_v10_dy24_rfrhpr.csv', live_since: '2026-11-21T16:35:00Z' }, location: loc, locations: [loc] };
  if (b.action === 'codes') return { ok: true, enabled: true, codes: [{ hcpcs: 'E1392', hcpcs_desc: DESC, rows: 400 }] };
  if (b.action === 'radius') return { ok: true, enabled: true, mode: 'radius', release: { data_year: 2024, version: 'v10', label: 'Original Medicare ordering activity · claims year 2024', states: ['KY', 'TN', 'OH', 'IN', 'GA'] }, hcpcs: b.hcpcs,
    center: { zip: b.center_zip, lat: 36.97, lng: -86.45 }, radius_miles: 25, zip_areas: 31, total: REF.length, rows: REF, unsettled: 0, geocoder: 'ok', placed_by: { office: 5, zip: 0 }, coverage: { partial: false, outside: [] }, specialties: [...new Set(REF.map((r) => r.specialty))].sort(),
    notes: { distance: 'Straight-line miles from the Census center point of the search ZIP to the office.', suppressed: 'Withheld by CMS', coverage: 'Original Medicare fee-for-service Part B claims only.', location: 'The office is the clinician’s reported office location.' } };
  return { ok: false };
}

(async () => {
  const b = await chromium.launch();
  const orig = b.newContext.bind(b); let T0 = 0;
  b.newContext = (o) => { T0 = Date.now(); return orig(Object.assign({}, o, { recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }, deviceScaleFactor: 1 })); };
  const { ctx, page } = await open(b, 1280, 720, { access: { your_accounts: ['dalton', 'pedifix', 'access4u'], available: [], request_access: [], golden: 'None' }, prices: { dalton: 109, pedifix: 8, access4u: 240 } });
  await page.route('**/order-history-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); return J(r, x.action === 'history' ? { ok: true, orders: ORDERS } : SUMMARY); });
  await page.route('**/data/dealer-documents.json', (r) => J(r, DOCS));
  await page.route('**/dealer-support-api', (r) => { const x = JSON.parse(r.request().postData() || '{}');
    return J(r, x.action === 'support_home' ? HOME : x.action === 'training_slots' ? SLOTS : x.action === 'my_requests' ? REQS : { ok: true }); });
  await page.route('**/referral-sources-api', (r) => J(r, referralApi(JSON.parse(r.request().postData() || '{}'))));
  await page.route('**/featured-month-api*', (r) => J(r, { ok: true, month: '2026-11', items: [], alternates: [] }));
  await page.route('**/reimbursement-api', async (r) => { const body = JSON.parse(r.request().postData() || '{}');
    const res = await RF.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(Object.assign({ dos: '2026-11-20' }, body)) });
    r.fulfill({ status: res.statusCode, contentType: 'application/json', headers: CORS, body: res.body }); });
  /* reload so the dashboard, catalogs and quote list are built from the demonstration answers above (the harness booted first) */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'approved' && (state.manufacturers || []).length > 5, null, { timeout: 30000 });
  await page.evaluate(() => { const P = { dalton: [109, 249], pedifix: [8, 16], access4u: [240, 480] }; window.mergeCatalogEdits = async (slug, prods) => (prods || []).map((p) => Object.assign({}, p, P[slug] ? { base_price: P[slug][0], msrp: P[slug][1], tiers: [] } : {})); if (window.DASH) { DASH.lineCache = {}; } try { if (typeof PRICE !== 'undefined') PRICE = null; } catch (e) {} });
  /* demonstration dressing: an example dealer name, no staff-preview banners, a visible pointer, and a corner label */
  await page.evaluate((NAME) => {
    if (window.AUTH && AUTH.dealer) AUTH.dealer.name = NAME; if (window.PROFILE) PROFILE.name = NAME;
    const st = document.createElement('style'); st.textContent = `#demoCur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(239,99,37,.85);box-shadow:0 0 0 4px rgba(239,99,37,.25);pointer-events:none;transition:transform .12s}
      #demoCur.dn{transform:scale(.7)} #demoTag{position:fixed;left:12px;bottom:12px;z-index:2147483646;background:#0b1f33;color:#fff;font:600 13px system-ui;padding:6px 10px;border-radius:8px;opacity:.9}
      #demoCh{position:fixed;right:12px;bottom:12px;z-index:2147483646;background:#ef6325;color:#fff;font:700 14px system-ui;padding:7px 12px;border-radius:8px}
      .demo-hl{outline:3px solid #ef6325 !important;outline-offset:4px;border-radius:8px}`;
    document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'demoCur'; document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('dn'), true); addEventListener('mouseup', () => c.classList.remove('dn'), true);
    const t = document.createElement('div'); t.id = 'demoTag'; t.textContent = 'Demonstration — example names and prices'; document.body.appendChild(t);
    const h = document.createElement('div'); h.id = 'demoCh'; document.body.appendChild(h);
    const scrub = () => { document.querySelectorAll('body *').forEach((e) => { if (e.children.length === 0 && /TEST — Landing Sandbox/.test(e.textContent)) e.textContent = e.textContent.replace(/TEST — Landing Sandbox/g, NAME); });
      [...document.querySelectorAll('div,section,header,aside')].forEach((e) => { const tx = (e.innerText || '').trim(); const r = e.getBoundingClientRect();
        if ((/staff catalog preview/.test(tx) || /^PRIVATE CATALOG PREVIEW/.test(tx)) && tx.length < 400 && r.width > innerWidth * 0.9 && r.height < 90) e.style.display = 'none'; });
      document.querySelectorAll('body *').forEach((e) => { if (e.children.length === 0 && e.textContent.trim() === 'T—') e.textContent = 'EM'; });
      document.querySelectorAll('input,textarea').forEach((e) => { if (/TEST — Landing Sandbox/.test(e.value)) e.value = e.value.replace(/TEST — Landing Sandbox/g, NAME); });
      document.querySelectorAll('div,p,span,small').forEach((e) => { if (e.children.length === 0 && /^View as Dealer is read-only/.test((e.textContent || '').trim())) e.style.display = 'none'; });
      document.querySelectorAll('a,button').forEach((e) => { if (/^(Exit Dealer Account|Exit dealer view)/.test((e.textContent || '').trim())) e.style.visibility = 'hidden'; }); };
    scrub(); new MutationObserver(scrub).observe(document.body, { childList: true, subtree: true });
    try { localStorage.removeItem('hcps_sh_hide_d-test'); } catch (e) {}
  }, NAME);

  const caps = [], chapters = []; let tStart = 0;
  const now = () => (Date.now() - tStart) / 1000;
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  async function chapter(title) { if (chapters.length) chapters[chapters.length - 1].end = now(); chapters.push({ start: now(), title }); await page.evaluate((t) => { document.getElementById('demoCh').textContent = t; }, title); }
  async function say(text, secs, act) { const s = now(); if (caps.length && caps[caps.length - 1].end > s) caps[caps.length - 1].end = s; caps.push({ start: s, end: s + secs, text });
    if (act) { try { await act(); } catch (e) { console.log('step: ' + text.slice(0, 40) + ' — ' + e.message); } } const left = s + secs - now(); if (left > 0) await sleep(left * 1000); }
  /* the first VISIBLE match of a selector (or of a "text:<words>" link/button), tagged so every step uses one element; short
     timeouts so a missing control never stalls the recording */
  async function point(sel, { click = false, hl = true } = {}) {
    const found = await page.evaluate((sel) => { document.querySelectorAll('[data-demo-t]').forEach((x) => x.removeAttribute('data-demo-t'));
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const list = sel.startsWith('text:') ? [...document.querySelectorAll('a,button')].filter((e) => e.textContent.trim() === sel.slice(5)) : [...document.querySelectorAll(sel)];
      const e = list.find(vis); if (!e) return false; e.setAttribute('data-demo-t', '1'); e.scrollIntoView({ block: 'center', behavior: 'smooth' }); return true; }, sel);
    if (!found) { console.log('missing ' + sel); return; } await sleep(700);
    const e = await page.$('[data-demo-t]'); const bx = e && await e.boundingBox(); if (!bx) return;
    await page.mouse.move(bx.x + Math.min(bx.width / 2, 120), bx.y + Math.min(bx.height / 2, 60), { steps: 25 });
    if (hl) await page.evaluate(() => { document.querySelectorAll('.demo-hl').forEach((x) => x.classList.remove('demo-hl')); const x = document.querySelector('[data-demo-t]'); if (x) x.classList.add('demo-hl'); });
    if (click) { await sleep(250); await e.click({ timeout: 3000 }).catch(() => {}); }
  }
  const unhl = () => page.evaluate(() => document.querySelectorAll('.demo-hl').forEach((x) => x.classList.remove('demo-hl')));
  const scrollTo = (y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y);

  await page.evaluate(() => showP360('dash')); await page.waitForSelector('#shCard', { timeout: 20000 }); await page.mouse.move(640, 360); await sleep(800);
  tStart = Date.now();

  await chapter('Welcome');
  await say('Welcome to the 360 Dealer Portal — where Home Care Provider Services dealers order, quote and grow their business.', 7);
  await say('Dealer Overview is your home page: purchases this year, recent orders, and purchases by month and by manufacturer.', 8, () => point('.kpis'));
  await say('The menu across the top reaches every tool. This tour shows the main ones in about four minutes.', 7, () => point('text:Reports, Growth & Ideas'));
  await say('Start here — on this page and in Help & Training — replays this tour and the step-by-step walkthroughs.', 7, () => point('#shCard'));

  await chapter('Shop Products');
  await say('Shop Products lists the manufacturers on your account.', 6, async () => { await unhl(); await page.evaluate(() => showShop()); await sleep(1200); await point('.sl-grid', { hl: false }); });
  await say('Open a line — or search any product name, model or part number in the search box at the top.', 8, async () => { await point('#gsearch'); await page.type('#gsearch', 'wheelchair', { delay: 90, timeout: 4000 }).catch(() => {}); await sleep(1800); await page.evaluate(() => { const s = document.getElementById('gsearch'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); }); await page.keyboard.press('Escape').catch(() => {}); });
  await say('Here is Dalton Medical: filter by category, sort, and switch between grid and list.', 9, async () => { await unhl(); await page.evaluate(async () => { window.needsAccess = () => false; await selectManufacturer('dalton'); }); await page.waitForSelector('#cv2Grid .card', { timeout: 15000 }); await point('#cv2Grid .card'); });
  await say('Each card shows your own dealer price. The prices in this tour are examples.', 7, () => scrollTo(300));

  await chapter('A product page');
  await say('A product page has the photos, your price and every option for that model.', 8, async () => { await unhl(); await page.evaluate(() => { CUI.lastCode = 'K2DK16F'; openProductDetail('K2DK16F'); }); await page.waitForSelector('.pd[data-pd-code]', { timeout: 15000 }); await sleep(600); await point('.pd .pd-info'); });
  await say('From here: Add to cart, Print Brochure for your customer, or Add to a quote.', 8, () => point('.pd .pd-sub'));
  await say('Provider Reimbursement shows the published Medicare and Medicaid allowance for coded products, by state and ZIP.', 10, async () => { await unhl(); await page.waitForSelector('#pdReimb .pd-reimb-cols', { timeout: 15000 }).catch(() => {});
    await point('#pdReimb'); await page.selectOption('#pdReimb [data-k=state]', 'KY').catch(() => {}); await sleep(600); await page.fill('#pdReimb [data-k=zip]', '42101').catch(() => {}); await page.dispatchEvent('#pdReimb [data-k=zip]', 'change').catch(() => {}); });
  await say('It is a reference: the biller confirms each code and the payer’s rules before submitting a claim.', 8, () => scrollTo(page.evaluate(() => 0)) && page.evaluate(() => { const e = document.querySelector('#pdReimb'); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }));

  await chapter('Customer quotes');
  await say('Add to a quote puts this exact product on your customer quote.', 8, async () => { await unhl(); await page.evaluate(() => window.scrollTo({ top: 0 })); await sleep(300);
    await point('.pd [onclick^="pdAddQuote"]', { click: true }); await page.waitForSelector('#view-quotes .qacts', { timeout: 15000 }).catch(() => {}); await sleep(500); });
  await say('For each line, choose the price your customer sees: the manufacturer’s MSRP, your saved retail price, or a one-time price.', 10, () => point('#view-quotes select'));
  await say('Save the quote, then Print / PDF or Email it. Your dealer cost never appears on the customer’s copy.', 9, () => point('#view-quotes .qacts'));
  await say('Brochures work the same way from any product page — your dealership is the seller.', 7, unhl);

  await chapter('Orders & tracking');
  await say('Orders & Tracking lists every order with its PO and status.', 8, async () => { await page.evaluate(() => showP360('orders')); await sleep(1500); await point('#view-orders .card'); });
  await say('Open an order to see its lines and shipments, with carrier tracking once the manufacturer sends it.', 9, async () => { const r = await page.$('#view-orders [onclick*="Order"], #view-orders .rl, #view-orders tr'); if (r) { await point('#view-orders .rl, #view-orders tbody tr'); } });
  await say('Reorder favorites and print any order for your records.', 6, unhl);

  await chapter('Resources & Support');
  await say('Resources & Support starts with the Document Library: catalogs, manuals and warranty documents, searchable by model.', 9, async () => { await page.evaluate(() => showP360('resources')); await sleep(1200); await page.evaluate(() => rsTab('docs')); await sleep(900); await point('#view-resources .card'); });
  await say('Book in-service training with open times from HCPS, or send it as a request.', 8, async () => { await unhl(); await page.evaluate(() => rsTab('training')); await sleep(1200); await point('#view-resources #rsTask'); });
  await say('Service, Parts & Warranty: choose the line and the request — parts, warranty, repair or a return — and attach photos.', 9, async () => { await page.evaluate(() => rsTab('service')); await sleep(1200); await point('#view-resources #rsTask'); });
  await say('Every case and appointment, with its status, is in My Requests & Appointments.', 7, async () => { await page.evaluate(() => rsTab('requests')); await sleep(1200); await point('#view-resources #rsTask'); });

  await chapter('Local referral sources');
  await say('Find local referral sources lists clinicians near you who ordered a product code from Original Medicare — CMS’s published data.', 10, async () => { await unhl();
    await page.evaluate(() => openReferrals({ ret: { kind: 'resources' } })); await page.waitForSelector('#rfQ', { timeout: 15000 }); await page.fill('#rfQ', 'E1392'); await page.press('#rfQ', 'Enter');
    await page.waitForSelector('[data-code="E1392"]', { timeout: 10000 }); await point('[data-code="E1392"]', { click: true }); await sleep(600); await page.fill('#rfCenter', '42101').catch(() => {}); await page.click('[data-a="search"]').catch(() => {}); });
  await say('By default it searches 25 miles around your branch. The published allowance for the code is at the top; results are nearest first.', 10, async () => { await page.waitForSelector('#rfOut tbody tr', { timeout: 15000 }).catch(() => {}); await point('#rfRate'); await sleep(2500); await point('#rfOut'); });
  await say('“Withheld by CMS” means fewer than 11 — never zero. Copy office details to plan your visits.', 8, () => page.evaluate(() => { const e = document.querySelector('#rfOut'); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }));

  await chapter('Help & getting started');
  await say('My Account holds your company details, locations, logo and manufacturer accounts.', 8, async () => { await unhl(); await point('text:My Account'); });
  await say('Help & Training has a how-to for every tool and What’s New. Start here replays this tour and the walkthroughs.', 9, async () => { await unhl(); await page.evaluate(() => showP360('help')); await sleep(1500); await page.evaluate(() => helpTab('start')); await sleep(500); await point('#shStart'); });
  await say('Questions? Call HCPS at 888-626-3140, or use Contact HCPS support. Thanks for watching.', 8, unhl);
  chapters[chapters.length - 1].end = now(); caps[caps.length - 1].end = now();

  const trim = (tStart - T0) / 1000;
  await page.close(); const vp = await page.video().path(); await ctx.close(); await b.close();
  fs.renameSync(vp, path.join(OUT, 'tour.webm'));
  const ts = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };
  fs.writeFileSync(path.join(OUT, 'tour.en.vtt'), 'WEBVTT\n\n' + caps.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n'));
  fs.writeFileSync(path.join(OUT, 'tour-chapters.vtt'), 'WEBVTT\n\n' + chapters.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.title}\n`).join('\n'));
  fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify({ trim, length: chapters[chapters.length - 1].end, chapters, captions: caps.length }, null, 1));
  console.log('trim', trim.toFixed(2), 'length', chapters[chapters.length - 1].end.toFixed(1));
})();
