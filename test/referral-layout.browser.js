/* Find local referral sources — the full-width layout (owner 2026-11-22). Acceptance case: James Medical Equipment Bowling
   Green → Reports → Your local market → Find local referral sources, E1392, search center 42101, within 25 miles. Played on the
   REAL storefront page with SYNTHETIC referral rows (long names, long addresses, withheld counts — no real clinician names) and
   the admin repo's real rate engine. At 1280 / 768 / 390: the allowance is a compact summary ABOVE the filters (code, amount,
   rental months or unit, payer, rate ZIP) with the inputs, source and full disclaimer under "View rate details"; the result
   count and claims year sit directly above the list; every clinician, NPI, specialty, office, distance, billed-as,
   beneficiaries, supplier claims and Copy office details is inside the screen — table while it fits, labelled cards when it
   doesn't — with no sideways scrolling anywhere; the copy action copies the office details. SHOTS=dir saves screenshots.
   ADMIN_REPO=… node test/referral-layout.browser.js */
const { chromium, open, path } = require('./_shop-harness.js');
const R = require(process.env.REIMB_ENGINE || path.join(process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices'), 'netlify/functions/_reimb.js'));
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 500)); } }
const TODAY = '2026-11-20', DESC = 'Oxygen concentrator, portable, rental';
const ROWS = [['1000000011', 'Featherstonehaugh-Montgomery', 'Physical Medicine and Rehabilitation', 18, 103, 0.4, 'office'], ['1000000012', 'Okafor', 'Pulmonary Disease', null, 47, 1.1, 'office'],
  ['1000000013', 'Lindqvist', 'Nurse Practitioner', null, 22, 3.6, 'office'], ['1000000014', 'Brennan', 'Internal Medicine', 31, 64, 7.9, 'office'], ['1000000015', 'Moreau', 'Family Practice', null, 12, 24.1, 'zip']]
  .map(([npi, last, sp, benes, claims, miles, basis]) => ({ npi, last_org: last, first_name: 'Alexandria', mi: 'Q', credentials: 'MD, FCCP', entity: 'I', street1: '1200 Synthetic Medical Center Parkway', street2: 'Suite 400, Building B',
    city: 'Bowling Green', state: 'KY', zip5: '42101', specialty: sp, hcpcs: 'E1392', hcpcs_desc: DESC, rental: 'Y', suppliers: 3, benes, claims, services: claims, miles, distance_basis: basis }));
function referralApi(b) {
  if (b.action === 'meta') return { ok: true, enabled: true, source: { url: 'https://data.cms.gov/x' }, release: { data_year: 2024, version: 'v10', file_name: 'mup_dme_ry26_p05_v10_dy24_rfrhpr.csv', rows: 177000, live_since: '2026-11-21T07:00:00Z', label: 'Original Medicare ordering activity · claims year 2024' },
    last_check: { at: '2026-11-22T12:40:00Z', outcome: 'unchanged' }, location: { id: 'd-bg', name: 'TEST Bowling Green', city: 'Bowling Green', state: 'KY', zip: '42101' }, locations: [{ id: 'd-bg', name: 'TEST Bowling Green', city: 'Bowling Green', state: 'KY', zip: '42101' }] };
  if (b.action === 'codes') return { ok: true, enabled: true, codes: [{ hcpcs: 'E1392', hcpcs_desc: DESC, rows: 400 }] };
  if (b.action === 'radius') return { ok: true, enabled: true, mode: 'radius', release: { data_year: 2024, version: 'v10', label: 'Original Medicare ordering activity · claims year 2024', states: ['KY', 'TN', 'OH', 'IN', 'GA'] }, hcpcs: b.hcpcs,
    center: { zip: b.center_zip, lat: 36.97, lng: -86.45 }, radius_miles: 25, zip_areas: 31, total: ROWS.length, rows: ROWS, unsettled: 0, geocoder: 'ok', placed_by: { office: 4, zip: 1 }, coverage: { partial: false, outside: [] }, specialties: [...new Set(ROWS.map((r) => r.specialty))].sort(),
    notes: { distance: 'Straight-line miles from the Census center point of the search ZIP to the office.', suppressed: 'Withheld by CMS', coverage: 'Original Medicare fee-for-service Part B claims only.', location: 'The office is the clinician’s reported office location.' } };
  return { ok: false };
}
function reimbApi(b) {
  if (b.action === 'meta') return Object.assign({ ok: true, today: TODAY, branch_zip: '42101' }, R.meta('KY'));
  if (b.action === 'lookup') return R.lookup({ code: b.code, state: b.state, plan: b.plan, location: b.location, dos: b.dos, zip: b.zip, zip_source: b.zip_source }, { today: TODAY });
  return { ok: false };
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(browser, w, h, { access: { your_accounts: ['dalton'], available: [], request_access: [], golden: 'None' } });
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://deploy-preview-99--hcpsonlineordering.netlify.app' }).catch(() => {});
      await page.route('**/referral-sources-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(referralApi(JSON.parse(r.request().postData() || '{}'))) }));
      await page.route('**/reimbursement-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reimbApi(JSON.parse(r.request().postData() || '{}'))) }));
      await page.evaluate(() => showP360('reports')); await page.waitForSelector('#rptRef', { timeout: 20000 }); await page.evaluate(() => document.querySelector('#rptRef').scrollIntoView({ block: 'center' }));
      await page.click('#rptRef'); await page.waitForSelector('#rfQ', { timeout: 10000 }); await page.fill('#rfQ', 'E1392'); await page.press('#rfQ', 'Enter');
      await page.waitForSelector('[data-code="E1392"]'); await page.click('[data-code="E1392"]'); await page.fill('#rfCenter', '42101'); await page.click('[data-a="search"]');
      await page.waitForFunction(() => document.querySelectorAll('#rfOut tbody tr').length === 5 && /\$\d/.test(document.querySelector("#rfRate").textContent), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      const L = await page.evaluate(() => { const v = document.querySelector('#view-referrals'), rate = v.querySelector('#rfRate'), out = v.querySelector('#rfOut'), W = window.innerWidth;
        const cells = [...out.querySelectorAll('tbody td')].map((td) => td.getBoundingClientRect()); const btns = [...out.querySelectorAll('.copy')].map((b) => b.getBoundingClientRect());
        const head = out.querySelector('.rfresh'), table = out.querySelector('table');
        return { order: !!(rate.compareDocumentPosition(v.querySelector('#rfLoc')) & Node.DOCUMENT_POSITION_FOLLOWING), rate: rate.textContent.replace(/\s+/g, ' '), details: !!v.querySelector('#rrZip'),
          sw: document.documentElement.scrollWidth - document.documentElement.clientWidth, outScroll: out.scrollWidth - out.clientWidth, cellsOut: cells.filter((r) => r.right > W + 1 || r.left < -1).length,
          btnOut: btns.filter((r) => r.right > W + 1 || r.width < 40 || r.height < 43.5).length, btns: btns.length, headAbove: head && table && head.getBoundingClientRect().bottom <= table.getBoundingClientRect().top + 1, head: head && head.textContent,
          cards: getComputedStyle(out.querySelector('thead')).display === 'none', withheld: [...out.querySelectorAll('td[data-l="Beneficiaries"]')].filter((td) => /withheld by CMS \(fewer than 11\)/.test(td.textContent)).length,
          zero: [...out.querySelectorAll('td[data-l="Beneficiaries"]')].some((td) => td.textContent.trim() === '0'), claims: [...out.querySelectorAll('td[data-l="Supplier claims"]')].map((td) => td.textContent.trim()),
          npi: [...out.querySelectorAll('td[data-l="Clinician"]')].every((td) => /NPI \d{10}/.test(td.textContent)), rateW: rate.getBoundingClientRect().width, outW: out.getBoundingClientRect().width,
          centerLbl: (v.querySelector('label[for=rfCenter]') || {}).textContent };
      });
      await t(`${label}: allowance is a compact summary at the top — code, amount, rental period or billing unit, payer and rate ZIP; details closed`, () => {
        ok(L.order, 'summary is above the filters'); ok(/E1392/.test(L.rate) && /\$\d/.test(L.rate) && /Rental — one month/.test(L.rate) && /Original Medicare/.test(L.rate) && /Rate ZIP 42101/.test(L.rate), L.rate); ok(!L.details, 'details open');
        ok(/Search center ZIP/.test(L.centerLbl) && /where to look/.test(L.centerLbl), L.centerLbl);
      });
      await t(`${label}: results use the page width — count and claims year directly above the list; no sideways scrolling; every field and Copy office details inside the screen (${w < 1000 ? 'stacked cards' : 'table'})`, () => {
        ok(L.headAbove && /5 clinician rows/.test(L.head) && /Claims year 2024/.test(L.head), L.head); ok(L.sw <= 1 && L.outScroll <= 1, 'scroll ' + L.sw + '/' + L.outScroll);
        ok(!L.cellsOut && !L.btnOut && L.btns === 5, JSON.stringify({ c: L.cellsOut, b: L.btnOut })); ok(L.cards === (w < 1000), 'cards ' + L.cards); ok(Math.abs(L.outW - L.rateW) < 2, 'full width');
        ok(L.npi && L.withheld === 3 && !L.zero && L.claims.join() === '103,47,22,64,12', JSON.stringify(L.claims));
      });
      if (SHOTS) { await page.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const p = getComputedStyle(e).position; if ((p === 'sticky' || p === 'fixed') && e.offsetHeight < 700) e.style.setProperty('position', 'static', 'important'); } document.querySelector('#view-referrals').scrollIntoView(); });
        await page.waitForTimeout(200); await page.screenshot({ path: path.join(SHOTS, `referrals-${label}.png`), fullPage: false });
        await page.evaluate(() => document.querySelector('#rfOut').scrollIntoView()); await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, `referrals-${label}-list.png`), fullPage: false }); }
      await page.click('#rfOut .copy'); await page.waitForTimeout(300);
      const cp = await page.evaluate(async () => ({ btn: document.querySelector('#rfOut .copy').textContent, txt: await navigator.clipboard.readText().catch(() => '') }));
      await t(`${label}: Copy office details copies name, specialty, office address and NPI`, () => ok(/Copied/.test(cp.btn) && /Featherstonehaugh-Montgomery/.test(cp.txt) && /1200 Synthetic Medical Center Parkway/.test(cp.txt) && /NPI 1000000011/.test(cp.txt), JSON.stringify(cp)));
      await page.click('[data-a="ratetog"]'); await page.waitForSelector('#rrZip');
      const D = await page.evaluate(() => ({ t: document.querySelector('#rfRate').textContent, st: document.querySelector('#rrState').value, dos: document.querySelector('#rrDos').value, zip: document.querySelector('#rrZip').value, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      await t(`${label}: View rate details holds state, payer, rate ZIP, service date, the fee-schedule source and the full disclaimer`, () => ok(D.st === 'KY' && D.zip === '42101' && D.dos === TODAY && /Source: CMS DMEPOS Fee Schedule/.test(D.t) && /not a billing specialist/.test(D.t) && /Rate ZIP/.test(D.t) && D.sw <= 1, D.t.slice(0, 400)));
      if (SHOTS) { await page.evaluate(() => document.querySelector('#rfRate').scrollIntoView()); await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, `referrals-${label}-rate-details.png`), fullPage: false }); }
      await page.fill('#rfCenter', '42134'); await page.click('[data-a="search"]'); await page.waitForTimeout(600);
      const after = await page.evaluate(() => (document.querySelector('[data-rs]') || {}).getAttribute('data-rs'));
      await t(`${label}: a new search center keeps the rate ZIP independent`, () => ok(after === 'KY|42101|' + TODAY, after));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nreferral-layout: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
