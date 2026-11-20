/* Dealer Victoria — the panel (owner 2026-11-19 22:07, TEST-dealer preview). Loaded only when the dealer opens the orb.
   - Greeting: fixed text from the server for THIS person (first open vs later) — no model call. Shown as text; spoken
     only when the dealer turns Voice on (the browser's own speech; the orb animates while Victoria speaks).
   - Three workflows (Claude Haiku 5.5 on the server, under the dealer's own sign-in): Golden order + carrier tracking,
     the reimbursement for the product on screen (same state / ZIP / payer / date / notice as its panel), a draft quote
     for the product and variant on screen (left open for the dealer to review).
   - Every figure, notice and tracking number shown comes from the record the server returns (cards), never the model's text.
   - "Contact HCPS support" is always in the panel and works without AI (chat with HCPS, phone, email).
   - Motion only while thinking / speaking; none with prefers-reduced-motion. Text is placed as text (no HTML from answers). */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || !isFinite(Number(n)) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (!m) return String(d || ''); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
  const VKEY = 'dv_voice_on';
  window.DealerVictoriaPanel = function (orbHost) {
    const DV = window.DV || {}; const S = DV.support || { phone: '(888) 626-3140', phone_tel: '+18886263140', office: '937-626-5141', office_tel: '+19376265141', email: 'info@homecareproviderservices.us', chat: false };
    const host = document.createElement('div'); host.id = 'dvPanelHost';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>
      :host{all:initial}
      [hidden]{display:none!important}
      .p{position:fixed;z-index:2147482001;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b1f33;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(11,31,51,.28);display:flex;flex-direction:column;overflow:hidden}
      .hd{display:flex;align-items:center;gap:10px;padding:12px 10px 12px 14px;background:#0b1f33;color:#fff}
      .orb{width:40px;height:40px;border-radius:50%;flex:none;background:radial-gradient(circle at 38% 32%,#e9f7ff 0,#7fd3ff 18%,#1681c2 55%,#0b1f33 100%)}
      .orb[data-s="speaking"]{animation:sp .55s ease-in-out infinite alternate;box-shadow:0 0 18px rgba(127,211,255,.9)}
      .orb[data-s="thinking"]{animation:th 1.6s linear infinite}
      @keyframes sp{from{transform:scale(1)}to{transform:scale(1.12)}} @keyframes th{to{filter:hue-rotate(360deg)}}
      @media (prefers-reduced-motion:reduce){.orb{animation:none!important}}
      .t{font-weight:800}.s{font-size:12px;opacity:.85}
      .ib{all:unset;box-sizing:border-box;min-width:44px;min-height:44px;display:grid;place-items:center;cursor:pointer;border-radius:10px;font-size:13px;font-weight:700;padding:0 8px}
      .hd .ib{color:#fff}.hd .x{font-size:22px;margin-left:auto}.v[aria-pressed="true"]{background:rgba(255,255,255,.18)}
      .ib:focus-visible,.chip:focus-visible,.go:focus-visible,.btn:focus-visible,a:focus-visible{outline:3px solid #fcb21e;outline-offset:2px}
      .bd{padding:12px 14px;overflow:auto;flex:1;min-height:0}
      .bubble{background:#f1f7fc;border-radius:12px;padding:10px 12px;margin:0 0 10px}
      .me{background:#0f5c8f;color:#fff;margin-left:auto;max-width:85%;width:fit-content}
      .chip{all:unset;box-sizing:border-box;display:block;width:100%;min-height:44px;padding:10px 12px;margin:0 0 8px;border:1px solid #cfe3f2;border-radius:12px;cursor:pointer;font-weight:700;color:#0f5c8f;background:#fff}
      .chip small{display:block;font-weight:400;color:#4a5b6b}.chip[disabled]{opacity:.5;cursor:default}
      .card{border:1px solid #d6e4ef;border-radius:12px;padding:10px 12px;margin:0 0 10px;background:#fff}
      .card h5{margin:0 0 4px;font-size:13px}.card .m{font-size:12.5px;color:#4a5b6b}.card .n{font-weight:800;color:#7a4b00;margin:4px 0}
      .card table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.card td{padding:3px 0;vertical-align:top}.card td:last-child{text-align:right;font-weight:700;white-space:nowrap;padding-left:8px}
      .btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;min-height:44px;padding:0 12px;margin:6px 6px 0 0;border-radius:10px;background:#0f5c8f;color:#fff;font-weight:700;cursor:pointer}
      .btn.gh{background:#eef5fb;color:#0f5c8f}
      a{color:#0f5c8f;font-weight:700}
      .warn{background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;border-radius:10px;padding:8px 10px;margin:0 0 10px}
      .sup{border-top:1px solid #e3edf5;padding:10px 14px}
      .sup b{display:block;margin-bottom:4px}.sup .row{display:flex;flex-wrap:wrap;gap:6px}
      .sup a,.sup button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border:1px solid #cfe3f2;border-radius:10px;color:#0f5c8f;font-weight:700;cursor:pointer;font-size:13px}
      .ask{display:flex;gap:8px;padding:10px 14px 14px;border-top:1px solid #e3edf5}
      .ask input{flex:1;min-width:0;min-height:44px;font-size:16px;padding:0 12px;border:1px solid #b9cfe0;border-radius:10px}
      .go{all:unset;min-height:44px;min-width:56px;display:grid;place-items:center;border-radius:10px;background:#ef6325;color:#fff;font-weight:800;cursor:pointer}
      .go[disabled]{opacity:.5;cursor:default}
      .src{font-size:11.5px;color:#5b6b7a;margin-top:4px}
    </style>
    <div class="p" role="dialog" aria-label="Victoria, your HCPS assistant" hidden>
      <div class="hd"><div class="orb" data-s="idle" aria-hidden="true"></div><div><div class="t">Victoria</div><div class="s">Your personal assistant · TEST preview</div></div>
        <button class="ib v x0" type="button" aria-pressed="false" title="Speak Victoria's answers aloud">🔈 Voice</button>
        <button class="ib x" type="button" aria-label="Close Victoria">×</button></div>
      <div class="bd" aria-live="polite">
        <div class="bubble hello">…</div>
        <div class="warn ai-off" hidden>Victoria can't answer just now. Contact HCPS support below — they can help right away.</div>
        <div class="chips">
          <button class="chip" type="button" data-q="Where is my Golden order?">Where is my Golden order?<small>Opens the order and its carrier tracking</small></button>
          <button class="chip" type="button" data-q="What does Medicare allow for this product?" data-needs="product">What does Medicare allow for this product?<small>Uses this product's state, ZIP, payer and date</small></button>
          <button class="chip" type="button" data-q="Help me quote this product." data-needs="product">Help me quote this product<small>Opens a draft quote for you to review</small></button>
        </div>
        <div class="log"></div>
      </div>
      <div class="sup"><b>Contact HCPS support</b><div class="row">
        <button type="button" class="chat" ${S.chat === false ? 'hidden' : ''}>💬 Chat with HCPS</button>
        <a href="tel:${esc(S.phone_tel)}">📞 ${esc(S.phone)}</a>
        <a href="mailto:${esc(S.email)}">✉️ Email</a></div></div>
      <div class="ask"><input aria-label="Ask Victoria a question" placeholder="Ask about an order, a product's reimbursement or a quote…" maxlength="600"><button class="go" type="button">Ask</button></div>
    </div>`;
    document.body.appendChild(host);
    const $ = (s) => sh.querySelector(s); const P = $('.p'), orb = $('.orb'), log = $('.log'), inp = $('.ask input');
    let busy = false, greeted = false, aiOn = !(DV.ai && DV.ai.available === false);
    let voiceOn = false; try { voiceOn = localStorage.getItem(VKEY) === '1'; } catch (e) {}
    const vb = $('.v'); const setVoice = (on) => { voiceOn = !!on; vb.setAttribute('aria-pressed', String(voiceOn)); vb.textContent = voiceOn ? '🔊 Voice on' : '🔈 Voice'; try { localStorage.setItem(VKEY, voiceOn ? '1' : '0'); } catch (e) {} if (!voiceOn) stopSpeaking(); };
    setVoice(voiceOn);
    vb.onclick = () => setVoice(!voiceOn);
    function stopSpeaking() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} if (orb.dataset.s === 'speaking') orb.dataset.s = 'idle'; }
    function speak(text) {
      if (!voiceOn || !text || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
      try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).slice(0, 600)); u.lang = 'en-US';
        u.onstart = () => { orb.dataset.s = 'speaking'; }; u.onend = u.onerror = () => { if (orb.dataset.s === 'speaking') orb.dataset.s = 'idle'; };
        window.speechSynthesis.speak(u); } catch (e) {}
    }
    function setAi(on) { aiOn = on; $('.ai-off').hidden = on; sh.querySelectorAll('.chip').forEach((c) => { c.disabled = !on; }); inp.disabled = !on; $('.go').disabled = !on; }
    function refreshChips() { const hasP = !!(DV.context && DV.context().product); sh.querySelectorAll('.chip[data-needs="product"]').forEach((c) => { c.hidden = !hasP; }); }
    function place() {
      const W = innerWidth, H = innerHeight, r = orbHost.getBoundingClientRect();
      /* phone: a sheet that stops above the bottom strip, so the orb (right) and the Golden cart button (left) stay visible
         and tappable while it is open */
      if (W <= 600) Object.assign(P.style, { left: '8px', right: '8px', bottom: '84px', top: 'auto', width: 'auto', maxHeight: Math.max(300, H - 84 - 12) + 'px' });
      else {
        /* desktop / tablet: a card above the orb that never reaches the top search bar (it stays exactly as it is) */
        const hs = document.querySelector('.hsearch'); const hr = hs ? hs.getBoundingClientRect() : null;
        const topLimit = hr && hr.bottom > 0 && hr.width > 0 ? Math.round(hr.bottom + 12) : 12;
        Object.assign(P.style, { right: '16px', left: 'auto', width: '400px', bottom: Math.round(H - r.top + 12) + 'px', top: 'auto', maxHeight: Math.max(280, Math.round(r.top - 12 - topLimit)) + 'px' });
      }
    }
    addEventListener('resize', () => { if (!P.hidden) place(); });
    $('.x').onclick = () => api.toggle(false);
    P.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.toggle(false); });
    $('.chat').onclick = () => { if (DV.chat && DV.chat()) return; location.href = 'tel:' + S.phone_tel; };
    sh.querySelectorAll('.chip').forEach((c) => { c.onclick = () => ask(c.getAttribute('data-q')); });
    $('.go').onclick = () => ask(inp.value); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(inp.value); });

    function line(cls, text) { const d = document.createElement('div'); d.className = 'bubble ' + cls; d.textContent = text; log.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d; }
    function cardEl(html) { const d = document.createElement('div'); d.className = 'card'; d.innerHTML = html; log.appendChild(d); return d; }
    function orderCard(c, autoOpen) {
      c.orders.forEach((o) => {
        const tr = (o.tracking || []).map((t) => { const u = DV.trackUrl ? DV.trackUrl(t) : null;
          return `<div>${esc(t.carrier || 'Carrier')} · ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">Track ${esc(t.tracking_number)}</a>` : esc(t.tracking_number || '')}${t.ship_date ? ' · shipped ' + esc(day(t.ship_date)) : ''}</div>`; }).join('') || '<div class="m">No carrier tracking on Golden\'s record yet.</div>';
        const el = cardEl(`<h5>Golden order ${esc((o.so || [])[0] || o.order_ref)}${o.po ? ' · PO ' + esc(o.po) : ''}</h5><div class="m">${esc(o.status)}${o.placed_on ? ' · placed ' + esc(day(o.placed_on)) : ''}${o.location ? ' · ' + esc(o.location) : ''}</div>${tr}<div class="m">${esc(o.delivery || '')}</div><button class="btn" type="button">Open this order</button>`);
        el.querySelector('.btn').onclick = () => go(() => DV.openOrder && DV.openOrder(o.order_ref));
      });
      if (autoOpen && c.orders.length === 1) go(() => DV.openOrder && DV.openOrder(c.orders[0].order_ref));
    }
    function reimbCard(c) {
      const pay = (c.payers || []).map((p) => `<div style="margin-top:8px"><b>${esc(p.payer)}</b><div class="m">${esc([p.state, p.zip ? 'ZIP ' + p.zip + (p.zip_source === 'branch' ? ' (branch estimate)' : '') : '', p.date_of_service ? day(p.date_of_service) : ''].filter(Boolean).join(' · '))}</div>
        ${p.available ? `<table>${(p.amounts || []).map((a) => `<tr><td>${esc(a.basis)}${a.modifier ? ' · ' + esc(a.modifier) : ''}</td><td>${money(a.amount)}</td></tr>`).join('')}${(p.capped_rental || []).map((x) => `<tr><td>Rental, months ${esc(x.months)}</td><td>${money(x.amount)}</td></tr>`).join('')}</table>${p.split ? `<div class="m">${esc(p.split)}</div>` : ''}<div class="src">${esc([p.source, p.effective].filter(Boolean).join(' — '))}</div>` : `<div class="m">${esc(p.reason || 'Rate unavailable for this plan/date')}</div>`}</div>`).join('');
      const el = cardEl(`<h5>${esc(c.product || c.sku)}${c.codes && c.codes.length ? ' · HCPCS ' + esc(c.codes.join(' / ')) : ''}</h5>${c.notice ? `<div class="n">${esc(c.notice)}</div>` : ''}${c.allowance_note ? `<div class="m">${esc(c.allowance_note)}</div>` : ''}${pay}
        <div>${DV.openCalc && DV.hasCalc && DV.hasCalc() ? '<button class="btn calc" type="button">Open the earnings calculator</button>' : ''}<button class="btn gh fee" type="button">Open the fee schedule</button></div>`);
      const cb = el.querySelector('.calc'); if (cb) cb.onclick = () => go(() => DV.openCalc());
      el.querySelector('.fee').onclick = () => go(() => DV.openFee && DV.openFee());
    }
    function quoteCard(a) {
      const el = cardEl(`<h5>Draft quote opened</h5><div class="m">${esc(a.qty)} × ${esc(a.code)}${a.variant ? ' (' + esc(a.variant) + ')' : ''} — review it in Customer Quotes. Nothing has been sent.</div><button class="btn gh" type="button">Show the draft</button>`);
      el.querySelector('.btn').onclick = () => go(() => DV.showQuotes && DV.showQuotes());
    }
    /* an action that changes the page: on a phone the sheet steps aside so the page is visible */
    function go(fn) { try { fn(); } catch (e) {} if (innerWidth <= 600) api.toggle(false); }

    async function ask(q) {
      q = String(q || '').trim(); if (!q || busy || !aiOn) return;
      busy = true; inp.value = ''; line('me', q); orb.dataset.s = 'thinking'; $('.go').disabled = true;
      let r = null; try { r = await DV.api({ action: 'ask', question: q, page: DV.context ? DV.context() : {} }); } catch (e) { r = null; }
      busy = false; orb.dataset.s = 'idle'; $('.go').disabled = !aiOn;
      if (!r || r.ok !== true) {
        const over = r && /over_budget|over_daily/.test(String(r.error));
        line('', over ? "Victoria has reached her limit for now. Contact HCPS support below — they can help right away." : "Victoria can't answer just now. Contact HCPS support below — they can help right away.");
        if (over) setAi(false); return;
      }
      const a = line('', r.answer || 'Here is what I found.'); speak(r.answer);
      for (const c of r.cards || []) {
        if (c.type === 'golden_orders') orderCard(c, (r.cards || []).length === 1);
        else if (c.type === 'not_found') cardEl(`<div class="m">${esc(c.text)}</div>`);
        else if (c.type === 'reimbursement') reimbCard(c);
      }
      for (const x of r.actions || []) if (x.type === 'open_quote') { quoteCard(x); go(() => DV.openQuote && DV.openQuote(x)); }
      a.scrollIntoView({ block: 'nearest' });
    }
    async function hello() {
      greeted = true; const el = $('.hello');
      let r = null; try { r = await DV.api({ action: 'hello' }); } catch (e) { r = null; }
      const text = (r && r.ok && r.greeting) || 'Hello! How can I help you today?';
      el.textContent = text; speak(text);
    }
    const api = {
      toggle(on) { const show = on == null ? P.hidden : on; P.hidden = !show; if (show) { refreshChips(); place(); if (!greeted) hello(); setAi(aiOn); const f = sh.querySelector('.chip:not([hidden])') || inp; try { f.focus(); } catch (e) {} } else stopSpeaking(); },
      el: P, shadow: sh, ask, setAi,
    };
    return api;
  };
})();
