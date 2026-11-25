/* Dealer Victoria — the panel (TEST-dealer preview). Loaded when the dealer opens the globe.
   CONVERSATION (owner 2026-11-20 20:11): opening the globe starts a continuous spoken conversation — Victoria greets the
   person in the Command Center Deepgram voice, the browser asks for the microphone when it needs to, and she listens,
   answers aloud, carries out permitted actions and listens again with no button between turns (dv-voice.js, the dealer copy
   of Command Center's Voice Agent client). The dealer can talk over her (barge-in); echo cancellation keeps her own voice
   out of what is heard. Status shows Connecting · Listening · Thinking · Speaking; permission, connection and service
   problems are explained, never a silent wait. Close (or signing out) stops listening and speech at once and drops any
   answer still on its way; the next opening starts the conversation again.
   "Type instead" turns this opening into typing: no listening, no spoken replies. On a browser or device that can't hold a
   voice conversation the panel explains why and offers typing; the greeting is still spoken (the earlier, approved path).
   Every answer comes from the server's answer pipeline under the dealer's own sign-in; a page / draft action is performed
   and CHECKED by the portal before Victoria says it is done (✓ / ✗). Reimbursement answers carry the fixed billing
   disclaimer. Text is placed as text (no HTML from answers). */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || !isFinite(Number(n)) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (!m) return String(d || ''); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
  const BILLING_DISCLAIMER = 'Home Care Provider Services is not a billing specialist and is not qualified to provide coding or billing advice. This information is for reference only. The biller is responsible for confirming that the exact product supplied meets the applicable HCPCS code requirements and for verifying the payer’s billing and coverage rules before submitting a claim.';
  window.DealerVictoriaPanel = function (orbHost) {
    const DV = window.DV || {}; const S = DV.support || { phone: '(888) 626-3140', phone_tel: '+18886263140', office: '937-626-5141', office_tel: '+19376265141', email: 'info@homecareproviderservices.us', chat: false };
    const host = document.createElement('div'); host.id = 'dvPanelHost';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>
      :host{all:initial}
      [hidden]{display:none!important}
      .fbk{display:block;margin-top:6px;min-height:36px;padding:4px 10px;border:1px solid #d7dee8;border-radius:8px;background:#fff;color:#55606c;font:inherit;font-size:12.5px;cursor:pointer}.fbk:disabled{cursor:default;border-color:transparent;padding-left:0}
      .p{position:fixed;z-index:2147482001;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b1f33;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(11,31,51,.28);display:flex;flex-direction:column;overflow:hidden}
      .hd{display:flex;align-items:center;gap:10px;padding:10px 8px 10px 12px;background:#0b1f33;color:#fff}
      .orb{width:40px;height:40px;border-radius:50%;flex:none;overflow:hidden;background:radial-gradient(circle at 38% 32%,#e9f7ff 0,#7fd3ff 18%,#1681c2 55%,#0b1f33 100%)}
      .orb img{width:100%;height:100%;object-fit:cover;display:block}
      .orb[data-s="speaking"]{animation:sp .55s ease-in-out infinite alternate;box-shadow:0 0 18px rgba(127,211,255,.9)}
      .orb[data-s="listening"]{box-shadow:0 0 0 3px rgba(34,197,94,.85)}
      .orb[data-s="thinking"]{animation:th 1.6s linear infinite}
      @keyframes sp{from{transform:scale(1)}to{transform:scale(1.12)}} @keyframes th{to{filter:hue-rotate(360deg)}}
      .t{font-weight:800}
      .st{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;margin-top:2px}
      .st i{width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block}
      .st[data-s="listening"] i{background:#22c55e;animation:pl 1.2s ease-in-out infinite}
      .st[data-s="paused"] i{background:#94a3b8}.st[data-s="thinking"] i{background:#f59e0b}.st[data-s="speaking"] i{background:#7fd3ff}.st[data-s="connecting"] i{background:#cbd5e1;animation:pl .8s infinite}
      @keyframes pl{50%{opacity:.35}}
      @media (prefers-reduced-motion:reduce){.orb,.st i{animation:none!important}}
      .ib{all:unset;box-sizing:border-box;min-width:44px;min-height:44px;display:grid;place-items:center;cursor:pointer;border-radius:10px;font-size:13px;font-weight:700;padding:0 8px}
      .hd .ib{color:#fff}.hd .x{font-size:22px;margin-left:auto}
      .ib:focus-visible,.go:focus-visible,.btn:focus-visible,.learn:focus-visible,.tb:focus-visible,a:focus-visible{outline:3px solid #fcb21e;outline-offset:2px}
      .bd{padding:12px 14px;overflow:auto;flex:1;min-height:0}
      .learn{all:unset;box-sizing:border-box;display:block;width:100%;min-height:52px;padding:12px 14px;margin:0 0 10px;border-radius:12px;cursor:pointer;font-weight:800;color:#fff;background:linear-gradient(135deg,#0f5c8f,#1681c2);box-shadow:0 4px 14px rgba(22,129,194,.3)}
      .learn.small{min-height:44px;padding:8px 12px;font-weight:700;background:#eef5fb;color:#0f5c8f;box-shadow:none}
      .learn small{display:block;font-weight:500;opacity:.9;margin-top:2px}
      .bubble{background:#f1f7fc;border-radius:12px;padding:10px 12px;margin:0 0 10px}
      .me{background:#0f5c8f;color:#fff;margin-left:auto;max-width:85%;width:fit-content}
      .card{border:1px solid #d6e4ef;border-radius:12px;padding:10px 12px;margin:0 0 10px;background:#fff}
      .card h5{margin:0 0 4px;font-size:13px}.card .m{font-size:12.5px;color:#4a5b6b}.card .n{font-weight:800;color:#7a4b00;margin:4px 0}
      .card table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}.card td{padding:3px 0;vertical-align:top}.card td:last-child{text-align:right;font-weight:700;white-space:nowrap;padding-left:8px}
      .btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;min-height:44px;padding:0 12px;margin:6px 6px 0 0;border-radius:10px;background:#0f5c8f;color:#fff;font-weight:700;cursor:pointer}
      .btn.gh{background:#eef5fb;color:#0f5c8f}
      a{color:#0f5c8f;font-weight:700}
      .warn{background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;border-radius:10px;padding:8px 10px;margin:0 0 10px}
      .warn a{display:inline-flex;align-items:center;min-height:44px;margin-right:10px}
      .ft{border-top:1px solid #e3edf5;padding:8px 14px 12px}
      .tb{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border:1px solid #cfe3f2;border-radius:10px;color:#0f5c8f;font-weight:700;cursor:pointer;font-size:13px}
      .ask{display:flex;gap:8px;margin-top:8px}
      .ask input{flex:1;min-width:0;min-height:44px;font-size:16px;padding:0 12px;border:1px solid #b9cfe0;border-radius:10px}
      .go{all:unset;min-height:44px;min-width:56px;display:grid;place-items:center;border-radius:10px;background:#ef6325;color:#fff;font-weight:800;cursor:pointer}
      .go[disabled]{opacity:.5;cursor:default}
      .src{font-size:11.5px;color:#5b6b7a;margin-top:4px}
      .disc{font-size:11.5px;color:#4a5b6b;border-top:1px solid #e3edf5;margin-top:8px;padding-top:6px}
    </style>
    <div class="p" role="dialog" aria-label="Victoria, your Home Care Provider Services assistant" hidden>
      <div class="hd"><div class="orb" data-s="idle" aria-hidden="true"><img src="/assets/victoria/orb-still.webp" alt="" decoding="async" onerror="this.remove()"></div>
        <div><div class="t">Victoria</div><div class="st" data-s="idle" role="status" aria-live="polite"><i></i><span>Ready</span></div></div>
        <button class="ib x" type="button" aria-label="Close Victoria">×</button></div>
      <div class="bd" aria-live="polite">
        <button class="learn" type="button">Learn what Victoria can do for you<small>A short introduction — then just ask</small></button>
        <div class="bubble hello">…</div>
        <div class="log"></div>
      </div>
      <div class="ft">
        <button class="tb type" type="button">⌨️ Type instead</button>
        <button class="tb again" type="button" hidden>🎙️ Talk to Victoria</button>
        <div class="ask" hidden><input aria-label="Type your question for Victoria" placeholder="Ask about products, prices, quotes, orders or the portal…" maxlength="600"><button class="go" type="button">Ask</button></div>
      </div>
    </div>`;
    document.body.appendChild(host);
    const $ = (s) => sh.querySelector(s); const P = $('.p'), orb = $('.orb'), log = $('.log'), inp = $('.ask input'), stEl = $('.st'), learn = $('.learn');
    const typeB = $('.type'), againB = $('.again'), askBar = $('.ask');
    let aiOn = !(DV.ai && DV.ai.available === false), busy = false;
    /* legacy speech (greeting / answers as separate audio) — used only where a voice conversation isn't possible */
    const SP = orbHost.__dvSpeech || { speak: () => false, stop: () => {}, supported: () => false };
    const convoOK = () => !!(DV.conversation && DV.conversation.available && window.DVVoice && window.DVVoice.supported());
    let voice = null, mode = 'voice', speakTyped = false, hist = [], echo = [];
    const STATUS = { idle: 'Ready', connecting: 'Connecting…', listening: 'Listening', thinking: 'Thinking…', speaking: 'Speaking', paused: 'Paused — not listening while this tab is hidden', typing: 'Typing — voice is off for this opening', blocked: 'Voice unavailable' };
    function status(st) { stEl.dataset.s = st; stEl.querySelector('span').textContent = STATUS[st] || st; orb.dataset.s = st === 'speaking' || st === 'thinking' || st === 'listening' ? st : 'idle'; }
    const supportLinks = () => `<a href="tel:${esc(S.phone_tel)}">📞 ${esc(S.phone)}</a><a href="mailto:${esc(S.email)}">✉️ Email support</a>`;
    function warn(text, withSupport) { const d = document.createElement('div'); d.className = 'warn'; d.textContent = text; if (withSupport) { const s = document.createElement('div'); s.innerHTML = supportLinks(); d.appendChild(s); } log.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d; }
    function place() {
      const W = innerWidth, H = innerHeight, r = orbHost.getBoundingClientRect();
      /* the top search bar stays where it is and stays usable while the panel is open (owner 2026-11-20) */
      const hs = document.querySelector('.hsearch'); const hr = hs ? hs.getBoundingClientRect() : null;
      const seen = !!(hr && hr.bottom > 0 && hr.width > 0 && hr.top < H);
      if (W <= 600) { const top = seen ? Math.round(hr.bottom + 8) : 8;
        Object.assign(P.style, { left: '8px', right: '8px', bottom: '84px', top: top + 'px', width: 'auto', maxHeight: Math.max(160, H - 84 - top) + 'px' }); }
      else { const topLimit = seen ? Math.round(hr.bottom + 12) : 12;
        Object.assign(P.style, { right: '16px', left: 'auto', width: '400px', bottom: Math.round(H - r.top + 12) + 'px', top: 'auto', maxHeight: Math.max(280, Math.round(r.top - 12 - topLimit)) + 'px' }); }
    }
    addEventListener('resize', () => { if (!P.hidden) place(); });
    addEventListener('scroll', () => { if (!P.hidden) place(); }, { passive: true });
    $('.x').onclick = (e) => { e.stopPropagation(); api.toggle(false); };
    P.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.toggle(false); });
    $('.go').onclick = () => ask(inp.value); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(inp.value); });
    /* on a phone, when Victoria opens something on the page the panel steps aside so the page is visible; a spoken
       conversation keeps going (the globe shows a green ring and says so) and tapping the globe brings the panel back */
    function go(fn) { let p; try { p = fn(); } catch (e) {}
      if (innerWidth <= 600 && !P.hidden) { P.hidden = true; if (orbHost.__dvExpanded) orbHost.__dvExpanded(false); if (voice && voice.active && orbHost.__dvLive) orbHost.__dvLive(true); }
      return Promise.resolve(p).catch(() => {}); }
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
        ${p.available ? `<table>${(p.amounts || []).map((a) => `<tr><td>${esc(a.basis)}${a.modifier ? ' · ' + esc(a.modifier) : ''}${a.unit ? `<div class="m">${esc(a.unit)}</div>` : ''}</td><td>${money(a.amount)}</td></tr>`).join('')}${(p.capped_rental || []).map((x) => `<tr><td>Rental, months ${esc(x.months)}</td><td>${money(x.amount)}</td></tr>`).join('')}</table>${p.split ? `<div class="m">${esc(p.split)}</div>` : ''}<div class="src">${esc([p.source, p.effective].filter(Boolean).join(' — '))}</div>` : `<div class="m">${esc(p.reason || 'Rate unavailable for this plan/date')}</div>`}</div>`).join('');
      const el = cardEl(`<h5>${esc(c.product || c.sku)}${c.codes && c.codes.length ? ' · HCPCS ' + esc(c.codes.join(' / ')) : ''}</h5>${c.notice ? `<div class="n">${esc(c.notice)}</div>` : ''}${c.allowance_note ? `<div class="m">${esc(c.allowance_note)}</div>` : ''}${pay}
        <div>${DV.openCalc && DV.hasCalc && DV.hasCalc() ? '<button class="btn calc" type="button">Open the earnings calculator</button>' : ''}<button class="btn gh fee" type="button">Open the fee schedule</button></div>
        <div class="disc">${esc(c.disclaimer || BILLING_DISCLAIMER)}</div>`);
      const cb = el.querySelector('.calc'); if (cb) cb.onclick = () => go(() => DV.openCalc());
      el.querySelector('.fee').onclick = () => go(() => DV.openFee && DV.openFee());
    }
    function checked(ok, text) { const d = cardEl(`<div class="m"><b style="color:${ok ? '#166534' : '#9a3412'}">${ok ? '✓' : '✗'}</b> ${esc(text)}</div>`); d.dataset.check = ok ? 'ok' : 'fail'; d.scrollIntoView({ block: 'nearest' }); return d; }
    function quoteCard(list) {
      list = Array.isArray(list) ? list : [list];
      const el = cardEl(`<h5>Draft quote opened</h5><div class="m">${list.map((a) => `${esc(a.qty)} × ${esc(a.code)}${a.variant ? ' (' + esc(a.variant) + ')' : ''}`).join(', ')} — review it in Customer Quotes. Nothing has been saved or sent.</div><button class="btn gh" type="button">Show the draft</button>`);
      el.querySelector('.btn').onclick = () => go(() => DV.showQuotes && DV.showQuotes());
    }
    /* products with THIS account's price (from the server's checkout price check); a line not on the account shows no price */
    function productsCard(c) {
      const unit = (p) => p.units_per_order_unit > 1 ? ' per ' + esc(String(p.order_unit || 'case').toLowerCase()) + ' of ' + esc(p.units_per_order_unit) : (p.order_unit && String(p.order_unit).toLowerCase() !== 'each' ? ' per ' + esc(String(p.order_unit).toLowerCase()) : ' each');
      const why = { not_on_your_account: 'Not on your account — no price shown', discontinued: 'Discontinued', not_orderable: 'Not orderable', pricing_unavailable: 'Price could not be checked just now' };
      (c.products || []).forEach((p) => {
        const el = cardEl(`<h5>${esc(p.name || p.code)}</h5><div class="m">${esc(p.manufacturer)} · ${esc(p.code)}${p.category ? ' · ' + esc(p.category) : ''}</div>
          ${p.your_price != null ? `<table><tr><td>Your price${p.contract_price ? ' (your contract price)' : ''}</td><td>${money(p.your_price)}${unit(p)}</td></tr>${p.msrp != null ? `<tr><td>MSRP</td><td>${money(p.msrp)}</td></tr>` : ''}${p.map != null ? `<tr><td>MAP</td><td>${money(p.map)}</td></tr>` : ''}</table>` : `<div class="m">${esc(why[p.price_unavailable] || 'No price')}</div>`}
          ${p.your_price != null ? '<button class="btn gh op" type="button">Open the product</button><button class="btn gh qu" type="button">Add to a quote</button>' : ''}`);
        const a = { manufacturer: p.manufacturer_slug, code: p.code, name: p.name, qty: 1 };
        const o = el.querySelector('.op'); if (o) o.onclick = () => go(() => DV.openProduct && DV.openProduct(a));
        const q = el.querySelector('.qu'); if (q) q.onclick = () => { quoteCard([a]); go(() => DV.openQuote && DV.openQuote(a)); };
      });
      cardEl('<div class="src">Prices: Home Care Provider Services pricing for your account — the same check as checkout. The cart confirms every price before you order.</div>');
    }
    function guideCard(c) {
      (c.items || []).slice(0, 4).forEach((g) => {
        const el = cardEl(`<h5>${esc(g.title)}${g.help ? ' · Help Center' : ''}</h5><div class="m">${esc(g.text || '')}</div>${(g.steps || []).length ? `<ol style="margin:6px 0 0 18px;padding:0">${g.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${g.view ? '<button class="btn gh" type="button">Open it</button>' : ''}`);
        const b = el.querySelector('.btn'); if (b) b.onclick = () => go(() => DV.openView && DV.openView(g.view));
      });
    }
    function storefrontCard(c) {
      (c.locations || []).forEach((l) => {
        const el = cardEl(`<h5>${esc(l.location)}</h5><div class="m">${l.has_storefront ? (l.live ? 'Live' : 'Not published') : 'No storefront yet'}${l.unpublished_changes ? ' · unpublished changes' : ''}${l.blocked_by_hcps ? ' · paused by Home Care Provider Services' : ''} · ${esc(l.lines_it_may_show)} line(s) it may show</div>${l.link ? `<a href="${esc(l.link)}" target="_blank" rel="noopener">Open the live storefront</a>` : ''}<div><button class="btn gh" type="button">Open the Storefront Website Builder</button></div>`);
        el.querySelector('.btn').onclick = () => go(() => DV.openView && DV.openView('storefront'));
      });
    }
    /* Growth Advisor, local market and recent purchases (owner 2026-11-22): the location, period and source are always shown */
    const scopeM = (c) => `<div class="m">${esc(c.location || '')}${c.period ? ' · ' + esc(c.period) : ''}${c.company_figures ? ' · includes company-wide figures' : ''}</div>`;
    function growthCard(c) {
      (c.recommendations || []).slice(0, 4).forEach((r, i) => {
        cardEl(`<h5>${esc(r.title)}</h5>${i === 0 ? scopeM(c) : ''}<div class="m">${esc(r.detail)}</div>${(r.facts || []).length ? `<ul style="margin:6px 0 0 18px;padding:0">${r.facts.map((f) => `<li class="m">${esc(f)}</li>`).join('')}</ul>` : ''}`); });
      if (c.source) cardEl(`<div class="src">Source: ${esc(c.source)}</div>`);
    }
    function marketCard(c) {
      const p = c.profile || {}; const n = (x) => (x == null ? '—' : Number(x).toLocaleString('en-US'));
      cardEl(`<h5>Local market · ${esc(p.branch || c.location || '')}</h5><table><tr><td>Population (${esc(p.radius_miles || 25)} mi)</td><td>${n(p.population)}</td></tr><tr><td>Households</td><td>${n(p.households)}</td></tr>${p.age_65_plus ? `<tr><td>Age 65+</td><td>${n(p.age_65_plus.estimate)}${p.age_65_plus.share ? ' (' + esc(p.age_65_plus.share) + ')' : ''}</td></tr>` : ''}${p.median_household_income_estimate ? `<tr><td>Median household income (HCPS estimate)</td><td>${money(p.median_household_income_estimate)}</td></tr>` : ''}</table>
        <div class="src">${esc(p.census_source || '')}</div>`);
      (c.recommendations || []).slice(0, 3).forEach((r) => cardEl(`<h5>${esc(r.title)}</h5><div class="m">${esc(r.detail || '')}</div>`));
    }
    /* storefront plan (owner 2026-11-22): what "use that" applies is exactly the last plan shown here */
    let lastPlan = null;
    function storefrontPlanCard(c) {
      lastPlan = c;
      const tp = (c.top_products || []).slice(0, 8);
      cardEl(`<h5>Storefront plan · ${esc(c.location || '')}</h5><div class="m">From your purchases ${esc(c.from || '')} – ${esc(c.to || '')}${c.live ? ' · storefront is live (changes stay a draft until you publish)' : ''}</div>
        ${(c.lines || []).length ? `<div class="m"><b>Lines first:</b> ${(c.lines || []).map((l) => esc(l.name)).join(', ')}</div>` : '<div class="m">No purchases on lines this storefront can show.</div>'}
        ${(c.categories || []).length ? `<div class="m"><b>Categories first:</b> ${c.categories.map(esc).join(', ')}</div>` : ''}
        ${tp.length ? `<table>${tp.map((x) => `<tr><td>${esc(x.manufacturer)} · ${esc(x.code)}<div class="m">${esc(x.name || '')}${x.category ? ' · ' + esc(x.category) : ''} · ${esc((x.sources || []).join(' / '))}</div></td><td>${esc(x.qty)}</td></tr>`).join('')}</table>` : ''}
        ${(c.excluded || []).length ? `<div class="m">Not shown: ${(c.excluded || []).map((x) => esc(x.manufacturer) + ' — ' + esc(x.reason)).join('; ')}</div>` : ''}`);
      cardEl(`<h5>Headline</h5><div class="m">${esc(c.headline || '')}</div><h5 style="margin-top:6px">Introduction</h5><div class="m">${esc(c.about || '')}</div>
        <div class="src">${c.can_edit ? 'Nothing is saved. Say “use that” to put this into your Storefront builder — you save or publish it.' : 'Only your head office can change this location\'s storefront.'}</div>`);
    }
    function purchasesCard(c) {
      const list = (rows, title) => rows && rows.length ? cardEl(`<h5>${esc(title)}</h5><table>${rows.slice(0, 20).map((x) => `<tr><td>${esc(x.manufacturer)} · ${esc(x.code)}<div class="m">${esc(x.name || '')}${(x.dates || []).length ? ' · ' + esc(x.dates.join(', ')) : ''}</div></td><td>${esc(x.qty)}</td></tr>`).join('')}</table>`) : null;
      cardEl(`<h5>Purchases ${esc(day(c.from))} – ${esc(day(c.to))}</h5><div class="m">${esc(c.location || '')}</div>`);
      list(c.portal_orders, 'Ordered in the portal');
      list(c.manufacturer_reported, 'Reported by manufacturers');
      if (!(c.portal_orders || []).length && !(c.manufacturer_reported || []).length) cardEl('<div class="m">No purchases on file for these dates.</div>');
      if ((c.coverage_gaps || []).length) cardEl(`<div class="m"><b>Not reported yet:</b> ${c.coverage_gaps.map((g) => esc(g.manufacturer + (g.reported_through ? ' (through ' + g.reported_through + ')' : ''))).join('; ')}</div>`);
      if ((c.opportunities || []).length) cardEl(`<h5>Could interest your customers</h5>${c.opportunities.map((o) => `<div class="m">${esc(o.name)} · ${esc(o.manufacturer)}${o.category ? ' · ' + esc(o.category) : ''}</div>`).join('')}<div class="src">Bought by other Home Care Provider Services dealers in the past 12 months on lines you already buy — not local data.</div>`);
      cardEl('<div class="src">Portal orders and manufacturer-reported purchases are listed separately and never added together.</div>');
    }
    /* buttons for the screen on view, from the server (no AI call) */

    /* every page / draft action is performed and CHECKED in the portal before Victoria reports it (✓ / ✗); the confirmed
       sentences go back to the voice agent so she only says what the portal shows */
    async function perform(r) {
      /* `said` = what Victoria speaks: short, no item numbers (the ✓ card on screen carries the details) */
      const said = []; const acts = r.actions || [];
      const n = (k) => k + ' item' + (k === 1 ? '' : 's');
      const quotes = acts.filter((x) => x.type === 'open_quote');
      if (quotes.length) await go(async () => { const done = [], miss = []; for (const x of quotes) { let v = null; try { v = DV.openQuote ? await DV.openQuote(x) : null; } catch (e) { v = null; } ((v && v.ok) ? done : miss).push(x); }
        if (done.length) { quoteCard(done); said.push('The draft quote is open with ' + n(done.length) + '. Nothing has been saved or sent.'); }
        if (miss.length) { checked(false, 'Couldn\'t add ' + miss.map((x) => x.code).join(', ') + ' to a quote. Open the product and press Add to a quote.'); said.push('I couldn\'t add ' + (miss.length === 1 ? 'that item' : n(miss.length)) + ' to a quote. Open the product and press Add to a quote.'); } });
      for (const x of acts) {
        if (x.type === 'open_brochure') await go(async () => { let v = null; try { v = DV.openBrochure ? await DV.openBrochure(x) : null; } catch (e) { v = null; }
          checked(!!(v && v.ok), v && v.ok ? 'Print Brochure is open for ' + x.code + ' — choose the price your customer sees, then print, save or email it. Nothing has been sent.' : 'The Print Brochure dialog for ' + x.code + ' didn\'t open. Open the product and press Print Brochure.');
          said.push(v && v.ok ? 'Print Brochure is open — choose the price your customer sees. Nothing has been sent.' : 'The brochure didn\'t open. Open the product and press Print Brochure.'); });
        else if (x.type === 'open_view') await go(async () => { let v = null; try { v = DV.openView ? await DV.openView(x.view) : null; } catch (e) { v = null; }
          /* nested destinations confirm with their own sentence (Golden: once Troubleshoot is on screen) — said once */
          const t = v && v.ok ? (v.confirm || (x.label || x.view) + ' is open on the page.') : v && v.reason === 'not_available' ? (x.label || x.view) + ' isn\'t available for your account.' : (x.label || x.view) + ' didn\'t open. Use the menu at the top of the page.'; checked(!!(v && v.ok), t); said.push(t); });
        else if (x.type === 'open_search') await go(async () => { let v = null; try { v = DV.openSearch ? await DV.openSearch(x.query) : null; } catch (e) { v = null; }
          /* one clear match: its product page is open (confirmed once it is on screen); several: the results are on screen and
             Victoria asks one short question (owner 2026-11-20 23:31) */
          const ok = !!(v && v.ok); const n = ok ? v.count : 0;
          const searchFailure = v && v.message ? v.message : 'The search didn\'t open. Please try the search bar at the top of the page.';
          checked(ok, !ok ? searchFailure
            : v.opened ? 'The product page for ' + v.opened.name + ' is open.' : 'Shop Products shows ' + n + ' result' + (n === 1 ? '' : 's') + ' for “' + x.query + '” (every line on your account).');
          said.push(!ok ? searchFailure
            : v.opened ? 'The ' + v.opened.name + ' page is open.'
            : !n ? 'Shop Products found nothing for that on your lines.'
            : 'Shop Products shows ' + n + ' result' + (n === 1 ? '' : 's') + '.' + (n > 1 ? ' Which one would you like?' : '')); });   // names stay on screen, not read aloud
        else if (x.type === 'storefront_apply') await go(async () => {
          if (!lastPlan) { const t = 'Ask me for a storefront plan first — then say “use that”.'; checked(false, t); said.push(t); return; }
          const plan = Object.assign({}, lastPlan); if (x.headline) plan.headline = x.headline; if (x.about) plan.about = x.about;
          let v = null; try { v = DV.storefrontApply ? await DV.storefrontApply(plan) : null; } catch (e) { v = null; }
          const ok = !!(v && v.ok); const t = ok ? (v.confirm || 'The plan is in your Storefront builder.') + ' Nothing is saved or published until you press Save or Publish.' : (v && v.message) || 'The plan couldn\'t be put into the Storefront builder.';
          checked(ok, t); said.push(t); });
        else if (x.type === 'ad_create') await go(async () => {
          let v = null; try { v = DV.adCreate ? await DV.adCreate(x) : null; } catch (e) { v = null; }
          const nm = (v && v.name) || x.name || x.code;
          const why = { not_listed: x.code + ' isn\'t one of the products this location can advertise.', read_only: 'Only your head office can make ads for this location.', busy: 'The Studio is busy — try again in a moment.' };
          const ok = !!(v && v.ok && v.saved > 0);
          const t = !v || !v.ok ? (why[v && v.reason] || (v && v.message) || 'The designs couldn\'t be made just now — open Social Media Advertising and try Create 3 designs.')
            : v.saved === v.made ? v.made + ' Facebook designs for ' + nm + ' are in the Social Marketing Studio, each with its caption, and all ' + v.saved + ' are saved as private drafts in your Creative Library. Nothing is posted or scheduled.'
            : v.saved ? v.made + ' designs for ' + nm + ' are on screen; ' + v.saved + ' of ' + v.made + ' are saved to your Creative Library — press Retry saving for the rest. Nothing is posted.'
            : v.made + ' designs for ' + nm + ' are on screen but none are saved yet — download them, or press Retry saving. Nothing is posted.';
          checked(ok, t); said.push(t); });
        else if (x.type === 'ad_pick') await go(async () => {
          let v = null; try { v = DV.adPick ? await DV.adPick(x.n) : null; } catch (e) { v = null; }
          const ok = !!(v && v.ok);
          const t = ok ? 'Design ' + v.n + ' is open in the editor' + (v.saved ? ' (already saved in your Creative Library)' : '') + ' — change anything, then save or download. Nothing is posted.' : 'There are no generated designs on screen to choose from — ask me to create the ad first.';
          checked(ok, t); said.push(t); });
        else if (x.type === 'open_reimb') await go(async () => { let v = null; try { v = DV.openReimb ? await DV.openReimb() : null; } catch (e) { v = null; }
          const ok3 = !!(v && v.ok); const t = ok3 ? 'The reimbursement panel is on screen.' : 'The reimbursement panel didn\'t open — open a product first, then scroll to Provider reimbursement.'; checked(ok3, t); said.push(t); });
        else if (x.type === 'open_product') await go(async () => { let v = null; try { v = DV.openProduct ? await DV.openProduct(x) : null; } catch (e) { v = null; }
          const ok2 = !!(v && v.ok); const nm = (v && v.name) || x.name || x.code;
          checked(ok2, ok2 ? 'The product page for ' + nm + ' is open.' : 'The product ' + nm + ' didn\'t open — choose it in the results.');
          said.push(ok2 ? 'The ' + nm + ' page is open.' : 'That product page didn\'t open — choose it in the results.'); });
      }
      return said;
    }
    /* one spoken answer: the server's words, then what the portal confirmed — a sentence is never said twice */
    function joinSaid(a, confirmed) {
      const seen = new Set(), out = [];
      /* the portal's own "Nothing has been saved or sent." covers the model's variants of it — said once */
      const NOTHING = /\bnothing (?:is|has been|was|will be|gets)\b[^.!?]*\b(?:saved|sent|placed)\b/i;
      if ((confirmed || []).some((x) => NOTHING.test(x))) a = String(a || '').split(/(?<=[.!?])\s+/).filter((x) => !NOTHING.test(x) || /\$\s?\d|\b(not on your account|could ?n[o']t|can ?n[o']t|no match|not found|isn['’]t|aren['’]t|discontinued|unavailable|pending|order(?:ed|s)?|shipped|delivered|tracking)\b/i.test(x)).join(' ');   // a sentence carrying a price or fact is kept
      for (const x of [String(a || '')].concat(confirmed || []).join(' ').split(/(?<=[.!?])\s+/)) { const t = String(x || '').trim(); const k = t.toLowerCase().replace(/[^a-z0-9$]+/g, ' ').trim(); if (!t || seen.has(k)) continue; seen.add(k); out.push(t); }
      return out.join(' ');
    }
    function cards(r) {
      for (const c of r.cards || []) {
        if (c.type === 'golden_orders') orderCard(c, (r.cards || []).length === 1);
        else if (c.type === 'not_found') cardEl(`<div class="m">${esc(c.text)}</div>`);
        else if (c.type === 'reimbursement') reimbCard(c);
        else if (c.type === 'products') productsCard(c);
        else if (c.type === 'guide') guideCard(c);
        else if (c.type === 'storefront') storefrontCard(c);
        else if (c.type === 'growth') growthCard(c);
        else if (c.type === 'market') marketCard(c);
        else if (c.type === 'purchases') purchasesCard(c);
        else if (c.type === 'storefront_plan') storefrontPlanCard(c);
      }
    }
    const failText = (r) => { const over = r && /over_budget|over_daily|over_monthly|limit/.test(String(r.error));
      return over ? 'Victoria has reached her limit for now. Home Care Provider Services support can help right away.' : 'Victoria can\'t answer just now. Home Care Provider Services support can help right away.'; };
    const page = () => (DV.context ? DV.context() : {});

    /* TYPED question (typing mode, or a browser without a voice conversation) */
    async function ask(q) {
      q = String(q || '').trim(); if (!q || busy || !aiOn) return;
      busy = true; inp.value = ''; line('me', q); status('thinking'); $('.go').disabled = true;
      let r = null; try { r = await DV.api({ action: 'ask', question: q, page: page(), history: hist.slice(-3), voice: speakTyped && SP.supported() }); } catch (e) { r = null; }
      busy = false; $('.go').disabled = !aiOn; status(mode === 'typing' ? 'typing' : 'blocked');
      if (!r || r.ok !== true) { warn(failText(r), true); if (r && /over_/.test(String(r.error))) setAi(false); return; }
      const a = line('', r.answer || 'Here is what I found.');
      if (SP.mark) SP.mark('answer_shown', { audio_with_answer: !!(speakTyped && r.speech && r.speech.ok), tts_ms: r.speech ? r.speech.tts_ms : null, model_ms: r.timing ? r.timing.model_ms : null, total_ms: r.timing ? r.timing.total_ms : null });
      if (speakTyped) { if (r.speech && r.speech.ok && r.speech.audio && SP.preload) SP.preload(r.speech.text || r.answer, 'answer', r.speech.audio, r.speech.mime);
        if (Array.isArray(r.speech_parts) && r.speech_parts.length && SP.speakParts) SP.speakParts(r.speech_parts); else SP.speak(r.answer, { kind: 'answer', token: r.speech_token }); }
      { const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'fbk'; fb.textContent = 'That didn\u2019t answer my question';
        fb.onclick = async () => { fb.disabled = true; let ok = false; try { const x = await DV.api({ action: 'feedback', question: q, page: page() }); ok = !!(x && x.ok); } catch (e) { ok = false; }
          fb.textContent = ok ? 'Thanks — Home Care Provider Services will look at this.' : 'Thanks — it could not be recorded just now.'; };
        a.appendChild(fb); }
      hist.push({ q, a: r.answer || '' }); cards(r); await perform(r); a.scrollIntoView({ block: 'nearest' });
    }

    /* SPOKEN question: the voice agent calls ask_victoria → the same server pipeline (voice_tool), under the dealer's sign-in,
       with the last turns as context; the page performs and checks the actions, THEN the agent is told what to say */
    async function runTool(x) {
      const q = String((x.args && x.args.question) || '').trim();
      const tReq = Date.now(); let r = null; try { r = await DV.api({ action: 'voice_tool', session_id: x.session_id, name: x.name, args: x.args || {}, history: hist.slice(-3), page: page() }); } catch (e) { r = null; }
      if (!voice || !voice.active) return JSON.stringify({ say: '' });                 // closed meanwhile: nothing more happens
      if (!r || r.ok !== true) { const t = (r && r.content) ? null : failText(r); if (t) warn(t, true); return r && r.content ? r.content : JSON.stringify({ say: t }); }
      cards(r);
      if (r.disclaimer) { const d = document.createElement('div'); d.className = 'disc'; d.textContent = r.disclaimer; log.appendChild(d); }
      const tPage = Date.now(); const confirmed = await perform(r);
      if (!voice || !voice.active) return JSON.stringify({ say: '' });
      hist.push({ q, a: r.answer || r.say || '' });
      const say = joinSaid(r.say != null ? r.say : r.answer, confirmed);
      timings.push({ q: q.slice(0, 60), server_ms: r.timing ? r.timing.server_ms : null, model_ms: r.timing ? r.timing.model_ms : null, request_ms: tPage - tReq, page_ms: Date.now() - tPage, spoken_words: say.split(/\s+/).filter(Boolean).length });
      return JSON.stringify({ say });
    }

    function voiceEvent(type, d) {
      if (type === 'state') { if (d.state === 'idle' && orbHost.__dvLive && !(voice && voice.active)) orbHost.__dvLive(false); if (mode === 'voice') status(d.state === 'idle' ? (voice && voice.active ? 'connecting' : 'idle') : d.state); return; }
      if (type === 'permission') { if (d.asking) note('Allow microphone access to talk with Victoria.'); else clearNote(); return; }
      if (type === 'session') { if (d.greeting) { $('.hello').textContent = d.greeting; echo.push(d.greeting); } return; }
      if (type === 'ready') { clearNote(); if (pendingSay) { const s = pendingSay; pendingSay = null; voice.say(s); } return; }
      if (type === 'text') { const c = String(d.content || '').trim(); if (!c) return;
        if (d.role === 'assistant') { const i = echo.findIndex((e) => e === c || c.startsWith(e.slice(0, 60))); if (i >= 0) { echo.splice(i, 1); return; } line('', c); }
        else line('me', c); return; }
      if (type === 'interrupted' || type === 'paused' || type === 'resumed') return;
      if (type === 'away') { status('idle'); note('Victoria stopped listening because this tab was hidden for more than two minutes. Tap “Talk to Victoria” to start again.'); againB.hidden = false; return; }
      if (type === 'error') { clearNote(); warn(d.message || 'Victoria\'s voice stopped. You can type instead.', d.kind !== 'microphone'); toTyping(false, true); return; }
      if (type === 'idle') { status('idle'); note('Victoria stopped listening after two quiet minutes.'); againB.hidden = false; return; }
      if (type === 'limit') { status('idle'); note('This conversation reached its ' + (d.minutes || 10) + '-minute limit. Tap “Talk to Victoria” to start again.'); againB.hidden = false; return; }
    }
    let noteEl = null, pendingSay = null; const timings = [];   // per spoken question: server, page and spoken length (for timing checks; nothing is sent)
    function note(text) { if (!noteEl) { noteEl = document.createElement('div'); noteEl.className = 'warn vnote'; log.appendChild(noteEl); } noteEl.textContent = text; noteEl.scrollIntoView({ block: 'nearest' }); }
    function clearNote() { if (noteEl) { noteEl.remove(); noteEl = null; } }

    function startVoice() {
      mode = 'voice'; askBar.hidden = true; typeB.hidden = false; againB.hidden = true; status('connecting');
      if (!voice) voice = window.DVVoice.create({ api: DV.api, runTool, onEvent: voiceEvent });
      voice.start();                       // its audio contexts are made right here, inside the tap that opened Victoria
    }
    /* typing: this opening stops listening and speaking; the next opening talks again */
    function toTyping(byChoice, failed) {
      mode = 'typing'; speakTyped = !byChoice && !convoOK(); if (voice) voice.stop(byChoice ? 'typing' : 'failed'); SP.stop();
      askBar.hidden = false; typeB.hidden = true; againB.hidden = !(convoOK() && failed !== 'unsupported'); status(byChoice ? 'typing' : 'blocked');
      try { inp.focus(); } catch (e) {}
    }
    typeB.onclick = () => toTyping(true);
    againB.onclick = () => { clearNote(); if (convoOK()) startVoice(); };

    /* "Learn what Victoria can do for you": a short spoken + shown introduction (only what she can really do), then she
       listens. Shown in full once per browser; afterwards the card is a small link so it doesn't replay on every opening. */
    const LEARNED = 'dv_learned_v1'; const learned = () => { try { return localStorage.getItem(LEARNED) === '1'; } catch (e) { return false; } };
    function learnLook() { if (learned()) { learn.classList.add('small'); learn.innerHTML = 'Learn what Victoria can do for you'; } }
    learn.onclick = async () => {
      let r = null; try { r = await DV.api({ action: 'intro' }); } catch (e) { r = null; }
      const text = (r && r.ok && r.text) || 'I\'m Victoria, the personal assistant from Home Care Provider Services in your 360 Dealer Portal.';
      line('', text);
      if (mode === 'voice' && voice && voice.active) { echo.push(text); if (!voice.say(text)) pendingSay = text; }
      else if (speakTyped) SP.speak(text, { kind: 'answer' });
      try { localStorage.setItem(LEARNED, '1'); } catch (e) {} learnLook();
    };

    function setAi(on) { aiOn = on; inp.disabled = !on; $('.go').disabled = !on; if (!on) { warn('Victoria can\'t answer just now. Home Care Provider Services support can help right away.', true); if (voice) voice.stop('ai_off'); } }
    /* records this opening on the server (first welcome vs later, per person) — only when no voice session does it */
    async function hello(shown) {
      let r = null; try { r = await DV.api({ action: 'hello' }); } catch (e) { r = null; }
      if (!shown) { const text = (r && r.ok && r.greeting) || 'Hello! How can I help you today?'; $('.hello').textContent = text; if (speakTyped) SP.speak(text, { kind: 'greeting' }); }
    }
    /* the separate-audio path (no conversation): the globe glows while she speaks; a blocked or failed voice is explained */
    SP.onstate = (st) => { if (mode === 'voice') return; orb.dataset.s = st === 'speaking' ? 'speaking' : 'idle';
      if (st === 'blocked' && speakTyped) note(SP.supported() ? 'Victoria\'s voice didn\'t play in this browser. Everything she says is shown here.' : 'Victoria\'s voice isn\'t available just now. Everything she says is shown here.'); };
    function stopAll(reason) { if (voice) voice.stop(reason || 'closed'); SP.stop(); busy = false; }
    window.__dvVoiceStop = () => stopAll('signed_out');
    addEventListener('pagehide', () => stopAll('page_closed'));

    const api = {
      /* opts.greeting: the welcome to show at once (the launcher has spoken it already when there is no conversation) */
      toggle(on, opts) { const show = on == null ? P.hidden : on; P.hidden = !show;
        if (show && voice && voice.active && mode === 'voice') {        // a conversation still going (the panel had stepped aside): just show it
          if (orbHost.__dvLive) orbHost.__dvLive(false); place(); try { $('.x').focus(); } catch (e) {}
        } else if (show) {
          clearNote(); echo = []; pendingSay = null; learnLook();
          const g = (opts && opts.greeting) || DV.greeting || 'Hello! How can I help you today?'; $('.hello').textContent = g;
          place();
          if (DV.warmSearch) setTimeout(DV.warmSearch, 0);              // the product index loads while she greets
          if (!aiOn) { setAi(false); toTyping(false, 'unsupported'); hello(true); }
          else if (convoOK()) { speakTyped = false; startVoice(); }
          // (the voice session records the opening and speaks the greeting)
          else { mode = 'typing'; speakTyped = true; askBar.hidden = false; typeB.hidden = true; againB.hidden = true; status('blocked');
            warn(DV.conversation && DV.conversation.available ? 'This browser can\'t hold a spoken conversation (it needs microphone access over a secure connection). Victoria will answer what you type, and read her answers aloud.' : 'Spoken conversation isn\'t available just now. Type your question — Victoria will read her answers aloud.');
            hello(!!(opts && opts.greeting)); }
          try { (mode === 'typing' ? inp : $('.x')).focus(); } catch (e) {}
        } else { stopAll('closed'); if (orbHost.__dvLive) orbHost.__dvLive(false); if (on === false && orbHost.__dvFocus) orbHost.__dvFocus(); }
        if (orbHost.__dvExpanded) orbHost.__dvExpanded(show); },
      isOpen: () => !P.hidden,
      /* Start Here → Meet Victoria (owner 2026-11-22): a suggested question tapped on the page is asked as TYPED (no microphone
         is opened for it); a conversation already going switches to typing first */
      askFromPage(q) { if (P.hidden) { P.hidden = false; clearNote(); place(); if (orbHost.__dvExpanded) orbHost.__dvExpanded(true); }
        if (!aiOn) { setAi(false); toTyping(false, 'unsupported'); return null; }
        if (voice && voice.active) toTyping(true); else { mode = 'typing'; speakTyped = false; askBar.hidden = false; typeB.hidden = true; status('typing'); }
        return ask(q); },
      el: P, shadow: sh, ask, setAi, runTool, voiceEvent, timings,
      get voice() { return voice; },
    };
    return api;
  };
})();
