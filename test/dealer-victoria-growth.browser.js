/* DEALER VICTORIA — nested destinations, Growth Advisor, local market and recent purchases on the REAL portal page (owner
   2026-11-22). The admin repo's own tool code (_dealer_victoria_tools.js) answers; the report reads are stubbed with SYNTHETIC
   figures; the model's choice of tool is scripted. At 1280 and 390:
   - "Take me to the Golden Tech service portal" → Resources & Support → Golden Service & Support, confirmed only once
     Troubleshoot is on screen, said once; with Golden service off for the account → "isn't available for your account";
   - "local referral sources" → Find local referral sources (confirmed when its screen is on); referral sources off → not available;
   - growth / local market / purchases cards show the location, period, source, the facts, both purchase sources apart,
     coverage gaps and the "not local" label; the selected Reports location is what Victoria asks about.
   ADMIN_REPO=… GOLDEN_REPO=… node test/dealer-victoria-growth.browser.js */
const path = require('path');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'adm');
const VT = require(path.join(ADM, 'netlify', 'functions', '_dealer_victoria_tools.js'));
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const GS = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog.js'));
const GDATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog-data.json'));
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const reportsSeen = [];
const deps = { reports: () => async (ev) => { const b = JSON.parse(ev.body); reportsSeen.push(b);
  const base = { ok: true, scope_name: 'TEST Sandbox Bowling Green', period: { label: 'Year to date 2026 (Jan–Nov)' }, company_figures: false, data_source: 'Home Care Provider Services dealer report (synthetic)' };
  if (b.action === 'report_ai') return { statusCode: 200, body: JSON.stringify(Object.assign(base, { source: 'ai', facts: [{ id: 'mfr0', text: 'Sample Mobility: $4,200.00, last year $3,100.00' }],
    recommendations: [{ title: 'Build on Sample Mobility', detail: 'Purchases are up on last year.', refs: ['mfr0'] }] })) };
  if (b.action === 'local_market') return { statusCode: 200, body: JSON.stringify(Object.assign(base, { market: { branch: { name: 'TEST Sandbox Bowling Green' }, radius_miles: 25, zip_areas: [1], population: { estimate: 180000 }, households: { estimate: 70000 },
    age: { a65p: { estimate: 27000, pct: 15 }, a75p: { pct: 6.1 } }, income: { median: 54000 }, source: { acs: 'U.S. Census Bureau, American Community Survey 2019–2023 5-year estimates', year: 2023 } }, recommendations: [{ title: 'Older adults nearby', detail: 'About 15% are 65 or older (Census 2019–2023).' }] })) };
  if (b.action === 'recent_purchases') return { statusCode: 200, body: JSON.stringify(Object.assign(base, { from: '2026-08-22', to: '2026-11-22', months: 3,
    portal_orders: [{ manufacturer: 'Sample Mobility', code: 'SM-100', name: 'Sample walker', qty: 2, dates: ['2026-10-03'] }],
    manufacturer_reported: [{ manufacturer: 'Sample Rehab', code: 'SR-9', name: 'Sample chair', qty: 3, dates: ['2026-09-12'] }],
    coverage: [{ manufacturer: 'Sample Rehab', reported_through: '2026-09', note: 'purchases after 2026-09 appear once Sample Rehab reports them' }],
    opportunities: [{ manufacturer: 'Sample Mobility', code: 'SM-200', name: 'Sample rollator', category: 'Walking', basis: 'bought by other Home Care Provider Services dealers in the past 12 months — not local evidence' }],
    note: 'Portal orders and manufacturer-reported purchases are listed separately and never added.' })) };
  return { statusCode: 400, body: '{}' }; } };
const SCRIPT = [
  [/golden tech service/i, 'open_portal_tool', { view: 'goldsvc' }],
  [/referral sources/i, 'open_portal_tool', { view: 'referrals' }],
  [/growth suggestions/i, 'growth_advisor', {}],
  [/local market/i, 'local_market', {}],
  [/last three months/i, 'recent_purchases', { months: 3 }],
];

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label, golden, referrals] of [[1280, 800, 'desktop', true, true], [390, 844, 'phone', true, true], [1280, 800, 'desktop (Golden service off, referrals off)', false, false]]) {
      const { ctx, page } = await open(b, w, h, {});
      const asks = [];
      await page.route('**/functions/golden-proxy', async (route) => { const x = JSON.parse(route.request().postData() || '{}');
        let body = { ok: true, enabled: false, reason: 'off' };
        if (golden && x.action === 'service_catalog') body = Object.assign({ ok: true, enabled: true, available: true, as_of: '2026-11-13T10:00:00Z' }, GS.build(GDATA, { seePrices: false, linked: true }));
        return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      await page.route('**/referral-sources-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(referrals
        ? { ok: true, enabled: true, source: { url: 'https://data.cms.gov/x' }, release: { data_year: 2024, version: 'v10', label: 'claims year 2024', live_since: '2026-11-21T07:00:00Z' }, location: { id: 'd1', name: 'TEST', zip: '42101' }, locations: [{ id: 'd1', name: 'TEST', zip: '42101' }] }
        : { ok: true, enabled: false }) }));
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body = { ok: true };
        if (x.action === 'status') body = { ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', available: false }, ai: { available: true }, support: { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us' }, conversation: { available: false } };
        else if (x.action === 'hello') body = { ok: true, enabled: true, greeting: 'Hi, Ann. How can I help you today?' };
        else if (x.action === 'ask') { asks.push(x); const s = SCRIPT.find(([re]) => re.test(x.question));
          const out = s ? await VT.RUN[s[1]]({ dealer_id: 'd1', bearer: 'Bearer tok', page: x.page || {} }, deps, s[2]) : { result: {} };
          body = { ok: true, answer: 'Here you go.', speech_parts: [], cards: out.card ? [out.card] : [], actions: [].concat(out.actions || [], out.action ? [out.action] : []) }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      await page.evaluate(() => { window.__PREVIEW__ = null; if (!AUTH.session) AUTH.session = { access_token: 'tok' }; GSVCP = null; window.needsAccess = () => false; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; });
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost'), null, { timeout: 15000 });
      const S = (fn, a) => page.evaluate(([f, x]) => (new Function('s', 'x', f))(document.getElementById('dvPanelHost') && document.getElementById('dvPanelHost').shadowRoot, x), [fn, a]);
      const openPanel = async () => { await page.evaluate(() => { const hh = document.getElementById('dvPanelHost'); if (!hh || hh.shadowRoot.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
        await page.waitForFunction(() => { const hh = document.getElementById('dvPanelHost'); return hh && !hh.shadowRoot.querySelector('.p').hidden; }, null, { timeout: 10000 }); };
      const cards = () => S("return [...s.querySelectorAll('.log .card')].map(c=>c.textContent.replace(/\\s+/g,' ').trim());");
      const ask = async (q, wait) => { await openPanel(); const n = asks.length; await S("s.querySelector('.ask input').value=x; s.querySelector('.go').click();", q);
        for (let i = 0; i < 40 && asks.length <= n; i++) await page.waitForTimeout(100); await page.waitForTimeout(wait || 900); };
      await openPanel(); await page.waitForTimeout(600);

      await ask('Take me to the Golden Tech service portal.', 4000);
      const c1 = await cards(); const g1 = await page.evaluate(() => { const hh = document.getElementById('gsvHost'); const R = hh && hh.shadowRoot; const tr = R && R.getElementById('tab-troubleshoot'); return { active: state.active, troubleshoot: !!(tr && tr.getBoundingClientRect().height > 0) }; });
      const confirms = c1.filter((x) => /Golden Service & Support/.test(x));
      if (golden) await t(`${label}: "Take me to the Golden Tech service portal" → Golden Service & Support open on Troubleshoot, confirmed once (✓)`, () => ok(g1.active === 'p360:goldsvc' && g1.troubleshoot && confirms.length === 1 && /^✓ Golden Service & Support is open on Troubleshoot/.test(confirms[0]), JSON.stringify({ g1, confirms })));
      else await t(`${label}: Golden service off for the account → "isn't available for your account" (✗), no dead screen`, () => ok(confirms.length === 1 && /^✗ Golden Service & Support isn't available for your account/.test(confirms[0]) && g1.active !== 'p360:goldsvc', JSON.stringify({ g1, confirms })));

      await ask('Open my local referral sources', 3500);
      const c2 = await cards(); const r2 = await page.evaluate(() => ({ active: state.active, rf: !!document.querySelector('#view-referrals .rf') }));
      const rc = c2.filter((x) => /referral sources/i.test(x));
      if (referrals) await t(`${label}: "local referral sources" → Find local referral sources open (✓ once it is on screen)`, () => ok(r2.active === 'p360:referrals' && r2.rf && rc.length === 1 && /^✓/.test(rc[0]), JSON.stringify({ r2, rc })));
      else await t(`${label}: referral sources not enabled → not available (✗)`, () => ok(rc.length === 1 && /^✗ .*isn't available for your account/.test(rc[0]), JSON.stringify({ r2, rc })));

      if (golden) {
        reportsSeen.length = 0;
        await page.evaluate(() => { showP360('reports'); });
        await page.waitForTimeout(1500);
        /* the Reports location picker as the dealer sees it (head office): Bowling Green selected */
        await page.evaluate(() => { const v = document.getElementById('view-reports'); const s = document.createElement('select'); s.setAttribute('aria-label', 'Company or location');
          s.innerHTML = '<option value="company">All locations</option><option value="11111111-1111-4111-8111-111111111111" selected>TEST Sandbox Bowling Green</option>'; v.prepend(s); });
        await ask('Give me your AI growth suggestions for my location.');
        const c3 = await cards();
        await t(`${label}: growth suggestions card — location, period, the fact behind the suggestion and the source; Victoria asked about the selected location`, () => ok(c3.some((x) => /Build on Sample Mobility/.test(x) && /TEST Sandbox Bowling Green/.test(x) && /Year to date 2026/.test(x) && /\$4,200\.00/.test(x)) && c3.some((x) => /^Source: Home Care Provider Services dealer report/.test(x)) && reportsSeen[0] && reportsSeen[0].scope === '11111111-1111-4111-8111-111111111111', JSON.stringify({ last: c3.slice(-3), seen: reportsSeen[0] })));
        await ask('And my local market?');
        const c4 = await cards();
        await t(`${label}: local market card — population, 65+, Census source with its years`, () => ok(c4.some((x) => /Local market · TEST Sandbox Bowling Green/.test(x) && /180,000/.test(x) && /2019–2023/.test(x)), JSON.stringify(c4.slice(-3))));
        await ask('List the products I’ve ordered in the last three months.');
        const c5 = await cards();
        await t(`${label}: purchases card — exact dates, portal and manufacturer-reported apart, coverage gap, opportunities "not local"`, () => ok(c5.some((x) => /Purchases Aug 22, 2026 – Nov 22, 2026|Purchases .*2026 – .*2026/.test(x)) && c5.some((x) => /^Ordered in the portal/.test(x) && /SM-100/.test(x)) && c5.some((x) => /^Reported by manufacturers/.test(x) && /SR-9/.test(x))
          && c5.some((x) => /Not reported yet: Sample Rehab \(through 2026-09\)/.test(x)) && c5.some((x) => /Could interest your customers/.test(x) && /not local data/.test(x)) && c5.some((x) => /never added together/.test(x)), JSON.stringify(c5.slice(-7))));
      }
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      await t(`${label}: no sideways scroll`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\ndealer victoria growth & destinations: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
