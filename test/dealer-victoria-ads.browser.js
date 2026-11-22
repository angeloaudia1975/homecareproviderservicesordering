/* DEALER VICTORIA — "Create a Facebook ad for a g p three zero nine" → "use the second one", on the REAL portal page with the
   REAL Social Marketing Studio (ad-builder.js) (owner 2026-11-22). The admin repo's own tool code answers; the ads server is
   played locally with SYNTHETIC data (no AI, nothing saved anywhere real); the model's choice of tool is scripted. At 1280
   and 390:
   - GP309 resolves exactly; Social Media Advertising opens; the Studio's own Create 3 designs runs for Facebook; Victoria's ✓
     says how many designs were SAVED to the private Creative Library (from the Studio's own save answers), nothing posted;
   - "use the second one" opens design 2 in the editor (✓); no post / schedule request is ever made;
   - a failed save is reported as not saved (✗), never as saved; a product the location can't advertise → nothing made.
   ADMIN_REPO=… node test/dealer-victoria-ads.browser.js */
const path = require('path');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'adm');
const VT = require(path.join(ADM, 'netlify', 'functions', '_dealer_victoria_tools.js'));
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 700)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const LOC = '11111111-1111-4111-8111-111111111111';
const P = { manufacturer: 'golden-technologies', code: 'GP309', name: 'Synthetic Power Chair', category: 'Power Chairs', brand: 'Golden Technologies', description: 'Synthetic.', image: '/x.jpg', price: 1999, price_label: 'MSRP', price_unit: null };
const CTX = (o) => Object.assign({ ok: true, preview: false, head_office: true, can_edit: true, blocked: false, location_id: LOC, locations: [{ id: LOC, name: 'TEST Sandbox', city: 'Batesville', can_edit: true }],
  dealer: { name: 'TEST Sandbox', address: '1 Sample St.', city: 'Batesville', state: 'IN', phone: '555-0100', website: '', has_logo: false }, products: [P, Object.assign({}, P, { code: 'GP3090', name: 'Other item' })], lines: [],
  brand: { primary: '#0b1f33', accent: '#ef6325', source: 'default' },
  templates: { 'st-ai-premium': { kind: 'single', label: 'AI Premium', studio: true }, 'st-ai-lifestyle': { kind: 'single', label: 'AI Lifestyle', studio: true }, 'st-ai-features': { kind: 'single', label: 'AI Features', studio: true }, 'st-spotlight': { kind: 'single', label: 'Spotlight', studio: true } },
  formats: { square: { w: 1080, h: 1080, label: 'Square' }, portrait: { w: 1080, h: 1350, label: 'Portrait' }, story: { w: 1080, h: 1920, label: 'Story' }, landscape: { w: 1200, h: 628, label: 'Landscape' } },
  fonts: ['Inter'], ctas: ['Ask about this product'], limits: {}, publishing: { enabled: false } }, o || {});
const AD = { template: 'st-ai-premium', format: 'square', products: [{ manufacturer: P.manufacturer, code: P.code, show_price: true }], headline: 'Ride Further, Every Day.', subheadline: 'A power chair.', body: '', features: ['Compact base'], cta: 'Ask about this product',
  caption: 'Ask TEST Sandbox about the Synthetic Power Chair.', captions: { facebook: 'Ask TEST Sandbox about the Synthetic Power Chair.' }, hashtags: [], show: { logo: false, name: true, address: true, phone: true, website: true, price: true } };
const SCRIPT = [[/facebook ad for/i, 'facebook_ad', { code: 'GP309' }], [/second one/i, 'pick_ad_design', { number: 2 }], [/ad for the zz/i, 'facebook_ad', { code: 'ZZ1' }]];

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, {});
      const calls = []; const saved = []; let failSaves = 0;
      await page.route('**/dealer-ads-api', async (r) => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
        const x = JSON.parse(r.request().postData() || '{}'); calls.push(x); let body = { ok: true };
        if (x.action === 'ads_context') body = CTX();
        else if (x.action === 'ads_list') body = { ok: true, ads: saved.map((s) => ({ id: s.id, dealer_id: LOC, title: s.ad.title, template: s.ad.template, format: s.ad.format, updated_at: new Date().toISOString() })) };
        else if (x.action === 'ads_save') { if (failSaves > 0) { failSaves--; body = { ok: false, error: 'The library could not be reached just now.' }; } else { const id = 'a' + (saved.length + 1); saved.push({ id, ad: x.ad, key: x.save_key }); body = { ok: true, row: { id, version: 1, dealer_id: LOC } }; } }
        else if (x.action === 'ads_ai') body = { ok: true, ad: Object.assign({}, AD, { format: x.format }), alt_headlines: ['Go Further.', 'Ride Easy.'], why: [], products: [P] };
        else if (x.action === 'ads_check') body = { ok: true, products: [P] };
        else if (x.action === 'ad_image' || x.action === 'ad_cutout' || x.action === 'ad_scene' || x.action === 'ad_brand_logo') body = { ok: true, status: 'removed', data_url: PX };
        else if (x.action === 'library_list') body = { ok: true, creatives: [] };
        else if (x.action === 'social_status') body = { ok: true, accounts: [], posts: [] };
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      const deps = { ads: () => async (ev) => ({ statusCode: 200, body: JSON.stringify(CTX()) }) };
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body = { ok: true };
        if (x.action === 'status') body = { ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', available: false }, ai: { available: true }, support: { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us' }, conversation: { available: false } };
        else if (x.action === 'hello') body = { ok: true, enabled: true, greeting: 'Hi, Ann.' };
        else if (x.action === 'ask') { const s = SCRIPT.find(([re]) => re.test(x.question));
          const out = s ? await VT.RUN[s[1]]({ dealer_id: LOC, bearer: 'Bearer tok', question: x.question, page: x.page || {} }, deps, s[2]) : { result: {} };
          body = { ok: true, answer: out.action ? 'Making those now.' : 'That product isn\'t one this location can advertise.', speech_parts: [], cards: out.card ? [out.card] : [], actions: [].concat(out.action ? [out.action] : []) }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
      await page.evaluate(() => { window.__PREVIEW__ = null; if (!AUTH.session) AUTH.session = { access_token: 'tok' }; window.needsAccess = () => false; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; });
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost'), null, { timeout: 15000 });
      const S = (fn, a) => page.evaluate(([f, x]) => (new Function('s', 'x', f))(document.getElementById('dvPanelHost') && document.getElementById('dvPanelHost').shadowRoot, x), [fn, a]);
      const openPanel = async () => { await page.evaluate(() => { const hh = document.getElementById('dvPanelHost'); if (!hh || hh.shadowRoot.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
        await page.waitForFunction(() => { const hh = document.getElementById('dvPanelHost'); return hh && !hh.shadowRoot.querySelector('.p').hidden; }, null, { timeout: 10000 }); };
      const cards = () => S("return [...s.querySelectorAll('.log .card')].map(c=>c.textContent.replace(/\\s+/g,' ').trim());");
      const ask = async (q, done) => { await openPanel(); const n = (await cards()).length; await S("s.querySelector('.ask input').value=x; s.querySelector('.go').click();", q);
        for (let i = 0; i < 120; i++) { const c = await cards(); if (c.length > n && c.slice(n).some((x) => (done || /^[✓✗]/).test(x))) break; await page.waitForTimeout(250); } };
      await openPanel(); await page.waitForTimeout(400);

      await ask('Create a Facebook ad for a g p three zero nine');
      const c1 = await cards();
      const st = await page.evaluate(() => { const S0 = window.HCPSAdBuilder && window.HCPSAdBuilder._state; return { active: state.active, cands: S0 && S0.cd ? S0.cd.cands.length : 0, prod: S0 && S0.cur.products.map((p) => p.code), plat: S0 && S0.ai.platform }; });
      const ai = calls.filter((x) => x.action === 'ads_ai');
      await t(`${label}: GP309 → Studio opens, its Create 3 designs runs for GP309 on Facebook, ✓ says 3 saved to the Creative Library, nothing posted`, () => ok(
        st.active === 'p360:ads' && st.cands === 3 && st.prod[0] === 'GP309' && ai.length === 1 && ai[0].platform === 'facebook' && ai[0].products[0].code === 'GP309' && saved.length === 3
        && c1.some((x) => /^✓ 3 Facebook designs for Synthetic Power Chair are in the Social Marketing Studio, each with its caption, and all 3 are saved as private drafts in your Creative Library\. Nothing is posted or scheduled\./.test(x)), JSON.stringify({ st, ai: ai.length, saved: saved.length, c1: c1.slice(-2) })));

      await ask('Use the second one.');
      const c2 = await cards(); const p2 = await page.evaluate(() => { const S0 = window.HCPSAdBuilder._state; return { pick: S0.cd.pick, head: S0.cur.headline, h2: S0.cd.cands[1].headline }; });
      await t(`${label}: "use the second one" → design 2 open in the editor (✓, already saved)`, () => ok(p2.pick === 1 && p2.head === p2.h2 && c2.some((x) => /^✓ Design 2 is open in the editor \(already saved in your Creative Library\)/.test(x)), JSON.stringify({ p2, c2: c2.slice(-1) })));

      failSaves = 3;
      await ask('Create a Facebook ad for a g p three zero nine');
      const c3 = await cards();
      await t(`${label}: saves refused → ✗ "none are saved yet", never "saved"`, () => ok(c3.slice(-1)[0] && /^✗ 3 designs for Synthetic Power Chair are on screen but none are saved yet/.test(c3.slice(-1)[0]), JSON.stringify(c3.slice(-2))));

      const before = calls.length;
      await ask('Create an ad for the ZZ1', /isn't one of the products/);
      const c4 = await cards();
      await t(`${label}: a product the location can't advertise → nothing made (no Studio call)`, () => ok(c4.some((x) => /ZZ1 isn't one of the products TEST Sandbox can advertise/.test(x)) && !calls.slice(before).some((x) => x.action === 'ads_ai'), JSON.stringify(c4.slice(-2))));
      await t(`${label}: never a post or schedule request`, () => ok(!calls.some((x) => /^post_|^social_connect/.test(x.action)), JSON.stringify(calls.map((x) => x.action))));
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      await t(`${label}: no sideways scroll`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\ndealer victoria ads: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
