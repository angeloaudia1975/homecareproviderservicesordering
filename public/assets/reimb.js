/* 360 Dealer Portal — provider reimbursement lookup (owner 2026-11-19).
   Signed-in providers only: every answer comes from reimbursement-api (admin site), which checks the sign-in.
   Opened from Resources & Support, and from a coded model on Shop Products with its verified HCPCS code filled in.
   Text is placed as text (esc); links come only from the server's official source list and must be https. */
(function () {
  'use strict';
  const NO_CODE = 'No verified HCPCS code on file for this model';
  const NO_RATE = 'Rate unavailable for this plan/date';
  let META = null, METAP = null;
  const S = { code: '', state: '', plan: '', location: '', dos: '', modifier: '', otherMods: [], product: null, result: null, calc: null, busy: false, err: '' };
  const codeOf = (c) => (c && typeof c === 'object' ? c.code : String(c || ''));
  const codeLabel = (c) => (c && typeof c === 'object' ? (c.label || c.code) + (c.fit ? ' (' + c.fit + ')' : '') : String(c || ''));
  let CFG = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => /^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : null;
  const link = (u, label) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(label || s)}</a>` : esc(label || ''); };
  const money = (n) => (Number(n) < 0 ? '−' : '') + '$' + Math.abs(Number(n)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');   // a loss reads −$189.66
  const longDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); if (!m) return ''; return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1]; };

  async function meta(api) {
    if (META) return META;
    if (!METAP) METAP = api({ action: 'meta' }).then((r) => { if (r && r.ok) { META = r; return r; } METAP = null; throw new Error((r && r.error) || 'The reimbursement lookup could not be loaded.'); }, (e) => { METAP = null; throw e; });
    return METAP;
  }
  const stateOf = (id) => META && META.states.find((s) => s.id === id);
  const planOf = (st, id) => { const s = stateOf(st); return s && s.plans.find((p) => p.id === id); };
  function defaults(m) {
    const st = m.default_state || '';
    const s = stateOf(st); const plan = s ? (s.plans.find((p) => p.id === 'medicaid-ffs') || s.plans[0]) : null;
    return { state: st, plan: plan ? plan.id : '', location: plan ? plan.locations[0].id : '', dos: m.today };
  }

  /* ---------------- the lookup view ---------------- */
  async function mount(host, cfg) {
    CFG = cfg; S.host = host;
    host.innerHTML = '<div class="msg">Loading the reimbursement lookup…</div>';
    try { await meta(cfg.api); } catch (e) { host.innerHTML = `<div class="ph"><div><h1>Reimbursement lookup</h1></div></div><div class="card"><div class="msg">${esc(e.message)}</div></div>`; return; }
    const d = defaults(META);
    const pre = cfg.prefill || null;
    S.product = pre && pre.product ? pre.product : null;
    S.code = pre && pre.code ? codeOf(pre.code) : (S.code || '');
    S.state = (pre && pre.state) || S.state || d.state; S.plan = (pre && pre.plan) || S.plan || d.plan; S.location = (pre && pre.location) || S.location || d.location;
    S.dos = (pre && pre.dos) || S.dos || d.dos; S.modifier = ''; S.otherMods = []; S.result = null; S.err = '';
    if (!planOf(S.state, S.plan)) { const s = stateOf(S.state); S.plan = s ? (s.plans.find((p) => p.id === 'medicaid-ffs') || s.plans[0]).id : ''; }
    fixLocation();
    render();
    if (S.code && S.state && S.plan && !(S.product && S.product.noCode)) run();
  }
  function fixLocation() { const p = planOf(S.state, S.plan); if (p && !p.locations.some((l) => l.id === S.location)) S.location = p.locations[0].id; }

  function render() {
    const host = S.host; if (!host) return;
    const st = stateOf(S.state); const plans = st ? st.plans : []; const plan = planOf(S.state, S.plan);
    const prod = S.product;
    host.innerHTML = `<style>${CSS}</style>
      <div class="ph"><div><div class="rb-crumb"><a data-act="resources">Resources &amp; Support</a> / Reimbursement lookup</div><h1>Reimbursement lookup</h1>
        <div class="sub">Provider billing reference — Medicare and Medicaid fee schedule amounts by HCPCS code, state, plan and date of service.</div></div></div>
      ${prod ? `<div class="card rb-prod"><div><b>${esc(prod.name || '')}</b>${prod.code ? ' · Item # ' + esc(prod.code) : ''}</div>
        ${prod.noCode ? `<div class="rb-miss" role="status">${esc(NO_CODE)}</div>${prod.why ? `<div class="rb-small">${esc(prod.why)}</div>` : ''}`
          : `<div class="rb-small">Verified HCPCS ${prod.codes.map((c) => esc(codeLabel(c))).join(' · ')}</div>${prod.why ? `<div class="rb-small">${esc(prod.why)}</div>` : ''}`}</div>` : ''}
      <div class="card rb-form">
        <div class="rb-grid">
          <label>HCPCS code<input id="rbCode" value="${esc(S.code)}" maxlength="5" autocomplete="off" spellcheck="false" placeholder="e.g. L4361" ${prod && prod.codes && prod.codes.length > 1 ? 'list="rbCodes"' : ''}></label>
          ${prod && prod.codes && prod.codes.length > 1 ? `<datalist id="rbCodes">${prod.codes.map((c) => `<option value="${esc(codeOf(c))}">`).join('')}</datalist>` : ''}
          <label>State<select id="rbState"><option value="">Choose…</option>${META.states.map((s) => `<option value="${esc(s.id)}"${s.id === S.state ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
          <label>Plan<select id="rbPlan">${plans.map((p) => `<option value="${esc(p.id)}"${p.id === S.plan ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>
          <label>Service location<select id="rbLoc">${plan ? plan.locations.map((l) => `<option value="${esc(l.id)}"${l.id === S.location ? ' selected' : ''}>${esc(l.label)}</option>`).join('') : ''}</select></label>
          <label>Date of service<input id="rbDos" type="date" value="${esc(S.dos)}"></label>
          <label>Modifier<select id="rbMod"><option value="">Standard (none, NU, RR, UE)</option>${[...new Set(['NU', 'RR', 'UE'].concat(S.otherMods || []))].map((m) => `<option value="${esc(m)}"${m === S.modifier ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        </div>
        ${plan && plan.note ? `<div class="rb-small">${esc(plan.note)}</div>` : ''}
        <div class="rb-acts"><button class="btn pri" data-act="go"${S.busy ? ' disabled' : ''}>${S.busy ? 'Looking up…' : 'Look up'}</button>
          ${S.result && S.result.ok ? '<button class="btn gh" data-act="print">Print billing reference</button>' : ''}</div>
        ${S.err ? `<div class="rb-err" role="alert">${esc(S.err)}</div>` : ''}
      </div>
      <div id="rbOut">${S.result && S.result.ok ? resultHtml(S.result) : ''}</div>
      <div id="rbCalc">${S.result && S.result.ok && S.result.payment ? calcHtml(S.result) : ''}</div>
      <div class="rb-small rb-foot">${esc(META.disclaimer)} Patient information is not entered here.</div>`;
    const $ = (id) => host.querySelector('#' + id);
    $('rbState').onchange = (e) => { S.otherMods = []; S.modifier = ''; S.state = e.target.value; const s = stateOf(S.state); S.plan = s ? (s.plans.find((p) => p.id === 'medicaid-ffs') || s.plans[0]).id : ''; fixLocation(); S.result = null; render(); };
    $('rbPlan').onchange = (e) => { S.otherMods = []; S.modifier = ''; S.plan = e.target.value; fixLocation(); S.result = null; render(); };
    $('rbLoc').onchange = (e) => { S.location = e.target.value; };
    $('rbDos').onchange = (e) => { S.dos = e.target.value; };
    $('rbMod').onchange = (e) => { S.modifier = e.target.value; };
    $('rbCode').oninput = (e) => { S.code = e.target.value.toUpperCase(); S.otherMods = []; };
    $('rbCode').onkeydown = (e) => { if (e.key === 'Enter') run(); };
    bindCalc(host);
    host.querySelectorAll('[data-act]').forEach((el) => { el.onclick = () => { const a = el.getAttribute('data-act'); if (a === 'go') run(); else if (a === 'print') printRef(); else if (a === 'resources' && CFG.back) CFG.back(); }; });
  }

  async function run() {
    const host = S.host; if (!host || S.busy) return;
    const v = (id) => (host.querySelector('#' + id) || {}).value;
    S.code = String(v('rbCode') || S.code || '').trim().toUpperCase(); S.state = v('rbState') || S.state; S.plan = v('rbPlan') || S.plan;
    S.location = v('rbLoc') || S.location; S.dos = v('rbDos') || S.dos; S.modifier = v('rbMod') || '';
    S.err = '';
    if (!/^[A-V]\d{4}$/.test(S.code)) { S.err = 'Enter a HCPCS code — one letter and four digits, for example L4361.'; S.result = null; return render(); }
    if (!S.state || !S.plan) { S.err = 'Choose a state and plan.'; return render(); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(S.dos)) { S.err = 'Enter the date of service.'; return render(); }
    S.busy = true; render();
    try {
      const r = await CFG.api({ action: 'lookup', code: S.code, state: S.state, plan: S.plan, location: S.location, dos: S.dos, modifier: S.modifier || undefined });
      if (r && r.ok) { S.result = r; S.otherMods = r.other_modifiers || []; S.calc = calcDefaults(r); } else { S.result = null; S.err = (r && r.error) || 'The lookup failed — please try again.'; }
    } catch (e) { S.result = null; S.err = 'The lookup failed — please try again.'; }
    S.busy = false; render();
  }

  function itemsHtml(a) {
    return `<table class="rb-tab"><thead><tr><th>Amount</th><th>Billing unit</th><th>Modifier</th><th>What it pays for</th></tr></thead><tbody>${a.items.map((i) => `<tr><td class="rb-amt">${money(i.amount)}</td><td>${esc(i.unit || '')}</td><td>${esc(i.modifier || '—')}</td><td>${esc(i.basis || '')}${i.note ? `<div class="rb-small">${esc(i.note)}</div>` : ''}</td></tr>`).join('')}</tbody></table>`;
  }
  function resultHtml(r) {
    const c = r.context, a = r.allowance, pr = r.purchase_rental, g = r.guidance;
    const ctx = `<dl class="rb-ctx"><div><dt>Payer / plan</dt><dd>${esc(c.payer)} · ${esc(c.plan_label)} · ${esc(c.state_name)}</dd></div><div><dt>Service location</dt><dd>${esc(c.location_label)}</dd></div><div><dt>Date of service</dt><dd>${esc(c.dos_label)}</dd></div><div><dt>HCPCS</dt><dd>${esc(c.code)}${c.description ? ' — ' + esc(c.description) : ''}</dd></div></dl>`;
    const om = r.other_modifiers && r.other_modifiers.length ? `<div class="rb-small">Also published with modifiers: ${r.other_modifiers.map(esc).join(', ')} — choose one under Modifier to see it.</div>` : '';
    const allow = a.status === 'ok'
      ? `${itemsHtml(a)}${om}<div class="rb-small">Effective: ${esc(a.effective || '')}${a.note ? ' · ' + esc(a.note) : ''}</div><div class="rb-src">Source · ${link(a.source && a.source.url, a.source && a.source.title)}${a.source && a.source.page ? ', page ' + esc(a.source.page) : ''}</div>`
      : `<div class="rb-miss" role="status">${esc(a.message || NO_RATE)}</div><div class="rb-small">${esc(a.reason || '')}</div>${a.source ? `<div class="rb-src">Source checked · ${link(a.source.url, a.source.title)}</div>` : ''}`;
    let prh = '';
    if (pr && pr.status === 'ok') {
      prh = (pr.lines || []).map((l) => `<div>${esc(l)}</div>`).join('');
      if (pr.capped) prh += `<table class="rb-tab rb-cap"><thead><tr><th>Rental months</th><th>Monthly amount</th></tr></thead><tbody>${pr.capped.months.map((m) => `<tr><td>Months ${esc(m.months)}</td><td class="rb-amt">${money(m.amount)}</td></tr>`).join('')}</tbody></table><div class="rb-small">${esc(pr.capped.note)} ${link(pr.capped.source.url, pr.capped.source.title)}</div>`;
      if (pr.oxygen) prh += `<div class="rb-small">${esc(pr.oxygen.note)} ${link(pr.oxygen.source.url, pr.oxygen.source.title)}</div>`;
      if (pr.note) prh += `<div class="rb-small">${esc(pr.note)}</div>`;
    } else prh = `<div class="rb-small">${esc((pr && pr.message) || 'No purchase or rental amount for this plan and date.')}</div>`;
    const gh = `${g.status !== 'ok' ? `<div class="rb-warn">Coverage guidance unavailable. ${esc(g.message || '')}</div>` : (g.policy ? `<div>Policy: ${link(g.policy.url, g.policy.title)}</div>` : '')}
      ${g.bullets && g.bullets.length ? `<ul>${g.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${g.links && g.links.length ? `<div class="rb-links">${g.links.map((l) => link(l.url, l.label || l.title)).join(' · ')}</div>` : ''}`;
    return `${ctx}
      <section class="card rb-sec"><h3>Published allowance</h3>${allow}</section>
      <section class="card rb-sec"><h3>Purchase or rental</h3>${prh}</section>
      <section class="card rb-sec"><h3>Coverage &amp; billing guidance</h3>${gh}<div class="rb-small">${esc(r.disclaimer)}</div></section>
      <section class="card rb-sec"><h3>Sources</h3><ul class="rb-srcs">${r.sources.map((s) => `<li>${link(s.url, s.title)}${s.effective ? ' — ' + esc(s.effective) : ''}</li>`).join('')}</ul></section>`;
  }

  /* Print billing reference — an internal reference (no patient data): the context, all three sections and the sources,
     with every link printed as its address so the paper copy is usable too. Printed from a hidden frame (no pop-up). */
  function printRef() {
    const r = S.result; if (!r || !r.ok) return;
    const prod = S.product && !S.product.noCode ? `<p><b>Product:</b> ${esc(S.product.name || '')}${S.product.code ? ' · Item # ' + esc(S.product.code) : ''}</p>` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Billing reference ${esc(r.context.code)}</title><style>
      body{font:12px/1.45 -apple-system,Segoe UI,Arial,sans-serif;color:#111;margin:0}h1{font-size:18px;margin:0 0 2px}h3{font-size:13px;margin:14px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
      .note{font-size:11px;color:#444}table{border-collapse:collapse;width:100%;margin:4px 0}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2f2f2}
      a{color:#0b4f8a}a[href]:after{content:" (" attr(href) ")";font-size:9.5px;color:#555;word-break:break-all}dl{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:8px 0}dt{font-weight:700;font-size:10.5px;color:#555}dd{margin:0}
      .rb-miss{font-weight:700;color:#9b1c1c}.rb-warn{font-weight:700;color:#8a5a00}.rb-small{font-size:11px;color:#444}.rb-amt{font-weight:700}section{page-break-inside:avoid}
      @page{size:letter;margin:.6in}</style></head><body>
      <h1>Billing reference — HCPCS ${esc(r.context.code)}</h1><div class="note">Internal billing reference for provider staff · printed ${esc(longDate(META && META.today))} · HCPS 360 Dealer Portal. Not a claim, not an eligibility check and not for patients.</div>
      ${prod}${resultHtml(r).replace(/class="card rb-sec"/g, '')}
      <p class="note">${esc(r.disclaimer)}</p></body></html>`;
    const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(() => f.remove(), 60000); }, 250);
  }

  /* ---------------- Shop Products card (owner 2026-11-19 15:13): Original Medicare and the state's Medicaid side by side ----------------
     The server resolves the model's verified code(s) (_reimb_map) and looks both payers up; one payer without a rate keeps the
     other visible. The dealer can change the state, date, Medicare location and Medicaid plan right here. */
  const CARD = new WeakMap();
  async function card(el, cfg) {
    if (!el) return;
    let m; try { m = await meta(cfg.api); } catch (e) { el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">${esc(e.message)}</div></div>`; return; }
    const st = CARD.get(el) || { state: m.default_state || '', dos: m.today, mloc: 'nonrural', mplan: '', mploc: '' };
    CARD.set(el, st);
    const prod = cfg.product || {};
    el.innerHTML = '<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">Loading…</div></div>';
    let r; try { r = await cfg.api({ action: 'product', manufacturer: prod.manufacturer, sku: prod.code, category: prod.category, sku_code: prod.sku_code, page_codes: prod.page_codes,
      state: st.state, dos: st.dos, medicare_location: st.mloc, medicaid_plan: st.mplan || undefined, medicaid_location: st.mploc || undefined }); } catch (e) { r = null; }
    if (!r || !r.ok) { el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">${esc((r && r.error) || 'The reimbursement lookup could not be loaded — please try again.')}</div></div>`; return; }
    const mp = r.mapping || { codes: [] };
    const full = Object.assign({}, prod, { codes: mp.codes, why: mp.why, status: mp.status, noCode: !mp.codes.length });
    if (!mp.codes.length) {
      el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-miss">${esc(NO_CODE)}</div>${mp.why ? `<div class="pd-reimb-s">${esc(mp.why)}</div>` : ''}<a class="pd-reimb-go" role="button" tabindex="0">Open reimbursement lookup →</a></div>`;
      bindGo(el, () => cfg.open({ product: full })); return;
    }
    if (r.state) { st.state = r.state; st.dos = r.dos; st.mloc = r.medicare_location; st.mplan = r.medicaid_plan || ''; st.mploc = r.medicaid_location || ''; }
    const plans = r.plans || []; const mPlans = plans.filter((p) => p.id !== 'medicare'); const mPlan = mPlans.find((p) => p.id === st.mplan);
    const rowHtml = (x) => {
      const res = x.result || {}; const c = res.context || {}; const a = res.allowance || {};
      const head = `${x.payer === 'medicare' ? 'Original Medicare fee-for-service' : esc(c.plan_label || 'Medicaid')} · ${esc(c.state_name || '')} · ${esc(c.location_label || '')} · ${esc(c.dos_label || '')}`;
      const body = a.status === 'ok'
        ? a.items.map((i) => `<div class="pd-reimb-amt">${money(i.amount)}<span>${esc(i.basis)}${i.modifier ? ' · ' + esc(i.modifier) : ''} · ${esc(i.unit || '')}</span></div>`).join('') +
          `<div class="pd-reimb-src">Source · ${link(a.source && a.source.url, a.source && a.source.title)}${a.source && a.source.page ? ', page ' + esc(a.source.page) : ''}</div>`
        : `<div class="pd-reimb-miss">${esc(NO_RATE)}</div>${a.reason ? `<div class="pd-reimb-s">${esc(a.reason)}</div>` : ''}`;
      return `<div class="pd-reimb-row"><div class="pd-reimb-p">${head}</div>${body}</div>`;
    };
    const groups = mp.codes.map((c) => {
      const rows = (r.rows || []).filter((x) => x.code === c.code && !x.conditional);
      const alt = c.conditional ? (r.rows || []).filter((x) => x.code === c.conditional.code && x.conditional) : [];
      return `<div class="pd-reimb-code">HCPCS ${esc(codeLabel(c))}</div>${c.component === 'mechanism' ? `<div class="pd-reimb-s">${esc(mp.why)}</div>` : ''}${rows.map(rowHtml).join('')}
        ${c.conditional ? `<div class="pd-reimb-s pd-reimb-cond">${esc(c.conditional.note)}</div>${alt.map(rowHtml).join('')}` : ''}`;
    }).join('');
    const stOpts = (m.states || []).map((s) => `<option value="${esc(s.id)}"${s.id === st.state ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
    el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div>
      ${mp.codes.every((c) => c.component !== 'mechanism') && mp.why ? `<div class="pd-reimb-s">${esc(mp.why)}</div>` : ''}
      <div class="pd-reimb-ctl">
        <label>State<select data-k="state"><option value="">Choose…</option>${stOpts}</select></label>
        <label>Date of service<input type="date" data-k="dos" value="${esc(st.dos)}"></label>
        <label>Medicare location<select data-k="mloc"><option value="nonrural"${st.mloc !== 'rural' ? ' selected' : ''}>Non-rural ZIP</option><option value="rural"${st.mloc === 'rural' ? ' selected' : ''}>Rural ZIP</option></select></label>
        ${mPlans.length ? `<label>Medicaid plan<select data-k="mplan">${mPlans.map((p) => `<option value="${esc(p.id)}"${p.id === st.mplan ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>` : ''}
        ${mPlan && mPlan.locations.length > 1 ? `<label>Medicaid location<select data-k="mploc">${mPlan.locations.map((l) => `<option value="${esc(l.id)}"${l.id === st.mploc ? ' selected' : ''}>${esc(l.label)}</option>`).join('')}</select></label>` : ''}
      </div>
      ${st.state ? groups : '<div class="pd-reimb-s">Choose a state to see Original Medicare and Medicaid allowances.</div>'}
      <div class="pd-reimb-links"><a class="pd-reimb-go" role="button" tabindex="0">View billing details →</a><a class="pd-reimb-go pd-reimb-calc" role="button" tabindex="0">Insurance earnings calculator (dealer only) →</a></div></div>`;
    el.querySelectorAll('[data-k]').forEach((x) => { x.onchange = () => { const k = x.getAttribute('data-k'); st[k] = x.value; if (k === 'state') { st.mplan = ''; st.mploc = ''; } if (k === 'mplan') st.mploc = ''; card(el, cfg); }; });
    const go = (calc) => cfg.open({ product: full, code: mp.codes[0], state: st.state, plan: calc === 'medicaid' ? st.mplan : 'medicare', location: st.mloc, dos: st.dos });
    const links = el.querySelectorAll('.pd-reimb-go');
    bindOne(links[0], () => go('medicare')); bindOne(links[1], () => go('medicare'));
  }
  function bindOne(a, fn) { if (!a) return; a.onclick = fn; a.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; }

  /* ---------------- Insurance earnings calculator (dealer only) ----------------
     Never printed, never on a storefront, quote, brochure or customer email: it lives only in this signed-in view. Pure
     arithmetic on the verified allowance and the payer rule the server sends (result.payment); each payer share counted once. */
  function estimate(o) {
    const it = o.item, pay = o.payment || {}, split = pay.split || { program: 1, patient: 0 }, rule = pay.rental || {};
    const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) && n >= 0 ? n : null; };   // non-numbers → blank, never below 0
    const cp = num(o.coins_pct == null ? 100 : o.coins_pct); const coins = Math.min(100, cp == null ? 100 : cp) / 100;
    const cost = o.cost == null || String(o.cost).trim() === '' ? null : num(o.cost), setup = num(o.setup) || 0, service = num(o.service) || 0;
    const months = [];
    if (it.type === 'purchase') months.push(it.amount);
    else {
      let n = Math.floor(num(o.months) || 0);
      if (rule.kind === 'capped') { n = Math.min(n, 13); for (let i = 1; i <= n; i++) months.push(Math.round(it.amount * (i <= 3 ? 1 : 0.75) * 100) / 100); }
      else if (rule.kind === 'oxygen') { n = Math.min(n, 36); for (let i = 1; i <= n; i++) months.push(it.amount); }
      else if (rule.kind === 'inexpensive' && rule.cap) { let paid = 0; for (let i = 1; i <= n && paid < rule.cap - 0.005; i++) { const amt = Math.min(it.amount, Math.round((rule.cap - paid) * 100) / 100); months.push(amt); paid += amt; } }
      else for (let i = 1; i <= n; i++) months.push(it.amount);
    }
    const after = it.type === 'rental' && rule.kind === 'oxygen' ? Math.min(24, Math.floor(num(o.after) || 0)) : 0;
    const allowed = months.reduce((a, b) => a + b, 0);
    const program = allowed * split.program, patient = allowed * (split.patient || 0) * coins;
    const collections = program + patient;
    const serviceMonths = it.type === 'rental' ? months.length + after : 0;
    const costs = cost == null ? null : cost + setup + service * serviceMonths;
    let breakEven = null;
    if (costs != null) {
      if (it.type === 'purchase') breakEven = collections >= costs ? 'At payment' : null;
      else { let cum = 0; for (let i = 0; i < months.length; i++) { cum += months[i] * (split.program + (split.patient || 0) * coins); if (cum >= cost + setup + service * (i + 1) - 0.005) { breakEven = 'Month ' + (i + 1); break; } } }
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    return { months, paid_months: months.length, after_months: after, allowed: r2(allowed), program: r2(program), patient: r2(patient), collections: r2(collections),
      costs: costs == null ? null : r2(costs), margin: costs == null ? null : r2(collections - costs), margin_pct: costs == null || !collections ? null : Math.round((collections - costs) / collections * 1000) / 10, break_even: breakEven };
  }
  function calcDefaults(r) {
    const items = (r.allowance && r.allowance.items) || []; const rule = (r.payment && r.payment.rental) || {};
    const idx = Math.max(0, items.findIndex((i) => i.type === 'rental' && (rule.kind === 'capped' || rule.kind === 'oxygen')));
    const prod = S.product || {}; const mech = (prod.codes || []).some((c) => c && c.component === 'mechanism' && c.code === r.context.code);
    return { idx: items.length ? idx : 0, cost: mech || prod.cost == null ? '' : String(prod.cost), setup: '0', service: '0', months: rule.kind === 'capped' ? '13' : rule.kind === 'oxygen' ? '36' : rule.unmodelled ? '1' : '12', coins: '100', after: rule.kind === 'oxygen' ? '24' : '0', mech };
  }
  function calcHtml(r) {
    const c = S.calc || (S.calc = calcDefaults(r)); const items = r.allowance.items; const it = items[c.idx] || items[0]; const pay = r.payment; const rule = pay.rental || {};
    const e = estimate({ item: it, payment: pay, cost: c.cost, setup: c.setup, service: c.service, months: c.months, coins_pct: c.coins, after: c.after });
    const rental = it.type === 'rental';
    const period = !rental ? 'One payment (purchase)'
      : rule.kind === 'capped' ? 'Capped rental: months 1–3 at ' + money(it.amount) + ', months 4–13 at ' + money(Math.round(it.amount * 75) / 100) + ' (' + rule.rule + '); ' + e.paid_months + ' paid month(s) modelled'
      : rule.kind === 'oxygen' ? 'Oxygen: up to 36 monthly payments (' + rule.rule + '), then months 37–60 the supplier keeps furnishing the equipment without rental payments; ' + e.paid_months + ' paid month(s) + ' + e.after_months + ' unpaid service month(s) modelled'
      : rule.kind === 'inexpensive' ? 'Rental of an inexpensive item: total rental never exceeds the purchase fee ' + (rule.cap ? money(rule.cap) : '') + ' (' + rule.rule + '); ' + e.paid_months + ' paid month(s)'
      : 'Monthly rental: ' + e.paid_months + ' month(s), your estimate' + (rule.unmodelled ? '. ' + rule.unmodelled : '');
    const packNote = (S.product && S.product.cost_note && !c.mech) ? `<div class="rb-small">${esc(S.product.cost_note)}</div>` : '';
    const mechNote = c.mech ? '<div class="rb-warn">This allowance is for the electric seat-lift mechanism only. Enter the mechanism\'s own cost — the chair\'s full cost is not used, so the margin stays unavailable until you do.</div>' : '';
    return `<section class="card rb-sec rb-calc"><h3>Insurance earnings estimate — dealer only</h3>
      <div class="rb-small">Private to your signed-in account: never shown on storefronts, customer quotes, brochures, customer emails or the printed billing reference.</div>${mechNote}${packNote}
      <div class="rb-grid">
        <label>Allowance<select data-c="idx">${items.map((i, k) => `<option value="${k}"${k === c.idx ? ' selected' : ''}>${esc(money(i.amount) + ' · ' + i.basis + (i.modifier ? ' · ' + i.modifier : ''))}</option>`).join('')}</select></label>
        <label>${c.mech ? 'Mechanism cost (your cost)' : 'Your acquisition cost'}<input data-c="cost" inputmode="decimal" value="${esc(c.cost)}" placeholder="${c.mech ? 'Enter component cost' : '0.00'}"></label>
        <label>Delivery / setup cost<input data-c="setup" inputmode="decimal" value="${esc(c.setup)}"></label>
        ${rental ? `<label>Expected paid rental months<input data-c="months" inputmode="numeric" value="${esc(c.months)}"></label><label>Service cost per month<input data-c="service" inputmode="decimal" value="${esc(c.service)}"></label>` : ''}
        ${rental && rule.kind === 'oxygen' ? `<label>Months furnished after payments end<input data-c="after" inputmode="numeric" value="${esc(c.after)}"></label>` : ''}
        ${pay.payer === 'medicare' ? `<label>Coinsurance collected (%)<input data-c="coins" inputmode="numeric" value="${esc(c.coins)}"></label>` : ''}
      </div>
      <div class="rb-small">${esc(pay.split_note)}</div>
      <table class="rb-tab"><tbody>
        <tr><th>Payment period</th><td>${esc(period)}</td></tr>
        <tr><th>Allowed amount over the period</th><td class="rb-amt">${money(e.allowed)}</td></tr>
        ${pay.payer === 'medicare' ? `<tr><th>Medicare pays (80%)</th><td>${money(e.program)}</td></tr><tr><th>Beneficiary / secondary (20% × ${esc(c.coins)}% collected)</th><td>${money(e.patient)}</td></tr>` : `<tr><th>Medicaid pays</th><td>${money(e.program)}</td></tr>`}
        <tr><th>Expected collections</th><td class="rb-amt">${money(e.collections)}</td></tr>
        <tr><th>Your costs</th><td>${e.costs == null ? 'Unavailable — enter your cost' : money(e.costs)}</td></tr>
        <tr><th>Estimated gross margin</th><td class="rb-amt">${e.margin == null ? 'Unavailable' : money(e.margin) + (e.margin_pct == null ? '' : ' (' + e.margin_pct.toFixed(1) + '%)')}</td></tr>
        ${rental || e.break_even ? `<tr><th>Break-even</th><td>${e.costs == null ? '—' : esc(e.break_even || 'Not reached in the modelled period')}</td></tr>` : ''}
      </tbody></table>
      <div class="rb-small">An estimate from the published allowance — not a payment guarantee. The deductible, denials, plan rules and timing are not included.</div></section>`;
  }
  function bindCalc(host) {
    host.querySelectorAll('[data-c]').forEach((x) => { x.onchange = () => { S.calc[x.getAttribute('data-c')] = x.getAttribute('data-c') === 'idx' ? Number(x.value) : x.value; const box = host.querySelector('#rbCalc'); if (box && S.result) { box.innerHTML = calcHtml(S.result); bindCalc(host); } }; });
  }
  function bindGo(el, fn) { const a = el.querySelector('.pd-reimb-go'); if (!a) return; a.onclick = fn; a.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; }

  const CSS = `.rb-crumb{font-size:12px;color:var(--muted,#667);margin-bottom:4px}.rb-crumb a{cursor:pointer;text-decoration:underline}
    .rb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px}.rb-grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--muted,#556)}
    .rb-grid input,.rb-grid select{font-size:16px;min-height:44px;border:1px solid var(--line,#d5dbe3);border-radius:8px;padding:6px 10px;min-width:0;width:100%;box-sizing:border-box;background:#fff;color:inherit}
    .rb-acts{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.rb-acts .btn{min-height:44px}.rb-err{margin-top:10px;color:#9b1c1c;font-weight:700}
    .rb-small{font-size:12px;color:var(--muted,#556);margin-top:6px}.rb-foot{margin:14px 0 24px}
    .rb-miss{font-weight:800;color:#9b1c1c;margin:4px 0}.rb-warn{font-weight:700;color:#7a4b00;background:#fff7e6;border:1px solid #f1d39b;border-radius:8px;padding:8px 10px;margin-bottom:8px}
    .rb-ctx{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 14px;margin:12px 0}.rb-ctx dt{font-size:11px;font-weight:800;color:var(--muted,#667);text-transform:uppercase;letter-spacing:.3px}.rb-ctx dd{margin:2px 0 0;font-size:13.5px}
    .rb-tab{width:100%;border-collapse:collapse;margin:6px 0;font-size:13.5px}.rb-tab th,.rb-tab td{border-bottom:1px solid var(--line-2,#e6eaf0);padding:7px 8px;text-align:left;vertical-align:top}.rb-tab th{font-size:11px;text-transform:uppercase;letter-spacing:.3px;color:var(--muted,#667)}
    .rb-amt{font-weight:800;font-size:15px;white-space:nowrap}.rb-src{font-size:12px;margin-top:8px}.rb-sec ul{margin:6px 0 0 18px;padding:0}.rb-sec li{margin:4px 0}.rb-links{font-size:12.5px;margin-top:8px;line-height:1.8}
    .rb-prod{display:flex;flex-direction:column;gap:4px}.rb-srcs a,.rb-links a,.rb-src a{word-break:break-word}
    .rb-calc th{width:45%}
    @media (max-width:760px){.rb-grid{grid-template-columns:1fr}.rb-ctx{grid-template-columns:1fr 1fr}.rb-tab{font-size:13px}}`;

  window.HCPSReimb = { mount, card, estimate, NO_CODE, NO_RATE };
})();
