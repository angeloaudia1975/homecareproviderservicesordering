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
  if (u.endsWith('/auth/v1/user')) return okj({ id: 'u1' }); if (u.includes('/dealer_users?')) return okj([{ status: 'approved', dealer_id: 'd1' }]); if (u.includes('/dealers?')) return okj([{ state: 'KY' }]); throw new Error('unexpected ' + u); };
const H = require(API_FILE).handler;
const JS = path.join(__dirname, '..', 'public', 'assets', 'reimb.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }

async function page(browser, w) {
  const pg = await browser.newPage({ viewport: { width: w || 1280, height: 900 } });
  await pg.exposeFunction('__reimbApi', (b) => {
    if (b.action === 'meta') return Object.assign({ ok: true, today: '2026-11-19' }, R.meta('KY'));
    if (b.action === 'lookup') return R.lookup(b, { today: '2026-11-19' });
    if (b.action === 'product') return H({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(Object.assign({ dos: '2026-11-19' }, b)) }).then((r) => JSON.parse(r.body));
    return { ok: false, error: 'unknown' };
  });
  await pg.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}.card{border:1px solid #ddd;padding:12px;margin:10px}.btn{min-height:44px}</style></head>
    <body><div id="host"></div><div id="cardHost"></div></body></html>`);
  await pg.addScriptTag({ path: JS });
  await pg.evaluate(() => { window.__opened = []; window.API = (b) => window.__reimbApi(b); });
  return pg;
}
const mount = (pg, prefill) => pg.evaluate((pre) => window.HCPSReimb.mount(document.getElementById('host'), { api: window.API, prefill: pre, back: () => {} }), prefill || null);
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
      const pg = await page(browser); await mount(pg, { code: 'E0260', state: 'KY', plan: 'medicare', location: 'nonrural', dos: '2026-11-19', product: null }); await settle(pg);
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
      ok(/Original Medicare fee-for-service · Kentucky · Non-rural ZIP code · November 19, 2026/.test(txt), 'medicare row: ' + txt);
      ok(/Kentucky Medicaid fee-for-service · Kentucky · Any service location/.test(txt) && /\$91\.82/.test(txt), 'medicaid row');
      ok(/RR/.test(txt) && /Rental — one month/.test(txt) && (await pg.$$('#cardHost .pd-reimb-src a')).length >= 2, 'modifier, unit, two sources'); await pg.close();
    });
    await t('one payer without a rate keeps the other visible (Tennessee: Medicare rate + TennCare "Rate unavailable for this plan/date")', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [] }); await cardText(pg);
      await pg.selectOption('#cardHost select[data-k="state"]', 'TN'); await pg.waitForTimeout(400); const txt = await cardText(pg);
      const rowsTxt = await pg.$$eval('#cardHost .pd-reimb-row', (r) => r.map((x) => x.innerText));
      ok(/Original Medicare fee-for-service · Tennessee/.test(rowsTxt[0]) && /\$\d/.test(rowsTxt[0]), 'medicare amount: ' + rowsTxt[0]);
      ok(/Rate unavailable for this plan\/date/.test(txt), 'tenncare message'); await pg.close();
    });
    await t('the dealer changes date and Medicare location on the card', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [] }); await cardText(pg);
      await pg.selectOption('#cardHost select[data-k="mloc"]', 'rural'); await pg.waitForTimeout(300); let txt = await cardText(pg); ok(/Rural ZIP code/.test(txt) && /\$177\.16/.test(txt), 'rural');
      await pg.fill('#cardHost input[data-k="dos"]', '2027-02-01'); await pg.dispatchEvent('#cardHost input[data-k="dos"]', 'change'); await pg.waitForTimeout(300); txt = await cardText(pg);
      ok(/February 1, 2027/.test(txt) && (txt.match(/Rate unavailable for this plan\/date/g) || []).length === 2, 'no 2027 schedules → both rows unavailable'); await pg.close();
    });
    await t('Golden lift chair card: E0627 — electric seat-lift mechanism only, with the component made clear', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'Cloud Plus Luxe', code: 'PR525-MED', manufacturer: 'golden-technologies', category: 'Lift Chairs', cost: 1200 });
      const txt = await cardText(pg); ok(/HCPCS E0627 — electric seat-lift mechanism only/.test(txt) && /covers only the electric seat-lift mechanism/.test(txt) && /\$324\.15/.test(txt), txt.slice(0, 300)); await pg.close();
    });
    await t('cash-only Golden scooter, an unmatched suffix and a product without a code: "No verified HCPCS code on file for this model" with the reason', async () => {
      const pg = await page(browser);
      for (const [p, re] of [[{ name: 'BUZZ Extreme', code: 'GB118D', manufacturer: 'golden-technologies', category: 'Scooters' }, /cash scooter only/],
        [{ name: 'Buzzaround LT', code: 'GB107B', manufacturer: 'golden-technologies', category: 'Scooters' }, /GB107A/],
        [{ name: 'ErgoSteel', code: 'ES0001', manufacturer: 'strongback-mobility', category: 'Wheelchairs' }, /./]]) {
        await cardOf(pg, p); const txt = await cardText(pg); ok(txt.includes('No verified HCPCS code on file for this model') && re.test(txt), p.code + ': ' + txt.slice(0, 200)); }
      await pg.close();
    });
    await t('exact Dalton SKU: PM8080-1 → E0277 from the Dalton page; an unverified cushion stays unmapped with the PDAC reason', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'Low Air Loss', code: 'PM8080-1', manufacturer: 'dalton', category: 'Mattresses' });
      ok(/HCPCS E0277/.test(await cardText(pg)), 'E0277');
      await cardOf(pg, { name: 'Comfy Gel', code: 'PM-GG16163', manufacturer: 'dalton' }); const txt = await cardText(pg); ok(/No verified HCPCS code/.test(txt) && /PDAC/.test(txt), 'pdac'); await pg.close();
    });
    await t('card → lookup: the code, state and date travel; the dealer cost stays in the product for the calculator only', async () => {
      const pg = await page(browser); await cardOf(pg, { name: 'M50', code: '304051011', manufacturer: 'ohio-medical', sku_code: 'E1390', page_codes: [], cost: 445 }); await cardText(pg);
      await pg.click('#cardHost .pd-reimb-go'); const o = await pg.evaluate(() => window.__opened[0]);
      ok(o.code.code === 'E1390' && o.state === 'KY' && o.dos === '2026-11-19' && o.product.cost === 445, JSON.stringify(o).slice(0, 200)); await pg.close();
    });
    const calcRun = async (pg, pre, set) => { await mount(pg, pre); await settle(pg); await pg.waitForSelector('#rbCalc .rb-calc');
      for (const [k, v] of Object.entries(set || {})) { const sel = `#rbCalc [data-c="${k}"]`; if (k === 'idx') await pg.selectOption(sel, String(v)); else { await pg.fill(sel, String(v)); await pg.dispatchEvent(sel, 'change'); } }
      return pg.$eval('#rbCalc', (e) => e.innerText); };
    await t('calculator — M50 oxygen (Medicare KY): 36 paid months, 37–60 service period, 80/20 counted once, break-even month', async () => {
      const pg = await page(browser);
      const txt = await calcRun(pg, { code: 'E1390', state: 'KY', plan: 'medicare', location: 'nonrural', dos: '2026-11-19', product: { name: 'M50', code: '304051011', codes: [{ code: 'E1390' }], cost: 445 } });
      ok(/months 37–60/.test(txt) && /36 paid month\(s\) \+ 24 unpaid service month\(s\)/.test(txt), 'periods');
      ok(/Allowed amount over the period\s+\$3,607\.56/i.test(txt) && /Medicare pays \(80%\)\s+\$2,886\.05/i.test(txt) && /\$721\.51/.test(txt) && /Expected collections\s+\$3,607\.56/i.test(txt), 'split: ' + txt);
      ok(/Break-even\s+Month 5/i.test(txt) && /Estimated gross margin\s+\$3,162\.56 \(87\.7%\)/i.test(txt), 'margin/break-even');
      const half = await (async () => { await pg.fill('#rbCalc [data-c="coins"]', '50'); await pg.dispatchEvent('#rbCalc [data-c="coins"]', 'change'); return pg.$eval('#rbCalc', (e) => e.innerText); })();
      ok(/Expected collections\s+\$3,246\.80/i.test(half), '50% coinsurance collected'); await pg.close();
    });
    await t('calculator — E0260 hospital bed: 13-month capped rental and an early stop at month 6', async () => {
      const pg = await page(browser);
      let txt = await calcRun(pg, { code: 'E0260', state: 'KY', plan: 'medicare', location: 'nonrural', dos: '2026-11-19' }, { cost: '600' });
      ok(/Allowed amount over the period\s+\$820\.68/i.test(txt) && /months 1–3 at \$78\.16, months 4–13 at \$58\.62/.test(txt), '13 months: ' + txt.slice(0, 400));
      await pg.fill('#rbCalc [data-c="months"]', '6'); await pg.dispatchEvent('#rbCalc [data-c="months"]', 'change'); txt = await pg.$eval('#rbCalc', (e) => e.innerText);
      ok(/Allowed amount over the period\s+\$410\.34/i.test(txt) && /Break-even\s+Not reached/i.test(txt), 'early stop');
      ok(/Estimated gross margin\s+−\$189\.66 \(-46\.2%\)/i.test(txt) && !/\$-/.test(txt), 'a loss reads −$189.66'); await pg.close();
    });
    await t('calculator — Golden lift chair: mechanism-only, margin unavailable until the dealer enters the mechanism cost', async () => {
      const pg = await page(browser);
      let txt = await calcRun(pg, { code: 'E0627', state: 'KY', plan: 'medicare', location: 'nonrural', dos: '2026-11-19', product: { name: 'Cloud', code: 'PR525-MED', codes: [{ code: 'E0627', component: 'mechanism' }], cost: 1200 } });
      ok(/seat-lift mechanism only/.test(txt) && /Estimated gross margin\s+Unavailable/i.test(txt) && !/1,200/.test(txt), 'unavailable, full chair cost unused');
      await pg.fill('#rbCalc [data-c="cost"]', '150'); await pg.dispatchEvent('#rbCalc [data-c="cost"]', 'change'); txt = await pg.$eval('#rbCalc', (e) => e.innerText);
      ok(/Estimated gross margin\s+\$174\.15 \(53\.7%\)/i.test(txt), 'with component cost: ' + txt.slice(0, 500)); await pg.close();
    });
    await t('calculator — Medicaid rental defaults to 1 month with the not-modelled note; bad input never shows NaN or a negative', async () => {
      const pg = await page(browser);
      let txt = await calcRun(pg, { code: 'E1390', state: 'KY', plan: 'medicaid-ffs', dos: '2026-11-19' }, { cost: '445' });
      ok(/1 month\(s\), your estimate/.test(txt) && /not modelled/.test(txt) && /Medicaid pays\s+\$91\.82/i.test(txt), 'medicaid default: ' + txt.slice(0, 600));
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
      const pg = await page(browser); await calcRun(pg, { code: 'E0260', state: 'KY', plan: 'medicare', location: 'nonrural', dos: '2026-11-19' }, { cost: '600' });
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
      const pg = await page(browser, w); await mount(pg, { code: 'L4361', state: 'KY', plan: 'medicare', location: 'nonrural', dos: '2026-11-19' }); await settle(pg); await pg.waitForSelector('#rbOut section');
      const o = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        fs: [...document.querySelectorAll('#host input,#host select')].map((e) => parseFloat(getComputedStyle(e).fontSize)),
        h: [...document.querySelectorAll('#host input,#host select,#host .btn')].map((e) => e.getBoundingClientRect().height) }));
      ok(o.sw <= o.cw, 'overflow ' + o.sw + '>' + o.cw); ok(o.fs.every((x) => x >= 16), 'font ' + o.fs); ok(o.h.every((x) => x >= 44), 'height ' + o.h); await pg.close();
    });
  } finally { await browser.close(); }
  console.log(`\nreimbursement UI: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
