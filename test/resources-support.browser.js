/* RESOURCES & SUPPORT inside Dealer 360 (owner milestone 2026-11-22 §2), on the REAL portal page at 1280 / 768 / 390:
   - desktop/tablet: a left menu with the four destinations; phone: the menu, then a full-width task screen with Back;
   - no link to the old website Resource Library and no "alert" placeholders;
   - Document Library: the website's document feed; search by model / keyword, filter by manufacturer and type; links open the file;
   - Training & In-Service: prefilled contact; open times from the scheduler; Book → "Booked"; Send as a request → "Requested";
   - Service, Parts & Warranty: line → request type → that type's fields; a missing required field is refused on the page;
     one request_key per case — a double click sends ONE request and a retry after an error reuses the same key;
   - My Requests & Appointments lists cases, appointments and requests with their status;
   - no sideways scroll; tappable controls ≥ 44 px on the phone.
   dealer-support-api and the document feed are SYNTHETIC here (the server is tested in the admin repo). */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const DOCS = { version: 1, types: [{ id: 'catalog', label: 'Catalog' }, { id: 'service-warranty', label: 'Service / Warranty' }, { id: 'training', label: 'Training / Video' }],
  items: [{ id: 'd1', title: 'Dalton Catalog 2026', type: 'catalog', manufacturer: 'dalton', format: 'pdf', url: 'https://www.homecareproviderservices.org/assets/docs/d.pdf', description: 'Full line.', models: ['iSeries'], year: '2026', keywords: 'beds', featured: true, sortPriority: 80 },
    { id: 'd2', title: 'Strongback Warranty', type: 'service-warranty', manufacturer: 'strongback-mobility', format: 'pdf', url: 'https://www.homecareproviderservices.org/assets/docs/s.pdf', description: 'Frame warranty.', models: ['Comfort 1007AB'], year: '', keywords: 'warranty', featured: false, sortPriority: 50 },
    { id: 'd3', title: 'Twilight Training Video', type: 'training', manufacturer: 'golden-technologies', format: 'video', url: 'https://vimeo.com/1', description: '', models: ['Twilight'], year: '', keywords: 'video', featured: false, sortPriority: 40 }] };
const HOME = { ok: true, location: { id: 'L1', name: 'TEST Sandbox', city: 'Batesville', state: 'IN', is_head_office: true }, locations: [{ id: 'L1', name: 'TEST Sandbox' }], staff: false,
  contact: { name: 'Ann Tester', email: 'ann@example.com', phone: '555-0100' }, ship_to: 'TEST Sandbox, 1 Main St, Batesville IN 47006',
  lines: [{ slug: 'dalton', name: 'Dalton Medical', mode: 'standard', note: '', types: [
      { key: 'parts', label: 'Parts order or inquiry', blurb: 'A part.', attachments: 'optional', ship_to: true, fields: [{ key: 'model', label: 'Model / item number', required: true, max: 80 }, { key: 'part', label: 'Part number or description', required: true, max: 200 }, { key: 'quantity', label: 'Quantity', required: true, max: 6, kind: 'int' }, { key: 'issue', label: 'What is happening?', required: false, max: 2000, kind: 'text' }] },
      { key: 'rma', label: 'Return (RMA)', blurb: 'Return.', attachments: 'recommended', ship_to: true, fields: [{ key: 'model', label: 'Model / item number', required: true, max: 80 }, { key: 'reason', label: 'Reason for return', required: true, max: 120, kind: 'choice', choices: ['Damaged in shipping', 'Defective'] }, { key: 'purchase_ref', label: 'Original PO, invoice or order number', required: true, max: 80 }, { key: 'quantity', label: 'Quantity', required: true, max: 6, kind: 'int' }, { key: 'issue', label: 'What is happening?', required: true, max: 2000, kind: 'text' }] }] },
    { slug: 'ohio-medical', name: 'Ohio Medical', mode: 'legacy_pending', note: 'Ohio Medical legacy service route — pending HCPS confirmation.', types: [{ key: 'repair', label: 'Repair / technical help', blurb: 'x', attachments: 'optional', ship_to: false, fields: [{ key: 'model', label: 'Model / item number', required: true, max: 80 }, { key: 'issue', label: 'What is happening?', required: true, max: 2000, kind: 'text' }] }] },
    { slug: 'golden-technologies', name: 'Golden Technologies', mode: 'golden', note: '', types: [] }] };
const SLOTS = { ok: true, format: 'zoom', tz_abbr: 'CST', duration_min: 30, with: 'Angelo Audia', days: [{ date: '2026-11-24', dayname: 'Tuesday', slots: [{ label: '10:00 AM', start_utc: '2026-11-24T16:00:00Z' }, { label: '10:30 AM', start_utc: '2026-11-24T16:30:00Z' }] }] };

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 800, 'desktop'], [768, 1000, 'tablet'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, {});
      const calls = []; let failNext = false;
      await page.route('**/data/dealer-documents.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(DOCS) }));
      await page.route('**/dealer-support-api', async (r) => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
        const x = JSON.parse(r.request().postData() || '{}'); calls.push(x); let body = { ok: true };
        if (x.action === 'support_home') body = HOME;
        else if (x.action === 'training_slots') body = SLOTS;
        else if (x.action === 'training_book') body = { ok: true, status: 'Booked', when_text: 'Tuesday, Nov 24 10:00 AM CST', message: 'Booked for Tuesday, Nov 24 10:00 AM CST. A calendar invite and confirmation are on their way to ann@example.com.' };
        else if (x.action === 'training_request') body = { ok: true, status: 'Requested', message: 'Requested — HCPS will confirm a time with you.' };
        else if (x.action === 'case_submit') { await new Promise((z) => setTimeout(z, 300)); body = failNext ? { ok: false, error: 'Your case could not be saved — please try again.' } : { ok: true, case_no: 'HCPS-SC-00007', status: 'Submitted', notified: true, delivery: 'internal', message: "Case HCPS-SC-00007 is open. HCPS's service desk has it and will follow up." }; }
        else if (x.action === 'my_requests') body = { ok: true, unavailable: [], items: [{ kind: 'case', ref: 'HCPS-SC-00007', title: 'Return (RMA) — dalton', detail: 'iSeries', status: 'Submitted', at: '2026-11-22T17:00:00Z', location: 'TEST Sandbox' },
          { kind: 'appointment', ref: 'APPT-9', title: 'In-service / training: lift chairs', detail: 'Tuesday 10:00', status: 'Booked', at: '2026-11-22T16:00:00Z', location: 'TEST Sandbox' }] };
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      await page.route('**/golden-proxy', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false, off: true }) }));
      await page.route('**/referral-sources-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: true, enabled: false }) }));
      await page.evaluate(() => { window.__PREVIEW__ = null; if (!AUTH.session) AUTH.session = { access_token: 'tok' }; window.needsAccess = () => false; });
      await page.evaluate(() => showP360('resources'));
      await page.waitForFunction(() => document.querySelector('#view-resources .rs-nav'), null, { timeout: 15000 });
      const txt = () => page.evaluate(() => document.querySelector('#view-resources').innerText);
      const phone = w <= 760;
      await t(`${label}: no old Resource library link, no alert placeholders`, async () => { const html = await page.evaluate(() => document.querySelector('#view-resources').innerHTML);
        ok(!/href="\/"/.test(html) && !/alert\(/.test(html) && !/Resource library/.test(html), 'old link or placeholder present'); });
      if (phone) {
        await t('phone: the menu shows the four destinations first, no task yet', async () => { const s = await txt(); ok(/Document Library/.test(s) && /Training & In-Service/.test(s) && /Service, Parts & Warranty/.test(s) && /My Requests & Appointments/.test(s) && !(await page.$('#rsTask')), s.slice(0, 300)); });
        await page.evaluate(() => rsTab('docs'));
        await t('phone: a task screen is full width with Back', async () => { ok(await page.$('#rsTask')); const back = await page.$('text=← Resources & Support'); ok(back, 'no back'); await back.click(); await page.waitForTimeout(200); ok(!(await page.$('#rsTask')), 'back did not return to the menu'); await page.evaluate(() => rsTab('docs')); });
      } else {
        await t(`${label}: a left menu with the four destinations beside the Document Library`, async () => { const r = await page.evaluate(() => { const m = document.querySelector('#view-resources .rs-menu').getBoundingClientRect(), c = document.querySelector('#rsTask').getBoundingClientRect(); return { mr: m.right, cl: c.left, n: document.querySelectorAll('#view-resources .rs-menu .rs-nav').length }; });
          ok(r.mr <= r.cl && r.n >= 5, JSON.stringify(r)); });
      }
      await page.waitForFunction(() => document.querySelectorAll('#view-resources .rs-doc').length === 3, null, { timeout: 8000 });
      await t(`${label}: Document Library — search by model, filter by manufacturer/type; links open the file in a new tab`, async () => {
        await page.fill('#rsDocQ', '1007AB'); await page.waitForTimeout(150);
        let n = await page.$$eval('#view-resources .rs-doc', (e) => e.map((x) => x.innerText)); ok(n.length === 1 && /Strongback Warranty/.test(n[0]), JSON.stringify(n));
        await page.fill('#rsDocQ', ''); await page.waitForTimeout(100);
        await page.selectOption('#view-resources .rs-filt select >> nth=1', 'training'); await page.waitForTimeout(150);
        n = await page.$$eval('#view-resources .rs-doc', (e) => e.map((x) => x.innerText)); ok(n.length === 1 && /Twilight/.test(n[0]) && /Watch/.test(n[0]), JSON.stringify(n));
        const a = await page.$eval('#view-resources .rs-doc a', (x) => ({ href: x.href, tgt: x.target })); ok(a.tgt === '_blank' && /vimeo/.test(a.href), JSON.stringify(a));
        await page.selectOption('#view-resources .rs-filt select >> nth=1', ''); });
      await page.evaluate(() => rsTab('training'));
      await page.waitForFunction(() => document.querySelector('#view-resources .rs-slot'), null, { timeout: 8000 });
      await t(`${label}: Training — contact prefilled, open times from the scheduler, Book → Booked`, async () => {
        ok((await page.inputValue('#rsCName')) === 'Ann Tester' && (await page.inputValue('#rsCEmail')) === 'ann@example.com');
        await page.fill('#rsTTopic', 'Lift chair features'); await page.click('#view-resources .rs-slot >> nth=0');
        ok((await page.inputValue('#rsTTopic')) === 'Lift chair features', 'typed topic lost on re-render');
        await page.click('text=Book this time'); await page.waitForSelector('#view-resources .rs-done');
        const s = await txt(); ok(/Booked/.test(s) && /You're booked/.test(s), s.slice(-300));
        const c = calls.filter((x) => x.action === 'training_book').pop(); ok(c && c.start_utc === '2026-11-24T16:00:00Z' && c.topics === 'Lift chair features' && c.contact.email === 'ann@example.com', JSON.stringify(c)); });
      await page.evaluate(() => { RS.train = { format: 'in_store', slots: null, sel: null }; rsTab('training'); });
      await page.waitForFunction(() => document.querySelector('#view-resources .rs-slot'), null, { timeout: 8000 });
      await t(`${label}: Training — Send as a request → Requested (in-store)`, async () => {
        await page.fill('#rsTTopic', 'Bed setup'); await page.click('text=Send as a request — HCPS coordinates'); await page.waitForSelector('#view-resources .rs-done');
        const s = await txt(); ok(/Requested/.test(s) && /Request sent/.test(s)); const c = calls.filter((x) => x.action === 'training_request').pop(); ok(c && c.format === 'in_store', JSON.stringify(c)); });
      await page.evaluate(() => rsTab('service'));
      await page.waitForFunction(() => document.querySelector('#view-resources select'), null, { timeout: 8000 });
      await t(`${label}: Service — Golden is not offered here (its own integration); a legacy line says so`, async () => {
        const opts = await page.$$eval('#view-resources select option', (o) => o.map((x) => x.textContent)); ok(!opts.some((x) => /Golden/.test(x)) && opts.some((x) => /Dalton/.test(x)), JSON.stringify(opts));
        await page.selectOption('#view-resources select', 'ohio-medical'); await page.waitForTimeout(150); ok(/pending HCPS confirmation/.test(await txt())); });
      await t(`${label}: Service — RMA fields, a missing required field is refused, then one case per click (double click = one request)`, async () => {
        await page.selectOption('#view-resources select', 'dalton'); await page.waitForTimeout(100);
        await page.click('#view-resources .rs-type >> text=Return (RMA)'); await page.waitForSelector('#rsF_reason');
        await page.fill('#rsF_model', 'iSeries'); await page.click('#rsSvcGo'); await page.waitForTimeout(150);
        ok(/Reason for return is required/.test(await page.innerText('#rsSMsg')), 'required not refused');
        ok(!calls.some((x) => x.action === 'case_submit'), 'sent with a missing field');
        await page.selectOption('#rsF_reason', 'Damaged in shipping'); await page.fill('#rsF_purchase_ref', 'PO-1'); await page.fill('#rsF_quantity', '1'); await page.fill('#rsF_issue', 'Box crushed');
        await page.setInputFiles('#rsFiles', [{ name: 'damage.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) }]);
        failNext = true; await page.click('#rsSvcGo'); await page.waitForTimeout(700);
        ok(/could not be saved/.test(await page.innerText('#rsSMsg')), 'error not shown');
        failNext = false; const before = calls.filter((x) => x.action === 'case_submit').length;
        await page.evaluate(() => { const b = document.getElementById('rsSvcGo'); b.click(); b.click(); }); await page.waitForSelector('#view-resources .rs-done', { timeout: 5000 });
        const sub = calls.filter((x) => x.action === 'case_submit'); ok(sub.length === before + 1, 'double click sent ' + (sub.length - before));
        ok(sub[0].request_key && sub[0].request_key === sub[sub.length - 1].request_key, 'retry did not reuse the key');
        const last = sub[sub.length - 1]; ok(last.type === 'rma' && last.fields.reason === 'Damaged in shipping' && last.attachments.length === 1 && last.attachments[0].name === 'damage.jpg', JSON.stringify(last).slice(0, 300));
        ok(/HCPS-SC-00007/.test(await txt())); });
      await page.evaluate(() => rsTab('requests'));
      await page.waitForFunction(() => document.querySelectorAll('#view-resources .rs-req').length === 2, null, { timeout: 8000 });
      await t(`${label}: My Requests & Appointments — case and appointment with status`, async () => { const s = await txt(); ok(/HCPS-SC-00007/.test(s) && /Submitted/.test(s) && /Booked/.test(s), s.slice(-400)); });
      await t(`${label}: no sideways scroll${phone ? '; controls ≥ 44 px' : ''}`, async () => {
        for (const tab of ['docs', 'training', 'service', 'requests']) { await page.evaluate((x) => rsTab(x), tab); await page.waitForTimeout(250);
          const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(o <= 1, `${tab}: overflow ${o}`);
          if (phone) { const small = await page.$$eval('#view-resources a.btn, #view-resources .rs-nav, #view-resources .rs-type, #view-resources select, #view-resources input:not([type=checkbox]):not([type=file])', (e) => e.filter((x) => x.offsetParent && x.getBoundingClientRect().height < 44).map((x) => x.textContent.slice(0, 30) || x.tagName)); ok(!small.length, `${tab}: small ${JSON.stringify(small)}`); } } });
      await t(`${label}: Victoria opens each destination and confirms only once it is on screen`, async () => {
        await page.route('**/dealer-victoria-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { available: false }, ai: { available: true }, conversation: { available: false } }) }));
        await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => window.DV && window.DV.openView, null, { timeout: 15000 });
        for (const [v, T] of [['training', 'Training & In-Service'], ['service', 'Service, Parts & Warranty'], ['docs', 'Document Library'], ['requests', 'My Requests & Appointments']]) {
          await page.evaluate(() => showP360('dash'));
          const r = await page.evaluate((x) => window.DV.openView(x), v);
          ok(r.ok && r.confirm === T + ' is open in Resources & Support.', v + ' ' + JSON.stringify(r));
          ok((await page.$eval('#view-resources .card h2', (e) => e.textContent.trim())) === T, v + ' not on screen'); } });
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`resources-support: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
