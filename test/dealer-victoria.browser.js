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
const VO = require(path.join(ADM, 'netlify', 'functions', '_dealer_victoria_voice.js'));
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
      let first = true, aiOn = true, asks = [], hellos = 0, panelReq = 0, chatOpened = 0, spoken = [], speakReqs = [], playbacks = [];
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body;
        if (x.action === 'speak') { speakReqs.push({ kind: x.kind, text: x.text, token: x.token || null });
          const fake = Buffer.concat([Buffer.from('FAKEMP3:' + x.text), Buffer.alloc(64)]).toString('base64');
          body = { ok: true, kind: x.kind, voice: 'aura-2-thalia-en', mime: 'audio/mpeg', audio: fake, chars: x.text.length, usd: 0 }; }
        else if (x.action === 'playback') { playbacks.push(x.event); body = { ok: true }; }
        else if (x.action === 'status') body = { ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', label: 'Thalia — clear, energetic (female, US)', source: 'command_center_owner_setting', available: true, provider: 'deepgram' }, greeting: V._test.greeting('Ann', first), greeting_again: V._test.greeting('Ann', false), ai: aiOn ? { available: true } : { available: false, reason: 'over_budget' }, support: { chat: true, phone: '(888) 626-3140', phone_tel: '+18886263140', office: '937-626-5141', office_tel: '+19376265141', email: 'info@homecareproviderservices.us' } };
        else if (x.action === 'hello') { hellos++; body = { ok: true, enabled: true, first, greeting: V._test.greeting('Ann', first), model_call: false }; first = false; }
        else if (x.action === 'ask') { asks.push(x); const ctx2 = { dealer_id: 'hq', bearer: 'Bearer tok', page: x.page || {} }; const q = String(x.question);
          const tool = /order/i.test(q) ? await V._test.toolGoldenOrder(ctx2, {}) : /medicare|allow/i.test(q) ? await V._test.toolReimb(ctx2) : /quote/i.test(q) ? await V._test.toolQuote(ctx2, { qty: 2 }) : { result: {} };
          const billing = tool.card && tool.card.type === 'reimbursement';
          const ansText = 'Here is what I found.' + (billing ? '\n\n' + V._test.BILLING_DISCLAIMER : '');
          /* voice on → the answer audio comes back WITH the answer (made on the server right after the model); not on the
             "Thanks" question, so the speak fallback (token) path is exercised too */
          const withAudio = x.voice === true && !/Thanks/.test(q) && !/^Where is my/.test(q);
          /* the answer in parts (the server's own splitter), the FIRST part's audio coming back with the answer */
          const parts = VO.chunks(ansText).map((tx, i) => ({ text: tx, token: 'tok-' + asks.length + '-' + i }));
          const fake = (tx) => Buffer.concat([Buffer.from('FAKEMP3:' + tx), Buffer.alloc(64)]).toString('base64');
          body = { ok: true, speech_token: 'tok-' + asks.length, speech_parts: parts, answer: ansText, speech: withAudio ? { ok: true, part: 0, text: parts[0].text, voice: 'aura-2-thalia-en', mime: 'audio/mpeg', audio: fake(parts[0].text), tts_ms: 900 } : undefined, timing: { model_ms: 1500, total_ms: 2300 }, disclaimer: billing ? V._test.BILLING_DISCLAIMER : null, cards: tool.card ? [tool.card] : [], actions: tool.action ? [tool.action] : [], usage: { model: 'claude-haiku-5-5', usd: 0.0004, ms: 1500 } }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); });
      await page.route('**/assets/dealer-victoria-panel.js*', (r) => { panelReq++; return r.fallback(); });
      await page.route('**/dealer-reports-api', (r) => { const x = JSON.parse(r.request().postData() || '{}'); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x.action === 'golden_orders' ? GOLDEN : { ok: false }) }); });
      await page.route('**/reimbursement-api', async (r) => { const RF = require(path.join(ADM, 'netlify', 'functions', 'reimbursement-api.js')); const x = JSON.parse(r.request().postData() || '{}');
        const res = await RF.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(Object.assign({ dos: '2026-11-19' }, x)) }).catch(() => null);
        return r.fulfill({ status: res ? res.statusCode : 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: res ? res.body : '{}' }); });
      /* the live chat widget, as Zoho draws it (55 × 55, 10 px from the right and bottom) + its API */
      await page.evaluate(() => { const z = document.createElement('div'); z.id = 'zsiq_float'; z.style.cssText = 'position:fixed;right:10px;bottom:10px;width:55px;height:55px;border-radius:50%;background:#1681c2;z-index:2147483000'; document.body.appendChild(z);
        window.__chat = 0; window.$zoho = window.$zoho || {}; window.$zoho.salesiq = Object.assign(window.$zoho.salesiq || {}, { floatbutton: { visible: () => {} }, floatwindow: { visible: (v) => { if (v === 'show') window.__chat++; } } });
        /* Victoria's voice is Deepgram audio played through ONE <audio> element (owner 2026-11-20 11:21). The stub: each fake
           mp3 carries its own text, so __spoken lists what was PLAYED, in order; __blockAudio makes play() refuse as a browser
           that blocks audio does; 'playing' then 'ended' fire like a real element. */
        window.__plays = []; window.__speakState = []; window.__blobText = new Map(); window.__blockAudio = false; window.__cancels = 0; window.__silentPlays = 0;
        const oc = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { const u = oc(b); if (b && b.text) b.text().then((t) => window.__blobText.set(u, t)); return u; };
        Object.defineProperty(window, '__spoken', { configurable: true, get: () => window.__plays.map((u) => String(window.__blobText.get(u) || '?').replace(/^FAKEMP3:/, '').replace(/\u0000+$/, '')) });
        const M = HTMLMediaElement.prototype;
        Object.defineProperty(M, 'paused', { configurable: true, get() { return this.__p !== false; } });
        Object.defineProperty(M, 'src', { configurable: true, get() { return this.__src || ''; }, set(v) { this.__src = String(v); } });   // no real decoding of the fake mp3
        M.pause = function () { if (this.__p === false) window.__cancels++; this.__p = true; clearTimeout(this.__end); };
        const vplay = M.play; M.play = function () { const el = this, src = el.src || ''; if (el.tagName !== 'AUDIO') { el.__p = false; return Promise.resolve(); }   // the globe video is not speech
          if (window.__blockAudio) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
          if (/^data:audio\/wav/.test(src)) { window.__silentPlays++; el.__p = false; el.__end = setTimeout(() => { el.__p = true; }, 40); return Promise.resolve(); }
          window.__plays.push(src); el.__p = false;
          setTimeout(() => { if (el.__p !== false || el.src !== src) return; el.dispatchEvent(new Event('playing'));
            const o = document.getElementById('dvOrbHost'); window.__speakState.push(o ? o.shadowRoot.querySelector('button').dataset.s : null);
            el.__end = setTimeout(() => { if (el.src !== src) return; el.__p = true; el.dispatchEvent(new Event('ended')); }, 60); }, 5);
          return Promise.resolve(); };
        window.__PREVIEW__ = null; window.needsAccess = () => false; });
      const zoneBefore = await page.evaluate(() => getComputedStyle(document.getElementById('zsiq_float')).display);
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost'), null, { timeout: 15000 }); await page.waitForTimeout(300);
      const closed = await page.evaluate(() => ({ chat: getComputedStyle(document.getElementById('zsiq_float')).display, orbJs: [...document.scripts].some((s) => /dealer-victoria\.js/.test(s.src)), panelLoaded: !!window.DealerVictoriaPanel, on: document.body.classList.contains('dv-on') }));
      await t(`${label}: the globe replaces the bottom-right chat button; closed, it records nothing and calls no AI`, () => {
        /* the panel script is fetched once the page is usable (so the first opening shows and speaks the welcome at once);
           nothing else: no greeting recorded, no AI call */
        ok(zoneBefore !== 'none' && closed.chat === 'none' && closed.on && closed.orbJs && hellos === 0 && asks.length === 0, JSON.stringify(closed));
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
      await t(`${label}: the welcome audio (Command Center voice, Deepgram) is fetched ahead of the tap — both welcomes, greeting kind only, no AI call`, async () => {
        await page.waitForFunction(() => (document.getElementById('dvOrbHost').__dvSpeech.log || []).filter((x) => x.e === 'prefetched').length >= 2, null, { timeout: 10000 });
        const kinds = speakReqs.map((x) => x.kind + ':' + x.text);
        ok(kinds.includes('greeting:' + V._test.greeting('Ann', true)) && kinds.includes('greeting:' + V._test.greeting('Ann', false)) && asks.length === 0 && hellos === 0, JSON.stringify(kinds)); });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `dv-closed-${label}.png`) });
      const searchClosed = await R('.hsearch');
      /* open: the panel loads now; first open greets by name */
      const inTap = await page.evaluate(() => { const n = window.__plays.length; document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); return { played_in_tap: window.__plays.length - n }; });
      await t(`${label}: the opening tap starts the prefetched welcome audio synchronously, inside the tap (no network wait)`, () => ok(inTap.played_in_tap === 1, JSON.stringify(inTap)));
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
      const v1 = await page.evaluate(() => { const b = document.getElementById('dvPanelHost').shadowRoot.querySelector('.v'); return { text: b.textContent.trim(), pressed: b.dataset.voice, aria: b.getAttribute('aria-pressed'), spoken: window.__spoken.slice() }; });
      await t(`${label}: first open — "Hello, Ann. I’m Victoria, …" shown AND spoken from the opening tap (no AI call); the button says Voice off; support is in the panel`, () => {
        ok(g1 === 'Hello, Ann. I’m Victoria, your personal assistant in the 360 Dealer Portal. How can I help you today?', g1);
        ok(v1.spoken.length === 1 && v1.spoken[0] === g1, 'spoken: ' + JSON.stringify(v1.spoken));
        ok(/Voice off/.test(v1.text) && v1.pressed === 'on' && v1.aria === null, JSON.stringify(v1)); ok(asks.length === 0, 'no AI call to greet');
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
      const kbSpoken = await page.evaluate(() => window.__spoken.slice(-1)[0]);
      await t(`${label}: reopening with the keyboard speaks the welcome again ("Hi, Ann. …")`, () => ok(kbSpoken === 'Hi, Ann. How can I help you today?', kbSpoken));
      await t(`${label}: keyboard — Esc closes the panel and returns focus to the orb; Enter on the orb reopens it with focus inside`, () => ok(kb1.hidden && kb1.onOrb && kb1.exp === 'false' && kb2.open && kb2.inPanel, JSON.stringify([kb1, kb2])));
      const cOpen = await checkCovered(true);
      report[label] = { viewport: `${w}×${h}`, orb: pos.orb, cart: pos.cart, panel: open1.panel, covered_when_closed: cClosed, covered_when_open: cOpen };
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `dv-open-${label}.png`) });
      /* chat with HCPS without AI */
      await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.sup .chat').click());
      await t(`${label}: "Chat with HCPS" opens the HCPS chat window from the panel`, async () => ok((await page.evaluate(() => window.__chat)) === 1));
      /* open → hear greeting → Voice off → close → reopen → hear greeting again (owner 2026-11-20 10:37) */
      const seq = await page.evaluate(async () => {
        const o = () => document.getElementById('dvOrbHost').shadowRoot.querySelector('button'); const s = document.getElementById('dvPanelHost').shadowRoot; const W = (ms) => new Promise((r) => setTimeout(r, ms));
        const n0 = window.__spoken.length; const c0 = window.__cancels;
        s.querySelector('.v').click(); const off = { text: s.querySelector('.v').textContent.trim(), pressed: s.querySelector('.v').dataset.voice, cancelled: window.__cancels > c0 || document.getElementById('dvOrbHost').__dvSpeech.audio.paused };
        s.querySelector('.x').click(); await W(50); const closed = s.querySelector('.p').hidden;
        o().click(); await W(120);
        return { off, closed, reopened: !s.querySelector('.p').hidden, spokenAgain: window.__spoken.slice(n0), label: s.querySelector('.v').textContent.trim(), typing: !s.querySelector('.ask input').disabled }; });
      await t(`${label}: Voice off stops speech for this opening; closing and reopening turns voice back on and speaks the welcome again; typing stays available`, () => {
        ok(/Voice on/.test(seq.off.text) && seq.off.pressed === 'off' && seq.off.cancelled, 'voice off: ' + JSON.stringify(seq.off));
        ok(seq.closed && seq.reopened && seq.spokenAgain.length === 1 && seq.spokenAgain[0] === 'Hi, Ann. How can I help you today?' && /Voice off/.test(seq.label) && seq.typing, JSON.stringify(seq)); });
      /* muted for the rest of an opening: an answer is not spoken */
      const muted = await page.evaluate(async () => { const s = document.getElementById('dvPanelHost').shadowRoot; s.querySelector('.v').click(); const n = window.__spoken.length;
        s.querySelector('.ask input').value = 'Thanks for your help today'; s.querySelector('.go').click(); await new Promise((r) => setTimeout(r, 1500)); const said = window.__spoken.length - n; s.querySelector('.v').click(); return said; });
      await t(`${label}: after Voice off, answers in that opening are not spoken`, () => ok(muted === 0, 'spoken ' + muted));
      await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; if (s.querySelector('.p').hidden) document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click(); });
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
        const D = 'HCPS is not a billing specialist and is not qualified to provide coding or billing advice. This information is for reference only. The biller is responsible for confirming that the exact product supplied meets the applicable HCPCS code requirements and for verifying the payer’s billing and coverage rules before submitting a claim.';
        ok(rc.includes(D) && panelTxt.includes(D), 'the fixed disclaimer is in Victoria\'s card and the product panel');
      });
      await page.waitForTimeout(250);
      await t(`${label}: voice on — the reimbursement answer is spoken WITH the disclaimer and the globe glows while Victoria speaks`, async () => { const sp = await page.evaluate(() => [window.__spoken.slice(), window.__speakState.slice()]); const D = V._test.BILLING_DISCLAIMER; ok(sp[0].join(' ').includes('Here is what I found. ' + D) && sp[1].includes('speaking'), 'the spoken reimbursement answer ends with the fixed disclaimer: ' + JSON.stringify(sp).slice(0, 600)); });
      await t(`${label}: the reimbursement answer's audio came WITH the answer — no separate speak request; it starts as the text appears`, async () => {
        const L = await page.evaluate(() => document.getElementById('dvOrbHost').__dvSpeech.log.slice());
        const sh = L.filter((x) => x.e === 'answer_shown' && x.audio_with_answer); ok(sh.length >= 1, 'answer_shown with audio: ' + JSON.stringify(L.slice(-8)));
        const pl = L.filter((x) => x.e === 'playing' && x.kind === 'answer' && x.after_text_ms != null); ok(pl.length && pl[pl.length - 1].after_text_ms < 300, 'text-to-audio ' + JSON.stringify(pl.slice(-2)));
        ok(!speakReqs.some((x) => x.kind === 'answer' && /^Here is what I found\. HCPS is not/.test(x.text)), 'the first part came with the answer — never requested again: ' + JSON.stringify(speakReqs.map((x) => x.text.slice(0, 40))));
        const sp = await page.evaluate(() => window.__spoken.slice()); const parts = VO.chunks('Here is what I found.\n\n' + V._test.BILLING_DISCLAIMER);
        const at = sp.indexOf(parts[0]); ok(at >= 0 && parts.every((p, i) => sp[at + i] === p), 'all parts played in order: ' + JSON.stringify(sp.slice(-5)));
        ok(speakReqs.filter((x) => x.kind === 'answer' && parts.slice(1).includes(x.text)).every((x) => /^tok-\d+-\d+$/.test(x.token)), 'each later part fetched with its own token'); });
      /* the fee schedule from Victoria's card → the existing page */
      await page.evaluate(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.card .fee').click());
      await page.waitForSelector('#view-reimb .rb-ret', { timeout: 15000 });
      await t(`${label}: "Open the fee schedule" opens the portal's own fee schedule (with ← Back to the product)`, async () => { ok(/Back to K2 16/.test(await page.$eval('#view-reimb .rb-ret', (e) => e.textContent)));
        ok((await page.$eval('#view-reimb', (e) => e.textContent)).includes(V._test.BILLING_DISCLAIMER), 'the fee-schedule lookup shows the fixed disclaimer'); });
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
      /* a browser that blocks audio: the text stays, "Tap to hear Victoria" retries from a tap */
      const blk = await page.evaluate(async () => { const h = document.getElementById('dvPanelHost'); const s = h.shadowRoot; const o = document.getElementById('dvOrbHost').shadowRoot.querySelector('button');
        if (!s.querySelector('.p').hidden) s.querySelector('.x').click();
        window.__blockAudio = true; o.click(); await new Promise((r) => setTimeout(r, 600));
        const st = { text: s.querySelector('.hello').textContent, retry: !s.querySelector('.retry').hidden, note: s.querySelector('.vnote').textContent };
        window.__blockAudio = false; const n = window.__spoken.length; s.querySelector('.retry').click(); await new Promise((r) => setTimeout(r, 200));
        return Object.assign(st, { retried: window.__spoken.slice(n), retryHidden: s.querySelector('.retry').hidden }); });
      await t(`${label}: audio blocked — the greeting stays as text with "Tap to hear Victoria"; the retry speaks it`, () => ok(/Hi, Ann/.test(blk.text) && blk.retry && /didn.t play/.test(blk.note) && blk.retried.length === 1 && /Hi, Ann/.test(blk.retried[0]) && blk.retryHidden, JSON.stringify(blk)));
      /* audio not fetched yet: the tap unlocks the element with a silent clip, the real audio plays when it arrives */
      const nr = await page.evaluate(async () => { const S = document.getElementById('dvOrbHost').__dvSpeech; const sp0 = window.__silentPlays, n = window.__plays.length;
        S.speak('An answer that was not fetched yet.', { kind: 'answer', token: 'tok-x' }); const silentInTap = window.__silentPlays - sp0;
        await new Promise((r) => setTimeout(r, 400)); const played = window.__spoken.slice(n);
        S.speak('An answer that was not fetched yet.', { kind: 'answer', token: 'tok-x' }); await new Promise((r) => setTimeout(r, 25)); const playingBeforeStop = !S.audio.paused; S.stop();
        return { silentInTap, played, playingBeforeStop, stoppedLogged: S.log.some((x) => x.e === 'stopped') }; });
      await t(`${label}: audio not ready at the tap — a silent clip unlocks the element in the tap, then Victoria's audio plays`, () => ok(nr.silentInTap === 1 && nr.played.length === 1 && nr.played[0] === 'An answer that was not fetched yet.' && nr.playingBeforeStop && nr.stoppedLogged, JSON.stringify(nr)));
      await page.waitForTimeout(300);
      await t(`${label}: answers are spoken only with the server's token for that answer; playback is REPORTED as browser events (requested / playing / ended / stopped / blocked), not as "heard"`, () => {
        const ans = speakReqs.filter((x) => x.kind === 'answer'); ok(ans.length >= 1 && ans.every((x) => /^tok-/.test(x.token || '')), JSON.stringify(ans).slice(0, 400));
        for (const e of ['requested', 'playing', 'ended', 'stopped', 'blocked']) ok(playbacks.includes(e), 'missing playback event ' + e + ': ' + JSON.stringify(playbacks)); });
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
    /* the globe launcher: the Connect 360 still at once; the looping globe video only without reduced motion */
    const globe = async (pg) => pg.evaluate(async () => { window.DV = { greeting: 'Hi', support: {} }; delete window.__dvOrb; const old = document.getElementById('dvOrbHost'); if (old) old.remove();
      const s = document.createElement('script'); s.src = '/assets/dealer-victoria.js?v=3&t=' + Math.random(); await new Promise((r) => { s.onload = r; document.head.appendChild(s); });
      await new Promise((r) => setTimeout(r, 2500)); const b = document.getElementById('dvOrbHost').shadowRoot.querySelector('button'); const img = b.querySelector('img'); const v = b.querySelector('video');
      return { still: !!(img && img.complete && img.naturalWidth === 240), video: !!v, src: v ? [...v.querySelectorAll('source')].map((x) => x.getAttribute('src')) : [], live: b.classList.contains('live') }; });
    const gr = await globe(page);
    await t('phone: reduced motion — the globe is the still picture only (no video)', () => ok(gr.still && !gr.video, JSON.stringify(gr)));
    await ctx.close();
    { const { ctx: c2, page: p2 } = await open(b, 1280, 800, {}); const gm = await globe(p2);
      await t('desktop: the launcher is the animated Victoria globe (Connect 360 still at once, the globe video after the page is usable)', () => ok(gm.still && gm.video && gm.src.join() === '/assets/victoria/orb.webm,/assets/victoria/orb.mp4', JSON.stringify(gm)));
      await c2.close(); }
    console.log('     placement: ' + JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, { viewport: v.viewport, orb: [v.orb.left, v.orb.top, v.orb.w], cart: [v.cart.left, v.cart.top, v.cart.w], panel: [Math.round(v.panel.left), Math.round(v.panel.top), Math.round(v.panel.right), Math.round(v.panel.bottom)], open_covers: v.covered_when_open.filter((x) => x.by_panel).map((x) => x.control) }]))));
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'dv-placement.json'), JSON.stringify(report, null, 1));
  } finally { await b.close(); }
  console.log(`\ndealer victoria (TEST preview): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
