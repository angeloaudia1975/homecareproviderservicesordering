/* DEALER VICTORIA — the continuous spoken conversation (owner 2026-11-20 20:11) on the REAL portal page, desktop 1280 × 800
   and phone 390 × 844. Chromium runs with its fake microphone (a real MediaStream from getUserMedia) and real Web Audio; the
   Deepgram Voice Agent socket is a stand-in that behaves like the service (Settings → SettingsApplied → greeting; a user turn
   → FunctionCallRequest; FunctionCallResponse → the agent speaks its `say`; barge-in = UserStartedSpeaking). The panel's
   functions run the admin repo's own tool code (_dealer_victoria_tools.js) through the real portal screens.
   Checks: opening starts the conversation with no button (greeting in the agent, microphone streaming); K3 → price → quote →
   reports without pressing a microphone or Ask; each result is ON SCREEN before the agent is told to say it; follow-ups carry
   the earlier turns; interruption stops playback at once; Close mid-answer drops the pending answer, stops the microphone and
   the connection; reopening talks again; "Type instead"; the introduction card; microphone refused / connection lost
   explained; signing out stops everything first. What this does NOT prove: a real person's voice through a real microphone,
   Deepgram's real turn detection, or audio heard through a speaker — see the live checks.
   ADMIN_REPO=<admin repo> node test/dealer-victoria-convo.browser.js */
const path = require('path');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'adm');
const VT = require(path.join(ADM, 'netlify', 'functions', '_dealer_victoria_tools.js'));
const DVA = require(path.join(ADM, 'netlify', 'functions', '_dealer_voice_agent.js'));
const { chromium, open } = require('./_shop-harness.js');
const PUB = path.join(__dirname, '..', 'public');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 600)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const PRICE = { 'K3DK16FTADJ': 512.5, 'K3DK18FTADJ': 530 };
const deps = { files: { manufacturersFile: async () => require(path.join(PUB, 'data', 'manufacturers.json')), catalogFile: async (s) => { try { return require(path.join(PUB, 'data', s + '.json')); } catch (e) { return []; } } },
  sbGet: async () => [],
  orders: () => async (ev) => { const b = JSON.parse(ev.body); const o = b.orders[0];
    if (o.manufacturer_slug !== 'dalton') return { statusCode: 403, body: JSON.stringify({ ok: false, status: 'not_entitled' }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, orders: [{ manufacturer_slug: 'dalton', items: o.items.map((i) => ({ code: i.code, qty: i.qty, unit: PRICE[i.code] || 400, line_total: (PRICE[i.code] || 400) * i.qty, uom: 'Each', contract: null, commercial: { msrp: null, map: null } })) }] }) }; },
  storefront: () => async () => ({ statusCode: 200, body: JSON.stringify({ ok: true, locations: [] }) }),
  fetch: async () => ({ ok: true, json: async () => require(path.join(PUB, 'data', 'help.json')) }) };
/* what the server's model would choose (scripted); the history it was sent is checked separately */
const SCRIPT = [
  [/^Find Dalton K3 wheelchairs/i, 'open_shop_search', { query: 'Dalton K3 wheelchairs' }],
  [/price/i, 'find_products', { query: 'K3DK16FTADJ' }],
  [/quote/i, 'quote_products', { items: [{ code: 'K3DK16FTADJ', qty: 1 }] }],
  [/reports/i, 'open_portal_tool', { view: 'reports' }],
];
const GREET = 'Hello, Ann. I’m Victoria, your personal assistant in the 360 Dealer Portal. How can I help you today?';

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const [w, h, label] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, { prices: { dalton: 109 }, access: { your_accounts: ['dalton'], available: [], request_access: [], golden: 'None' } });
      await ctx.grantPermissions(['microphone']);
      const calls = [], toolReqs = [], ends = []; let sess = 0, holdTool = null, convoOn = true, sessionFail = false;
      await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); calls.push(x.action); let body = { ok: true };
        if (x.action === 'status') body = { ok: true, enabled: true, preview: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', available: false }, ai: { available: true }, conversation: { available: convoOn }, support: { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us', chat: false }, greeting: GREET, greeting_again: 'Hi, Ann. How can I help you today?' };
        else if (x.action === 'voice_session') { if (sessionFail) body = { ok: false, error: 'voice_unavailable', message: 'Victoria\'s voice isn\'t available just now. You can type instead.' };
          else { sess++; const g = sess === 1 ? GREET : 'Hi, Ann. How can I help you today?'; body = { ok: true, session_id: 's' + sess, url: DVA.AGENT_URL, token: 'tkn' + sess, max_minutes: 10, greeting: g, settings: DVA.settings({ first_name: 'Ann', today: '2026-11-20', voice: 'aura-2-thalia-en', greeting: g }) }; } }
        else if (x.action === 'voice_end') { ends.push(x); }
        else if (x.action === 'intro') body = { ok: true, text: DVA.intro('Ann') };
        else if (x.action === 'hello') body = { ok: true, greeting: 'Hi, Ann. How can I help you today?' };
        else if (x.action === 'voice_tool' || x.action === 'ask') {
          const q = x.action === 'ask' ? x.question : (x.args || {}).question; toolReqs.push({ action: x.action, q, history: x.history || [], session: x.session_id });
          if (holdTool) await holdTool;
          const s = SCRIPT.find(([re]) => re.test(q)); const out = s ? await VT.RUN[s[1]]({ dealer_id: 'd1', bearer: 'Bearer tok', page: x.page || {} }, deps, s[2]) : { result: {} };
          const say = s && s[1] === 'find_products' ? 'Your price for the K3 is shown in the card.' : s && s[1] === 'quote_products' ? 'Nothing is saved or sent until you review it.' : 'Here is what I found.';
          body = { ok: true, say, answer: say, cards: out.card ? [out.card] : [], actions: [].concat(out.actions || [], out.action ? [out.action] : []) }; }
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); });
      /* the Deepgram Voice Agent stand-in */
      await page.evaluate(() => {
        window.__PREVIEW__ = null; window.needsAccess = () => false; window.print = () => {};
        const D = window.__dg = { sockets: [], sent: [], responses: [], audioIn: 0, n: 0 };
        const snap = () => ({ active: typeof state !== 'undefined' ? state.active : null, rows: document.querySelectorAll('.sl-search .gsr2').length, h: (document.querySelector('.sl-search .sl-shead h2') || {}).textContent || '',
          quote: window.P360Quote && window.P360Quote.picked ? window.P360Quote.picked().map((r) => r.sku) : null, card: (() => { const hh = document.getElementById('dvPanelHost'); return hh ? [...hh.shadowRoot.querySelectorAll('.log .card')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()).slice(-3) : []; })() });
        class FakeWS {
          constructor(url, protos) { this.url = url; this.protos = protos; this.readyState = 0; D.sockets.push(this); D.cur = this; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 20); }
          send(d) { if (typeof d !== 'string') { D.audioIn++; return; } const m = JSON.parse(d); D.sent.push(m);
            if (m.type === 'Settings') setTimeout(() => { this.msg({ type: 'Welcome' }); this.msg({ type: 'SettingsApplied' }); if (m.agent && m.agent.greeting) this.speak(m.agent.greeting); }, 20);
            if (m.type === 'FunctionCallResponse') { const c = JSON.parse(m.content); D.responses.push({ say: c.say, at: snap() }); if (c.say) setTimeout(() => this.speak(c.say), 10); }
            if (m.type === 'InjectAgentMessage') setTimeout(() => this.speak(m.message), 10); }
          msg(o) { if (this.readyState === 1 && this.onmessage) this.onmessage({ data: JSON.stringify(o) }); }
          speak(text, secs) { if (this.readyState !== 1) return; this.msg({ type: 'AgentStartedSpeaking' }); this.msg({ type: 'ConversationText', role: 'assistant', content: text });
            const pcm = new Int16Array(Math.round(24000 * (secs || 0.25))); for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.sin(i / 9) * 2500);
            this.onmessage && this.onmessage({ data: pcm.buffer }); setTimeout(() => this.msg({ type: 'AgentAudioDone' }), 40); }
          user(text) { this.msg({ type: 'UserStartedSpeaking' }); this.msg({ type: 'ConversationText', role: 'user', content: text }); this.msg({ type: 'AgentThinking' });
            this.msg({ type: 'FunctionCallRequest', functions: [{ id: 'f' + (++D.n), name: 'ask_victoria', arguments: JSON.stringify({ question: text }), client_side: true }] }); }
          close() { if (this.readyState === 3) return; this.readyState = 3; this.closedByPage = true; }
          drop() { this.readyState = 3; this.onclose && this.onclose({ code: 1011 }); }
        }
        FakeWS.OPEN = 1; window.WebSocket = FakeWS;
        /* every microphone track handed out, so the test can see it stop */
        const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); window.__tracks = []; window.__denyMic = false;
        navigator.mediaDevices.getUserMedia = async (c) => { if (window.__denyMic) throw new DOMException('denied', 'NotAllowedError'); if (window.__gumDelay) await new Promise((r) => setTimeout(r, window.__gumDelay)); const s = await gum(c); s.getTracks().forEach((tr) => window.__tracks.push(tr)); return s; };
      });
      await page.evaluate(() => window.dvProbe()); await page.waitForFunction(() => document.getElementById('dvOrbHost') && window.DVVoice, null, { timeout: 15000 });
      const P = (f, a) => page.evaluate(([fn, x]) => (new Function('s', 'x', fn))(document.getElementById('dvPanelHost') && document.getElementById('dvPanelHost').shadowRoot, x), [f, a]);
      const orbClick = () => page.evaluate(() => document.getElementById('dvOrbHost').shadowRoot.querySelector('button').click());
      const until = (fn, a, ms) => page.waitForFunction(fn, a, { timeout: ms || 15000 });
      const say = async (q) => { const n = await page.evaluate(() => window.__dg.responses.length); await page.evaluate((x) => window.__dg.cur.user(x), q);
        await until((k) => window.__dg.responses.length > k, n, 20000); await page.waitForTimeout(400); return page.evaluate(() => window.__dg.responses[window.__dg.responses.length - 1]); };
      const st = () => P("return s.querySelector('.st').dataset.s;");

      /* 1 — opening starts the conversation; no button press */
      await orbClick();
      await until(() => { const hh = document.getElementById('dvPanelHost'); return hh && hh.shadowRoot.querySelector('.st').dataset.s === 'listening' && window.__dg.audioIn > 5; }, null, 15000);
      const o1 = await P("return { askHidden: s.querySelector('.ask').hidden, buttons: [...s.querySelectorAll('button')].filter(b=>!b.hidden && b.offsetParent).map(b=>b.textContent.trim()), hello: s.querySelector('.hello').textContent, bubbles: [...s.querySelectorAll('.log .bubble')].map(b=>b.textContent), status: s.querySelector('.st span').textContent };");
      const settings = await page.evaluate(() => window.__dg.sent.find((m) => m.type === 'Settings'));
      await t(`${label}: opening the globe starts the conversation — greeting by the agent in the Command Center voice, microphone streaming, "Listening" — with no microphone or Ask button`, () => {
        ok(o1.askHidden && !o1.buttons.some((x) => /^Ask$|🎤|🎙/.test(x)) && o1.buttons.some((x) => /Type instead/.test(x)) && o1.buttons.some((x) => /Learn what Victoria can do for you/.test(x)), JSON.stringify(o1.buttons));
        ok(o1.hello === GREET && o1.bubbles.length === 0 && o1.status === 'Listening', 'greeting shown once, not repeated as a bubble: ' + JSON.stringify(o1));
        ok(settings && settings.agent.greeting === GREET && settings.agent.speak.provider.model === 'aura-2-thalia-en' && settings.agent.think.functions[0].name === 'ask_victoria' && /Never say "HCPS"/.test(settings.agent.think.prompt), 'settings');
        ok(calls.filter((c) => c === 'voice_session').length === 1 && !calls.includes('hello'), 'one voice session, no separate hello: ' + calls.join(','));
      });
      /* 2 — K3 → price → quote → reports, by voice only */
      const r1 = await say('Find Dalton K3 wheelchairs');
      await t(`${label}: "Find Dalton K3 wheelchairs" — the results are on screen BEFORE the agent is told what to say, and she says the counted number (spoken short, details on screen)`, () =>
        ok(/for “Dalton K3 wheelchairs”/.test(r1.at.h) && r1.at.rows > 0 && new RegExp('Shop Products shows ' + r1.at.rows + ' results?\\.').test(r1.say) && !/Dalton K3 wheelchairs/.test(r1.say), JSON.stringify(r1)));
      if (label === 'phone') { const ph = await page.evaluate(() => ({ hidden: document.getElementById('dvPanelHost').shadowRoot.querySelector('.p').hidden, ring: document.getElementById('dvOrbHost').shadowRoot.querySelector('button').dataset.convo, aria: document.getElementById('dvOrbHost').shadowRoot.querySelector('button').getAttribute('aria-label'), live: window.__dg.cur.readyState }));
        await t('phone: the panel steps aside so the results are visible; the conversation keeps going and the globe shows a green ring saying Victoria is still listening', () => ok(ph.hidden && ph.ring === 'on' && /still listening/.test(ph.aria) && ph.live === 1, JSON.stringify(ph))); }
      const r2 = await say('What is my price on that one?');
      const tq2 = toolReqs[toolReqs.length - 1];
      await t(`${label}: follow-up about price — the earlier turn is sent as context; the price card is shown before she answers`, () => {
        ok(tq2.action === 'voice_tool' && tq2.history.length >= 1 && /K3 wheelchairs/.test(tq2.history[0].q), JSON.stringify(tq2));
        ok(r2.at.card.some((c) => /K3DK16FTADJ/.test(c) && /\$512\.50/.test(c)) && /Your price/.test(r2.say), JSON.stringify(r2)); });
      const r3 = await say('Help me prepare a quote for one of those');
      await t(`${label}: quote help — the draft quote holds K3DK16FTADJ before she says so; spoken short (no item number), "nothing saved or sent" said once`, () => ok(r3.at.quote && r3.at.quote.includes('K3DK16FTADJ') && /draft quote is open with 1 item/.test(r3.say) && (r3.say.match(/Nothing has been saved or sent/g) || []).length === 1 && !/Nothing is saved/.test(r3.say) && !/K3DK16FTADJ/.test(r3.say) && r3.at.card.some((c) => /1 × K3DK16FTADJ/.test(c)), JSON.stringify(r3)));
      const r4 = await say('Open my reports');
      await t(`${label}: "Open my reports" — Reports is on screen before she says it is open`, () => ok(r4.at.active === 'p360:reports' && /is open on the page/.test(r4.say), JSON.stringify(r4)));
      const turns = await page.evaluate(() => ({ socks: window.__dg.sockets.length, audioIn: window.__dg.audioIn }));
      await t(`${label}: four turns in ONE connection, the microphone streaming throughout — no button pressed between turns`, () => ok(turns.socks === 1 && toolReqs.filter((x) => x.action === 'voice_tool').length === 4 && toolReqs.every((x) => x.session === 's1'), JSON.stringify(turns)));
      if (label === 'phone') { await orbClick(); await page.waitForTimeout(200);
        const back = await page.evaluate(() => ({ open: !document.getElementById('dvPanelHost').shadowRoot.querySelector('.p').hidden, socks: window.__dg.sockets.length, ring: document.getElementById('dvOrbHost').shadowRoot.querySelector('button').dataset.convo || null }));
        await t('phone: tapping the globe brings the same conversation back (no new session, ring cleared)', () => ok(back.open && back.socks === 1 && !back.ring, JSON.stringify(back))); }
      const log = await P("return [...s.querySelectorAll('.log .bubble')].map(b=>[b.classList.contains('me')?'me':'v', b.textContent]);");
      await t(`${label}: the conversation is written out — the dealer's words and Victoria's, in order`, () => ok(log.filter((x) => x[0] === 'me').map((x) => x[1]).join('|') === 'Find Dalton K3 wheelchairs|What is my price on that one?|Help me prepare a quote for one of those|Open my reports' && log.filter((x) => x[0] === 'v').length === 4, JSON.stringify(log)));

      /* tab hidden → capture stops (tracks ended, KeepAlive), "Paused"; visible again → listening on a new track; away > 2 min ends */
      const vis = await page.evaluate(async () => { const W = (ms) => new Promise((r) => setTimeout(r, ms)); let hidden = false; Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
        const s = document.getElementById('dvPanelHost').shadowRoot; const D = window.__dg; const tr0 = window.__tracks.slice(-1)[0]; const a0 = D.audioIn;
        hidden = true; document.dispatchEvent(new Event('visibilitychange')); await W(300);
        const p = { st: s.querySelector('.st').dataset.s, text: s.querySelector('.st span').textContent, track: tr0.readyState }; const a1 = D.audioIn; await W(600); p.audioWhileHidden = D.audioIn - a1;
        hidden = false; document.dispatchEvent(new Event('visibilitychange')); await W(800);
        const r = { st: s.querySelector('.st').dataset.s, newTrack: window.__tracks.slice(-1)[0] !== tr0 && window.__tracks.slice(-1)[0].readyState === 'live', socket: D.cur.readyState, socks: D.sockets.length, audioAfter: D.audioIn > a1 };
        return { p, r }; });
      await t(`${label}: tab hidden — microphone capture stops (track ended, no audio sent) and the status says Paused; back on the tab she listens again on the same conversation`, () => {
        ok(vis.p.st === 'paused' && /Paused/.test(vis.p.text) && vis.p.track === 'ended' && vis.p.audioWhileHidden === 0, JSON.stringify(vis.p));
        ok(vis.r.st === 'listening' && vis.r.newTrack && vis.r.socket === 1 && vis.r.audioAfter, JSON.stringify(vis.r)); });
      /* quick hide / show / hide / show while the microphone is still being granted: one resume at a time, no stream left
         capturing — after Close every microphone track this page ever got is ended */
      const race = await page.evaluate(async () => { const W = (ms) => new Promise((r) => setTimeout(r, ms)); let hidden = false;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); const fire = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
        const n0 = window.__tracks.length; window.__gumDelay = 400; fire(true); await W(50); fire(false); await W(50); fire(true); await W(50); fire(false); await W(1200); window.__gumDelay = 0;
        const s = document.getElementById('dvPanelHost').shadowRoot; const mid = { st: s.querySelector('.st').dataset.s, live: window.__tracks.filter((t) => t.readyState === 'live').length, got: window.__tracks.length - n0 };
        fire(true); await W(50); fire(false); await W(80); fire(true); await W(600);   // hidden while a grant is pending: stays paused, nothing live
        const hiddenAfter = { st: s.querySelector('.st').dataset.s, live: window.__tracks.filter((t) => t.readyState === 'live').length };
        fire(false); await W(800); return { mid, hiddenAfter, back: s.querySelector('.st').dataset.s }; });
      await t(`${label}: quick hide/show while the microphone is being granted — one resume at a time; hidden again during a grant stays paused with nothing capturing`, () => {
        ok(race.mid.st === 'listening' && race.mid.live === 1 && race.mid.got === 1, 'one live track after the double resume: ' + JSON.stringify(race.mid));
        ok(race.hiddenAfter.st === 'paused' && race.hiddenAfter.live === 0 && race.back === 'listening', JSON.stringify(race)); });
      /* 3 — interruption */
      const intr = await page.evaluate(async () => { const D = window.__dg; D.cur.speak('A long answer that keeps going for a while.', 3); await new Promise((r) => setTimeout(r, 120));
        const before = document.getElementById('dvPanelHost').shadowRoot.querySelector('.st').dataset.s; D.cur.msg({ type: 'UserStartedSpeaking' }); await new Promise((r) => setTimeout(r, 60));
        return { before, after: document.getElementById('dvPanelHost').shadowRoot.querySelector('.st').dataset.s }; });
      await t(`${label}: interruption — Victoria is "Speaking", the dealer talks, playback stops at once and she is "Listening"`, () => ok(intr.before === 'speaking' && intr.after === 'listening', JSON.stringify(intr)));

      /* 4 — the introduction card */
      await P("s.querySelector('.learn').click();"); await until(() => window.__dg.sent.some((m) => m.type === 'InjectAgentMessage'), null, 8000); await page.waitForTimeout(400);
      const lr = await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; const inj = window.__dg.sent.filter((m) => m.type === 'InjectAgentMessage'); return { inj: inj.map((m) => m.message), shown: [...s.querySelectorAll('.log .bubble')].filter((b) => /personal assistant from Home Care Provider Services/.test(b.textContent)).length, small: s.querySelector('.learn').classList.contains('small'), st: s.querySelector('.st').dataset.s }; });
      await t(`${label}: "Learn what Victoria can do for you" — the introduction is spoken by the agent and shown once, then she listens; afterwards the card is a small link`, () => {
        ok(lr.inj.length === 1 && lr.inj[0] === DVA.intro('Ann') && /Home Care Provider Services/.test(lr.inj[0]) && !/HCPS/.test(lr.inj[0]) && lr.shown === 1 && lr.small && lr.st === 'listening', JSON.stringify(lr)); });

      /* 5 — Close while an answer is on its way: nothing more is said, microphone and connection stop */
      let release; holdTool = new Promise((r) => { release = r; });
      const nResp = await page.evaluate(() => window.__dg.responses.length);
      await page.evaluate(() => window.__dg.cur.user('Find Dalton K3 wheelchairs again'));
      await page.waitForTimeout(400);
      const thinking = await st();
      await P("s.querySelector('.x').click();");
      const cl = await page.evaluate(() => ({ tracks: window.__tracks.map((tr) => tr.readyState), closed: window.__dg.cur.closedByPage === true, hidden: document.getElementById('dvPanelHost').shadowRoot.querySelector('.p').hidden }));
      release(); holdTool = null; await page.waitForTimeout(1200);
      const after = await page.evaluate(() => window.__dg.responses.length);
      await t(`${label}: Close while Victoria is thinking — the connection closes and every microphone track stops at once; the late answer is dropped (never sent to be spoken); minutes recorded`, () => {
        ok(thinking === 'thinking' && cl.hidden && cl.closed && cl.tracks.length && cl.tracks.every((x) => x === 'ended'), JSON.stringify({ thinking, cl }));
        ok(after === nResp, 'a response was sent after Close'); ok(ends.some((e) => e.session_id === 's1' && e.reason === 'closed' && e.turns >= 4 && e.interruptions >= 1), JSON.stringify(ends)); });

      /* 6 — reopen: talking again */
      await orbClick(); await until(() => { const s = document.getElementById('dvPanelHost').shadowRoot; return s.querySelector('.st').dataset.s === 'listening' && window.__dg.sockets.length === 2; }, null, 15000);
      const ro = await P("return { hello: s.querySelector('.hello').textContent, learnSmall: s.querySelector('.learn').classList.contains('small') };");
      await t(`${label}: reopening starts the conversation again (new session, short welcome) and the introduction does not replay`, () => ok(ro.hello === 'Hi, Ann. How can I help you today?' && ro.learnSmall && ends.length >= 1, JSON.stringify(ro)));

      /* 7 — Type instead */
      await P("s.querySelector('.type').click();"); await page.waitForTimeout(200);
      const ty = await page.evaluate(() => { const s = document.getElementById('dvPanelHost').shadowRoot; return { ask: !s.querySelector('.ask').hidden, st: s.querySelector('.st span').textContent, closed: window.__dg.cur.closedByPage === true, tracks: window.__tracks.slice(-1).map((tr) => tr.readyState) }; });
      const nAsk = toolReqs.length; await P("s.querySelector('.ask input').value='Open my reports'; s.querySelector('.go').click();"); await page.waitForTimeout(1500);
      const typed = toolReqs[nAsk] || {};
      await t(`${label}: "Type instead" — listening and speaking stop for this opening; typed questions go through the same answers, not spoken`, () => ok(ty.ask && /Typing/.test(ty.st) && ty.closed && ty.tracks[0] === 'ended' && typed.action === 'ask' && typed.q === 'Open my reports', JSON.stringify({ ty, typed })));
      await P("s.querySelector('.x').click();"); await orbClick();
      await until(() => window.__dg.sockets.length === 3 && document.getElementById('dvPanelHost').shadowRoot.querySelector('.st').dataset.s === 'listening', null, 15000);
      await t(`${label}: after typing, the next opening talks again`, async () => ok(await P("return s.querySelector('.ask').hidden;"), 'the typing bar stayed'));

      /* 8 — the connection drops: explained, typing offered, "Talk to Victoria" restarts */
      await page.evaluate(() => window.__dg.cur.drop()); await page.waitForTimeout(200);
      const dr = await P("return { warn: [...s.querySelectorAll('.warn')].map(w=>w.textContent).join(' | '), ask: !s.querySelector('.ask').hidden, again: !s.querySelector('.again').hidden };");
      await t(`${label}: the voice connection drops — it says so, typing opens, and "Talk to Victoria" is offered`, () => ok(/voice connection closed/.test(dr.warn) && dr.ask && dr.again, JSON.stringify(dr)));
      await P("s.querySelector('.again').click();"); await until(() => window.__dg.sockets.length === 4 && document.getElementById('dvPanelHost').shadowRoot.querySelector('.st').dataset.s === 'listening', null, 15000);
      await t(`${label}: "Talk to Victoria" starts talking again`, () => ok(true));

      /* KeepAlive flows for the whole conversation; Deepgram's "no audio received" error is explained as a microphone problem */
      await page.waitForTimeout(5600);
      const ka = await page.evaluate(() => window.__dg.sent.filter((m) => m.type === 'KeepAlive').length);
      await page.evaluate(() => window.__dg.cur.msg({ type: 'Error', code: 'CLIENT_MESSAGE_TIMEOUT', description: 'We did not receive audio within our timeout.' })); await page.waitForTimeout(200);
      const cmt = await P("return { warn: [...s.querySelectorAll('.warn')].map(w=>w.textContent).join(' | '), ask: !s.querySelector('.ask').hidden, again: !s.querySelector('.again').hidden };");
      await t(`${label}: KeepAlive is sent while listening; "no audio received" from the service is explained as a microphone problem with Talk to Victoria offered`, () => ok(ka >= 1 && /couldn.t hear your microphone/.test(cmt.warn) && cmt.ask && cmt.again, JSON.stringify({ ka, cmt })));
      await P("s.querySelector('.again').click();"); await until(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.st').dataset.s === 'listening', null, 15000);
      /* 9 — microphone refused */
      await P("s.querySelector('.x').click();"); await page.evaluate(() => { window.__denyMic = true; }); await orbClick(); await page.waitForTimeout(500);
      const mic = await P("return { warn: [...s.querySelectorAll('.warn')].map(w=>w.textContent).join(' | '), ask: !s.querySelector('.ask').hidden, st: s.querySelector('.st span').textContent };");
      await t(`${label}: microphone refused — explained (how to allow it in the browser), typing opens, no silent wait`, () => ok(/Microphone access is blocked/.test(mic.warn) && /site settings/.test(mic.warn) && mic.ask && !/Listening/.test(mic.st), JSON.stringify(mic)));
      await page.evaluate(() => { window.__denyMic = false; });

      /* 10 — the voice service refuses (cap reached / not configured) */
      await P("s.querySelector('.x').click();"); sessionFail = true; await orbClick(); await page.waitForTimeout(600);
      const sv = await P("return { warn: [...s.querySelectorAll('.warn')].map(w=>w.textContent).join(' | '), ask: !s.querySelector('.ask').hidden };");
      await t(`${label}: the voice service is unavailable — its message is shown and typing opens`, () => ok(/voice isn.t available just now/.test(sv.warn) && sv.ask, JSON.stringify(sv)));
      sessionFail = false;

      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      await t(`${label}: no sideways scroll`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
      /* 11 — sign out stops everything first */
      await P("s.querySelector('.x').click();"); await orbClick(); await until(() => document.getElementById('dvPanelHost').shadowRoot.querySelector('.st').dataset.s === 'listening', null, 15000);
      await page.evaluate(() => { const sock = window.__dg.cur; const orig = window.__dvVoiceStop; window.__dvVoiceStop = () => { orig();
        sessionStorage.setItem('dvso', JSON.stringify({ closed: sock.closedByPage === true, tracks: window.__tracks.slice(-1).map((tr) => tr.readyState), panel: !!document.getElementById('dvPanelHost') })); }; });
      await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => {}), page.evaluate(() => { setTimeout(() => signOut(), 0); })]);
      const so = await page.evaluate(() => JSON.parse(sessionStorage.getItem('dvso') || 'null'));
      await t(`${label}: signing out stops the microphone and the connection before anything else`, () => ok(so && so.closed && so.tracks[0] === 'ended', JSON.stringify(so)));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\ndealer victoria conversation: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
