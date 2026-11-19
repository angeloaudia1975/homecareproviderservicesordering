/* 360 Dealer Portal — provider reimbursement lookup (owner 2026-11-19).
   Signed-in providers only: every answer comes from reimbursement-api (admin site), which checks the sign-in.
   Opened from Resources & Support, and from a coded model on Shop Products with its verified HCPCS code filled in.
   Text is placed as text (esc); links come only from the server's official source list and must be https. */
(function () {
  'use strict';
  const NO_CODE = 'No verified HCPCS code on file for this model';
  const NO_RATE = 'Rate unavailable for this plan/date';
  let META = null, METAP = null;
  const S = { code: '', state: '', plan: '', location: '', dos: '', modifier: '', otherMods: [], product: null, result: null, busy: false, err: '' };
  let CFG = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => /^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : null;
  const link = (u, label) => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(label || s)}</a>` : esc(label || ''); };
  const money = (n) => '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    S.code = pre && pre.code ? pre.code : (S.code || '');
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
          : `<div class="rb-small">Verified HCPCS ${prod.codes.map(esc).join(' · ')} from the HCPS catalog</div>`}</div>` : ''}
      <div class="card rb-form">
        <div class="rb-grid">
          <label>HCPCS code<input id="rbCode" value="${esc(S.code)}" maxlength="5" autocomplete="off" spellcheck="false" placeholder="e.g. L4361" ${prod && prod.codes && prod.codes.length > 1 ? 'list="rbCodes"' : ''}></label>
          ${prod && prod.codes && prod.codes.length > 1 ? `<datalist id="rbCodes">${prod.codes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>` : ''}
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
      <div class="rb-small rb-foot">${esc(META.disclaimer)} Patient information is not entered here.</div>`;
    const $ = (id) => host.querySelector('#' + id);
    $('rbState').onchange = (e) => { S.otherMods = []; S.modifier = ''; S.state = e.target.value; const s = stateOf(S.state); S.plan = s ? (s.plans.find((p) => p.id === 'medicaid-ffs') || s.plans[0]).id : ''; fixLocation(); S.result = null; render(); };
    $('rbPlan').onchange = (e) => { S.otherMods = []; S.modifier = ''; S.plan = e.target.value; fixLocation(); S.result = null; render(); };
    $('rbLoc').onchange = (e) => { S.location = e.target.value; };
    $('rbDos').onchange = (e) => { S.dos = e.target.value; };
    $('rbMod').onchange = (e) => { S.modifier = e.target.value; };
    $('rbCode').oninput = (e) => { S.code = e.target.value.toUpperCase(); S.otherMods = []; };
    $('rbCode').onkeydown = (e) => { if (e.key === 'Enter') run(); };
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
      if (r && r.ok) { S.result = r; S.otherMods = r.other_modifiers || []; } else { S.result = null; S.err = (r && r.error) || 'The lookup failed — please try again.'; }
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

  /* ---------------- Shop Products card ---------------- */
  async function card(el, cfg) {
    if (!el) return;
    const prod = cfg.product || {};
    const open = (extra) => cfg.open(Object.assign({ product: prod, code: prod.codes && prod.codes[0] }, extra || {}));
    if (!prod.codes || !prod.codes.length) {
      el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-miss">${esc(NO_CODE)}</div>${prod.why ? `<div class="pd-reimb-s">${esc(prod.why)}</div>` : ''}<a class="pd-reimb-go" role="button" tabindex="0">Open reimbursement lookup →</a></div>`;
      bindGo(el, () => cfg.open({ product: Object.assign({}, prod, { noCode: true }) }));
      return;
    }
    el.innerHTML = '<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">Loading…</div></div>';
    let m; try { m = await meta(cfg.api); } catch (e) { el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">${esc(e.message)}</div></div>`; return; }
    const d = defaults(m);
    if (!d.state) { el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">HCPCS ${prod.codes.map(esc).join(' · ')}</div><a class="pd-reimb-go" role="button" tabindex="0">Look up a plan and date →</a></div>`; bindGo(el, () => open()); return; }
    const plan = planOf(d.state, d.plan);
    const rows = [];
    for (const code of prod.codes.slice(0, 3)) {
      let r = null; try { r = await cfg.api({ action: 'lookup', code, state: d.state, plan: d.plan, location: d.location, dos: d.dos }); } catch (e) { r = null; }
      rows.push({ code, r });
    }
    const one = (x) => {
      const a = x.r && x.r.ok && x.r.allowance;
      if (a && a.status === 'ok') return `<div class="pd-reimb-amt">${money(a.items[0].amount)}<span>${esc(a.items[0].basis)}${a.items.length > 1 ? ' · +' + (a.items.length - 1) + ' more' : ''} · HCPCS ${esc(x.code)}</span></div>`;
      return `<div class="pd-reimb-miss">${esc(NO_RATE)}<span> · HCPCS ${esc(x.code)}</span></div>${a && a.reason ? `<div class="pd-reimb-s">${esc(a.reason)}</div>` : ''}`;
    };
    const src = rows.map((x) => x.r && x.r.ok && x.r.allowance && x.r.allowance.source).find(Boolean);
    el.innerHTML = `<div class="pd-reimb"><div class="pd-reimb-h">Provider reimbursement</div><div class="pd-reimb-s">${esc(stateOf(d.state).name)} · ${esc(plan.label)}</div>
      ${rows.map(one).join('')}<div class="pd-reimb-s">Published amount · Service date ${esc(longDate(d.dos))}</div>
      <a class="pd-reimb-go" role="button" tabindex="0">View billing details or change plan →</a>
      ${src ? `<div class="pd-reimb-src">Source · ${link(src.url, src.title)}${src.page ? ', page ' + esc(src.page) : ''}</div>` : ''}</div>`;
    bindGo(el, () => open({ state: d.state, plan: d.plan, location: d.location, dos: d.dos }));
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
    @media (max-width:760px){.rb-grid{grid-template-columns:1fr}.rb-ctx{grid-template-columns:1fr 1fr}.rb-tab{font-size:13px}}`;

  window.HCPSReimb = { mount, card, NO_CODE, NO_RATE };
})();
