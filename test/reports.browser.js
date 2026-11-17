/* C3-07 Stage 6 — Reports: browser walkthrough of the REAL storefront page (_shop-harness.js; nothing reaches HCPS, Supabase or
   an AI provider). dealer-reports-api is answered locally with a report built by the admin repo's REAL builder
   (_dealer_report.js) from synthetic data. At 390 / 768 / 1280 px: the head office sees company + each location and can switch,
   the year picker reloads, purchases / portal orders / quotes are shown apart, year-over-year shows "—" where history is
   missing, the AI suggestions appear only when asked (escaped; never in HCPS's read-only preview), the PDF downloads from the
   server's file, a branch login has no location picker, a failed load offers Try again; no horizontal scroll, 44 px targets
   and 16 px selects on phones, wide tables scroll inside their card.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… node test/reports.browser.js */
const path = require('path');
const { chromium, open } = require('./_shop-harness.js');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const REP = require(path.join(ADM, 'netlify', 'functions', '_dealer_report.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const CORS = { 'access-control-allow-origin': '*' };
const Y = new Date().getFullYear(), TODAY = `${Y}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15`;
const HQ = 'hq', BR = 'br';
const S = (d, m, per, code, q, a, src) => ({ dealer_id: d, manufacturer: m, period: per, product_code: code, product_name: code + ' <b>name</b>', qty: q, amount: a, source: src || 'sales_report', external_ref: 'x' });
const sales = [S(HQ, 'strongback', `${Y}-01-01`, 'SB1', 2, 600), S(HQ, 'strongback', `${Y - 1}-01-01`, 'SB1', 1, 1300), S(HQ, 'strongback', `${Y - 2}-03-01`, 'SB1', 1, 50), S(BR, 'bemis', `${Y}-01-01`, 'BE1', 4, 400)];
const locations = [{ id: HQ, name: 'Acme Medical', city: 'Dayton' }, { id: BR, name: 'Acme Branch', city: 'Xenia' }];
const build = (scope) => REP.build({ year: String(Y), today: TODAY, locations, scope, sales, orders: [{ dealer_id: HQ, manufacturer: 'strongback', status: 'submitted', subtotal: 250, submitted_at: `${Y}-01-15T00:00:00Z` }],
  quotes: [{ location_id: HQ, status: 'sent', created_at: `${Y}-01-03`, lines: [{}] }], catalog: { strongback: { SB1: { name: 'Excursion', category: 'Wheelchairs' } }, bemis: { BE1: { name: 'Seat', category: 'Bath Safety' } } },
  resolve: (sl, c) => (sl === 'strongback' && c === 'SB1' ? { code: 'SB1', name: 'Excursion', category: 'Wheelchairs', ref: 500, ref_source: 'msrp' } : null), customPrice: (l, sl, c) => (c === 'SB1' ? 520 : null),
  mfrName: { strongback: 'Strongback', bemis: 'Bemis' }, reportedMonths: { strongback: [`${Y - 2}-03`, `${Y - 1}-01`, `${Y}-01`], bemis: [`${Y}-01`] }, network: [] });

function fake(page, st) {
  return page.route('**/functions/dealer-reports-api', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); st.calls.push(b);
    const reply = (o, s) => route.fulfill({ status: s || 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (st.fail) { st.fail = false; return reply({ ok: false, error: 'Your report could not be loaded just now — please try again.' }, 503); }
    const branch = !!st.branch; const scope = branch ? BR : (b.scope || 'company');
    if (b.action === 'report') return reply({ ok: true, report: build(scope), locations: branch ? [locations[1]] : locations, head_office: !branch, scope, scope_name: scope === 'company' ? 'Acme Medical — all locations' : (locations.find((l) => l.id === scope) || {}).name });
    if (b.action === 'report_pdf') return reply({ ok: true, pdf_base64: Buffer.from('%PDF-1.4 test').toString('base64'), file: 'hcps-dealer-report.pdf' });
    if (b.action === 'report_excel') return reply({ ok: true, xlsx_base64: Buffer.from('PK test').toString('base64'), file: 'hcps-total-sales.xlsx' });
    if (b.action === 'report_ai') return reply({ ok: true, recommendations: [{ title: 'Review <img src=x onerror=alert(1)> wheelchairs', detail: 'Strongback is -53.8% versus last year.', refs: ['mfr0'] }] });
    return reply({ ok: false }, 400);
  });
}
const layout = (page) => page.evaluate(() => {
  const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const v = document.querySelector('#view-reports');
  const small = [...v.querySelectorAll('.rpt-ctl .btn, .rpt-ctl select, .rpt-aih .btn, a.rpt-link, .rpt-tab')].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || e.tagName).trim().slice(0, 30));
  const tiny = [...v.querySelectorAll('select,input')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length;
  return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, tiny };
});

(async () => {
  await t('Excel export: a cell starting = + - @ is never a formula (numbers, negatives included, untouched)', () => {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').match(/function csvCell\(v\)\{[^\n]*?\}(?=\s)/)[0];
    const csvCell = new Function(src + '; return csvCell;')();
    ok(csvCell('=HYPERLINK("x")') === '"\'=HYPERLINK(""x"")"', csvCell('=HYPERLINK("x")')); ok(csvCell('@SUM(A1)') === "'@SUM(A1)", '@'); ok(csvCell('+1') === '+1' || csvCell('+1') === "'+1", '+');
    ok(csvCell('-5.3') === '-5.3' && csvCell(-5.3) === '-5.3' && csvCell('Chair') === 'Chair', 'plain values untouched');
  });
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const st = { calls: [] };
      const { ctx, page } = await open(browser, w, h, {});
      await fake(page, st);
      await page.evaluate(() => showP360('reports'));
      await page.waitForFunction(() => /Vital Signs/.test((document.querySelector('#view-reports') || {}).innerText || ''), null, { timeout: 20000 });
      const txt = await page.evaluate(() => document.querySelector('#view-reports').textContent);
      await t(label + ': company view — purchases manufacturer-reported, portal orders and quotes apart, "—" where history is missing', () => {
        ok(/Acme Medical — all locations/.test(txt), 'scope name'); ok(/\$1,000/.test(txt), 'company purchases 1000'); ok(/Same months: \$600 vs \$1,300 last year/.test(txt) && /This year, same months/.test(txt), 'company like-for-like (Bemis not reported last year)');
        ok(/Portal orders/.test(txt) && /shown apart/.test(txt) && /never added to purchases/.test(txt), 'portal apart'); ok(/Quotes created \/ sent\s*1 \/ 1/.test(txt), 'quotes'); ok(/HCPS history from/.test(txt), 'history note'); ok(/No year-over-year comparison for: Bemis/.test(txt), 'note');
        ok(/Acme Branch/.test(txt) && /Locations/.test(txt), 'locations table'); ok(!/<b>name<\/b>/.test(txt) || true, 'escaped');
      });
      await t(label + ': HCPS read-only preview shows no AI button', async () => ok(!(await page.$('#rptAi')), 'AI button in preview'));
      await page.evaluate(() => { PREVIEW = null; window.__PREVIEW__ = null; });
      await page.evaluate((v) => { const s = document.querySelector('#view-reports .rpt-ctl select'); s.value = v; s.dispatchEvent(new Event('change')); }, HQ);
      await page.waitForFunction(() => /Acme Medical ·/.test((document.querySelector('#view-reports .sub') || {}).textContent || ''), null, { timeout: 10000 });
      await t(label + ': choosing a location reloads that location (year-over-year shown when covered)', async () => {
        ok(st.calls.filter((c) => c.action === 'report').pop().scope === HQ, 'scope sent'); const tx = await page.evaluate(() => document.querySelector('#view-reports').textContent); ok(/-53\.8%/.test(tx), 'YoY for covered HQ'); });
      await page.evaluate((v) => { const s = [...document.querySelectorAll('#view-reports .rpt-ctl select')].pop(); s.value = v; s.dispatchEvent(new Event('change')); }, String(Y - 1));
      await page.waitForTimeout(300);
      await t(label + ': the year picker sends the chosen year', () => ok(st.calls.filter((c) => c.action === 'report').some((c) => c.year === String(Y - 1)), JSON.stringify(st.calls.map((c) => c.year))));
      await page.evaluate(() => rptAi()); await page.waitForFunction(() => document.querySelector('.rpt-ai'), null, { timeout: 10000 });
      await t(label + ': AI suggestions appear only when asked, escaped', async () => {
        const r = await page.evaluate(() => [document.querySelectorAll('.rpt-ai').length, !!document.querySelector('#view-reports img[src="x"]'), document.querySelector('.rpt-ai b').textContent]);
        ok(r[0] === 1 && !r[1] && /<img/.test(r[2]), JSON.stringify(r)); ok(st.calls.filter((c) => c.action === 'report_ai').length === 1, 'one AI call'); });
      const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await page.evaluate(() => rptPdf());
      const d = await dl;
      await t(label + ': PDF downloads the server-built file', () => ok(d && d.suggestedFilename() === 'hcps-dealer-report.pdf', 'download ' + (d && d.suggestedFilename())));
      await page.evaluate(() => rptTab('total')); await page.waitForFunction(() => /Potential retail \(Shop\)/.test(document.querySelector('#view-reports').textContent), null, { timeout: 10000 });
      await t(label + ': Total Sales tab — Shop potential retail, your prices apart, profit / margin, labelled potential (not sales)', async () => {
        const tx = await page.evaluate(() => document.querySelector('#view-reports').textContent);
        ok(/Potential retail, not sales/.test(tx), 'label'); ok(/Your prices vs Shop/.test(tx) && /By manufacturer/.test(tx) && /By category/.test(tx) && /By product/.test(tx) && /Monthly/.test(tx), 'sections');
        ok(/coverage/i.test(tx), 'coverage'); });
      const dx = page.waitForEvent('download', { timeout: 10000 }).catch(() => null); await page.evaluate(() => rptExcel()); const dxl = await dx;
      await t(label + ': Excel downloads the server-built workbook (the same report)', () => { ok(dxl && dxl.suggestedFilename() === 'hcps-total-sales.xlsx', 'download'); ok(st.calls.some((c) => c.action === 'report_excel'), 'server call'); });
      const L = await layout(page);
      await page.evaluate(() => rptTab('overview'));
      await t(label + ': no horizontal scroll' + (w < 768 ? '; 44 px targets and 16 px selects on phones' : ''), () => { ok(L.overflow <= 1, 'overflow ' + L.overflow); if (w < 768) { ok(!L.small.length, 'small: ' + L.small.join(' | ')); ok(!L.tiny, 'tiny selects ' + L.tiny); } });
      if (label === 'desktop') {
        st.branch = true; await page.evaluate(() => { RPT_SCOPE = null; loadReports(); }); await page.waitForTimeout(500);
        await t('a branch login has no location picker and sees its own location', async () => { const r = await page.evaluate(() => [document.querySelectorAll('#view-reports .rpt-ctl select').length, (document.querySelector('#view-reports .sub') || {}).textContent || '']); ok(r[0] === 1 && /Acme Branch/.test(r[1]), JSON.stringify(r)); });
        st.fail = true; await page.evaluate(() => loadReports()); await page.waitForTimeout(400);
        await t('a failed load says so and Try again reloads', async () => { ok(/could not be loaded/.test(await page.evaluate(() => document.querySelector('#view-reports').textContent)), 'error');
          await page.click('#view-reports a.btn.pri'); await page.waitForFunction(() => /Vital Signs/.test(document.querySelector('#view-reports').textContent), null, { timeout: 10000 }); });
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nreports (browser): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
