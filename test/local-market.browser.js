/* YOUR LOCAL MARKET — the REAL storefront page (_shop-harness.js; nothing reaches HCPS, Supabase or census.gov). The report and
   the local_market answer are built by the admin repo's REAL code (_dealer_report.js, _local_market.js) from synthetic data.
   At 390 / 768 / 1280 px: nothing is fetched until asked; the button loads the 25-mile profile (tiles, map, age / sex /
   income bars, three suggestions with "Your HCPS activity" vs "Census estimate" tags, sources + limits, ZIP list); text is
   escaped; "not connected yet" is shown plainly; no horizontal scroll; 44 px targets on phones.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… node test/local-market.browser.js */
const path = require('path');
const { chromium, open } = require('./_shop-harness.js');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const REP = require(path.join(ADM, 'netlify', 'functions', '_dealer_report.js'));
const LM = require(path.join(ADM, 'netlify', 'functions', '_local_market.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const Y = new Date().getFullYear(), TODAY = `${Y}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15`;
const locations = [{ id: 'br', name: 'Acme Branch', city: 'Xenia' }];
const report = REP.build({ year: String(Y), today: TODAY, locations, scope: 'br', sales: [], orders: [{ id: 'golden:G-SO1', dealer_id: 'br', manufacturer: 'golden-technologies', status: 'placed', submitted_at: `${Y}-01-20T12:00:00Z`, subtotal: 900, channel: 'golden', items: [{ code: 'PR447', name: 'Lift chair', qty: 1, unit_price: 900, line_total: 900 }] }], quotes: [], catalog: {}, resolve: () => null, mfrName: {}, reportedMonths: {}, network: [] });
const C0 = { lat: 36.8656, lng: -87.4886 };
const zs = Array.from({ length: 16 }, (_, i) => ({ attributes: { ZCTA5: String(42200 + i), INTPTLAT: String(C0.lat + (i % 4 - 1.5) * 0.08), INTPTLON: String(C0.lng + (Math.floor(i / 4) - 1.5) * 0.1) } }));
const VARS = LM.variables();
const rows = (suf, v) => [VARS.map((x) => x + suf).concat(['zip code tabulation area'])].concat(zs.map((z, i) => VARS.map((_, j) => String(v(i, j))).concat([z.attributes.ZCTA5])));
let MARKET;
async function market() {
  if (MARKET) return MARKET;
  const p = await LM.build({ center: C0, key: 'k', fetchJson: async (u) => (/tigerweb/.test(u) ? { features: zs } : /_001M/.test(decodeURIComponent(u)) ? rows('M', () => 20) : rows('E', (i, j) => (j === 0 ? 1000 + i * 150 : j === 1 ? 400 + i * 50 : j === 2 ? 480 + i * 70 : j === 3 ? 520 + i * 80 : 10 + i))) });
  const m = Object.assign({}, p, { branch: { id: 'br', name: 'Acme <b>Branch</b>', address: '9 Elm St, Xenia, OH 45385', company_view: false }, approx_location: false });
  MARKET = { market: m, recommendations: LM.recommendations(m, { authorized_unused: ['Dalton Medical'], storefront: 'none', social_ads: 0, academy_learners: 0 }, 'Acme Branch') };
  return MARKET;
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const st = { calls: [], noKey: false };
      const { ctx, page } = await open(browser, w, h, {});
      await page.route('**/functions/dealer-reports-api', async (route) => {
        const b = JSON.parse(route.request().postData() || '{}'); st.calls.push(b.action);
        const reply = (o, s) => route.fulfill({ status: s || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
        if (b.action === 'report') return reply({ ok: true, report, locations, head_office: false, scope: 'br', scope_name: 'Acme Branch' });
        if (b.action === 'local_market') return st.noKey ? reply({ ok: false, code: 'census_key_missing', error: 'Local market data is not connected yet — HCPS is setting it up.' }, 503) : reply(Object.assign({ ok: true }, await market()));
        return reply({ ok: false }, 400);
      });
      await page.evaluate(() => { PREVIEW = null; window.__PREVIEW__ = null; showP360('reports'); });
      await page.waitForFunction(() => document.getElementById('rptLmBox'), null, { timeout: 20000 });
      await t(label + ': offered, not fetched until asked', () => ok(!st.calls.includes('local_market'), 'fetched on load'));
      await t(label + ': a Golden order (Golden history) shows at once: Orders placed counts it, Last order says Golden, on order $900', async () => {
        const tx = await page.evaluate(() => document.querySelector('#view-reports').textContent);
        ok(/Orders placed\s*1/.test(tx) && /1 Golden, 0 portal/.test(tx), 'orders tile'); ok(/Last order \d{4}-01-20 \(Golden\)/.test(tx), 'last order'); ok(/Purchases \+ on order\s*\$900/.test(tx), 'on order');
        ok(/a Golden order from the day Golden books it/.test(tx), 'explainer'); });
      st.noKey = true; await page.evaluate(() => rptLocal()); await page.waitForFunction(() => /not connected yet/.test(document.getElementById('rptLmBox').textContent) && !/Loading Census/.test(document.getElementById('rptLmBox').textContent), null, { timeout: 10000 });
      await t(label + ': no Census key → a plain "not connected yet" message', async () => { const x = await page.evaluate(() => document.getElementById('rptLmBox').textContent); ok(/not connected yet/.test(x), 'message: ' + x.slice(0, 200)); });
      st.noKey = false; await page.evaluate(() => rptLocal()); await page.waitForFunction(() => document.querySelector('#rptLmBox .lm-map') && document.querySelector('#rptLmBox .lm-tiles') && !/Loading Census/.test(document.getElementById('rptLmBox').textContent), null, { timeout: 10000 });
      const r = await page.evaluate(() => { const b = document.getElementById('rptLmBox'); const vis = (e) => e.getBoundingClientRect().height > 0;
        return { txt: b.textContent, dots: b.querySelectorAll('.lm-map circle').length, recs: b.querySelectorAll('.rpt-ai').length, me: b.querySelectorAll('.lm-tag.me').length, es: b.querySelectorAll('.lm-tag.es').length,
          bold: !!b.querySelector('b b'), over: document.documentElement.scrollWidth - window.innerWidth,
          small: [...b.querySelectorAll('.btn, summary')].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.trim().slice(0, 20)) }; });
      await t(label + ': the profile — tiles, map with every ZIP area, age / sex / income, 3 suggestions tagged measured vs estimated', () => {
        ok(/People/.test(r.txt) && /Households/.test(r.txt) && /Aged 65\+/.test(r.txt) && /Median household income/.test(r.txt), 'tiles');
        ok(r.dots === 16 + 2, 'dots ' + r.dots); ok(/55–64/.test(r.txt) && /Female/.test(r.txt) && /\$150,000 or more/.test(r.txt), 'bars');
        ok(r.recs >= 3 && r.es === 3 && r.me >= 1, JSON.stringify([r.recs, r.me, r.es])); ok(/Acme <b>Branch<\/b>/.test(r.txt) && !r.bold, 'escaped');
      });
      await t(label + ': sources, data years and limits are on the page', async () => {
        await page.evaluate(() => document.querySelectorAll('#rptLmBox details').forEach((d) => { d.open = true; }));
        const tx = await page.evaluate(() => document.getElementById('rptLmBox').innerText);
        ok(/American Community Survey 2020–2024 5-year/.test(tx) && /TIGERweb/.test(tx) && /not a published Census figure/.test(tx) && /not a forecast of sales/.test(tx), 'sources'); ok(/Nearby ZIP areas \(16\)/.test(tx) && /422\d\d\s+\d/.test(tx), 'ZIP list');
      });
      await t(label + ': no horizontal scroll' + (w < 761 ? '; 44 px targets' : ''), () => { ok(r.over <= 1, 'overflow ' + r.over); if (w < 761) ok(!r.small.length, JSON.stringify(r.small)); });
      if (w === 390 || w === 1280) await (await page.$('#rptLmBox')).screenshot({ path: path.join(process.env.SHOTS || '/tmp', `local-market-${label}.png`) });
      await ctx.close();
    }
  } catch (e) { fail++; console.log('FAIL harness\n     ' + String(e && e.stack).slice(0, 600)); }
  await browser.close();
  console.log(`local market browser: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
