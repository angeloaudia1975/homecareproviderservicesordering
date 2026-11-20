/* DEALER VICTORIA — TEST-dealer preview, the dealer's experience on the REAL portal page (_shop-harness.js, a signed-in dealer;
   nothing leaves the page) at desktop 1280 × 800, tablet 768 × 1024 and phone 390 × 844.
   dealer-victoria-api is answered IN-PROCESS by the admin repo's own tool functions (the real reimbursement engine, the real
   order cleaning, the real quote action), with the model's choice of tool scripted — so the cards the panel shows are the
   server's own. Checks: the orb replaces the chat button; the Golden cart moves to its own place; nothing covers a purchasing
   control (closed and open); the per-person greeting; voice only when turned on; the three workflows through the portal's
   own screens; support without AI; reduced motion; the closed orb loads nothing else.
   ADMIN_REPO=<admin repo> REIMB_ENGINE=<admin>/netlify/functions/_reimb.js node test/dealer-victoria.browser.js */
const path = require('path'), fs = require('fs');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'adm');
process.env.SUPABASE_URL = 'https://example.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'service';
const V = require(path.join(ADM, 'netlify', 'functions', 'dealer-victoria-api.js'));
const realFetch = global.fetch;   /* the reimbursement engine's own sign-in read, answered locally (a TEST dealer in KY) */
global.fetch = async (url, o) => { const u = String(url); const okj = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => JSON.stringify(x) });
  if (u.endsWith('/auth/v1/user')) return okj({ id: 'u1' }); if (u.includes('/dealer_users?')) return okj([{ status: 'approved', dealer_id: 'd1' }]);
  if (u.includes('/dealers?')) return okj([{ state: 'KY', zip: '42101' }]); if (u.includes('dealer_preview_tokens')) return okj([{ dealer_id: 'd1', expires_at: '2099-01-01T00:00:00Z' }]);
  return realFetch(url, o); };
const { chromium, open } = require('./_shop-harness.js');
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const inter = (a, b) => a && b && !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);

const P1 = { order_ref: 'P1601', source: 'linked', status: 'invoiced', placed_on: '2026-11-05', po_number: '70001', so_numbers: ['SO269990001'], ship_to: { city: 'Washington', state: 'IN' },
  items: [{ sku: 'PR510-MED', description: 'Cloud lift chair', qty: 1 }], tracking: [{ so_number: 'SO269990001', carrier: 'R & L Carriers', tracking_number: 'AC0000001', ship_date: '2026-11-12' }],
  lifecycle: [{ type: 'submitted', at: '2026-11-05' }], location_id: 'w', location_name: 'TEST — Golden Sandbox', booked_on: '2026-11-05' };
const GOLDEN = { ok: true, enabled: true, available: true, orders: [P1], prices_visible: true, locations: [{ id: 'w', name: 'TEST — Golden Sandbox', city: 'Washington', state: 'IN' }], since_day: '2025-10-15', newest_day: '2026-11-05', oldest_day: '2026-11-05', truncated: false, unread_locations: [] };
V._test.deps.reports = () => async () => ({ statusCode: 200, body: JSON.stringify(GOLDEN) });

(async () => {
  const b = await chromium.launch(); const report = {};
  try {
    for (const [w, h, label] of [[1280, 800, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, { prices: { dalton: 109 } });
      let first = true, aiOn = true, asks = [], panelReq = 0, chatOpened = 0, spoken = [];
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body;
        if (x.action === 'status') body = { ok: true, enabled: true, preview: true, ai: aiOn ? { available: true } : { available: false, reason: 'over_budget' }, support: { chat: true, phone: '(888) 626-3140', phone_tel: '+18886263140', office: '937-626-5141', office_tel: '+19376265141', email: 'info@homecareproviderservices.us' } };
        else if (x.action === 'hello') { body = { ok: true, enabled: true, first, greeting: V._test.greeting('Ann', first), model_call: false }; first = false; }
        else if (x.action === 'ask') { asks.push(x); const ctx2 = { dealer_id: 'hq', bearer: 'Bearer tok', page: x.page || {} }; const q = String(x.question);
          const tool = /order/i.test(q) ? await V._test.toolGoldenOrder(ctx2, {}) : /medicare|allow/i.test(q) ? await V._test.toolReimb(ctx2) : /quote/i.test(q) ? await V._test.toolQuote(ctx2, { qty: 2 }) : { result: {} };
          body = { ok: true, answer: 'Here is what I found.', cards: tool.card ? [tool.card] : [], actions: tool.action ? [tool.action] : [], usage: { model: 'claude-haiku-5-5', usd: 0.0004, ms: 1500 } }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); });
      await page.route('**/assets/dealer-victoria-panel.js*', (r) => { panelReq++; return r.fallback(); });
      await page.route('**/dealer-reports-api', (r) => { const x = JSON.parse(r.request().postData() || '{}'); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x.action === 'golden_orders' ? GOLDEN : { ok: false }) }); });
      await page.route('**/reimbursement-api', async (r) => { const RF = require(path.join(ADM, 'netlify', 'functions', 'reimbursement-api.js')); const x = JSON.parse(r.request().postData() || '{}');
        const res = await RF.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(Object.assign({ dos: '2026-11-19' }, x)) }).catch(() => null);
        return r.fulfill({ status: res ? res.statusCode : 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: res ? res.body : '{}' }); });
      /* the live chat widget, as Zoho draws it (55 × 55, 10 px from the right and bottom) + its API */
      await page.evaluate(() => { const z = document.createElement('div'); z.id = 'zsiq_float'; z.style.cssText = 'position:fixed;right:10px;bottom:10px;width:55px;height:55px;border-radius:50%;background:#1681c2;z-index:2147483000'; document.body.appendChild(z);
        window.__chat = 0; window.$zoho = window.$zoho || {}; window.$zoho.salesiq = Object.assign(window.$zoho.salesiq || {}, { floatbutton: { visible: () => {} }, floatwindow: { visible: (v) => { if (v === 'show') window.__chat++; } } });
        window.__spoken = []; window.__speakState = [];
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak(u) { window.__spoken.push(u.text); if (u.onstart) u.onstart();
          const h = document.getElementById('dvPanelHost'); window.__speakState.push(h ? h.shadowRoot.querySelector('.orb').dataset.s : null); setTimeout(() => u.onend && u.onend(), 50); } } });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function (tx) { this.text = tx; } });
        window.__PREVIEW__ = null; window.needsAccess = () => false; });
      const zoneBefore = await page.evaluate(() => getComputedStyle(document.getElementById('zsiq_float')).display);
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost'), null, { timeout: 15000 }); await page.waitForTimeout(300);
      const closed = await page.evaluate(() => ({ chat: getComputedStyle(document.getElementById('zsiq_float')).display, orbJs: [...document.scripts].some((s) => /dealer-victoria\.js/.test(s.src)), panelLoaded: !!window.DealerVictoriaPanel, on: document.body.classList.contains('dv-on') }));
      await t(`${label}: the orb replaces the bottom-right chat button; the closed orb loads nothing else`, () => {
        ok(zoneBefore !== 'none' && closed.chat === 'none' && closed.on && closed.orbJs && !closed.panelLoaded && panelReq === 0, JSON.stringify(closed));
      });
      /* a product page with its buy controls, and a Golden cart in progress */
      await page.evaluate(async () => { await selectManufacturer('dalton'); }); await page.waitForFunction(() => document.querySelector('#cv2Grid .card'), null, { timeout: 20000 });
      await page.evaluate(() => openProductDetail('K2DK16F')); await page.waitForSelector('#pdReimb .pd-reimb-cols', { timeout: 20000 });
      await page.selectOption('#pdReimb [data-k=state]', 'KY'); await page.waitForTimeout(600);
      await page.fill('#pdReimb [data-k=zip]', '42101'); await page.dispatchEvent('#pdReimb [data-k=zip]', 'change'); await page.waitForTimeout(800);
      /* the agreed baseline date of service: November 19, 2026 (fixed, so the check does not move with the calendar) */
      await page.fill('#pdReimb [data-k=dos]', '2026-11-19'); await page.dispatchEvent('#pdReimb [data-k=dos]', 'change'); await page.waitForTimeout(800);
      await page.evaluate(() => { const el = document.createElement('button'); el.id = 'gcartPill'; el.className = 'gck-pill'; el.textContent = 'Golden cart · 2'; document.body.appendChild(el); window.scrollTo(0, 0); });
      await page.waitForTimeout(400);
      const R = (sel) => page.evaluate((s) => { const e = typeof s === 'string' ? document.querySelector(s) : null; if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }, sel);
      const buys = async () => { const out = []; for (const sel of ['#content .pd input[type=number]', '#content .pd .pd-buy button', '#content .pd button.add', '#content .pd [onclick^="pdAddQuote"]']) { const n = await page.evaluate((s) => document.querySelectorAll(s).length, sel); for (let i = 0; i < n; i++) out.push([sel, i]); } return out; };
      const checkCovered = async (panelOpen) => { const res = [];
        for (const [sel, i] of await buys()) {
          await page.evaluate(([s, k]) => { const e = document.querySelectorAll(s)[k]; const r = e.getBoundingClientRect(); window.scrollBy(0, r.bottom - innerHeight + 24); }, [sel, i]); await page.waitForTimeout(450);
          const g = await page.evaluate(([s, k, po]) => { const e = document.querySelectorAll(s)[k]; const r = e.getBoundingClientRect(); const box = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { left: q.left, top: q.top, right: q.right, bottom: q.bottom }; };
            return { label: (e.textContent || e.getAttribute('aria-label') || e.type || '').trim().slice(0, 24), c: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, orb: box(document.getElementById('dvOrbHost')), pill: box(document.getElementById('gcartPill')),
              panel: po ? box(document.getElementById('dvPanelHost').shadowRoot.querySelector('.p')) : null }; }, [sel, i, panelOpen]);
          res.push({ control: g.label, by_orb: inter(g.orb, g.c), by_cart: inter(g.pill, g.c), by_panel: panelOpen ? inter(g.panel, g.c) : false }); }
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); return res; };
      const cClosed = await checkCovered(false);
      const pos = await page.evaluate(() => { const b = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }; return { orb: b('dvOrbHost'), cart: b('gcartPill'), vw: innerWidth, sw: document.documentElement.scrollWidth }; });
      await t(`${label}: closed — orb lower right (${pos.orb.w}×${pos.orb.h}), Golden cart lower left, apart; no purchasing control under either; no sideways scroll`, () => {
        ok(pos.orb.right > pos.vw - 30 && pos.cart.left < 30 && !inter(pos.orb, pos.cart) && pos.orb.w >= 44 && pos.cart.h >= 44, JSON.stringify(pos));
        ok(cClosed.length >= 2 && cClosed.every((x) => !x.by_orb), 'orb covers: ' + JSON.stringify(cClosed));
        ok(pos.sw <= pos.vw + 1, 'scroll ' + pos.sw);
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `dv-closed-${label}.png`) });
      const searchClosed = await R('.hsearch');
      /* open: the panel loads now; first open greets by name */
      await page.evaluate(() => document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click());
      await page.waitForFunction(() => { const h = document.getElementById('dvPanelHost'); return h && /Hello|Hi/.test(h.shadowRoot.querySelector('.hello').textContent); }, null, { timeout: 10000 });
      const g1 = await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.hello').textContent);
      const open1 = await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; const r = s.querySelector('.p').getBoundingClientRect(); const o = document.getElementById('dvOrbHost').getBoundingClientRect(); const c = document.getElementById('gcartPill').getBoundingClientRect();
        const box = (q) => ({ left: q.left, top: q.top, right: q.right, bottom: q.bottom });
        const tapOk = (q) => { const x = (q.left + q.right) / 2, y = (q.top + q.bottom) / 2; const e = document.elementFromPoint(x, y); return e; };
        return { panel: box(r), orb: box(o), cart: box(c), orbTap: tapOk(o) === document.getElementById('dvOrbHost'), cartTap: tapOk(c) === document.getElementById('gcartPill'), support: [...s.querySelectorAll('.sup a, .sup button')].map((a) => (a.textContent || '').trim()),
          close: (() => { const q = s.querySelector('.x').getBoundingClientRect(); return [q.width, q.height]; })(), spoke: window.__spoken.length,
          search: (() => { const e = document.querySelector('.hsearch'); if (!e) return null; const q = e.getBoundingClientRect(); if (!q.width) return null; const inp = e.querySelector('input'); const y = (q.top + q.bottom) / 2, x = (q.left + q.right) / 2; const hit = document.elementFromPoint(x, y);
            return { left: q.left, top: q.top, right: q.right, bottom: q.bottom, width: q.width, tappable: !!(hit && e.contains(hit)), visible: q.top >= 0 && q.bottom <= innerHeight }; })(),
          expanded: document.getElementById('dvOrbHost').shadowRoot.querySelector('button').getAttribute('aria-expanded') }; });
      await t(`${label}: first open — "Hello, Ann. I’m Victoria, …"; no voice until turned on; support is in the panel`, () => {
        ok(g1 === 'Hello, Ann. I’m Victoria, your personal assistant in the 360 Dealer Portal. How can I help you today?', g1);
        ok(open1.spoke === 0, 'spoken without voice on');
        ok(open1.support.some((x) => /Chat with HCPS/.test(x)) && open1.support.some((x) => /626-3140/.test(x)) && open1.support.some((x) => /Email/.test(x)), JSON.stringify(open1.support));
        ok(open1.close[0] >= 44 && open1.close[1] >= 44, 'close ' + open1.close);
      });
      await t(`${label}: open — the orb and the Golden cart stay visible and tappable; the panel never sits on either`, () => {
        ok(!inter(open1.panel, open1.orb) && !inter(open1.panel, open1.cart) && open1.orbTap && open1.cartTap, JSON.stringify(open1));
      });
      await t(`${label}: open — the top search bar stays where it is, uncovered and usable (typing works with the panel open)`, async () => {
        ok(open1.search && open1.search.visible && open1.search.tappable && !inter(open1.panel, open1.search), 'search bar: ' + JSON.stringify([open1.panel, open1.search]));
        ok(Math.abs(open1.search.top - (searchClosed && searchClosed.top)) < 1, 'the search bar moved: ' + JSON.stringify([searchClosed, open1.search]));
        await page.click('.hsearch input'); await page.keyboard.type('K2DK'); const v = await page.$eval('.hsearch input', (e) => e.value); ok(v === 'K2DK', 'typed ' + v);
        await page.fill('.hsearch input', ''); ok(await page.evaluate(() => !document.getElementById('dvPanelHost').shadowRoot.querySelector('.p').hidden), 'the panel stayed open');
        ok(open1.expanded === 'true', 'aria-expanded ' + open1.expanded);
      });
      /* keyboard: focus is inside the panel on open; Esc closes it and gives focus back to the orb; Enter on the orb reopens */
      await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; (s.querySelector('.chip:not([hidden])') || s.querySelector('.ask input')).focus(); });
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      const kb1 = await page.evaluate(() => { const o = document.getElementById('dvOrbHost'); return { hidden: document.getElementById('dvPanelHost').shadowRoot.querySelector('.p').hidden, onOrb: document.activeElement === o && o.shadowRoot.activeElement === o.shadowRoot.querySelector('button'), exp: o.shadowRoot.querySelector('button').getAttribute('aria-expanded') }; });
      await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      const kb2 = await page.evaluate(() => { const h = document.getElementById('dvPanelHost'); return { open: !h.shadowRoot.querySelector('.p').hidden, inPanel: document.activeElement === h }; });
      await t(`${label}: keyboard — Esc closes the panel and returns focus to the orb; Enter on the orb reopens it with focus inside`, () => ok(kb1.hidden && kb1.onOrb && kb1.exp === 'false' && kb2.open && kb2.inPanel, JSON.stringify([kb1, kb2])));
      const cOpen = await checkCovered(true);
      report[label] = { viewport: `${w}×${h}`, orb: pos.orb, cart: pos.cart, panel: open1.panel, covered_when_closed: cClosed, covered_when_open: cOpen };
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `dv-open-${label}.png`) });
      /* chat with HCPS without AI */
      await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.sup .chat').click());
      await t(`${label}: "Chat with HCPS" opens the HCPS chat window from the panel`, async () => ok((await page.evaluate(() => window.__chat)) === 1));
      /* voice on: the greeting is not repeated, answers are spoken, the orb animates while speaking */
      await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.v').click());
      /* workflow 2 — reimbursement for the product on screen, matching its panel */
      await page.evaluate(() => [...document.getElementById('dvPanelHost').shadowRoot.querySelectorAll('.chip')].find((c) => /Medicare/.test(c.textContent)).click());
      await page.waitForFunction(() => /HCPCS reference only/.test(document.getElementById('dvPanelHost').shadowRoot.querySelector('.log').textContent), null, { timeout: 15000 });
      const rc = await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.log').textContent.replace(/\s+/g, ' '));
      const panelTxt = await page.evaluate(() => document.querySelector('#pdReimb').textContent.replace(/\s+/g, ' '));
      const sent = asks[asks.length - 1].page.product;
      await t(`${label}: reimbursement — the screen's state, ZIP, payer and date; same amounts and the same verification notice as the product's panel`, () => {
        ok(sent.code === 'K2DK16F' && sent.state === 'KY' && sent.zip === '42101' && sent.dos === '2026-11-19' && sent.manufacturer === 'dalton', JSON.stringify(sent));
        ok(/\$54\.13/.test(rc) && /\$40\.60/.test(rc) && /\$368\.60/.test(rc) && /\$36\.86/.test(rc) && /HCPCS reference only — model verification pending\./.test(rc) && /ZIP 42101/.test(rc) && /Nov 19, 2026/.test(rc), rc.slice(0, 700));
        ok(/Per month/.test(rc) && /Per HCPCS unit as the code describes it/.test(rc) && /Kentucky Medicaid MSEA Fee Schedule 2026/.test(rc), 'billing units and source: ' + rc.slice(0, 900));
        ok(/\$54\.13/.test(panelTxt) && /HCPCS reference only — model verification pending/.test(panelTxt), 'the panel shows the same');
      });
      await t(`${label}: voice on — the answer is spoken and the orb animates while Victoria speaks`, async () => { const sp = await page.evaluate(() => [window.__spoken.slice(), window.__speakState.slice()]); ok(sp[0].includes('Here is what I found.') && sp[1].includes('speaking'), JSON.stringify(sp)); });
      /* the fee schedule from Victoria's card → the existing page */
      await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.card .fee').click());
      await page.waitForSelector('#view-reimb .rb-ret', { timeout: 15000 });
      await t(`${label}: "Open the fee schedule" opens the portal's own fee schedule (with ← Back to the product)`, async () => ok(/Back to K2 16/.test(await page.$eval('#view-reimb .rb-ret', (e) => e.textContent))));
      await page.click('#view-reimb .rb-ret'); await page.waitForFunction(() => document.querySelector('#content .pd') && !document.body.classList.contains('p360on'), null, { timeout: 15000 });
      /* workflow 3 — draft quote with the SKU and variant on screen, left open for review */
      await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; if (s.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => [...document.getElementById('dvPanelHost').shadowRoot.querySelectorAll('.chip')].find((c) => /quote/i.test(c.textContent)).click());
      await page.waitForFunction(() => window.P360Quote && window.P360Quote.picked().some((r) => r.sku === 'K2DK16F'), null, { timeout: 15000 }).catch(async (e) => {
        console.log('     debug: ' + JSON.stringify(await page.evaluate(() => ({ Q: typeof QUOTE !== 'undefined' ? QUOTE : null, log: document.getElementById('dvPanelHost').shadowRoot.querySelector('.log').textContent.slice(-300), pd: (document.querySelector('#content .pd') || {}).getAttribute && document.querySelector('#content .pd').getAttribute('data-pd-code'), btn: !!document.querySelector("#content .pd [onclick^='pdAddQuote']"), held: typeof isHeldSlug === 'function' && isHeldSlug('dalton'), act: state.active })))); throw e; });
      const q = await page.evaluate(() => { const r = window.P360Quote.picked().find((x) => x.sku === 'K2DK16F'); const inp = [...document.querySelectorAll('input[aria-label^="Quantity for"]')].find((i) => /K2 16/.test(i.getAttribute('aria-label'))); return { qty: inp ? Number(inp.value) : null, found: !!r, view: document.body.classList.contains('p360on'), active: state.active }; });
      await t(`${label}: quote — a draft with K2DK16F (qty 2) is open in Customer Quotes for review; nothing sent`, () => ok(q.qty === 2 && q.view && /quotes/.test(q.active), JSON.stringify(q)));
      /* workflow 1 — Golden order + carrier tracking, through Orders & Tracking's own View / print */
      await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; if (s.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
      await page.waitForTimeout(300);
      await page.evaluate(() => [...document.getElementById('dvPanelHost').shadowRoot.querySelectorAll('.chip')].find((c) => /Golden order/.test(c.textContent)).click());
      await page.waitForFunction(() => /PR510-MED/.test((document.getElementById('modal') || {}).innerText || ''), null, { timeout: 20000 });
      const oc = await page.evaluate(() => ({ card: document.getElementById('dvPanelHost').shadowRoot.querySelector('.log').innerHTML, modal: document.getElementById('modal').innerHTML }));
      await t(`${label}: order — the order opens in Orders & Tracking's View / print with the official R&L tracking link; delivery never claimed`, () => {
        ok(/rlcarriers\.com[^"]*AC0000001/.test(oc.card) && /Delivery not confirmed/.test(oc.card), 'card ' + oc.card.slice(oc.card.indexOf('Golden order') - 20, oc.card.indexOf('Golden order') + 900));
        ok(/AC0000001/.test(oc.modal) && /Delivery not confirmed/.test(oc.modal), 'modal');
      });
      await page.evaluate(() => typeof ghCloseOrder === 'function' && ghCloseOrder());
      if (SHOTS) { await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; if (s.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, `dv-answers-${label}.png`) }); }
      /* a later visit: the short greeting */
      await page.evaluate(() => { const h = document.getElementById('dvPanelHost'); h.remove(); window.DealerVictoriaPanel = null; delete window.DealerVictoriaPanel; });
      const p2 = await page.evaluate(async () => { const s = document.createElement('script'); s.src = '/assets/dealer-victoria-panel.js?v=1&again'; await new Promise((ok2) => { s.onload = ok2; document.head.appendChild(s); });
        const api = window.DealerVictoriaPanel(document.getElementById('dvOrbHost')); api.toggle(true); await new Promise((r2) => setTimeout(r2, 600)); return api.shadow.querySelector('.hello').textContent; });
      await t(`${label}: a later open greets "Hi, Ann. How can I help you today?"`, () => ok(p2 === 'Hi, Ann. How can I help you today?', p2));
      /* AI unavailable (cap reached): support still works; questions are disabled */
      aiOn = false; await page.evaluate(() => { window.DV.ai = { available: false, reason: 'over_budget' }; const h = document.getElementById('dvPanelHost'); if (h) h.remove(); });
      const off = await page.evaluate(async () => { const api = window.DealerVictoriaPanel(document.getElementById('dvOrbHost')); api.toggle(true); await new Promise((r2) => setTimeout(r2, 400)); const s = api.shadow;
        return { warn: !s.querySelector('.ai-off').hidden, chips: [...s.querySelectorAll('.chip')].every((c) => c.disabled), input: s.querySelector('.ask input').disabled, sup: [...s.querySelectorAll('.sup a')].map((a) => a.getAttribute('href')) }; });
      await t(`${label}: over the cap — a plain message, questions off, phone and email support still there`, () => ok(off.warn && off.chips && off.input && off.sup.includes('tel:+18886263140') && off.sup.includes('mailto:info@homecareproviderservices.us'), JSON.stringify(off)));
      await ctx.close();
    }
    /* reduced motion: no animation while speaking */
    const { ctx, page } = await open(b, 390, 844, {}); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addScriptTag({ path: path.join(__dirname, '..', 'public', 'assets', 'dealer-victoria-panel.js') });
    const anim = await page.evaluate(() => { window.DV = { api: async () => ({ ok: true, greeting: 'Hi' }) }; const o = document.createElement('div'); o.id = 'dvOrbHost'; o.style.cssText = 'position:fixed;right:16px;bottom:16px;width:56px;height:56px'; document.body.appendChild(o);
      const api = window.DealerVictoriaPanel(o); api.toggle(true); const orb = api.shadow.querySelector('.orb'); orb.dataset.s = 'speaking'; return getComputedStyle(orb).animationName; });
    await t('phone: reduced motion — Victoria speaking does not animate', () => ok(anim === 'none', anim));
    await ctx.close();
    console.log('     placement: ' + JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, { viewport: v.viewport, orb: [v.orb.left, v.orb.top, v.orb.w], cart: [v.cart.left, v.cart.top, v.cart.w], panel: [Math.round(v.panel.left), Math.round(v.panel.top), Math.round(v.panel.right), Math.round(v.panel.bottom)], open_covers: v.covered_when_open.filter((x) => x.by_panel).map((x) => x.control) }]))));
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'dv-placement.json'), JSON.stringify(report, null, 1));
  } finally { await b.close(); }
  console.log(`\ndealer victoria (TEST preview): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
