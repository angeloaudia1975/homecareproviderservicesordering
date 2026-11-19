/* Provider reimbursement lookup UI (owner 2026-11-19): the lookup view, the Shop Products card, both missing-data
   messages, the Print billing reference (links stay clickable in the PDF) and phone widths. The API is answered by the
   admin engine itself (REIMB_ENGINE=<admin repo>/netlify/functions/_reimb.js).
   PLAYWRIGHT_MODULE=… REIMB_ENGINE=… node test/reimb-ui.browser.js */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const R = require(process.env.REIMB_ENGINE || path.join(__dirname, '..', '..', 'adm', 'netlify', 'functions', '_reimb.js'));
const JS = path.join(__dirname, '..', 'public', 'assets', 'reimb.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }

async function page(browser, w) {
  const pg = await browser.newPage({ viewport: { width: w || 1280, height: 900 } });
  await pg.exposeFunction('__reimbApi', (b) => {
    if (b.action === 'meta') return Object.assign({ ok: true, today: '2026-11-19' }, R.meta('KY'));
    if (b.action === 'lookup') return R.lookup(b, { today: '2026-11-19' });
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
    await t('Shop Products card: coded model shows the plan-specific amount and opens the lookup with the code filled in', async () => {
      const pg = await page(browser);
      await pg.evaluate(() => window.HCPSReimb.card(document.getElementById('cardHost'), { api: window.API, product: { name: 'Gen 2 Walker Boot', code: '10007BLACK', codes: ['L4361'] }, open: (p) => window.__opened.push(p) }));
      await pg.waitForSelector('.pd-reimb-amt'); const txt = await pg.$eval('#cardHost', (e) => e.innerText);
      ok(/\$259\.40/.test(txt) && /Kentucky · Kentucky Medicaid fee-for-service/.test(txt) && /Service date November 19, 2026/.test(txt), txt);
      await pg.click('.pd-reimb-go'); const o = await pg.evaluate(() => window.__opened[0]);
      ok(o && o.code === 'L4361' && o.state === 'KY' && o.plan === 'medicaid-ffs' && o.product.code === '10007BLACK', JSON.stringify(o)); await pg.close();
    });
    await t('Shop Products card: an uncoded model says "No verified HCPCS code on file for this model"', async () => {
      const pg = await page(browser);
      await pg.evaluate(() => window.HCPSReimb.card(document.getElementById('cardHost'), { api: window.API, product: { name: 'ES0001', code: 'ES0001', codes: [] }, open: (p) => window.__opened.push(p) }));
      ok(await pg.$eval('.pd-reimb-miss', (e) => e.textContent) === 'No verified HCPCS code on file for this model', 'msg');
      await pg.click('.pd-reimb-go'); ok((await pg.evaluate(() => window.__opened[0])).product.noCode === true, 'opens with noCode'); await pg.close();
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
    await t('a model\'s codes: SKU code; a page code only when the page lists one; several page codes or a disagreement → no verified code, with the reason', () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
      const m = src.match(/function reimbCodesOf\(p\)\{[\s\S]*?\n\}/); ok(m, 'reimbCodesOf in index.html');
      const f = new Function(m[0] + '; return reimbCodesOf;')();
      ok(JSON.stringify(f({ hcpc: 'L4361' }).codes) === '["L4361"]', 'sku');
      ok(JSON.stringify(f({ _billing: ['L4361'] }).codes) === '["L4361"]', 'one page code');
      const multi = f({ _billing: ['L0627 / L0642'] }); ok(multi.codes.length === 0 && /several codes/.test(multi.why), 'several page codes');
      ok(JSON.stringify(f({ hcpc: 'L0642/L0627', _billing: ['L0627 / L0642'] }).codes) === '["L0642","L0627"]', 'sku dual code agrees with page');
      const c = f({ hcpc: 'L4397', _billing: ['L4396'] }); ok(c.codes.length === 0 && c.conflict && /different codes/.test(c.why), 'conflict');
    });
    await t('an uncoded card shows the reason under the exact message', async () => {
      const pg = await page(browser);
      await pg.evaluate(() => window.HCPSReimb.card(document.getElementById('cardHost'), { api: window.API, product: { name: 'Brace', code: 'X', codes: [], why: 'The product page lists several codes (L0627, L0642) for its models, and none is assigned to this model.' }, open: () => {} }));
      ok(/several codes/.test(await pg.$eval('#cardHost', (e) => e.innerText)), 'why'); await pg.close();
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
