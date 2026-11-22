/* Provider reimbursement lookup UI (owner 2026-11-19): the lookup view, the Shop Products card, both missing-data
   messages, the Print billing reference (links stay clickable in the PDF) and phone widths. The API is answered by the
   admin engine itself (REIMB_ENGINE=<admin repo>/netlify/functions/_reimb.js).
   PLAYWRIGHT_MODULE=… REIMB_ENGINE=… node test/reimb-ui.browser.js */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const R = require(process.env.REIMB_ENGINE || path.join(__dirname, '..', '..', 'adm', 'netlify', 'functions', '_reimb.js'));
/* the real reimbursement-api handler, signed in through a mocked Supabase (the "product" action runs the server's own mapping) */
const API_FILE = path.join(path.dirname(process.env.REIMB_ENGINE || path.join(__dirname, '..', '..', 'adm', 'netlify', 'functions', '_reimb.js')), 'reimbursement-api.js');
process.env.SUPABASE_URL = 'https://example.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'service';
global.fetch = async (url) => { const u = String(url); const okj = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  if (u.endsWith('/auth/v1/user')) return okj({ id: 'u1' }); if (u.includes('/dealer_users?')) return okj([{ status: 'approved', dealer_id: 'd1' }]); if (u.includes('/dealers?')) return okj([{ state: 'KY', zip: '42101' }]); throw new Error('unexpected ' + u); };
const H = require(API_FILE).handler;
const JS = path.join(__dirname, '..', 'public', 'assets', 'reimb.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }

async function page(browser, w) {
  const pg = await browser.newPage({ viewport: { width: w || 1280, height: 900 } });
  /* the fixtures are dated 2026-11-19 (the rate data's service date); pin the page clock so "today" — the lookup's default date —
     is that day, not the machine's (the 5 baseline failures since 2026-11-20 were this clock, not the page) */
  await pg.clock.setFixedTime(new Date('2026-11-19T17:00:00Z'));
  await pg.exposeFunction('__reimbApi', (b) => {
    if (b.action === 'meta' || b.action === 'lookup' || b.action === 'product') return H({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(Object.assign({ dos: '2026-11-19' }, b)) }).then((r) => { const j = JSON.parse(r.body); if (j && j.today) j.today = '2026-11-19'; return j; });
    return { ok: false, error: 'unknown' };
  });
  await pg.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}.card{border:1px solid #ddd;padding:12px;margin:10px}.btn{min-height:44px}</style></head>
    <body><div id="host"></div><div id="cardHost"></div></body></html>`);
  await pg.addScriptTag({ path: JS });
  await pg.evaluate(() => { window.__opened = []; window.API = (b) => window.__reimbApi(b); });
  return pg;
}
const mount = (pg, prefill) => pg.evaluate((pre) => window.HCPSReimb.mount(document.getElementById('host'), { api: window.API, prefill: pre, back: () => {} }), prefill || null);
/* the storefront's own .pd-reimb rules (public/index.html), so the card is laid out as on the product page */
const PD_CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').split('\n').filter((l) => /^\.pd-reimb|^@media\(max-width:820px\)\{\.pd-reimb/.test(l)).join('\n');
const settle = (pg) => pg.waitForFunction(() => !document.querySelector('[data-act="go"][disabled]'), null, { timeout: 5000 });

(async () => {
  const browser = await chromium.launch();
  try {
    await t('Resources entry: the dealer\'s state + Medicaid fee-for-service by default; L4361 → three sections with the dated, plan-specific Kentucky rate', async () => {
      const pg = await page(browser); await mount(pg);
      ok(await pg.$eval('#rbState', (e) => e.value) === 'KY', 'state default'); ok(await pg.$eval('#rbPlan', (e) => e.value) === 'medicaid-ffs', 'plan default');
      ok(await pg.$eval('#rbDos', (e) => e.value) === '2026-11-19', 'date default');
      await pg.fill('#rbCode', 'l4361'); await pg.click('[data-act="go"]'); await settle(pg);
      const txt = await pg.$eval('#rbOut', (e) => e.innerText);
      ok(/Published allowance/.test(txt) && /Purchase or rental/.test(txt) && /Coverage & billing guidance/.test(txt), 'three sections');
      ok(/\$259\.40/.test(txt) && /November 19, 2026/.test(txt) && /Kentucky Medicaid fee-for-service/.test(txt), 'amount + context');
      ok(/revised October 26, 2026/.test(txt), 'effective date');
      const href = await pg.$eval('#rbOut .rb-src a', (a) => a.href); ok(/2026MedicaidMSEAfeeSchedule\.pdf#page=128$/.test(href), href);
      ok(await pg.$('[data-act="print"]'), 'print button'); await pg.close();
    });
    await t('rental example: Medicare capped rental shows months 1–3 and 4–13', async () => {
      const pg = await page(browser); await mount(pg, { code: 'E0260', state: 'KY', plan: 'medicare', dos: '2026-11-19', product: null }); await settle(pg);
      await pg.waitForSelector('.rb-cap'); const txt = await pg.$eval('.rb-cap', (e) => e.innerText); ok(/Months 1–3\s+\$78\.16/.test(txt) && /Months 4–13\s+\$58\.62/.test(txt), txt); await pg.close();
    });
    await t('missing rate: TennCare plan → "Rate unavailable for this plan/date" exactly', async () => {
      const pg = await page(browser); await mount(pg, { code: 'L4361', state: 'TN', plan: 'tenncare-bluecare' }); await settle(pg); await pg.waitForSelector('#rbOut .rb-miss');
      ok(await pg.$eval('#rbOut .rb-miss', (e) => e.textContent) === 'Rate unavailable for this plan/date', 'message'); await pg.close();
    });
    await t('missing code: a model without a verified code → "No verified HCPCS code on file for this model" exactly; nothing looked up', async () => {
      const pg = await page(browser); await mount(pg, { product: { name: 'Strongback ES0001', code: 'ES0001', codes: [], noCode: true } });
      ok(await pg.$eval('.rb-prod .rb-miss', (e) => e.textContent) === 'No verified HCPCS code on file for this model', 'message');
      ok(!(await pg.$('#rbOut section')), 'no result'); await pg.close();
    });
    const cardOf = (pg, prod) => pg.evaluate((p) => window.HCPSReimb.card(document.getElementById('cardHost'), { api: window.API, product: p, open: (x) => window.__opened.push(x) }), prod);
    const cardText = async (pg) => { await pg.waitForFunction(() => !/Loading/.test(document.getElementById('cardHost').innerText), null, { timeout: 8000 }); return pg.$eval('#cardHost', (e) => e.innerText); };
    await t('M50 oxygen concentrator card: Original Medicare and Kentucky Medicaid side by side, each with payer, location, date, modifier, unit and source', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50 Stationary 5L Concentrator', code: '304051011', manufacturer: 'ohio-medical', category: 'Oxygen', sku_code: 'E1390', page_codes: [], cost: 445 });
      const txt = await cardText(pg);
      ok(/Original Medicare fee-for-service · Kentucky · ZIP 42101 · non-rural · branch estimate · November 19, 2026/.test(txt) && /\$100\.21/.test(txt), 'medicare row: ' + txt);
      ok(/Kentucky Medicaid fee-for-service · Kentucky · Any service location/.test(txt) && /\$91\.82/.test(txt), 'medicaid row');
      ok(/RR/.test(txt) && /Rental — one month/.test(txt) && (await pg.$$('#cardHost .pd-reimb-src a')).length >= 2, 'modifier, unit, two sources'); await pg.close();
    });
    await t('one payer without a rate keeps the other visible (Tennessee: Medicare rate + TennCare "Rate unavailable for this plan/date")', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [] }); await cardText(pg);
      await pg.selectOption('#cardHost select[data-k="state"]', 'TN'); await pg.waitForTimeout(400); await cardText(pg);
      await pg.fill('#cardHost input[data-k="zip"]', '38301'); await pg.dispatchEvent('#cardHost input[data-k="zip"]', 'change'); await pg.waitForTimeout(300); const txt = await cardText(pg);
      const rowsTxt = await pg.$$eval('#cardHost .pd-reimb-row', (r) => r.map((x) => x.innerText));
      ok(/Original Medicare fee-for-service · Tennessee/.test(rowsTxt[0]) && /\$\d/.test(rowsTxt[0]), 'medicare amount: ' + rowsTxt[0]);
      ok(/Rate unavailable for this plan\/date/.test(txt), 'tenncare message'); await pg.close();
    });
    const setZip = async (pg, z) => { await pg.fill('#cardHost input[data-k="zip"]', z); await pg.dispatchEvent('#cardHost input[data-k="zip"]', 'change'); await pg.waitForTimeout(300); return cardText(pg); };
    await t('ZIP pricing on the card: branch estimate by default; patient ZIP override; Kentucky rural, non-rural and former CBA; a missing ZIP and a Tennessee ZIP get no Medicare rate', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [] });
      let txt = await cardText(pg); ok(/Branch estimate/.test(txt) && /\$100\.21/.test(txt), 'branch estimate');
      txt = await setZip(pg, '41301'); ok(/ZIP 41301 · rural \(CMS DMEPOS rural ZIP file\) · patient residence/.test(txt) && /\$177\.16/.test(txt), 'rural: ' + txt.slice(0, 400));
      txt = await setZip(pg, '40202'); ok(/former competitive bidding area Louisville County, KY/.test(txt) && /\$91\.82/.test(txt), 'former CBA');
      txt = await setZip(pg, ''); let rows = await pg.$$eval('#cardHost .pd-reimb-row', (r) => r.map((x) => x.innerText));
      ok(/Enter patient ZIP to see Medicare allowance/.test(rows[0]) && /No ZIP code entered/.test(rows[0]) && !/\$100\.21|\$177\.16/.test(rows[0]), 'missing ZIP: ' + rows[0]);
      ok(/Enter patient ZIP to see Medicare allowance/.test(await pg.$eval('#pdZipHint', (e) => e.textContent)), 'message beside the ZIP field');
      ok(/\$91\.82/.test(rows[1]), 'Medicaid row unaffected');
      txt = await setZip(pg, '37075'); rows = await pg.$$eval('#cardHost .pd-reimb-row', (r) => r.map((x) => x.innerText));
      ok(/Rate unavailable for this plan\/date/.test(rows[0]) && /Tennessee ZIP code/.test(rows[0]) && !/\$100\.21/.test(rows[0]), 'state conflict: ' + rows[0]); await pg.close();
    });
    await t('the dealer changes date and Medicare ZIP on the card', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [] }); await cardText(pg);
      let txt = await setZip(pg, '41301'); ok(/\$177\.16/.test(txt), 'rural');
      await pg.fill('#cardHost input[data-k="dos"]', '2027-02-01'); await pg.dispatchEvent('#cardHost input[data-k="dos"]', 'change'); await pg.waitForTimeout(300); txt = await cardText(pg);
      ok(/February 1, 2027/.test(txt) && (txt.match(/Rate unavailable for this plan\/date/g) || []).length === 2, 'no 2027 schedules → both rows unavailable'); await pg.close();
    });
    await t('Golden lift chair card: E0627 — electric seat-lift mechanism only, with the component made clear', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'Cloud Plus Luxe', code: 'PR525-MED', manufacturer: 'golden-technologies', category: 'Lift Chairs', cost: 1200 });
      const txt = await cardText(pg); ok(/HCPCS E0627 — electric seat-lift mechanism only/.test(txt) && /covers only the electric seat-lift mechanism/.test(txt) && /\$324\.15/.test(txt), txt.slice(0, 300));
      ok(/informational only/.test(txt) && !/earnings calculator/i.test(txt) && !(await pg.$('#cardHost .pd-reimb-calc')), 'informational, no calculator link');
      await pg.click('#cardHost .pd-reimb-go'); const o = await pg.evaluate(() => window.__opened[0]); ok(o.product.informational && o.product.cost === undefined, 'no cost carried'); await pg.close();
    });
    await t('cash-only Golden scooter, an unmatched suffix and a product without a code: "No verified HCPCS code on file for this model" with the reason', async () => {
      const pg = await page(browser);
      for (const [p, re] of [[{ name: 'BUZZ Extreme', code: 'GB118D', manufacturer: 'golden-technologies', category: 'Scooters' }, /cash scooter only/],
        [{ name: 'Buzzaround LT', code: 'GB107B', manufacturer: 'golden-technologies', category: 'Scooters' }, /GB107A/],
        [{ name: 'ErgoSteel', code: 'ES0001', manufacturer: 'strongback-mobility', category: 'Wheelchairs' }, /./]]) {
        await cardOf(pg, p); const txt = await cardText(pg); ok(txt.includes('No verified HCPCS code on file for this model') && re.test(txt), p.code + ': ' + txt.slice(0, 200)); }
      await pg.close();
    });
    await t('Dalton — four display states on the card: verified (code, source, calculator), reference (note beside the code, allowance notice, no estimate), pending (no code, no allowance, missing evidence), none', async () => {
      const pg = await page(browser);
      await cardOf(pg, { name: 'K5 18 Ultra Light', code: 'K515FA', manufacturer: 'dalton', category: 'Wheelchairs' }); let txt = await cardText(pg);
      ok(/HCPCS K0005/.test(txt) && /PDAC Product Classification List/.test(txt) && /\$2,634\.76/.test(txt) && (await pg.$('#cardHost .pd-reimb-calc')) && !/HCPCS reference only/.test(txt), 'verified: ' + txt.slice(0, 300));
      await cardOf(pg, { name: 'K4 16 Lightweight', code: 'K416FA0215', manufacturer: 'dalton', category: 'Wheelchairs' }); txt = await cardText(pg);
      ok(/HCPCS K0004 HCPCS reference only — model verification pending\./.test(txt) && !/\*/.test(txt), 'reference note beside the code, no asterisk: ' + txt.slice(0, 300));
      ok(/Published allowance for this code\. This product's classification is pending verification\./.test(txt) && /\$57\.95/.test(txt), 'allowance with the notice');
      ok(!(await pg.$('#cardHost .pd-reimb-calc')) && !(await pg.$('#cardHost .pd-est-sc')) && /Explore a K\d{4} estimate/.test(txt) && /Open the code's fee schedule/.test(txt), 'no estimate until opted in, fee schedule link');
      // the notice stays when the ZIP, date or payer changes
      await pg.fill('#cardHost [data-k="zip"]', '41301'); await pg.dispatchEvent('#cardHost [data-k="zip"]', 'change'); await pg.waitForFunction(() => /41301/.test(document.getElementById('cardHost').innerText), null, { timeout: 8000 });
      txt = await cardText(pg); ok(/classification is pending verification/.test(txt) && /reference only/.test(txt), 'notice after a ZIP change');
      await pg.fill('#cardHost [data-k="dos"]', '2026-12-01'); await pg.dispatchEvent('#cardHost [data-k="dos"]', 'change'); await pg.waitForFunction(() => /December 1, 2026/.test(document.getElementById('cardHost').innerText), null, { timeout: 8000 });
      txt = await cardText(pg); ok(/classification is pending verification/.test(txt), 'notice after a date change');
      await cardOf(pg, { name: 'Foam Seat Cushion 16', code: 'PMC-260116-6', manufacturer: 'dalton', category: 'Wheelchair Cushions' }); txt = await cardText(pg);
      ok(/Coding verification pending/.test(txt) && /Missing evidence/.test(txt) && /PMC-260116/.test(txt) && !/HCPCS E26|\$\d/.test(txt) && !(await pg.$('#cardHost .pd-reimb-calc')), 'pending: ' + txt.slice(0, 300));
      for (const s of ['B-MATT-M442', 'SC-S145HD20', 'K07DK20F02V']) { await cardOf(pg, { name: s, code: s, manufacturer: 'dalton' }); txt = await cardText(pg); ok(/Coding verification pending/.test(txt) && /Missing evidence/.test(txt) && !/\$\d/.test(txt), s + ': ' + txt.slice(0, 200)); }
      await cardOf(pg, { name: 'Medical cart', code: 'MCA435E', manufacturer: 'dalton' }); txt = await cardText(pg);
      ok(txt.includes('No verified HCPCS code on file for this model') && !/HCPCS [A-Z]\d{4}/.test(txt), 'none'); await pg.close();
    });
    await t('Dalton reference in the billing details: notice above the allowance, no calculator, notice on the printed reference', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'K4 16 Lightweight', code: 'K416FA0215', manufacturer: 'dalton', category: 'Wheelchairs', cost: 300 }); await cardText(pg);
      await pg.click('#cardHost .pd-reimb-go'); const o = await pg.evaluate(() => window.__opened[0]);
      ok(o.plan === 'medicare' && o.product.reference === true && o.product.cost == null, 'opens Medicare, no cost carried: ' + JSON.stringify(o).slice(0, 200));
      await mount(pg, o); await settle(pg); await pg.waitForSelector('#rbOut .rb-refnote');
      const txt = await pg.$eval('#host', (e) => e.innerText);
      ok(/HCPCS K0004 HCPCS reference only — model verification pending\./.test(txt) && /Published allowance for this code\. This product's classification is pending verification\./.test(txt), 'notices: ' + txt.slice(0, 400));
      ok(!(await pg.$('#rbCalc .rb-calc')), 'no earnings estimate');
      await pg.selectOption('#rbPlan', 'medicaid-ffs'); await pg.click('[data-act="go"]'); await settle(pg); await pg.waitForSelector('#rbOut .rb-refnote'); ok(true, 'notice after a payer change');
      await pg.evaluate(() => { window.print = () => {}; }); await pg.click('[data-act="print"]');
      await pg.waitForFunction(() => document.querySelector('iframe') && document.querySelector('iframe').contentDocument.body && document.querySelector('iframe').contentDocument.body.innerText.length > 100);
      const html = await pg.evaluate(() => document.querySelector('iframe').contentDocument.body.innerText);
      ok(/Published allowance for this code\. This product's classification is pending verification\./.test(html) && /HCPCS reference only — model verification pending\./.test(html), 'printed notice');
      ok(/Kentucky Medicaid fee-for-service/.test(html) && /November 19, 2026/.test(html), 'payer and date printed');
      await pg.evaluate(() => { try { sessionStorage.removeItem('hcps_reimb_plan'); } catch (e) {} }); await pg.close();
    });
    await t('Medicare first: the card opens billing details on Original Medicare; an explicit plan choice in the lookup is kept when moving back to the product', async () => {
      const pg = await page(browser); await pg.evaluate(() => { try { sessionStorage.removeItem('hcps_reimb_plan'); } catch (e) {} });
      await cardOf(pg, { name: 'K5', code: 'K515FA', manufacturer: 'dalton', category: 'Wheelchairs' }); let txt = await cardText(pg);
      const rows = await pg.$$eval('#cardHost .pd-reimb-row .pd-reimb-p', (e) => e.map((x) => x.textContent)); ok(/^Original Medicare/.test(rows[0]) && /Medicaid/.test(rows[1]), 'Medicare row first: ' + rows.join(' | '));
      await pg.click('#cardHost .pd-reimb-go'); let o = await pg.evaluate(() => window.__opened.pop()); ok(o.plan === 'medicare', 'default Medicare: ' + o.plan);
      await mount(pg, o); await settle(pg); ok(await pg.$eval('#rbPlan', (e) => e.value) === 'medicare', 'lookup on Medicare');
      await pg.selectOption('#rbPlan', 'medicaid-ffs');
      await cardOf(pg, { name: 'K5', code: 'K515FA', manufacturer: 'dalton', category: 'Wheelchairs' }); await cardText(pg);
      await pg.click('#cardHost .pd-reimb-go'); o = await pg.evaluate(() => window.__opened.pop()); ok(o.plan === 'medicaid-ffs', 'explicit choice kept: ' + o.plan);
      await pg.evaluate(() => { try { sessionStorage.removeItem('hcps_reimb_plan'); } catch (e) {} }); await pg.close();
    });
    await t('only Medicaid has a rate: Medicare row says "Rate unavailable for this plan/date"; the Medicaid rate shows under its own payer label (IN-ABB11020, T4522, Kentucky)', async () => {
      const pg = await page(browser); await pg.evaluate(() => { try { sessionStorage.removeItem('hcps_reimb_plan'); } catch (e) {} });
      await cardOf(pg, { name: 'Brief, Medium', code: 'IN-ABB11020', manufacturer: 'dalton', category: 'Incontinence' }); await cardText(pg);
      const rows = await pg.$$eval('#cardHost .pd-reimb-row', (e) => e.map((x) => x.innerText));
      ok(/^Original Medicare fee-for-service/.test(rows[0]) && /Rate unavailable for this plan\/date/.test(rows[0]), 'medicare row: ' + rows[0]);
      ok(/Kentucky Medicaid fee-for-service/.test(rows[1]) && /\$0\.81/.test(rows[1]), 'medicaid row: ' + rows[1]); await pg.close();
    });
    await t('FULL-WIDTH PANEL (owner 2026-11-19 19:25) — K2DK18F / K0002 reference: Medicare left with its ZIP, Medicaid right with its plan; each payer its own amount, unit, basis, source; both notices', async () => {
      for (const w of [1280, 390]) {
        const pg = await page(browser, w); await pg.evaluate(() => { try { sessionStorage.removeItem('hcps_reimb_plan'); } catch (e) {} });
        await pg.addStyleTag({ content: PD_CSS });   // the product page's own panel styles
        await cardOf(pg, { name: 'K2 18" Wheelchair W/Footrest', code: 'K2DK18F', manufacturer: 'dalton', category: 'Wheelchairs', cost: 200 }); await cardText(pg);
        await pg.selectOption('#cardHost select[data-k="state"]', 'IN'); await pg.waitForTimeout(400); await cardText(pg);
        await setZip(pg, '');
        const blank = await pg.evaluate(() => ({ hint: document.getElementById('pdZipHint').textContent, med: document.querySelectorAll('#cardHost .pd-reimb-col')[0].innerText }));
        ok(/^Enter patient ZIP to see Medicare allowance$/.test(blank.hint) && /Enter patient ZIP to see Medicare allowance/.test(blank.med), 'blank ZIP: ' + JSON.stringify(blank));
        await setZip(pg, '47501');
        const L = await pg.evaluate(() => { const c = [...document.querySelectorAll('#cardHost .pd-reimb-col')].map((e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), t: e.innerText,
          zip: !!e.querySelector('[data-k="zip"]'), plan: !!e.querySelector('[data-k="mplan"]') }; }); return { c, top: document.querySelector('#cardHost .pd-reimb').innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
        const [med, mcd] = L.c;
        ok(L.c.length === 2 && /^Original Medicare fee-for-service/.test(med.t) && /^Indiana Medicaid/.test(mcd.t), 'columns: ' + L.c.map((x) => x.t.slice(0, 40)).join(' | '));
        ok(med.zip && !med.plan && mcd.plan && !mcd.zip, 'the ZIP is in the Medicare column, the plan selector in the Medicaid column');
        if (w > 820) ok(med.x < mcd.x && Math.abs(med.y - mcd.y) < 4, 'side by side: ' + JSON.stringify(L.c.map((x) => [x.x, x.y])));
        else ok(med.y < mcd.y && Math.abs(med.x - mcd.x) < 4, 'stacked, Medicare first: ' + JSON.stringify(L.c.map((x) => [x.x, x.y])));
        ok(/HCPCS K0002[^\n]*HCPCS reference only — model verification pending\./.test(med.t) && /HCPCS reference only — model verification pending\./.test(mcd.t), 'notice beside the code in both columns');
        ok(/Published allowance for this code\. This product's classification is pending verification\./.test(L.top), 'allowance notice with the rates');
        ok(/\$85\.38/.test(med.t) && /Rental — one month · RR · Per HCPCS unit as the code describes it/.test(med.t) && /ZIP 47501 · rural/.test(med.t) && /November 19, 2026/.test(med.t) && /CMS DMEPOS Fee Schedule — October 2026/.test(med.t), 'Indiana Medicare amount: ' + med.t);
        ok(/Rate unavailable for this plan\/date/.test(mcd.t) && /starts January 1, 2027/.test(mcd.t) && /K0002 is not listed on the 2027 schedule either/.test(mcd.t), 'Indiana Medicaid reason: ' + mcd.t);
        ok(!/earnings calculator/i.test(L.top) && /Explore a K0002 estimate/.test(L.top) && !/Dealer-only estimate/.test(L.top), 'reference code: opt-in only');
        ok(L.sw <= L.cw + 1, 'no sideways scroll ' + L.sw + '/' + L.cw);
        await pg.selectOption('#cardHost select[data-k="state"]', 'KY'); await pg.waitForTimeout(400); await cardText(pg); await setZip(pg, '40202');
        const ky = await pg.$$eval('#cardHost .pd-reimb-col', (e) => e.map((x) => x.innerText));
        ok(/\$42\.05/.test(ky[0]) && /\$368\.60/.test(ky[1]) && /\$36\.86/.test(ky[1]) && /Kentucky Medicaid MSEA Fee Schedule 2026/.test(ky[1]), 'both payers show dollar amounts: ' + ky.join(' || '));
        await pg.close();
      }
    });
    await t('manufacturer-listed codes (owner 2026-11-19 20:03): Golden GB108B K0800 (Pending) from its specs — code, qualification and allowance, no estimate; Golden GC240E K0807 with dealer-only estimates; Ovation 30004 L4397 pending', async () => {
      const pg = await page(browser, 1280); await pg.addStyleTag({ content: PD_CSS }); await pg.evaluate(() => { try { sessionStorage.removeItem('hcps_reimb_plan'); } catch (e) {} });
      await cardOf(pg, { name: 'Buzzaround LT', code: 'GB108B', manufacturer: 'golden-technologies', category: 'Scooters', spec_codes: ['K0800'], cost: 900 }); await cardText(pg);
      await pg.selectOption('#cardHost select[data-k="state"]', 'IN'); await pg.waitForTimeout(400); await cardText(pg); let txt = await setZip(pg, '47501');
      ok(/HCPCS K0800[^\n]*Manufacturer-listed HCPCS — pending/.test(txt) && /K0800 \(Pending\)/.test(txt) && /\$1,359\.25/.test(txt) && /Purchase|New/.test(txt), 'GB108B: ' + txt.slice(0, 900));
      ok(!/earnings calculator/i.test(txt) && !/Explore a/.test(txt) && !/Dealer-only estimate/.test(txt) && /No earnings estimate while the manufacturer's code is pending/.test(txt), 'no estimate for a pending listing');
      await pg.click('#cardHost .pd-reimb-go'); const o = await pg.evaluate(() => window.__opened.pop()); ok(o.product.qualified && o.product.cost === undefined, 'no cost carried to the lookup');
      await mount(pg, o); await settle(pg); await pg.click('[data-act="print"]');
      await pg.waitForFunction(() => document.querySelector('iframe') && document.querySelector('iframe').contentDocument.body && document.querySelector('iframe').contentDocument.body.innerText.length > 100);
      const pr = await pg.evaluate(() => document.querySelector('iframe').contentDocument.body.innerText); ok(/Manufacturer-listed HCPCS — pending/.test(pr) && /K0800 \(Pending\)/.test(pr), 'printed qualification');
      await cardOf(pg, { name: 'Companion', code: 'GC240E', manufacturer: 'golden-technologies', category: 'Scooters', spec_codes: ['K0807'], cost: 1500 }); txt = await cardText(pg);
      ok(/HCPCS K0807[^\n]*Manufacturer-listed HCPCS/.test(txt) && !/pending/i.test(txt.split('HCPCS K0807')[1].split('\n')[0]) && /earnings calculator/i.test(txt) && /Dealer-only estimate/.test(txt) && /Estimated margin\s+\$\d/.test(txt), 'GC240E: exact-model listed code, no pending → dealer-only estimates (owner 2026-11-19 20:48): ' + txt.slice(700, 2600));
      await cardOf(pg, { name: 'Walker', code: '30004', manufacturer: 'ovation-medical', category: 'Walkers', sku_code: 'L4397', page_codes: ['L4396'] }); txt = await cardText(pg);
      ok(/HCPCS L4397[^\n]*pending/.test(txt) && /product page lists L4396/.test(txt), 'Ovation 30004: ' + txt.slice(0, 500)); await pg.close();
    });
    await t('changing the Medicaid plan, ZIP or date updates the panel in place — the page does not jump and never collapses to "Loading…"', async () => {
      const pg = await page(browser, 1280);
      await pg.evaluate(() => { const s = document.createElement('div'); s.style.height = '1600px'; document.body.insertBefore(s, document.getElementById('cardHost')); const e = document.createElement('div'); e.style.height = '1600px'; document.body.appendChild(e); });
      await cardOf(pg, { name: 'K2', code: 'K2DK18F', manufacturer: 'dalton', category: 'Wheelchairs' }); await cardText(pg);
      await pg.evaluate(() => window.scrollTo(0, document.getElementById('cardHost').getBoundingClientRect().top + window.scrollY - 100)); const y0 = await pg.evaluate(() => window.scrollY);
      const seen = await pg.evaluate(() => new Promise((res) => { const log = []; const mo = new MutationObserver(() => log.push(/Loading…/.test(document.getElementById('cardHost').innerText))); mo.observe(document.getElementById('cardHost'), { childList: true, subtree: true });
        const z = document.querySelector('#cardHost [data-k="zip"]'); z.value = '40601'; z.dispatchEvent(new Event('change'));
        setTimeout(() => { mo.disconnect(); res({ log, y: window.scrollY, focus: document.activeElement && document.activeElement.getAttribute('data-k') }); }, 1200); }));
      ok(!seen.log.some(Boolean), 'collapsed to Loading'); ok(Math.abs(seen.y - y0) <= 1, 'scroll ' + y0 + ' → ' + seen.y); ok(seen.focus === 'zip', 'focus kept on the ZIP field: ' + seen.focus);
      const plans = await pg.$$eval('#cardHost [data-k="mplan"] option', (o) => o.map((x) => x.value));
      if (plans.length > 1) { await pg.selectOption('#cardHost [data-k="mplan"]', plans[1]); await pg.waitForTimeout(800); ok(Math.abs((await pg.evaluate(() => window.scrollY)) - y0) <= 1, 'scroll after plan change'); }
      await pg.close();
    });
    await t('card → lookup: the code, state and date travel; the dealer cost stays in the product for the calculator only', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [], cost: 445 }); await cardText(pg);
      await pg.click('#cardHost .pd-reimb-go'); const o = await pg.evaluate(() => window.__opened[0]);
      ok(o.code.code === 'E1390' && o.state === 'KY' && o.dos === '2026-11-19' && o.zip === '42101' && o.zipSrc === 'branch' && o.product.cost === 445, JSON.stringify(o).slice(0, 200)); await pg.close();
    });
    const calcRun = async (pg, pre, set) => { await mount(pg, pre); await settle(pg); await pg.waitForSelector('#rbCalc .rb-calc');
      for (const [k, v] of Object.entries(set || {})) { const sel = `#rbCalc [data-c="${k}"]`; if (k === 'idx') await pg.selectOption(sel, String(v)); else { await pg.fill(sel, String(v)); await pg.dispatchEvent(sel, 'change'); } }
      return pg.$eval('#rbCalc', (e) => e.innerText); };
    await t('calculator — M50 oxygen (Medicare KY): 36 paid months, 37–60 service period, 80/20 counted once, break-even month', async () => {
      const pg = await page(browser);
      const txt = await calcRun(pg, { code: 'E1390', state: 'KY', plan: 'medicare', dos: '2026-11-19', product: { name: 'M50', code: '304051011', codes: [{ code: 'E1390' }], cost: 445 } });
      ok(/months 37–60/.test(txt) && /36 paid month\(s\) \+ 24 unpaid service month\(s\)/.test(txt), 'periods');
      ok(/Allowed amount over the period\s+\$3,607\.56/i.test(txt) && /Medicare pays \(80%\)\s+\$2,886\.05/i.test(txt) && /\$721\.51/.test(txt) && /Expected collections\s+\$3,607\.56/i.test(txt), 'split: ' + txt);
      ok(/Break-even\s+Month 5/i.test(txt) && /Estimated gross margin\s+\$3,162\.56 \(87\.7%\)/i.test(txt), 'margin/break-even');
      const half = await (async () => { await pg.fill('#rbCalc [data-c="coins"]', '50'); await pg.dispatchEvent('#rbCalc [data-c="coins"]', 'change'); return pg.$eval('#rbCalc', (e) => e.innerText); })();
      ok(/Expected collections\s+\$3,246\.80/i.test(half), '50% coinsurance collected'); await pg.close();
    });
    await t('calculator — E0260 hospital bed: 13-month capped rental and an early stop at month 6', async () => {
      const pg = await page(browser);
      let txt = await calcRun(pg, { code: 'E0260', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '600' });
      ok(/Allowed amount over the period\s+\$820\.68/i.test(txt) && /months 1–3 at \$78\.16, months 4–13 at \$58\.62/.test(txt), '13 months: ' + txt.slice(0, 400));
      await pg.fill('#rbCalc [data-c="months"]', '6'); await pg.dispatchEvent('#rbCalc [data-c="months"]', 'change'); txt = await pg.$eval('#rbCalc', (e) => e.innerText);
      ok(/Allowed amount over the period\s+\$410\.34/i.test(txt) && /Break-even\s+Not reached/i.test(txt), 'early stop');
      ok(/Estimated gross margin\s+−\$189\.66 \(-46\.2%\)/i.test(txt) && !/\$-/.test(txt), 'a loss reads −$189.66'); await pg.close();
    });
    await t('Golden lift chair (PR525-MED) and E0627 in the lookup: informational only — allowances and guidance, no calculator, no cost field', async () => {
      const pg = await page(browser);
      await mount(pg, { code: 'E0627', state: 'KY', plan: 'medicare', dos: '2026-11-19', product: { name: 'Cloud', code: 'PR525-MED', codes: [{ code: 'E0627', component: 'mechanism' }], informational: true } }); await settle(pg); await pg.waitForSelector('#rbOut section');
      const all = await pg.$eval('#host', (e) => e.innerText);
      ok(/\$324\.15/.test(all) && /Coverage & billing guidance/.test(all) && /information only/.test(all), 'allowance + guidance');
      ok(!(await pg.$('#rbCalc .rb-calc')) && !(await pg.$('[data-c="cost"]')) && !/earnings estimate — dealer only|acquisition cost|Mechanism cost|gross margin/i.test(all), 'no calculator / cost'); ok(await pg.$('[data-act="print"]'), 'print stays');
      await mount(pg, { code: 'E0627', state: 'KY', plan: 'medicare', dos: '2026-11-19' }); await settle(pg); await pg.waitForSelector('#rbOut section');
      ok(!(await pg.$('#rbCalc .rb-calc')), 'direct E0627 lookup: no calculator either'); await pg.close();
    });
    await t('power wheelchair K0823 vs E0260 bed vs E1390 oxygen (Medicare KY 42101): month 3 / month 4 amounts in the lookup, the calculator and the print', async () => {
      const pg = await page(browser);
      let txt = await calcRun(pg, { code: 'K0823', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '1500' });
      let out = await pg.$eval('#rbOut', (e) => e.innerText);
      ok(/Months 1–3\s+\$350\.31\s+100%/.test(out) && /Months 4–13\s+\$140\.12\s+40%/.test(out) && /40% of it for months 4–13/.test(out), 'lookup table: ' + out.slice(0, 900));
      ok(/rental only — no first-month purchase option/.test(out), 'no purchase option for K0823');
      ok(/Power wheelchair capped rental: months 1–3 at \$350\.31, months 4–13 at \$140\.12/.test(txt) && /Months 1–3: \$350\.31 · Months 4–13: \$140\.12/.test(txt), 'calc schedule: ' + txt.slice(0, 900));
      ok(/Allowed amount over the period\s+\$2,452\.13/i.test(txt), 'K0823 13 months = 3×350.31 + 10×140.12');
      await pg.click('[data-act="print"]'); await pg.waitForFunction(() => document.querySelector('iframe') && document.querySelector('iframe').contentDocument.body.innerText.length > 100);
      const pr = await pg.evaluate(() => document.querySelector('iframe').contentDocument.body.innerText);
      ok(/\$350\.31/.test(pr) && /\$140\.12/.test(pr) && /40%/.test(pr) && !/earnings|gross margin/i.test(pr), 'print K0823');
      txt = await calcRun(pg, { code: 'E0260', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '600' });
      ok(/Months 1–3: \$78\.16 · Months 4–13: \$58\.62/.test(txt), 'E0260 75%');
      txt = await calcRun(pg, { code: 'E1390', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '445' });
      ok(/Months 1–36: \$100\.21 · Months 37–60: no payment/.test(txt), 'E1390 flat 36 months: ' + txt.slice(0, 900)); await pg.close();
    });
    await t('calculator month amounts match the billing table to the cent (E0373 $508.90 → $381.67)', async () => {
      const pg = await page(browser); const txt = await calcRun(pg, { code: 'E0373', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '1' });
      const out = await pg.$eval('#rbOut', (e) => e.innerText); const m = /Months 4–13\s+(\$[\d,.]+)/.exec(out);
      ok(m && txt.includes('Months 4–13: ' + m[1]), 'table ' + (m && m[1]) + ' vs calc ' + txt.slice(0, 400)); await pg.close();
    });
    await t('calculator assumptions sit beside the margin: paid months, projected fee schedule, pricing area, collections, cost, delivery and service', async () => {
      const pg = await page(browser);
      const txt = await calcRun(pg, { code: 'E0260', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '600', setup: '75', service: '10', months: '6' });
      const a = await pg.$eval('#rbCalc .rb-asm', (e) => e.innerText);
      ok(/Paid months\s+6/i.test(a) && /Projected fee schedule\s+Months 1–3: \$78\.16 · Months 4–6: \$58\.62/i.test(a) && /ZIP 42101 · non-rural · branch estimate/.test(a), 'assumptions: ' + a);
      ok(/Expected collections\s+\$410\.34/i.test(a) && /Dealer cost entered\s+\$600\.00/i.test(a) && /Delivery \/ setup entered\s+\$75\.00/i.test(a) && /Service cost entered\s+\$10\.00 × 6 month\(s\) = \$60\.00/i.test(a), 'money: ' + a);
      const box = await pg.$eval('#rbCalc .rb-calcgrid', (e) => { const t = e.children[0].getBoundingClientRect(), s = e.children[1].getBoundingClientRect(); return [t.right <= s.left + 1, Math.abs(t.top - s.top) < 8, getComputedStyle(e).display, e.children.length, t.top, s.top, t.right, s.left]; });
      ok(box[0] && box[1], 'beside the table on desktop ' + JSON.stringify(box)); await pg.close();
    });
    await t('calculator — Medicaid rental defaults to a 12-month dealer scenario with the not-modelled note (same default as the product page); bad input never shows NaN or a negative', async () => {
      const pg = await page(browser);
      let txt = await calcRun(pg, { code: 'E1390', state: 'KY', plan: 'medicaid-ffs', dos: '2026-11-19' }, { cost: '445' });
      ok(/12 month\(s\), your estimate/.test(txt) && /not modelled/.test(txt) && /Medicaid pays\s+\$1,101\.84/i.test(txt), 'medicaid default: ' + txt.slice(0, 600));
      await pg.fill('#rbCalc [data-c="cost"]', 'abc'); await pg.dispatchEvent('#rbCalc [data-c="cost"]', 'change'); txt = await pg.$eval('#rbCalc', (e) => e.innerText);
      ok(!/NaN/.test(txt) && /Unavailable/.test(txt), 'non-number → blank');
      await pg.fill('#rbCalc [data-c="months"]', '-5'); await pg.dispatchEvent('#rbCalc [data-c="months"]', 'change'); txt = await pg.$eval('#rbCalc', (e) => e.innerText);
      ok(!/NaN|-\$/.test(txt), 'negative months'); await pg.close();
    });
    await t('pack items: the per-item cost note shows (pack price ÷ pack quantity)', async () => {
      const pg = await page(browser);
      const txt = await calcRun(pg, { code: 'L4361', state: 'KY', plan: 'medicaid-ffs', dos: '2026-11-19', product: { name: 'Pack', code: 'P', codes: [{ code: 'L4361' }], cost: 10, cost_note: 'Your cost per item: the 12-roll pack price ÷ 12 items.' } });
      ok(/÷ 12 items/.test(txt), 'note'); await pg.close();
    });
    await t('index.html: the dealer cost sent to the calculator is per item (pack price ÷ case_qty)', () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
      ok(/Number\(p\.case_qty\)>1\?Number\(p\.case_qty\):1/.test(src) && /Math\.round\(u\/q\*100\)\/100/.test(src), 'divided by pack quantity');
    });
    await t('calculator stays out of the printed billing reference', async () => {
      const pg = await page(browser); await calcRun(pg, { code: 'E0260', state: 'KY', plan: 'medicare', dos: '2026-11-19' }, { cost: '600' });
      await pg.click('[data-act="print"]'); await pg.waitForFunction(() => document.querySelector('iframe') && document.querySelector('iframe').contentDocument.body.innerText.length > 100);
      const html = await pg.evaluate(() => document.querySelector('iframe').contentDocument.documentElement.outerHTML);
      ok(!/earnings|gross margin|acquisition cost|600\.00/i.test(html), 'no calculator in print'); await pg.close();
    });
    await t('Print billing reference: context, three sections and sources; links stay clickable in the PDF', async () => {
      const pg = await page(browser); await mount(pg, { code: 'L4361', state: 'KY', plan: 'medicaid-ffs', dos: '2026-11-19' }); await settle(pg); await pg.waitForSelector('[data-act="print"]');
      await pg.evaluate(() => { window.__printed = null; const orig = HTMLIFrameElement.prototype; window.print = () => {}; });
      await pg.click('[data-act="print"]'); await pg.waitForFunction(() => document.querySelector('iframe') && document.querySelector('iframe').contentDocument.body && document.querySelector('iframe').contentDocument.body.innerText.length > 100);
      const html = await pg.evaluate(() => document.querySelector('iframe').contentDocument.documentElement.outerHTML);
      ok(/Internal billing reference/.test(html) && /Published allowance/.test(html) && /Purchase or rental/.test(html) && /Coverage &amp; billing guidance/.test(html) && /Sources/.test(html), 'sections');
      ok(/\$259\.40/.test(html) && /November 19, 2026/.test(html), 'context');
      const p2 = await browser.newPage(); await p2.setContent(html); const f = path.join(os.tmpdir(), 'rb-' + Date.now() + '.pdf');
      await p2.pdf({ path: f, format: 'Letter', printBackground: true, preferCSSPageSize: true }); const pdf = fs.readFileSync(f).toString('latin1');
      ok((pdf.match(/\/URI/g) || []).length >= 4, 'clickable links in the PDF: ' + (pdf.match(/\/URI/g) || []).length);
      ok(/chfs\.ky\.gov/.test(pdf), 'source URL in the PDF'); await p2.close(); await pg.close();
    });
    await t('text is placed as text (a product name cannot inject markup)', async () => {
      const pg = await page(browser); await mount(pg, { product: { name: '<img src=x onerror="window.__x=1">', code: 'A', codes: [], noCode: true } });
      ok(!(await pg.$('#host img')) && !(await pg.evaluate(() => window.__x)), 'escaped'); await pg.close();
    });
    await t('index.html wiring: the product page (another script scope) reaches the card and the lookup through window', () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
      ok(/window\.reimbCard=reimbCard;/.test(src) && /window\.openReimb=openReimb;/.test(src), 'exported');
      ok(!/reimbCodesOf/.test(src), 'codes are resolved on the server only');
      ok(/typeof window\.reimbCard==="function"\) window\.reimbCard\(host\.querySelector\('#pdReimb'\),p\)/.test(src), 'detail page calls window.reimbCard');
      ok(!/typeof reimbCard==="function"/.test(src), 'no bare cross-scope call');
    });
    for (const w of [360, 390, 768]) await t('phone/tablet ' + w + 'px: no sideways scroll, 16px inputs, 44px targets', async () => {
      const pg = await page(browser, w); await mount(pg, { code: 'L4361', state: 'KY', plan: 'medicare', dos: '2026-11-19' }); await settle(pg); await pg.waitForSelector('#rbOut section');
      const o = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        fs: [...document.querySelectorAll('#host input,#host select')].map((e) => parseFloat(getComputedStyle(e).fontSize)),
        h: [...document.querySelectorAll('#host input,#host select,#host .btn')].map((e) => e.getBoundingClientRect().height) }));
      ok(o.sw <= o.cw, 'overflow ' + o.sw + '>' + o.cw); ok(o.fs.every((x) => x >= 16), 'font ' + o.fs); ok(o.h.every((x) => x >= 44), 'height ' + o.h); await pg.close();
    });
  } finally { await browser.close(); }
  console.log(`\nreimbursement UI: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
