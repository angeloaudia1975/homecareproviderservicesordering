/* Dealer Victoria — the closed orb (owner 2026-11-19 22:07, TEST-dealer preview). Loaded by the portal ONLY when
   dealer-victoria-api says this signed-in dealership may use Victoria (TEST dealerships during the preview).
   Closed cost: one small button in a Shadow DOM, CSS only — no animation, fonts or network call. The panel (with its
   animation, greeting, support contact and voice) loads only when the dealer opens the orb.
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
    button{all:unset;box-sizing:border-box;width:56px;height:56px;border-radius:50%;cursor:pointer;display:block;
      background:radial-gradient(circle at 38% 32%,#e9f7ff 0,#7fd3ff 18%,#1681c2 55%,#0b1f33 100%);
      box-shadow:0 4px 14px rgba(11,31,51,.35),inset 0 0 10px rgba(255,255,255,.35)}
    button:focus-visible{outline:3px solid #fcb21e;outline-offset:3px}
    .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .fb{position:absolute;right:0;bottom:66px;width:240px;padding:12px;background:#fff;color:#0b1f33;border-radius:12px;box-shadow:0 10px 30px rgba(11,31,51,.3);font:14px/1.4 system-ui,sans-serif}
    .fb b{display:block;margin-bottom:6px}.fb a{display:block;min-height:44px;line-height:44px;color:#0f5c8f;font-weight:700}
  </style><button type="button" aria-label="Ask Victoria — your HCPS assistant" aria-haspopup="dialog"><span class="lbl">Ask Victoria</span></button>`;
  document.body.appendChild(host);

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
  sh.querySelector('button').addEventListener('click', async () => {
    if (!panel) {                                                     // panel + animation load only now
      const src = (window.DV_PANEL_SRC || '/assets/dealer-victoria-panel.js?v=1');
      try { if (!window.DealerVictoriaPanel) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
        panel = window.DealerVictoriaPanel && window.DealerVictoriaPanel(host); } catch (e) { panel = null; }
    }
    if (panel) panel.toggle(); else fallback();
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
