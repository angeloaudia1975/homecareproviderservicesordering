/* Shop Products — dealer-only margin estimates beneath each payer's rates + "← Back to <product>" from the fee schedule
   (owner 2026-11-19 20:48). The REAL storefront page (_shop-harness.js) with the REAL reimbursement-api handler and engine
   (REIMB_ENGINE=<admin repo>/netlify/functions/_reimb.js; Supabase answered locally — nothing leaves the test), at 1280 and 390 px.
   Acceptance example: Dalton K2DK16F (K0002, reference only), Kentucky ZIP 42101, November 19, 2026, dealer cost $109:
     - reference-only → "Explore a K0002 estimate" (opt-in) with "Estimate assumes this product qualifies under K0002.";
     - Medicare rental: $54.13 months 1–3, $40.60 months 4–13 → $568.39 collections, $459.39 margin (80.8%); fewer paid months
       update the result; Medicare 80% and patient / secondary 20% shown apart, counted once; coinsurance collected changes it;
     - Kentucky Medicaid purchase $368.60 → $259.60 (70.4%); rental $36.86 per paid month as a labelled dealer scenario;
     - "Open the code's fee schedule" → "← Back to <product>" returns to the same SKU with quantity, state, ZIP, payer, date and
       scroll kept; the billing-details calculator agrees; "Back to results" still restores the filtered catalog;
     - dealer-only blocks are hidden in print.
   PLAYWRIGHT_MODULE=… REIMB_ENGINE=… node test/reimb-est-return.browser.js */
const path = require('path');
const ENGINE = process.env.REIMB_ENGINE || path.join(__dirname, '..', '..', 'adm', 'netlify', 'functions', '_reimb.js');
process.env.SUPABASE_URL = 'https://example.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'service';
const RF = require(path.join(path.dirname(ENGINE), 'reimbursement-api.js'));
const realFetch = global.fetch;
global.fetch = async (url, o) => { const u = String(url); const okj = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => JSON.stringify(x) });
  if (u.endsWith('/auth/v1/user')) return okj({ id: 'u1' }); if (u.includes('/dealer_users?')) return okj([{ status: 'approved', dealer_id: 'd1' }]);
  if (u.includes('/dealers?')) return okj([{ state: 'KY', zip: '42101' }]); if (u.includes('dealer_preview_tokens')) return okj([{ dealer_id: 'd1', expires_at: '2099-01-01T00:00:00Z' }]);
  return realFetch(url, o); };
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 500)); } }
const SHOTS = process.env.SHOTS || '';

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, { prices: { dalton: 109 } });
      let weird = false;
      await page.route('**/reimbursement-api', async (r) => { const body = JSON.parse(r.request().postData() || '{}');
        const res = await RF.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(Object.assign({ dos: '2026-11-19' }, body)) });
        let out = res.body;
        /* a plan id carrying quotes, brackets and a backslash: the panel must keep refreshing (no CSS selector is ever built from it) */
        if (weird && body.action === 'product') { try { const j = JSON.parse(out); (j.rows || []).forEach((x) => { if (x.payer && x.payer !== 'medicare') x.payer = 'ky "medicaid" [ffs]\\\'x'; }); out = JSON.stringify(j); } catch (e) {} }
        r.fulfill({ status: res.statusCode, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out }); });
      await page.evaluate(async () => { window.needsAccess = () => false; await selectManufacturer('dalton'); });
      await page.waitForFunction(() => document.querySelector('#cv2Grid .card'), null, { timeout: 20000 });
      await page.evaluate(() => { const s = document.getElementById('search'); s.value = 'K2'; CUI.sort = 'name'; CUI.page = 1; renderProducts(); });
      await page.waitForTimeout(400);
      const list0 = await page.evaluate(() => ({ q: cvQuery(), sort: CUI.sort, y: Math.round(window.scrollY) }));
      await page.evaluate(() => { CUI.lastCode = 'K2DK16F'; openProductDetail('K2DK16F'); });
      await page.waitForSelector('#pdReimb .pd-reimb-cols', { timeout: 20000 });
      await page.selectOption('#pdReimb [data-k=state]', 'KY'); await page.waitForTimeout(700);
      await page.fill('#pdReimb [data-k=zip]', '42101'); await page.dispatchEvent('#pdReimb [data-k=zip]', 'change'); await page.waitForTimeout(800);
      await t(`${label}: a reference-only model offers "Explore a K0002 estimate" — no estimate until the dealer opts in`, async () => {
        const txt = await page.$eval('#pdReimb', (e) => e.innerText);
        ok(/Explore a K0002 estimate/.test(txt) && /Estimate assumes this product qualifies under K0002\./.test(txt) && !(await page.$('#pdReimb .pd-est-sc')), txt.slice(0, 600));
        const bh = await page.$eval('#pdReimb [data-explore]', (e) => e.getBoundingClientRect().height); ok(bh >= 44, 'touch ' + bh);
      });
      await t(`${label}: the "Explore a K0002 estimate" offer is hidden in print`, async () => {
        await page.emulateMedia({ media: 'print' }); const v = await page.$$eval('#pdReimb [data-explore], #pdReimb .pd-est-offer, #pdReimb .pd-reimb-calc', (e) => e.filter((x) => x.offsetParent !== null).length); await page.emulateMedia({ media: 'screen' });
        ok(v === 0, 'visible in print: ' + v);
      });
      await page.click('#pdReimb [data-explore]'); await page.waitForSelector('#pdReimb .pd-est-sc', { timeout: 10000 });
      const cols = () => page.$$eval('#pdReimb .pd-reimb-col', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ')));
      await t(`${label}: Medicare rental 13 paid months — $568.39 collections, $109 cost, $459.39 margin (80.8%), schedule, 80% / 20% shown once`, async () => {
        const [med] = await cols();
        ok(/\$54\.13/.test(med) && /Estimate assumes this product qualifies under K0002/.test(med), med.slice(0, 400));
        ok(/Estimated collections \$568\.39/.test(med) && /Medicare 80% \$454\.71 \+ patient \/ secondary 20% × 100% collected \$113\.68/.test(med), med);
        ok(/Dealer cost \$109\.00/.test(med) && /Estimated margin \$459\.39 \(80\.8%\)/.test(med) && /Break-even Month 3/.test(med), med);
        ok(/Months 1–3 \$54\.13 · Months 4–13 \$40\.60/.test(med), 'schedule: ' + med);
      });
      await t(`${label}: Kentucky Medicaid — purchase $368.60 → $259.60 (70.4%); rental $36.86 a paid month as a labelled dealer scenario`, async () => {
        const [, mcd] = await cols();
        ok(/Purchase[^]*Estimated collections \$368\.60[^]*Estimated margin \$259\.60 \(70\.4%\)/.test(mcd), mcd);
        ok(/Rental — one month[^]*Dealer scenario — Kentucky Medicaid's rental term is not on file; the paid months are your estimate[^]*Months 1–12 \$36\.86/.test(mcd), mcd);
      });
      await page.fill('#pdReimb [data-e="m"][data-key^="medicare"]', '6'); const y0 = await page.evaluate(() => window.scrollY); await page.dispatchEvent('#pdReimb [data-e="m"][data-key^="medicare"]', 'change'); await page.waitForTimeout(400);
      await t(`${label}: (paid months) page did not jump`, async () => ok(Math.abs((await page.evaluate(() => window.scrollY)) - y0) <= 2, 'scroll ' + y0 + ' → ' + (await page.evaluate(() => window.scrollY))));
      await page.fill('#pdReimb [data-e="coins"]', '50'); const y1 = await page.evaluate(() => window.scrollY); await page.dispatchEvent('#pdReimb [data-e="coins"]', 'change'); await page.waitForTimeout(400);
      await t(`${label}: fewer paid months and incomplete coinsurance update the result in place (no refetch, page does not jump)`, async () => {
        const [med] = await cols();
        // 3 × 54.13 + 3 × 40.60 = 284.19; Medicare 80% 227.35 + 20% × 50% 28.42 = 255.77; margin 146.77 (57.4%)
        ok(/Estimated collections \$255\.77/.test(med) && /20% × 50% collected \$28\.42/.test(med) && /Estimated margin \$146\.77 \(57\.4%\)/.test(med), med);
        ok(Math.abs((await page.evaluate(() => window.scrollY)) - y1) <= 2, 'scroll ' + y1 + ' → ' + (await page.evaluate(() => window.scrollY)));
      });
      await page.fill('#pdReimb [data-e="m"][data-key^="medicare"]', '13'); await page.dispatchEvent('#pdReimb [data-e="m"][data-key^="medicare"]', 'change'); await page.waitForTimeout(300);
      await page.fill('#pdReimb [data-e="coins"]', '100'); await page.dispatchEvent('#pdReimb [data-e="coins"]', 'change'); await page.waitForTimeout(300);
      await t(`${label}: dealer-only estimates are hidden in print`, async () => {
        await page.emulateMedia({ media: 'print' }); const vis = await page.$$eval('[data-dealer-only]', (e) => e.filter((x) => x.offsetParent !== null).length); await page.emulateMedia({ media: 'screen' });
        ok(vis === 0, 'visible in print: ' + vis);
      });
      if (SHOTS) { const el = await page.$('#pdReimb'); await el.screenshot({ path: path.join(SHOTS, `estimates-K2DK16F-KY-${label}.png`) }); }
      // a quantity typed on the product page, then the fee schedule
      await page.evaluate(() => { const q = document.querySelector('#content .pd input[type=number], #content .pd .qty input'); if (q) { q.value = '3'; q.dispatchEvent(new Event('input')); } });
      const qty0 = await page.evaluate(() => { const q = document.querySelector('#content .pd input[type=number], #content .pd .qty input'); return q ? q.value : null; });
      await page.evaluate(() => document.getElementById('pdReimb').scrollIntoView({ block: 'start' })); await page.waitForTimeout(200);
      const yp = await page.evaluate(() => Math.round(window.scrollY));
      await page.evaluate(() => document.querySelector('#pdReimb .pd-reimb-go:not(.pd-reimb-calc)').click()); await page.waitForSelector('#view-reimb .rb-ret', { timeout: 15000 });   // a click that does not scroll first
      await page.waitForFunction(() => document.querySelector('#view-reimb #rbCalc .rb-calc'), null, { timeout: 15000 });
      await t(`${label}: the fee schedule page starts with "← Back to K2 16″ …" and its calculator agrees with the product page`, async () => {
        const btn = await page.$eval('#view-reimb .rb-ret', (e) => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height, top: e.getBoundingClientRect().top + window.scrollY }));
        ok(/^← Back to K2 16/.test(btn.t) && btn.h >= 44, JSON.stringify(btn));
        const calc = await page.$eval('#view-reimb #rbCalc', (e) => e.textContent.replace(/\s+/g, ' ')); if (!calc) console.log('     debug: ' + (await page.$eval('#view-reimb', (e) => e.innerText.replace(/\s+/g, ' ').slice(-900))));
        ok(/Estimate assumes this product qualifies under K0002/.test(calc) && /Expected collections\s*\$568\.39/.test(calc) && /\$459\.39 \(80\.8%\)/.test(calc), 'calc: ' + calc.slice(500, 1600));
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `return-1-fee-schedule-${label}.png`) });
      await page.click('#view-reimb .rb-ret'); await page.waitForFunction(() => document.querySelector('#content .pd') && !document.body.classList.contains('p360on'), null, { timeout: 15000 });
      await page.waitForTimeout(400);
      await t(`${label}: "← Back to …" returns to the same SKU with quantity, state, ZIP, payer, date, estimate and scroll kept`, async () => {
        const s = await page.evaluate(() => ({ code: document.querySelector('#content .pd').getAttribute('data-pd-code'), st: document.querySelector('#pdReimb [data-k=state]').value,
          zip: document.querySelector('#pdReimb [data-k=zip]').value, plan: (document.querySelector('#pdReimb [data-k=mplan]') || {}).value, dos: document.querySelector('#pdReimb [data-k=dos]').value,
          y: Math.round(window.scrollY), est: !!document.querySelector('#pdReimb .pd-est-sc'), q: (document.querySelector('#content .pd input[type=number], #content .pd .qty input') || {}).value }));
        ok(s.code === 'K2DK16F' && s.st === 'KY' && s.zip === '42101' && s.plan === 'medicaid-ffs' && s.dos === '2026-11-19' && s.est, JSON.stringify(s));
        ok(qty0 == null || s.q === qty0, 'quantity ' + qty0 + ' → ' + s.q); ok(Math.abs(s.y - yp) < 40, 'scroll ' + yp + ' → ' + s.y);
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `return-2-back-on-product-${label}.png`) });
      await page.click('#content .pd-back'); await page.waitForFunction(() => document.querySelector('#cv2Grid .card') && !document.querySelector('#content .pd'), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      await t(`${label}: "Back to results" then restores the filtered catalog`, async () => {
        const l = await page.evaluate(() => ({ q: cvQuery(), sort: CUI.sort, y: Math.round(window.scrollY) })); ok(l.q === list0.q && l.sort === list0.sort && Math.abs(l.y - list0.y) < 40, JSON.stringify([list0, l]));
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `return-3-results-${label}.png`) });
      /* a quick switch: the dealer opens K2DK16F and straight away K2DK18F — the button names, and returns to, the product whose card opened the fee schedule */
      await page.evaluate(() => { openProductDetail('K2DK16F'); openProductDetail('K2DK18F'); });
      await page.waitForFunction(() => { const pd = document.querySelector('#content .pd'); return pd && pd.getAttribute('data-pd-code') === 'K2DK18F' && document.querySelector('#pdReimb .pd-reimb-cols'); }, null, { timeout: 20000 });
      await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelector('#pdReimb .pd-reimb-go:not(.pd-reimb-calc)').click()); await page.waitForSelector('#view-reimb .rb-ret', { timeout: 15000 });
      const rb = await page.$eval('#view-reimb .rb-ret', (e) => e.textContent.trim());
      await page.click('#view-reimb .rb-ret'); await page.waitForFunction(() => document.querySelector('#content .pd') && !document.body.classList.contains('p360on'), null, { timeout: 15000 });
      const back = await page.evaluate(() => document.querySelector('#content .pd').getAttribute('data-pd-code'));
      /* the race itself, made deterministic: K2DK16F's card finishes mounting while the page already shows K2DK18F */
      await page.evaluate(() => { document.getElementById('lateCard') && document.getElementById('lateCard').remove();
        const d = document.createElement('div'); d.id = 'lateCard'; d.className = 'pd'; d.setAttribute('data-pd-code', 'K2DK16F');
        d.innerHTML = '<div class="pd-info"><h1>K2 16\u2033 Wheelchair W/Footrest</h1></div><div id="lateReimb"></div>'; document.body.appendChild(d);
        return window.reimbCard(document.getElementById('lateReimb'), state.products.find((x) => x.code === 'K2DK16F')); });
      await page.waitForSelector('#lateReimb .pd-reimb-go', { timeout: 15000 });
      await page.evaluate(() => document.querySelector('#lateReimb .pd-reimb-go:not(.pd-reimb-calc)').click()); await page.waitForSelector('#view-reimb .rb-ret', { timeout: 15000 });
      const rbLate = await page.$eval('#view-reimb .rb-ret', (e) => e.textContent.trim());
      await page.evaluate(() => document.getElementById('lateCard').remove());
      await page.click('#view-reimb .rb-ret'); await page.waitForFunction(() => document.querySelector('#content .pd') && !document.body.classList.contains('p360on'), null, { timeout: 15000 });
      const backLate = await page.evaluate(() => document.querySelector('#content .pd').getAttribute('data-pd-code'));
      await t(`${label}: a card that finishes after the page moved on names and returns to its own product (K2DK16F)`, () => ok(/^← Back to K2 16/.test(rbLate) && backLate === 'K2DK16F', JSON.stringify({ rbLate, backLate })));
      await t(`${label}: after a quick product switch, the label and the destination are both K2DK18F`, () => ok(/^← Back to K2 18/.test(rb) && !/16/.test(rb) && back === 'K2DK18F', JSON.stringify({ rb, back })));
      /* a plan id with quotes / brackets / a backslash: each change still refreshes the panel and keeps focus */
      weird = true;
      await page.evaluate(() => { openProductDetail('K2DK16F'); });
      await page.waitForFunction(() => { const pd = document.querySelector('#content .pd'); return pd && pd.getAttribute('data-pd-code') === 'K2DK16F' && document.querySelector('#pdReimb .pd-reimb-cols'); }, null, { timeout: 20000 });
      await page.waitForFunction(() => { const x = document.querySelector('#pdReimb [data-explore]'); if (x) x.click(); return !!document.querySelector('#pdReimb .pd-est-sc'); }, null, { timeout: 15000, polling: 500 }).catch(() => {});
      await page.waitForSelector('#pdReimb .pd-est-sc', { timeout: 1000 }).catch(async (e) => { console.log('     debug: ' + (await page.$eval('#pdReimb', (x) => x.innerText.replace(/\s+/g, ' ').slice(0, 900)))); throw e; });
      const mSel = '#pdReimb [data-e="m"]:not([data-key^="medicare"])';
      const setM = async (v) => { await page.evaluate(([sel, v]) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('change')); }, [mSel, v]); await page.waitForTimeout(300);
        return page.evaluate((sel) => ({ txt: document.querySelectorAll('#pdReimb .pd-reimb-col')[1].textContent.replace(/\s+/g, ' '), focus: document.activeElement === document.querySelector(sel), key: document.querySelector(sel).getAttribute('data-key') }), mSel); };
      const r6 = await setM('6'), r3 = await setM('3');
      await t(`${label}: a plan id with quotes, brackets and a backslash — every change refreshes the panel and keeps focus`, () => {
        ok(/"medicaid" \[ffs\]/.test(r6.key), r6.key);
        ok(/Months 1–6 \$36\.86/.test(r6.txt) && r6.focus, JSON.stringify({ t: r6.txt.slice(-300), f: r6.focus }));
        ok(/Months 1–3 \$36\.86/.test(r3.txt) && r3.focus, JSON.stringify({ t: r3.txt.slice(-300), f: r3.focus }));
      });
      weird = false;
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\nestimates + fee-schedule return: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
