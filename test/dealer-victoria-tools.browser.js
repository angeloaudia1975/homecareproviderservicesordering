/* DEALER VICTORIA — batch 1 on the REAL portal page (owner 2026-11-20 16:07): screen suggestions, products with the account's
   price, opening a product, draft quotes for several items, Print Brochure, the portal guide opening a screen, and the storefront
   status — at desktop 1280 × 800 and phone 390 × 844. The admin repo's own tool code (_dealer_victoria_tools.js) answers, with
   its price check and storefront read stubbed (synthetic prices); the model's choice of tool is scripted. Nothing leaves the page.
   ADMIN_REPO=<admin repo> node test/dealer-victoria-tools.browser.js */
const path = require('path');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'adm');
const VT = require(path.join(ADM, 'netlify', 'functions', '_dealer_victoria_tools.js'));
const { chromium, open } = require('./_shop-harness.js');
const PUB = path.join(__dirname, '..', 'public');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const PRICE = { 'R-CART-6': 66, 'AKN411AR': 105, 'A-CA20003R': 5 };
const deps = { files: { manufacturersFile: async () => require(path.join(PUB, 'data', 'manufacturers.json')), catalogFile: async (s) => { try { return require(path.join(PUB, 'data', s + '.json')); } catch (e) { return []; } } },
  sbGet: async () => [],
  orders: () => async (ev) => { const b = JSON.parse(ev.body); const o = b.orders[0];
    if (o.manufacturer_slug !== 'dalton') return { statusCode: 403, body: JSON.stringify({ ok: false, status: 'not_entitled' }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, orders: [{ manufacturer_slug: 'dalton', items: o.items.map((i) => ({ code: i.code, qty: i.qty, unit: PRICE[i.code] || 20, line_total: (PRICE[i.code] || 20) * i.qty, uom: i.code === 'R-CART-6' ? 'Case' : 'Each', ...(i.code === 'R-CART-6' ? { case_qty: 6 } : {}), contract: null, commercial: { msrp: i.code === 'AKN411AR' ? 210 : null, map: null } })) }] }) }; },
  storefront: () => async () => ({ statusCode: 200, body: JSON.stringify({ ok: true, locations: [{ name: 'TEST — Golden Sandbox', city: 'Nashville', can_edit: true, storefront: { slug: 'sandbox', draft: null }, live: true, link: 'https://hcpsonlineordering.netlify.app/store/sandbox', lines: [{ slug: 'dalton' }] }] }) }),
  fetch: async () => ({ ok: true, json: async () => require(path.join(PUB, 'data', 'help.json')) }) };
const SCRIPT = [   // question → tool + input (the model's choice, scripted)
  [/price of R-CART-6/i, 'find_products', { query: 'R-CART-6' }],
  [/quote two/i, 'quote_products', { items: [{ code: 'AKN411AR', qty: 2 }, { code: 'A-CA20003R', qty: 1 }] }],
  [/brochure/i, 'brochure_for_product', { code: 'AKN411AR' }],
  [/knee walker/i, 'find_products', { query: 'knee walker' }],
  [/storefront live/i, 'storefront_status', {}],
  [/social ad/i, 'portal_guide', { topic: 'social ad' }],
  [/K3 wheelchairs/i, 'open_shop_search', { query: 'Dalton K3 wheelchairs' }],
  [/open my reports/i, 'open_portal_tool', { view: 'reports' }],
];

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, { prices: { dalton: 109 }, access: { your_accounts: ['access4u', 'dalton'], available: ['bemis', 'pedifix'], request_access: [], golden: 'None' } });
      const asks = [], suggests = [];
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body = { ok: true };
        if (x.action === 'status') body = { ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', available: false }, ai: { available: true }, support: { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us', chat: false }, greeting: 'Hello, Ann.', greeting_again: 'Hi, Ann.' };
        else if (x.action === 'hello') body = { ok: true, enabled: true, greeting: 'Hi, Ann. How can I help you today?' };
        else if (x.action === 'suggest') { suggests.push(x.page || {}); body = { ok: true, suggestions: VT.suggestions(x.page) }; }
        else if (x.action === 'ask') { asks.push(x); const s = SCRIPT.find(([re]) => re.test(x.question));
          const out = s ? await VT.RUN[s[1]]({ dealer_id: 'd1', bearer: 'Bearer tok', page: x.page || {} }, deps, s[2]) : { result: {} };
          body = { ok: true, answer: 'Here is what I found.', speech_parts: [], cards: out.card ? [out.card] : [], actions: [].concat(out.actions || [], out.action ? [out.action] : []) }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); });
      await page.evaluate(() => { window.SpeechRecognition = window.webkitSpeechRecognition = function () { const r = this; window.__srFire = () => { r.onresult && r.onresult({ results: [[{ transcript: window.__heard }]] }); setTimeout(() => r.onend && r.onend(), 30); }; r.start = () => {}; r.stop = () => { r.onend && r.onend(); }; };
        window.__PREVIEW__ = null; window.needsAccess = () => false; const M = HTMLMediaElement.prototype; M.play = function () { return Promise.resolve(); }; window.print = () => {}; });
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost'), null, { timeout: 15000 });
      const S = (fn, a) => page.evaluate(([f, x]) => (new Function('s', 'x', f))(document.getElementById('dvPanelHost') && document.getElementById('dvPanelHost').shadowRoot, x), [fn, a]);
      const openPanel = async () => { await page.evaluate(() => { const h = document.getElementById('dvPanelHost'); if (!h || h.shadowRoot.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
        await page.waitForFunction(() => { const h = document.getElementById('dvPanelHost'); return h && !h.shadowRoot.querySelector('.p').hidden; }, null, { timeout: 10000 }); };
      const ask = async (q) => { await openPanel(); const n = asks.length; await S("s.querySelector('.ask input').value=x; s.querySelector('.go').click();", q);
        await page.waitForFunction((k) => window.__dvAsks >= k, n + 1, { timeout: 1 }).catch(() => {}); for (let i = 0; i < 40 && asks.length <= n; i++) await page.waitForTimeout(100); await page.waitForTimeout(700); };
      const cards = () => S("return [...s.querySelectorAll('.log .card')].map(c=>c.textContent.replace(/\\s+/g,' ').trim());");

      await openPanel(); await page.waitForTimeout(800);
      const chips = await S("return [...s.querySelectorAll('.chips .chip')].map(c=>c.textContent);");
      await t(`${label}: opening asks the server for this screen's suggestions (no AI call) and shows them as buttons`, () => ok(suggests.length >= 1 && chips.includes('Find a product and my price') && asks.length === 0, JSON.stringify({ chips, asks: asks.length })));

      await ask('What is the price of R-CART-6?');
      const c1 = await cards();
      await t(`${label}: products card — "Your price $66.00 per case of 6" from the server's price check, with the source line`, () => ok(c1.some((x) => /R-CART-6/.test(x) && /Your price\$66\.00 per case of 6/.test(x)) && c1.some((x) => /same check as checkout/.test(x)), JSON.stringify(c1).slice(0, 600)));
      await S("[...s.querySelectorAll('.log .card')].find(c=>/R-CART-6/.test(c.textContent)&&c.querySelector('.op')).querySelector('.op').click();"); await page.waitForFunction(() => { const pd = document.querySelector('#content .pd'); return pd && pd.getAttribute('data-pd-code') === 'R-CART-6'; }, null, { timeout: 20000 }).catch(() => {});
      const pd1 = await page.evaluate(() => { const pd = document.querySelector('#content .pd'); return pd && pd.getAttribute('data-pd-code'); });
      await t(`${label}: "Open the product" opens R-CART-6's own product page`, () => ok(pd1 === 'R-CART-6', String(pd1)));
      await openPanel(); await page.waitForTimeout(600);
      const chips2 = await S("return [...s.querySelectorAll('.chips .chip')].map(c=>c.textContent);");
      await t(`${label}: on a product page the suggestions change (price, brochure, quote, Medicare)`, () => ok(chips2.some((q) => /brochure/i.test(q)) && chips2.some((q) => /my price for this product/i.test(q)), JSON.stringify(chips2)));

      await ask('Help me quote two knee walkers and a cane');
      await page.waitForTimeout(1500);
      const c2 = await cards(); const qs = await page.evaluate(() => (window.P360Quote && window.P360Quote.items ? window.P360Quote.items().map((i) => i.code) : null));
      await t(`${label}: quote_products — one "Draft quote opened" card naming 2 × AKN411AR and 1 × A-CA20003R; nothing saved or sent`, () => ok(c2.some((x) => /Draft quote opened/.test(x) && /2 × AKN411AR/.test(x) && /1 × A-CA20003R/.test(x) && /Nothing has been saved or sent/.test(x)), JSON.stringify(c2).slice(-600)));

      await page.evaluate(() => { const m = document.getElementById('brModal'); if (m) m.remove(); });
      await ask('Print a brochure for the knee walker');
      await page.waitForFunction(() => document.getElementById('brModal'), null, { timeout: 15000 }).catch(() => {});
      const br = await page.evaluate(() => { const m = document.getElementById('brModal'); return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 160) : null; });
      await t(`${label}: brochure_for_product opens the product's own Print Brochure dialog (nothing printed or sent)`, () => ok(br && /Product brochure/.test(br) && /AKN411AR/.test(br), String(br)));
      await page.evaluate(() => { if (typeof closeBrochure === 'function') closeBrochure(); const m = document.getElementById('brModal'); if (m) m.remove(); });

      const chips3 = await S("return [...s.querySelectorAll('.chips .chip')].map(c=>c.textContent);");
      await t(`${label}: after an answer on a product page the suggestions are the product's`, () => ok(chips3.some((q) => /my price for this product/i.test(q)), JSON.stringify(chips3)));
      await ask('Is my storefront live?');
      const c3 = await cards();
      await t(`${label}: storefront status card — live, link, lines; button opens the Storefront Website Builder`, () => ok(c3.some((x) => /TEST — Golden Sandbox/.test(x) && /Live/.test(x) && /Open the live storefront/.test(x)), JSON.stringify(c3).slice(-500)));

      await ask('How do I make a social ad?');
      const c4 = await cards();
      await t(`${label}: portal guide for social ads (the words say no prices / discounts in your own words); Open it`, () => ok(c4.some((x) => /Social Media Advertising/.test(x) && /can't include prices/.test(x)), JSON.stringify(c4).slice(-500)));
      await S("[...s.querySelectorAll('.log .card .btn')].pop().click();"); await page.waitForTimeout(1200);
      const view = await page.evaluate(() => state.active);
      await t(`${label}: "Open it" goes to Social Media Advertising`, () => ok(view === 'p360:ads', String(view)));
      await ask('Find Dalton K3 wheelchairs'); await page.waitForTimeout(2500);
      const c5 = await cards(); const shop = await page.evaluate(() => ({ active: state.active, h: (document.querySelector('.sl-search .sl-shead h2') || {}).textContent || '', rows: document.querySelectorAll('.sl-search .gsr2').length }));
      await t(`${label}: "Find Dalton K3 wheelchairs" opens Shop Products results, and Victoria reports the counted results only after they opened (✓)`, () => ok(/for “Dalton K3 wheelchairs”/.test(shop.h) && shop.rows > 0 && c5.some((x) => /^✓ Shop Products: \d+ results? for “Dalton K3 wheelchairs”/.test(x)), JSON.stringify({ shop, last: c5.slice(-2) })));
      const hy = await page.evaluate(async () => { const a = await gsSearchAll('K-3DK16FTADJ'), b = await gsSearchAll('K3DK16FTADJ'); return [a.length && a[0].x.p.code, b.length && b[0].x.p.code]; });
      await t(`${label}: an item number typed with a hyphen ("K-3DK16FTADJ", like "PR-519") finds the part number`, () => ok(hy[0] === 'K3DK16FTADJ' && hy[1] === 'K3DK16FTADJ', JSON.stringify(hy)));
      await ask('open my reports'); await page.waitForTimeout(1500);
      const c6 = await cards(); const v6 = await page.evaluate(() => state.active);
      await t(`${label}: open a tool → ✓ only after the page is on screen`, () => ok(v6 === 'p360:reports' && c6.some((x) => /^✓ Opened Reports/.test(x)), JSON.stringify({ v6, last: c6.slice(-1) })));
      const names = await S("return [s.querySelector('.p').getAttribute('aria-label'), s.querySelector('.sup b').textContent];");
      await t(`${label}: the panel names Home Care Provider Services`, () => ok(names.every((x) => /Home Care Provider Services/.test(x)), JSON.stringify(names)));
      /* the microphone: the browser's speech recognition (stubbed) → Listening… → Processing… → the question is asked */
      await page.evaluate(() => { window.__heard = 'Find Dalton K3 wheelchairs'; });
      const micShown = await S("return !s.querySelector('.mic').hidden;");
      const n0 = asks.length;
      await S("s.querySelector('.mic').click();"); await page.waitForTimeout(150);
      const st1 = await S("return [s.querySelector('.mic').dataset.s, s.querySelector('.mic-st').textContent];");
      await S("window.__micLog = []; const m = s.querySelector('.mic'), st = s.querySelector('.mic-st'); new MutationObserver(() => window.__micLog.push([m.dataset.s, st.textContent])).observe(s, { subtree: true, attributes: true, childList: true, characterData: true });");
      await page.evaluate(() => window.__srFire()); await page.waitForTimeout(80);
      const st2 = (await page.evaluate(() => window.__micLog)).find((x) => x[0] === 'processing') || [];
      for (let i = 0; i < 40 && asks.length <= n0; i++) await page.waitForTimeout(100);
      await t(`${label}: microphone — Listening… with the words heard, then Processing…, then the spoken question is asked`, () => ok(micShown && st1[0] === 'listening' && /Listening/.test(st1[1]) && st2[0] === 'processing' && /Processing/.test(st2[1]) && asks.length === n0 + 1 && asks[n0].question === 'Find Dalton K3 wheelchairs', JSON.stringify({ micShown, st1, st2, q: asks[n0] && asks[n0].question })));
      await page.waitForTimeout(2500);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      await t(`${label}: no sideways scroll`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\ndealer victoria batch 1: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
