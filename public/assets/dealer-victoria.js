/* Dealer Victoria — the closed orb (owner 2026-11-19 22:07, TEST-dealer preview). Loaded by the portal ONLY when
   dealer-victoria-api says this signed-in dealership may use Victoria (TEST dealerships during the preview).
   The launcher is the animated Victoria globe used in Connect 360 (owner 2026-11-20 10:37): a 5.6 KB still shows at once;
   the looping globe video (same files as Connect 360's approved blue orb) loads after the page is usable, never with
   prefers-reduced-motion, and pauses while the tab is hidden. The panel (greeting, support contact, voice) loads when the
   dealer first opens it.
   Voice on every opening: every deliberate tap that OPENS Victoria turns voice on and speaks the welcome for this person
   inside that same tap (browsers only play speech started by a deliberate interaction) — no AI call, no waiting.
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
    .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .fb{position:absolute;right:0;bottom:66px;width:240px;padding:12px;background:#fff;color:#0b1f33;border-radius:12px;box-shadow:0 10px 30px rgba(11,31,51,.3);font:14px/1.4 system-ui,sans-serif}
    .fb b{display:block;margin-bottom:6px}.fb a{display:block;min-height:44px;line-height:44px;color:#0f5c8f;font-weight:700}
  </style><button type="button" aria-label="Ask Victoria — your HCPS assistant" aria-haspopup="dialog"><img src="/assets/victoria/orb-still.webp" alt="" decoding="async" draggable="false"><span class="lbl">Ask Victoria</span></button>`;
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
  const PANEL_SRC = () => (window.DV_PANEL_SRC || '/assets/dealer-victoria-panel.js?v=3');
  let panelLoad = null;
  const loadPanel = () => panelLoad || (panelLoad = window.DealerVictoriaPanel ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement('script'); s.src = PANEL_SRC(); s.onload = ok; s.onerror = (e) => { panelLoad = null; bad(e); }; document.head.appendChild(s); }));
  const idle = () => { motion(); loadPanel().catch(() => {}); };
  const goMotion = () => (window.requestIdleCallback ? requestIdleCallback(idle, { timeout: 1500 }) : setTimeout(idle, 300));
  if (document.readyState === 'complete') goMotion(); else addEventListener('load', goMotion, { once: true });
  if (RM.addEventListener) RM.addEventListener('change', () => { if (RM.matches) { const v = ob0.querySelector('video'); if (v) v.remove(); ob0.classList.remove('live'); } else goMotion(); });
  document.addEventListener('visibilitychange', () => { const v = ob0.querySelector('video'); if (v) { if (document.hidden) v.pause(); else v.play().catch(() => {}); } });

  /* ---- voice: one speech helper for the launcher and the panel ----
     speak() is called synchronously inside the opening tap. Chrome can drop an utterance queued in the same tick as
     cancel(), so cancel only when something is actually playing. If nothing starts within 2.5 s (a browser that blocks
     audio, or no speech engine) the panel shows the text and a "Tap to hear Victoria" retry. */
  const SPEECH = (function () {
    const ok = () => !!(window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined');
    let cur = null, watch = 0; const L = { onstate: null };
    const set = (st, why) => { ob0.dataset.s = st === 'speaking' ? 'speaking' : 'idle'; if (L.onstate) try { L.onstate(st, why); } catch (e) {} };
    L.supported = ok;
    L.speak = (text) => {
      clearTimeout(watch); if (!text) return false;
      if (!ok()) { set('blocked', 'unsupported'); return false; }
      try {
        const ss = window.speechSynthesis; if (ss.speaking || ss.pending) ss.cancel();
        const u = new SpeechSynthesisUtterance(String(text).slice(0, 1600)); u.lang = 'en-US'; cur = u; let started = false;
        u.onstart = () => { if (cur !== u) return; started = true; clearTimeout(watch); set('speaking'); };
        u.onend = () => { if (cur === u) { cur = null; set('idle'); } };
        u.onerror = (e) => { if (cur !== u) return; cur = null; clearTimeout(watch); const er = e && e.error; set(er === 'interrupted' || er === 'canceled' ? 'idle' : 'blocked', er || 'error'); };
        ss.speak(u); if (ss.paused) ss.resume();
        watch = setTimeout(() => { if (cur === u && !started && !ss.speaking) { cur = null; try { ss.cancel(); } catch (e) {} set('blocked', 'no_start'); } }, 2500);
        return true;
      } catch (e) { set('blocked', 'error'); return false; }
    };
    L.stop = () => { clearTimeout(watch); cur = null; try { if (ok() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel(); } catch (e) {} set('idle'); };
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
  sh.querySelector('button').addEventListener('click', async () => {
    const DV = window.DV || {};
    const opening = !(panel && panel.isOpen());
    let greet = null;
    if (opening) {                                                    // speak FIRST, inside this tap — before any await
      greet = DV.greeting || 'Hello! How can I help you today?';
      DV.greeting = DV.greeting_again || DV.greeting;                // a later opening on this page gets the short welcome
      SPEECH.speak(greet);
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
    f = document.createElement('div'); f.className = 'fb'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Contact HCPS support');
    f.innerHTML = '<b>Contact HCPS support</b><a href="tel:' + S.phone_tel + '">Call ' + S.phone + '</a><a href="mailto:' + S.email + '">Email ' + S.email + '</a>';
    sh.appendChild(f);
  }
  window.__dvPlace = place;
})();
