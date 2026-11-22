/* DEALER VICTORIA — "Help me build my storefront from my top products. Write a company introduction." → "use that", on the REAL
   portal page (owner 2026-11-22). The admin repo's own tool code answers; storefront and report reads are SYNTHETIC; the
   model's choice of tool is scripted. At 1280 and 390:
   - the plan card shows the location, dates, lines and categories first, top products, excluded lines and the copy;
   - "use that" puts the headline, introduction, lines and categories into the Storefront builder on screen — the dealer's
     other settings (hours, phone, other lines) are kept, hidden categories of the plan are shown again — and is confirmed
     (✓) once the builder shows it; NOTHING is saved or published (no sf_save request);
   - a location the dealer can't edit → ✗ "Only your head office…"; "use that" with no plan → ✗.
   ADMIN_REPO=… node test/dealer-victoria-storefront.browser.js */
const path = require('path');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'adm');
const VT = require(path.join(ADM, 'netlify', 'functions', '_dealer_victoria_tools.js'));
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 600)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const LOC = '11111111-1111-4111-8111-111111111111', BR = '22222222-2222-4222-8222-222222222222';
const SF = () => ({ ok: true, head_office: true, preview: false, base: 'https://example.invalid/store/', locations: [
  { id: LOC, name: 'TEST Sandbox', city: 'Batesville', state: 'IN', is_self: true, can_edit: true, live: false, design_ready: true, themes: { blue: { name: 'Professional Blue', primary: '#0b2f5b', accent: '#c2410c' } }, highlights: {},
    lines: [{ slug: 'dalton', name: 'Dalton Medical' }, { slug: 'strongback', name: 'Strongback Mobility' }, { slug: 'bemis', name: 'Bemis' }],
    all_lines: [{ slug: 'dalton', name: 'Dalton Medical', eligible: true }, { slug: 'strongback', name: 'Strongback Mobility', eligible: true }, { slug: 'bemis', name: 'Bemis', eligible: true }],
    storefront: { slug: 'test-sandbox', enabled: false, headline: 'Old headline', about: 'Old introduction.', hours: 'Mon 9-5', phone: '555-0100', lines: ['bemis'], hidden_categories: ['Wheelchairs', 'Bath Safety'], design: { layout: 'professional', theme: 'blue' }, version: 3 },
    logo: { url: null }, link: null },
  { id: BR, name: 'TEST Sandbox Branch', city: 'Bowling Green', state: 'KY', is_self: false, can_edit: false, live: false, design_ready: true, themes: {}, highlights: {},
    lines: [{ slug: 'dalton', name: 'Dalton Medical' }], all_lines: [{ slug: 'dalton', name: 'Dalton Medical', eligible: true }], storefront: null, logo: { url: null }, link: null }] });
const RP = { ok: true, from: '2025-11-22', to: '2026-11-22', months: 12, data_source: 'Home Care Provider Services dealer report (synthetic)',
  portal_orders: [{ manufacturer: 'Dalton Medical', slug: 'dalton', code: 'AKN411AR', name: 'Knee walker', category: 'Walking Mobility', qty: 4, dates: ['2026-10-03'] }],
  manufacturer_reported: [{ manufacturer: 'Strongback Mobility', slug: 'strongback', code: 'SB-1', name: 'Lightweight chair', category: 'Wheelchairs', qty: 3, dates: ['2026-09-12'] },
    { manufacturer: 'Golden Technologies', slug: 'golden-technologies', code: 'PR-1', name: 'Lift chair', category: null, qty: 6, dates: ['2026-09-01'] }], coverage: [], opportunities: [] };
const reads = [];
const deps = {
  storefront: () => async () => ({ statusCode: 200, body: JSON.stringify(SF()) }),
  reports: () => async (ev) => { const b = JSON.parse(ev.body); reads.push(b); return { statusCode: 200, body: JSON.stringify(RP) }; } };
const COPY = { headline: 'Mobility and walking aids in Batesville', about: 'TEST Sandbox in Batesville, IN carries Dalton Medical and Strongback Mobility, including walking mobility and wheelchairs. Call us or send a request from any product page.' };
const SCRIPT = [
  [/build my storefront/i, 'storefront_plan', COPY],
  [/^use that/i, 'apply_storefront_plan', {}],
];

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, {});
      const saves = [];
      await page.route('**/dealer-storefront-api', async (r) => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
        const x = JSON.parse(r.request().postData() || '{}'); let body = { ok: true };
        if (x.action === 'sf_get') body = SF(); else if (x.action === 'sf_inquiries') body = { ok: true, inquiries: [] };
        else if (x.action === 'sf_categories') body = { ok: true, categories: [{ manufacturer: 'dalton', line: 'Dalton Medical', category: 'Walking Mobility', count: 3, shown: 3 }, { manufacturer: 'strongback', line: 'Strongback Mobility', category: 'Wheelchairs', count: 2, shown: 0 }, { manufacturer: 'bemis', line: 'Bemis', category: 'Bath Safety', count: 2, shown: 0 }] };
        else if (x.action === 'sf_preview') body = { ok: true, preview: true, dealer: { name: 'TEST Sandbox' }, lines: [], products: [] };
        else if (x.action === 'sf_save') { saves.push(x); body = { ok: false, error: 'should not be called' }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body = { ok: true };
        if (x.action === 'status') body = { ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', available: false }, ai: { available: true }, support: { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us' }, conversation: { available: false } };
        else if (x.action === 'hello') body = { ok: true, enabled: true, greeting: 'Hi, Ann. How can I help you today?' };
        else if (x.action === 'ask') { const s = SCRIPT.find(([re]) => re.test(x.question));
          const out = s ? await VT.RUN[s[1]]({ dealer_id: LOC, bearer: 'Bearer tok', question: x.question, page: x.page || {} }, deps, s[2]) : { result: {} };
          body = { ok: true, answer: s && s[1] === 'storefront_plan' ? 'Here is a plan from your top products.' : 'Putting it into the builder.', speech_parts: [], cards: out.card ? [out.card] : [], actions: [].concat(out.actions || [], out.action ? [out.action] : []) }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      await page.evaluate(() => { window.__PREVIEW__ = null; if (!AUTH.session) AUTH.session = { access_token: 'tok' }; window.needsAccess = () => false; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; });
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost'), null, { timeout: 15000 });
      const S = (fn, a) => page.evaluate(([f, x]) => (new Function('s', 'x', f))(document.getElementById('dvPanelHost') && document.getElementById('dvPanelHost').shadowRoot, x), [fn, a]);
      const openPanel = async () => { await page.evaluate(() => { const hh = document.getElementById('dvPanelHost'); if (!hh || hh.shadowRoot.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
        await page.waitForFunction(() => { const hh = document.getElementById('dvPanelHost'); return hh && !hh.shadowRoot.querySelector('.p').hidden; }, null, { timeout: 10000 }); };
      const cards = () => S("return [...s.querySelectorAll('.log .card')].map(c=>c.textContent.replace(/\\s+/g,' ').trim());");
      const ask = async (q, wait) => { await openPanel(); await S("s.querySelector('.ask input').value=x; s.querySelector('.go').click();", q); await page.waitForTimeout(wait || 2500); };
      await openPanel(); await page.waitForTimeout(500);

      await ask('use that', 2000);
      const c0 = await cards();
      await t(`${label}: "use that" with no plan → ✗ ask for a plan first`, () => ok(c0.some((x) => /^✗ Ask me for a storefront plan first/.test(x)), JSON.stringify(c0)));

      reads.length = 0;
      await ask('Help me build my storefront from my top products. Write a company introduction.', 2500);
      const c1 = await cards();
      await t(`${label}: plan card — location, dates, lines and categories first, top products, excluded Golden, the copy; nothing saved`, () => ok(
        c1.some((x) => /Storefront plan · TEST Sandbox · Batesville/.test(x) && /2025-11-22 – 2026-11-22/.test(x) && /Lines first: Dalton Medical, Strongback Mobility/.test(x) && /Categories first: Walking Mobility, Wheelchairs/.test(x) && /AKN411AR/.test(x) && /Not shown: Golden Technologies/.test(x))
        && c1.some((x) => /Mobility and walking aids in Batesville/.test(x) && /carries Dalton Medical and Strongback Mobility/.test(x) && /Nothing is saved/.test(x)) && reads.some((r) => r.action === 'recent_purchases' && r.months === 12), JSON.stringify(c1.slice(-3))));

      await page.evaluate(() => showP360('storefront')); await page.waitForFunction(() => document.getElementById('sfHours'), null, { timeout: 15000 });
      await page.evaluate(() => { const h = document.getElementById('sfHours'); h.value = 'Mon–Fri 9–5 (typed, unsaved)'; h.dispatchEvent(new Event('input', { bubbles: true })); });
      await ask('use that', 3500);
      const c2 = await cards();
      const st = await page.evaluate(() => ({ head: document.getElementById('sfHead').value, about: document.getElementById('sfAbout').value, hours: document.getElementById('sfHours').value, phone: document.getElementById('sfPhone').value,
        lines: [...document.querySelectorAll('.sf-line:checked')].map((x) => x.value), order: [...document.querySelectorAll('.sfx-lns li')].map((x) => x.dataset.line), cats: [...document.querySelectorAll('.sfx-cats li.sfx-cat')].map((x) => [x.dataset.cat, !x.classList.contains('off')]), active: state.active }));
      await t(`${label}: "use that" → the builder shows the plan (✓), the dealer's typed hours, phone and Bemis line kept; hidden plan category shown; Bath Safety still hidden`, () => ok(
        c2.some((x) => /^✓ The plan is in your Storefront builder for TEST Sandbox/.test(x) && /Nothing is saved or published until you press Save or Publish/.test(x))
        && st.head === 'Mobility and walking aids in Batesville' && /carries Dalton Medical/.test(st.about) && st.hours === 'Mon–Fri 9–5 (typed, unsaved)' && st.phone === '555-0100'
        && ['bemis', 'dalton', 'strongback'].every((x) => st.lines.includes(x)) && st.order[0] === 'dalton' && st.order[1] === 'strongback'
        && st.cats[0][0] === 'Walking Mobility' && st.cats[1][0] === 'Wheelchairs' && st.cats[1][1] === true && st.cats.some((c) => c[0] === 'Bath Safety' && c[1] === false) && st.active === 'p360:storefront', JSON.stringify({ st, c2: c2.slice(-2) })));
      await t(`${label}: nothing saved or published`, () => ok(saves.length === 0, JSON.stringify(saves)));

      /* the branch is read-only for this login */
      const r3 = await page.evaluate((id) => DV.storefrontApply({ location_id: id, headline: 'x', about: 'y', lines: [], categories: [] }), BR);
      await t(`${label}: a location this login can't edit → refused with the head-office message`, () => ok(r3 && r3.ok === false && /Only your head office/.test(r3.message), JSON.stringify(r3)));
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      await t(`${label}: no sideways scroll`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\ndealer victoria storefront: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
