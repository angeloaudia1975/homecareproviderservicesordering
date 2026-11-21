/* Find local referral sources (pilot, owner 2026-11-21) on the REAL storefront page. The reimbursement answers come from the
   admin repo's own rate engine (_reimb.js, REIMB_ENGINE); referral-sources-api is played with SYNTHETIC rows shaped like the
   acceptance case (five E0260 rental rows in one ZIP, 161 supplier claims, four withheld beneficiary counts) — no real
   clinician names in the repo. Checks the three entry points, the shared results view, the separate allowance panel (the
   November 20, 2026 Kentucky branch estimate: $78.16 a month for months 1–3, $58.62 for 4–13), that the office search area
   never changes the rate inputs, Back to the caller, the empty / unavailable messages, the pilot gate and phone layout.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… REIMB_ENGINE=<admin>/netlify/functions/_reimb.js node test/referral-sources.browser.js */
const { chromium, open, path } = require('./_shop-harness.js');
const R = require(process.env.REIMB_ENGINE || path.join(process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices'), 'netlify/functions/_reimb.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 500)); } }

const DOS = '2026-11-20', TODAY = '2026-11-20';
const ROWS = [['1000000003', 'Rivera', 'Internal Medicine', 18, 103], ['1000000002', 'Okafor', 'Nurse Practitioner', null, 17], ['1000000005', 'Lindqvist', 'Internal Medicine', null, 16],
  ['1000000001', 'Brennan', 'Internal Medicine', null, 13], ['1000000004', 'Moreau', 'General Practice', null, 12]]
  .map(([npi, last, sp, benes, claims]) => ({ npi, last_org: last, first_name: 'Sam', mi: null, credentials: 'MD', entity: 'I', street1: '100 Synthetic Way', street2: null, city: 'Bowling Green', state: 'KY', zip5: '42101',
    specialty: sp, hcpcs: 'E0260', hcpcs_desc: 'Hospital bed, semi-electric (head and foot adjustment), with any type side rails, with mattress', rental: 'Y', suppliers: 2, benes, claims, services: claims }));
function referralApi(b, o) {
  if (o.disabled) return { ok: true, enabled: false };
  if (b.action === 'meta' && o.hqNoZip) return Object.assign(referralApi(b, {}), { location: { id: 'd-hq', name: 'TEST HQ', city: '', state: 'KY', zip: '' } });
  if (b.action === 'meta') return { ok: true, enabled: true, source: { url: 'https://data.cms.gov/x' }, release: { data_year: 2024, version: 'v10', file_name: 'mup_dme_ry26_p05_v10_dy24_rfrhpr.csv', rows: 177000, live_since: '2026-11-21T07:00:00Z', label: 'Original Medicare ordering activity · claims year 2024' },
    last_check: { at: '2026-11-21T12:40:00Z', outcome: 'unchanged' }, location: { id: 'd-test', name: 'TEST Bowling Green', city: 'Bowling Green', state: 'KY', zip: '42101' },
    locations: [{ id: 'd-test', name: 'TEST Bowling Green', city: 'Bowling Green', state: 'KY', zip: '42101' }, { id: 'd-test2', name: 'TEST Somerset', city: 'Somerset', state: 'KY', zip: '42503' }] };
  if (b.action === 'codes') return { ok: true, enabled: true, codes: /semi|E0260/i.test(b.q) ? [{ hcpcs: 'E0260', hcpcs_desc: ROWS[0].hcpcs_desc, rows: 900 }, { hcpcs: 'E0261', hcpcs_desc: 'Hospital bed, semi-electric, without mattress', rows: 50 }] : [] };
  if (b.action === 'search') {
    if (o.down) return { ok: false, enabled: true, error: 'data_unavailable', message: 'Referral data is temporarily unavailable — please try again shortly.' };
    const rows = ROWS.filter((r) => r.hcpcs === b.hcpcs && b.zips.includes(r.zip5) && (!b.rental || r.rental === b.rental) && (!b.specialty || r.specialty === b.specialty));
    return { ok: true, enabled: true, release: { data_year: 2024, version: 'v10', label: 'Original Medicare ordering activity · claims year 2024' }, hcpcs: b.hcpcs, zips: b.zips, total: rows.length, offset: 0, rows,
      specialties: [...new Set(rows.map((r) => r.specialty))].sort(), notes: { suppressed: 'Withheld by CMS', coverage: 'Original Medicare fee-for-service Part B claims only.', location: 'The ZIP is the clinician’s reported office location.' } };
  }
  return { ok: false };
}
function reimbApi(b) {
  if (b.action === 'meta') return Object.assign({ ok: true, today: TODAY, branch_zip: '42101' }, R.meta('KY'));
  if (b.action === 'lookup') return R.lookup({ code: b.code, state: b.state, plan: b.plan, location: b.location, dos: b.dos, zip: b.zip, zip_source: b.zip_source }, { today: TODAY });
  if (b.action === 'product') { const plans = R.plansFor('KY'); return { ok: true, mapping: { codes: [{ code: 'E0260' }], status: 'verified', listed: false }, state: 'KY', dos: DOS, zip: '42101', zip_source: 'branch', medicaid_plan: 'medicaid-ffs', medicaid_location: null, plans, today: TODAY,
    rows: [{ code: 'E0260', payer: 'medicare', result: R.lookup({ code: 'E0260', state: 'KY', plan: 'medicare', zip: '42101', zip_source: 'branch', dos: DOS }, { today: TODAY }) }, { code: 'E0260', payer: 'medicaid', result: R.lookup({ code: 'E0260', state: 'KY', plan: 'medicaid-ffs', dos: DOS }, { today: TODAY }) }] }; }
  return { ok: false };
}
async function setup(browser, w, h, o) {
  const { ctx, page } = await open(browser, w, h, { access: { your_accounts: ['dalton'], available: [], request_access: [], golden: 'None' } });
  const calls = [];
  await page.route('**/referral-sources-api', async (r) => { const b = JSON.parse(r.request().postData() || '{}'); calls.push(b); await new Promise((z) => setTimeout(z, 40)); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(referralApi(b, o || {})) }); });
  await page.route('**/reimbursement-api', async (r) => { const b = JSON.parse(r.request().postData() || '{}'); calls.push(Object.assign({ fn: 'reimb' }, b)); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(reimbApi(b)) }); });
  return { ctx, page, calls };
}
const view = (page) => page.evaluate(() => { const v = document.querySelector('#view-referrals'); const rows = [...v.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()));
  return { on: v.classList.contains('on'), text: v.innerText, rows, amt: [...v.querySelectorAll('.amt')].map((x) => x.textContent), rate: (v.querySelector('#rfRate') || {}).textContent, rateZip: (v.querySelector('#rrZip') || {}).value, rateState: (v.querySelector('#rrState') || {}).value, rateDos: (v.querySelector('#rrDos') || {}).value,
    zips: (v.querySelector('#rfZips') || {}).value, broken: [...v.querySelectorAll('img')].filter((i) => i.complete && !i.naturalWidth).length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
const waitRows = (page) => page.waitForFunction(() => { const v = document.querySelector('#view-referrals'); return v && v.classList.contains('on') && (v.querySelectorAll('tbody tr').length || /No published matches|unavailable/.test(v.innerText)) && v.querySelector('.amt, #rfRate .msg'); }, null, { timeout: 20000 });

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page, calls } = await setup(browser, w, h);
      // 1 — from the product's reimbursement panel
      await page.evaluate(async () => { await selectManufacturer('dalton'); await openProductDetail('BED1200i'); });
      await page.waitForSelector('#pdReimb .pd-ref-go:not([hidden])', { timeout: 20000 });
      const btn = await page.evaluate(() => document.querySelector('#pdReimb .pd-ref-go').textContent);
      await page.evaluate(() => { const s = document.querySelector('#pdReimb select[data-k="state"]'); return s && s.value; });
      await page.click('#pdReimb .pd-ref-go'); await waitRows(page); await page.waitForFunction(() => /Months 4–13/.test((document.querySelector('#rfRate') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300);
      const v1 = await view(page);
      const claims = v1.rows.reduce((a, r) => a + Number((r[5] || '').replace(/\D/g, '')), 0);
      await t(`${label}: from a product's reimbursement panel "${btn.trim()}" opens the referral view on E0260 with the branch ZIP — all five published rental rows, 161 supplier claims, four beneficiary counts withheld (never 0)`, () => {
        ok(/E0260/.test(btn) && v1.on && v1.zips === '42101', JSON.stringify({ btn, on: v1.on, zips: v1.zips }));
        ok(v1.rows.length === 5 && claims === 161 && v1.rows.filter((r) => /withheld by CMS/.test(r[4])).length === 4 && !v1.rows.some((r) => /^0$/.test(r[4])), JSON.stringify(v1.rows));
        ok(/claims year 2024/.test(v1.text) && /never added together/.test(v1.text) && /Original Medicare fee-for-service Part B claims only/.test(v1.text), v1.text.slice(0, 400));
      });
      await t(`${label}: the allowance beside it equals the reimbursement lookup — Kentucky, Original Medicare, rate ZIP 42101, Nov 20 2026: $78.16 a month (months 1–3), $58.62 (months 4–13), with the billing disclaimer`, () => {
        ok(v1.amt.includes('$78.16') && /Months 1–3: \$78\.16 per month/.test(v1.rate) && /Months 4–13: \$58\.62 per month/.test(v1.rate), JSON.stringify(v1.amt) + ' RATE: ' + v1.rate);
        ok(v1.rateState === 'KY' && v1.rateZip === '42101' && v1.rateDos === '2026-11-20', JSON.stringify(v1));
        ok(/HCPCS|billing|coding/i.test(v1.rate || ''), 'disclaimer');
      });
      // 2 — changing the office search area keeps every rate input
      await page.selectOption('#rfLoc', '42503'); await page.fill('#rfZips', '42101, 42103'); await page.click('[data-a="search"]'); await waitRows(page); await page.waitForTimeout(300);
      const v2 = await view(page);
      await t(`${label}: changing the office search area (another branch, more ZIPs) never changes the rate ZIP, state or date`, () => ok(v2.rateZip === '42101' && v2.rateState === 'KY' && v2.rateDos === '2026-11-20' && v2.rows.length === 5, JSON.stringify(v2)));
      const last = calls.filter((c) => c.action === 'search').pop();
      await t(`${label}: the search sends only the code and office ZIPs (text, five digits)`, () => ok(last.hcpcs === 'E0260' && JSON.stringify(last.zips) === '["42101","42103"]', JSON.stringify(last)));
      // 3 — the rate panel alone: changing the payer re-reads only the allowance
      await page.fill('#rrZip', '42101'); await page.selectOption('#rrPlan', 'medicaid-ffs'); await page.click('[data-a="rate"]'); await page.waitForTimeout(500);
      const v3 = await view(page);
      await t(`${label}: switching the payer to Kentucky Medicaid changes only the allowance panel — the referral rows stay, still "Original Medicare ordering activity"`, () => ok(v3.rows.length === 5 && /Original Medicare ordering activity · claims year 2024/.test(v3.text) && !/Months 1–3: \$78\.16/.test(v3.text), v3.text.slice(-500)));
      // 4 — Back to the product, still on its page
      await page.click('[data-a="back"]'); await page.waitForTimeout(800);
      const back = await page.evaluate(() => ({ p360: document.body.classList.contains('p360on'), pd: (document.querySelector('#content .pd') || { getAttribute: () => null }).getAttribute('data-pd-code') }));
      await t(`${label}: Back returns to the same product page`, () => ok(!back.p360 && back.pd === 'BED1200i', JSON.stringify(back)));
      // 5 — from Reports & Growth Ideas, search by words
      await page.evaluate(() => showP360('reports')); await page.waitForSelector('#rptRef', { timeout: 20000 }).catch(() => {});
      const hasRep = await page.evaluate(() => !!document.querySelector('#rptRef'));
      if (hasRep) { await page.click('#rptRef'); await page.waitForSelector('#rfQ', { timeout: 10000 }); }
      else await page.evaluate(() => openReferrals({ ret: { kind: 'reports' } }));
      await page.waitForSelector('#rfQ', { timeout: 10000 }); await page.fill('#rfQ', 'semi-electric hospital bed'); await page.press('#rfQ', 'Enter');
      await page.waitForSelector('[data-code="E0260"]', { timeout: 10000 }); await page.click('[data-code="E0260"]'); await page.click('[data-a="search"]'); await waitRows(page); await page.waitForTimeout(300);
      const v5 = await view(page);
      await t(`${label}: from Reports & Growth Ideas, "semi-electric hospital bed" offers E0260 with its description and reaches the same rows`, () => ok(hasRep && v5.rows.length === 5 && /Back to Reports/.test(v5.text), JSON.stringify({ hasRep, n: v5.rows.length })));
      await t(`${label}: no horizontal scroll, nothing broken`, () => ok(v5.sw <= v5.cw + 1 && !v5.broken, JSON.stringify({ sw: v5.sw, cw: v5.cw })));
      // 6 — empty result
      await page.fill('#rfZips', '99999'); await page.click('[data-a="search"]'); await page.waitForTimeout(500);
      const v6 = await view(page);
      await t(`${label}: no published matches is said plainly — not proof of no demand; offers nearby ZIPs / another code`, () => ok(/No published matches/.test(v6.text) && /not proof of no local demand/.test(v6.text), v6.text.slice(0, 300)));
      // 7 — from the standalone reimbursement lookup
      await page.evaluate(() => openReimb({ code: 'E0260', state: 'KY', plan: 'medicare', zip: '42101', dos: '2026-11-20' }));
      await page.waitForSelector('#rbCode', { timeout: 15000 }); await page.fill('#rbCode', 'E0260'); await page.click('[data-act="go"]');
      await page.waitForSelector('[data-act="refs"]:not([hidden])', { timeout: 15000 }); await page.click('[data-act="refs"]'); await waitRows(page); await page.waitForTimeout(300);
      const v7 = await view(page);
      await t(`${label}: from the reimbursement lookup result, Find local referral sources opens the same view with E0260 and the lookup's rate inputs`, () => ok(v7.rows.length === 5 && v7.rateState === 'KY' && v7.rateZip === '42101' && /Back to the reimbursement lookup/.test(v7.text), JSON.stringify({ n: v7.rows.length, s: v7.rateState, z: v7.rateZip })));
      await ctx.close();
    }
    // data unavailable vs empty; not in the pilot
    { const { ctx, page } = await setup(browser, 1280, 900, { down: true });
      await page.evaluate(() => openReferrals({ hcpcs: 'E0260', ret: { kind: 'reports' } })); await page.waitForTimeout(2500);
      const v = await view(page);
      await t('a service outage says "temporarily unavailable" (never "no matches"), and the allowance still shows', () => ok(/temporarily unavailable/.test(v.text) && !/No published matches/.test(v.text) && v.amt.includes('$78.16'), v.text.slice(0, 600)));
      await ctx.close(); }
    { const { ctx, page } = await setup(browser, 1280, 900, { disabled: true });
      await page.evaluate(async () => { await selectManufacturer('dalton'); await openProductDetail('BED1200i'); }); await page.waitForSelector('#pdReimb .pd-reimb', { timeout: 20000 }); await page.waitForTimeout(1500);
      const hidden = await page.evaluate(() => [...document.querySelectorAll('#pdReimb .pd-ref-go')].every((b) => b.hidden));
      await page.evaluate(() => showP360('reports')); await page.waitForTimeout(1500);
      const rep = await page.evaluate(() => !!document.querySelector('#rptRef'));
      await t('an account outside the pilot sees no referral buttons anywhere', () => ok(hidden && !rep, JSON.stringify({ hidden, rep })));
      await ctx.close(); }
    { const { ctx, page } = await setup(browser, 1280, 900, { hqNoZip: true });
      await page.evaluate(() => openReferrals({ hcpcs: 'E0260' })); await page.waitForSelector('#rfZips', { timeout: 20000 }); await page.waitForTimeout(800);
      const z = await page.evaluate(() => ({ zips: document.querySelector('#rfZips').value, loc: document.querySelector('#rfLoc').value }));
      await t('a head office with no ZIP on file starts on the first listed location (live Sandbox 2026-11-21)', () => ok(z.zips === '42101' && z.loc === '42101', JSON.stringify(z)));
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(`\nreferral sources: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
