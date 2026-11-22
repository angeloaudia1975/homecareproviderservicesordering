/* Dealer Victoria — the closed orb (owner 2026-11-19 22:07, TEST-dealer preview). Loaded by the portal ONLY when
   dealer-victoria-api says this signed-in dealership may use Victoria (TEST dealerships during the preview).
   The launcher is the animated Victoria globe used in Connect 360 (owner 2026-11-20 10:37): a 5.6 KB still shows at once;
   the looping globe video (same files as Connect 360's approved blue orb) loads after the page is usable, never with
   prefers-reduced-motion, and pauses while the tab is hidden. The panel (greeting, support contact, voice) loads when the
   dealer first opens it.
   Voice on every opening: every deliberate tap that OPENS Victoria turns voice on and speaks the welcome for this person
   inside that same tap (browsers only play audio started by a deliberate interaction) — no AI call; the welcome audio, in
   Victoria's Command Center voice (Deepgram), was fetched ahead of the tap.
   Place: lower right, where the HCPS chat button was (the chat now opens from "Contact HCPS support" in the panel); it
   stays clear of other bottom-right fixed elements and lifts above a page control (Add to cart, quantity …) when the
   dealer stops scrolling with one beneath it. If the panel cannot load, a small support card still opens. */
(function () {
  if (window.__dvOrb) return; window.__dvOrb = 1;
  const host = document.createElement('div'); host.id = 'dvOrbHost';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147482000;width:56px;height:56px';
  const sh = host.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>
    :host{all:initial}
    button{all:unset;box-sizing:border-box;width:56px;height:56px;border-radius:50%;cursor:pointer;display:block;position:relative;overflow:hidden;
      background:radial-gradient(circle at 38% 32%,#e9f7ff 0,#7fd3ff 18%,#1681c2 55%,#0b1f33 100%);
      box-shadow:0 0 18px rgba(80,185,255,.45),0 0 40px rgba(110,90,255,.25),0 4px 14px rgba(11,31,51,.35)}
    button img,button video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none}
    button video{opacity:0;transition:opacity .6s}button.live video{opacity:1}
    button[data-s="speaking"]{box-shadow:0 0 26px rgba(80,185,255,.85),0 0 60px rgba(110,90,255,.45),0 4px 14px rgba(11,31,51,.35)}
    button:focus-visible{outline:3px solid #fcb21e;outline-offset:3px}
    /* a conversation still going while the panel steps aside (phone): a green ring, and the button says so */
    button[data-convo="on"]{box-shadow:0 0 0 4px #22c55e,0 0 22px rgba(34,197,94,.6),0 4px 14px rgba(11,31,51,.35)}
    .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .fb{position:absolute;right:0;bottom:66px;width:240px;padding:12px;background:#fff;color:#0b1f33;border-radius:12px;box-shadow:0 10px 30px rgba(11,31,51,.3);font:14px/1.4 system-ui,sans-serif}
    .fb b{display:block;margin-bottom:6px}.fb a{display:block;min-height:44px;line-height:44px;color:#0f5c8f;font-weight:700}
  </style><button type="button" aria-label="Ask Victoria — your Home Care Provider Services assistant" aria-haspopup="dialog"><img src="/assets/victoria/orb-still.webp" alt="" decoding="async" draggable="false"><span class="lbl">Ask Victoria</span></button>`;
  document.body.appendChild(host);
  /* the globe: still now (a failed still leaves the gradient — never a broken image); motion once the page is usable */
  const ob0 = sh.querySelector('button'); const still = ob0.querySelector('img'); still.onerror = () => still.remove();
  const RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function motion() {
    if (RM.matches || ob0.querySelector('video')) return;
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.setAttribute('aria-hidden', 'true'); v.setAttribute('tabindex', '-1'); v.disablePictureInPicture = true; v.preload = 'auto';
    for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) { const so = document.createElement('source'); so.src = '/assets/victoria/orb.' + ext; so.type = type; v.appendChild(so); }
    v.addEventListener('playing', () => ob0.classList.add('live'), { once: true }); v.onerror = () => v.remove();
    ob0.appendChild(v); v.playbackRate = 0.6; if (!document.hidden) v.play().catch(() => {});
  }
  /* the panel script is fetched once the page is usable too, so the first opening shows the greeting at once */
  const PANEL_SRC = () => (window.DV_PANEL_SRC || '/assets/dealer-victoria-panel.js?v=18');
  let panelLoad = null;
  const loadPanel = () => panelLoad || (panelLoad = window.DealerVictoriaPanel ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement('script'); s.src = PANEL_SRC(); s.onload = ok; s.onerror = (e) => { panelLoad = null; bad(e); }; document.head.appendChild(s); }));
  const idle = () => { motion(); loadPanel().catch(() => {}); const D = window.DV || {}; SPEECH.prefetch(D.greeting); if (D.greeting_again && D.greeting_again !== D.greeting) SPEECH.prefetch(D.greeting_again); };
  const goMotion = () => (window.requestIdleCallback ? requestIdleCallback(idle, { timeout: 1500 }) : setTimeout(idle, 300));
  if (document.readyState === 'complete') goMotion(); else addEventListener('load', goMotion, { once: true });
  if (RM.addEventListener) RM.addEventListener('change', () => { if (RM.matches) { const v = ob0.querySelector('video'); if (v) v.remove(); ob0.classList.remove('live'); } else goMotion(); });
  document.addEventListener('visibilitychange', () => { const v = ob0.querySelector('video'); if (v) { if (document.hidden) v.pause(); else v.play().catch(() => {}); } });

  /* ---- voice: one speech helper for the launcher and the panel (owner 2026-11-20 11:21: Victoria's Command Center voice) ----
     Victoria speaks with the Deepgram Aura-2 voice saved in the owner's Command Center settings (the server picks it; the
     portal never chooses a voice). The welcome audio is fetched ahead of the tap once the page is usable — and kept in the
     browser's Cache Storage by voice + text — so the opening tap only has to press play. If the audio is not ready yet, the
     tap starts a short silent clip on the SAME audio element (that is what lets a phone play the real audio a moment later).
     Every event is logged (host.__dvSpeech.log) and counted on the server as a browser REPORT (requested / playing / ended /
     stopped / blocked / failed) — playback events, not proof that a person heard it. If nothing starts, the panel keeps the
     text and offers "Tap to hear Victoria". */
  const SPEECH = (function () {
    const L = { onstate: null, log: [] }; const DVx = () => window.DV || {};
    const audio = new Audio(); audio.preload = 'auto'; audio.setAttribute('playsinline', ''); audio.setAttribute('aria-hidden', 'true');
    /* a 40 ms silent WAV made here (no file to load) — played inside the tap when the real audio is not ready yet */
    const SILENT = (function () { const n = 320, b = new Uint8Array(44 + n); const v = new DataView(b.buffer); const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
      let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return 'data:audio/wav;base64,' + btoa(s); })();
    let gen = 0, watch = 0, silent = false, reached = 0, seq = null; const ready = new Map(), pending = new Map();
    const ev = (e, x) => { L.log.push(Object.assign({ e, t: Math.round(performance.now()) }, x || {})); if (L.log.length > 200) L.log.shift(); };
    const report = (e) => { try { const d = DVx(); if (d.api) d.api({ action: 'playback', event: e }).catch(() => {}); } catch (er) {} };
    const set = (st, why) => { ob0.dataset.s = st === 'speaking' ? 'speaking' : 'idle'; if (L.onstate) try { L.onstate(st, why); } catch (e) {} };
    const fail = (my, why, kind) => { if (my !== gen) return; clearTimeout(watch); ev(kind || 'blocked', { why }); report(kind || 'blocked'); set('blocked', why); };
    audio.addEventListener('playing', () => { if (silent) return; clearTimeout(watch); reached = 0;
      if (seq && seq.my === gen && seq.i > 0) { ev('part_playing', { part: seq.i }); return; }   // only the first part counts as "started" 
      const last = (e) => [...L.log].reverse().find((x) => x.e === e); const rq = last('requested'), sh = last('answer_shown'), now = Math.round(performance.now());
      ev('playing', { src: 'deepgram', kind: rq ? rq.kind : null, after_request_ms: rq ? now - rq.t : null, after_text_ms: rq && rq.kind === 'answer' && sh ? now - sh.t : null }); report('playing'); set('speaking'); });
    audio.addEventListener('timeupdate', () => { if (!silent) reached = Math.max(reached, audio.currentTime || 0); });
    audio.addEventListener('ended', () => { if (silent) return;
      /* an answer in parts: the next part starts as soon as this one ends (the element is already allowed to play) */
      if (seq && seq.my === gen && seq.i < seq.parts.length - 1) { ev('part_ended', { part: seq.i }); seq.i++; playPart(gen, seq.i); return; }
      ev('ended', { played_s: Math.round(reached * 10) / 10, duration_s: Math.round((audio.duration || 0) * 10) / 10, parts: seq && seq.my === gen ? seq.parts.length : 1 }); seq = null; report('ended'); set('idle'); });
    audio.addEventListener('error', () => { if (silent) return; fail(gen, 'media_error', 'failed'); });
    L.supported = () => typeof Audio !== 'undefined' && !(DVx().voice && DVx().voice.available === false);
    L.voice = () => (DVx().voice || null);
    const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
    const store = (key) => (window.caches ? caches.open('dv-voice-v1').then((c) => c) : Promise.reject(new Error('no cache')));
    /* the audio for a text → object URL; greetings are kept in Cache Storage (by voice + text), answers only for this page */
    L.fetch = (text, kind, token) => {
      const k = kind + '|' + text; if (ready.has(k)) return Promise.resolve({ url: ready.get(k) }); if (pending.has(k)) return pending.get(k);
      const vid = (DVx().voice || {}).id || 'voice'; const ck = kind === 'greeting' ? '/__dv-voice/' + encodeURIComponent(vid) + '/' + fnv(text) : null;
      const p = (async () => {
        if (ck) { try { const c = await store(); const hit = await c.match(ck); if (hit) { const u = URL.createObjectURL(await hit.blob()); ready.set(k, u); return { url: u, cached: true }; } } catch (e) {} }
        let r = null; const tq = performance.now(); try { r = await DVx().api({ action: 'speak', kind, text, token }); } catch (e) { r = null; }
        ev('fetched', { kind, ok: !!(r && r.ok), wall_ms: Math.round(performance.now() - tq), server_ms: r && r.server_ms, deepgram_ms: r && r.deepgram_ms, error: r && !r.ok ? r.error : undefined });
        if (!r || r.ok !== true || !r.audio) return { error: (r && r.error) || 'voice_failed' };
        const bin = atob(r.audio), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const blob = new Blob([u8], { type: r.mime || 'audio/mpeg' });
        if (ck) { try { const c = await store(); await c.put(ck, new Response(blob, { headers: { 'content-type': blob.type } })); } catch (e) {} }
        const u = URL.createObjectURL(blob); ready.set(k, u); return { url: u, voice: r.voice };
      })().finally(() => pending.delete(k));
      pending.set(k, p); return p;
    };
    /* audio the server already made with the answer (ask voice:true) — kept so speak() plays it at once */
    L.preload = (text, kind, b64, mime) => { try { const k = (kind === 'answer' ? 'answer' : 'greeting') + '|' + text; if (ready.has(k) || !b64) return false;
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      ready.set(k, URL.createObjectURL(new Blob([u8], { type: mime || 'audio/mpeg' }))); return true; } catch (e) { return false; } };
    L.mark = (e, x) => ev(e, x);
    L.prefetch = (text) => (text && L.supported() ? L.fetch(text, 'greeting').then((r) => { ev('prefetched', { ok: !r.error, cached: !!r.cached }); return r; }) : Promise.resolve(null));
    function start(url, my) {
      silent = false; audio.src = url; try { audio.currentTime = 0; } catch (e) {}
      const p = audio.play(); if (p && p.catch) p.catch((err) => fail(my, (err && err.name) || 'blocked'));
      clearTimeout(watch); watch = setTimeout(() => { if (my === gen && audio.paused) fail(my, 'no_start'); }, 4000);
    }
    /* an answer in parts [{text, token}] — the first plays as soon as it is ready (usually it came with the answer), each next
       part when the previous one ends; audio is fetched only one part ahead, so Voice off never pays for the rest and the
       server's spend counter sees one request at a time */
    function playPart(my, i) {
      const c = seq && seq.parts[i]; if (!c || my !== gen) return; const k = 'answer|' + c.text;
      const nx = seq.parts[i + 1]; if (nx) L.fetch(nx.text, 'answer', nx.token);   // one part ahead: no wasted audio after Voice off
      if (ready.has(k)) { start(ready.get(k), my); return; }
      clearTimeout(watch); watch = setTimeout(() => { if (my === gen && (silent || audio.paused)) fail(my, 'slow'); }, 15000);   // a part may be asked for twice (up to 6 s each)
      /* a part that could not be made is asked for once more before the panel offers "Tap to hear Victoria" */
      const go = (again) => L.fetch(c.text, 'answer', c.token).then((r) => { if (my !== gen || !seq || seq.i !== i) return;
        if (r.error && !again) { ev('part_retry', { part: i, why: r.error }); return go(true); }
        if (r.error) return fail(my, r.error, 'failed'); start(r.url, my); });
      go(false);
    }
    L.speakParts = (parts) => {
      const list = (parts || []).filter((p) => p && p.text); if (!list.length) return false;
      if (list.length === 1) return L.speak(list[0].text, { kind: 'answer', token: list[0].token });
      clearTimeout(watch); const my = ++gen;
      if (!L.supported()) { set('blocked', 'unsupported'); return false; }
      seq = { my, parts: list, i: 0 }; ev('requested', { kind: 'answer', parts: list.length }); report('requested');
      try { if (!audio.paused) audio.pause(); } catch (e) {}
      list.slice(0, 2).forEach((c) => { L.fetch(c.text, 'answer', c.token); });   // the first two now; each later part one ahead
      if (!ready.has('answer|' + list[0].text)) { silent = true; try { audio.src = SILENT; const pp = audio.play(); if (pp && pp.catch) pp.catch(() => {}); } catch (e) {} }
      playPart(my, 0); return true;
    };
    /* called synchronously inside the opening tap (before any await) */
    L.speak = (text, opts) => {
      const o = opts || {}, kind = o.kind === 'answer' ? 'answer' : 'greeting'; clearTimeout(watch); const my = ++gen; seq = null;
      if (!text) return false;
      if (!L.supported()) { set('blocked', 'unsupported'); return false; }
      ev('requested', { kind }); report('requested');
      try { if (!audio.paused) audio.pause(); } catch (e) {}
      const k = kind + '|' + text;
      if (ready.has(k)) { start(ready.get(k), my); return true; }
      silent = true; try { audio.src = SILENT; const pp = audio.play(); if (pp && pp.catch) pp.catch(() => {}); } catch (e) {}
      watch = setTimeout(() => { if (my === gen && (silent || audio.paused)) fail(my, 'slow'); }, 9000);
      L.fetch(text, kind, o.token).then((r) => { if (my !== gen) return; if (r.error) return fail(my, r.error, 'failed'); start(r.url, my); });
      return true;
    };
    L.stop = () => { clearTimeout(watch); gen++; seq = null; const was = !silent && !audio.paused; try { audio.pause(); } catch (e) {} if (was) { ev('stopped'); report('stopped'); } silent = false; set('idle'); };
    L.audio = audio;
    return L;
  })();
  host.__dvSpeech = SPEECH;

  /* stack above the bottom-right fixed elements (support chat launcher, Golden cart pill); a full-screen chat window
     or overlay is ignored (it is not a launcher) */
  const GAP = 12;
  function place() {
    const W = innerWidth, H = innerHeight; let top = H - 16;
    /* launchers are top-level elements (Zoho's #zsiq_float, the Golden cart pill): only body's children are measured, so
       a re-check costs well under a millisecond however large the page is */
    [...document.body.children, ...document.querySelectorAll('#zsiq_float, .gck-pill')].forEach((el) => {
      if (el === host || host.contains(el)) return;
      const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
      if (r.width > W * 0.6 || r.height > H * 0.5) return;            // panels / overlays, not launchers
      if (r.right < W - 140 || r.bottom < H - 200) return;            // only the bottom-right corner
      top = Math.min(top, r.top);
    });
    let bottom = Math.max(16, Math.round(H - top + GAP));
    /* never rest on top of a page control (Add to cart, quantity, Add to a quote, checkout …): when the dealer stops
       scrolling with one under the orb, the orb lifts just above it; it settles back when the corner is clear */
    for (let i = 0; i < 6; i++) {
      const hit = coveredControl(W - 16 - 56, H - bottom - 56, 56, 56); if (!hit) break;
      const nb = Math.round(H - hit.top + GAP); if (nb > H * 0.6) break; bottom = Math.max(bottom + 1, nb);
    }
    host.style.bottom = bottom + 'px';
  }
  const CTRL = 'button,a[href],input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])';
  function coveredControl(x, y, w, h) {
    let best = null; host.style.pointerEvents = 'none'; host.style.visibility = 'hidden';
    try { for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) {
      const el = document.elementFromPoint(x + w * fx, y + h * fy); if (!el) continue;
      const c = el.closest(CTRL); if (!c || c === document.body) continue;
      const cs = getComputedStyle(c); if (cs.position === 'fixed') continue;          // another corner widget, handled above
      const r = c.getBoundingClientRect(); if (!best || r.top < best.top) best = r; } }
    finally { host.style.visibility = ''; host.style.pointerEvents = ''; }
    return best;
  }
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(place, 120); };
  addEventListener('resize', later); addEventListener('scroll', later, { passive: true }); new MutationObserver(later).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class', 'style'] });
  setTimeout(place, 0); setTimeout(place, 1500); setTimeout(place, 4000);

  let panel = null;
  const ob = sh.querySelector('button'); ob.setAttribute('aria-expanded', 'false');
  host.__dvFocus = () => { try { ob.focus(); } catch (e) {} };
  host.__dvExpanded = (on) => ob.setAttribute('aria-expanded', on ? 'true' : 'false');
  host.__dvLive = (on) => { if (on) { ob.dataset.convo = 'on'; ob.setAttribute('aria-label', 'Victoria is still listening — open the conversation'); } else { delete ob.dataset.convo; ob.setAttribute('aria-label', 'Ask Victoria — your Home Care Provider Services assistant'); } };
  sh.querySelector('button').addEventListener('click', async () => {
    const DV = window.DV || {};
    const opening = !(panel && panel.isOpen());
    let greet = null;
    if (opening) {
      greet = DV.greeting || 'Hello! How can I help you today?';
      DV.greeting = DV.greeting_again || DV.greeting;                // a later opening on this page gets the short welcome
      /* a spoken conversation greets through the Voice Agent (the panel starts it in this tap); without one the greeting is
         spoken here, inside the tap, before any await */
      const convo = !!(DV.conversation && DV.conversation.available && window.DVVoice && window.DVVoice.supported() && !(DV.ai && DV.ai.available === false));
      if (!convo) SPEECH.speak(greet, { kind: 'greeting' });
    }
    if (!panel) {                                                     // normally already fetched while the page was idle
      try { await loadPanel(); panel = window.DealerVictoriaPanel && window.DealerVictoriaPanel(host); } catch (e) { panel = null; }
    }
    if (panel) panel.toggle(opening, { greeting: greet }); else { SPEECH.stop(); fallback(); }
  });
  /* the panel could not load: support contact still opens */
  function fallback() {
    let f = sh.querySelector('.fb'); if (f) { f.hidden = !f.hidden; return; }
    const S = (window.DV && window.DV.support) || { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us' };
    f = document.createElement('div'); f.className = 'fb'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Contact Home Care Provider Services support');
    f.innerHTML = '<b>Contact Home Care Provider Services support</b><a href="tel:' + S.phone_tel + '">Call ' + S.phone + '</a><a href="mailto:' + S.email + '">Email ' + S.email + '</a>';
    sh.appendChild(f);
  }
  window.__dvPlace = place;
  /* Start Here → Meet Victoria: "Ask Victoria" opens her exactly like a tap on the globe; a suggested question opens the panel
     and asks it as typed text (no microphone) */
  window.__dvOpen = () => { if (!(panel && panel.isOpen())) ob.click(); return true; };
  window.__dvAsk = async (q) => { if (!panel) { try { await loadPanel(); panel = window.DealerVictoriaPanel && window.DealerVictoriaPanel(host); } catch (e) { panel = null; } }
    if (!panel || !panel.askFromPage) return false; await panel.askFromPage(String(q || '').slice(0, 300)); return true; };
})();
