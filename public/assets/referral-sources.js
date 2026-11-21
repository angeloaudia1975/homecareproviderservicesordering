/* Find local referral sources (Dealer Portal pilot, owner 2026-11-21) — ONE results view, reached from a product's
   reimbursement panel, the reimbursement lookup and Reports & Growth Ideas.

   Left: clinicians' published Original Medicare ordering activity for one HCPCS code in the dealer's office-search ZIPs
   (CMS "by Referring Provider and Service", read through referral-sources-api). Right: the published allowance for the
   payer, service date and rate ZIP the dealer chose (the existing reimbursement lookup, reimbursement-api "lookup").
   The two are separate: changing the search ZIPs never changes the rate inputs, and one failing never hides the other.

   Counts are shown per row exactly as CMS publishes them (code / rental status / claims year) — never summed across rows;
   a withheld beneficiary count reads "withheld by CMS (fewer than 11)", never 0. All text is placed as text. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const zip5 = (z) => { const m = /^\s*(\d{5})/.exec(String(z || "")); return m ? m[1] : ""; };
  const CSS = `.rf{max-width:1240px}.rf h1{margin:0}.rf .sub{color:#5b6b7a;font-size:13px;margin-top:4px}.rf .grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;margin-top:12px}
    @media(max-width:900px){.rf .grid{grid-template-columns:1fr}}.rf .card{background:#fff;border:1px solid #dfe8f0;border-radius:12px;padding:14px}.rf label{display:block;font-size:12.5px;font-weight:700;color:#3b4b5b;margin:8px 0 3px}
    .rf input,.rf select{width:100%;min-height:44px;font-size:16px;border:1px solid #cbd8e4;border-radius:8px;padding:8px 10px;box-sizing:border-box;background:#fff}.rf .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .rf .btn{min-height:44px;border-radius:8px;border:1px solid #1681c2;background:#1681c2;color:#fff;font-weight:700;padding:8px 14px;cursor:pointer}.rf .btn.gh{background:#fff;color:#1681c2}
    .rf .src{font-size:12px;color:#4a5b6b;margin-top:6px}.rf .msg{padding:10px 12px;border-radius:8px;background:#f4f8fb;color:#3b4b5b;font-size:13.5px;margin-top:10px}.rf .msg.err{background:#fdf1ed;color:#8a3412}
    .rf .codes{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.rf .codes button{min-height:40px;border:1px solid #cbd8e4;border-radius:999px;background:#fff;padding:6px 12px;font-size:13px;cursor:pointer;text-align:left}
    .rf .codes button[aria-pressed=true]{border-color:#1681c2;background:#e8f3fb;font-weight:700}.rf table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px}.rf th,.rf td{text-align:left;padding:8px 6px;border-bottom:1px solid #edf2f6;vertical-align:top}
    .rf th{font-size:12px;color:#5b6b7a}.rf .num{text-align:right;white-space:nowrap}.rf .wh{color:#8a5a00;font-size:12px}.rf .copy{min-height:36px;font-size:12.5px;padding:4px 10px}
    .rf .table-scroll{overflow-x:auto}.rf .amt{font-size:20px;font-weight:800;color:#0f5c8f}.rf .disc{font-size:11.5px;color:#4a5b6b;border-top:1px solid #e3edf5;margin-top:10px;padding-top:8px}
    @media(max-width:640px){.rf table thead{display:none}.rf table tr{display:block;border-bottom:1px solid #dfe8f0;padding:8px 0}.rf table td{display:flex;justify-content:space-between;gap:10px;border:0;padding:3px 0}.rf table td::before{content:attr(data-l);font-weight:700;color:#5b6b7a;font-size:12px}.rf .num{text-align:right}}`;

  function mount(host, cfg) {
    const S = { meta: null, rmeta: null, code: "", desc: "", codes: [], zips: "", mode: "radius", center: "", shown: 50, rental: "", spec: "", res: null, err: "", busy: false, offset: 0,
      rate: { state: "", plan: "medicare", zip: "", dos: "", mplan: "" }, rateRes: null, rateErr: "", prefill: cfg.prefill || null };
    const pf = S.prefill || {};
    if (pf.hcpcs) { S.code = String(pf.hcpcs).toUpperCase(); S.desc = pf.hcpcs_desc || ""; }
    if (pf.rate) Object.assign(S.rate, { state: pf.rate.state || "", zip: pf.rate.zip || "", dos: pf.rate.dos || "", mplan: pf.rate.mplan || "" });
    host.innerHTML = `<style>${CSS}</style><div class="rf"><div class="msg">Loading local referral sources…</div></div>`;
    const $ = (s) => host.querySelector(s);

    function sourceLine() {
      const m = S.meta; if (!m || !m.release) return "Referral data hasn't been loaded yet.";
      const r = m.release; const lc = m.last_check ? ` · last checked ${new Date(m.last_check.at).toLocaleString()}` : "";
      return `${r.label} · CMS file ${r.file_name} · live in the portal since ${new Date(r.live_since).toLocaleDateString()}${lc}`;
    }
    function render() {
      const m = S.meta || {}; const locs = m.locations || [];
      const back = cfg.ret && cfg.ret.label ? `<button class="btn gh" data-a="back">← Back to ${esc(cfg.ret.label)}</button>` : "";
      host.querySelector(".rf").innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><h1>Find local referral sources</h1>
          <div class="sub">Clinicians whose offices are in your area and who ordered this equipment for Original Medicare patients — names and office addresses to plan practice visits.</div>
          <div class="src">${esc(sourceLine())} · <a href="${esc((m.source || {}).url || "#")}" target="_blank" rel="noopener">CMS source</a></div></div>${back}</div>
        <div class="grid"><div class="card">
          <div class="row"><div><label for="rfLoc">Branch</label><select id="rfLoc">${locs.map((l) => `<option value="${esc(l.zip)}"${l.id === (m.location || {}).id ? " selected" : ""}>${esc(l.name)} · ${esc(l.city || "")} ${esc(l.zip)}</option>`).join("")}</select></div>
            <div><label for="rfMode">Search area</label><select id="rfMode"><option value="radius"${S.mode === "radius" ? " selected" : ""}>Within 25 miles (straight line)</option><option value="zips"${S.mode === "zips" ? " selected" : ""}>Exact office ZIPs only</option></select></div></div>
          ${S.mode === "radius" ? `<label for="rfCenter">Search center — ZIP (its Census center point)</label><input id="rfCenter" inputmode="numeric" value="${esc(S.center)}" placeholder="42101">`
            : `<label for="rfZips">Office search ZIPs (five digits, comma-separated)</label><input id="rfZips" inputmode="numeric" value="${esc(S.zips)}" placeholder="42101, 42103">`}
          <label for="rfQ">Equipment — HCPCS code or product words</label><input id="rfQ" value="${esc(S.q || S.code)}" placeholder="E0260 or semi-electric hospital bed">
          <div class="codes" id="rfCodes">${S.codes.map((c) => `<button type="button" data-code="${esc(c.hcpcs)}" aria-pressed="${c.hcpcs === S.code}"><b>${esc(c.hcpcs)}</b> ${esc(c.hcpcs_desc || "")}</button>`).join("")}</div>
          ${S.code ? `<div class="src">Selected: <b>${esc(S.code)}</b> ${esc(S.desc)}${pf.product ? ` — from ${esc(pf.product.name)} (the portal's verified product configuration)` : ""}</div>` : ""}
          <div class="row"><div><label for="rfRent">Supplier billed as</label><select id="rfRent"><option value="">Rental or purchase</option><option value="Y"${S.rental === "Y" ? " selected" : ""}>Rental</option><option value="N"${S.rental === "N" ? " selected" : ""}>Purchase</option></select></div>
            <div><label for="rfSpec">Specialty</label><select id="rfSpec"><option value="">All specialties</option>${((S.res && S.res.specialties) || []).map((x) => `<option${x === S.spec ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div></div>
          <div style="margin-top:10px"><button class="btn" data-a="search"${S.busy ? " disabled" : ""}>${S.busy ? "Searching…" : "Find referral sources"}</button></div>
          <div id="rfOut">${resultsHtml()}</div></div>
          <div class="card" id="rfRate">${rateHtml()}</div></div>`;
      bind();
    }
    function who(r) { return r.entity === "O" ? r.last_org : [r.first_name, r.mi, r.last_org].filter(Boolean).join(" ") + (r.credentials ? ", " + r.credentials : ""); }
    function addr(r) { return [r.street1, r.street2, [r.city, r.state].filter(Boolean).join(", ") + " " + r.zip5].filter(Boolean).join(" · "); }
    function resultsHtml() {
      if (S.err) return `<div class="msg err" role="alert">${esc(S.err)}</div>`;
      const r = S.res; if (!r) return "";
      if (r.mode === "radius") return radiusHtml(r);
      if (!r.total) return `<div class="msg"><b>No published matches</b> for ${esc(r.hcpcs)} in ${esc(r.zips.join(", "))} (claims year ${esc(r.release.data_year)}). CMS publishes a row only with 11 or more supplier claims, so this is not proof of no local demand. Add nearby ZIPs or choose another code.</div>`;
      return `<div class="src"><b>${r.total}</b> published row${r.total === 1 ? "" : "s"} · ${esc(r.release.label)} · ${esc(r.hcpcs)} · office ZIPs ${esc(r.zips.join(", "))}. Each row is one clinician / code / rental status — counts are never added together.</div>
        <div class="table-scroll"><table><thead><tr><th>Clinician</th><th>Specialty</th><th>Office (published address)</th><th>Billed as</th><th class="num">Beneficiaries</th><th class="num">Supplier claims</th><th class="num">Suppliers</th><th></th></tr></thead><tbody>
        ${r.rows.map((x, i) => `<tr><td data-l="Clinician"><b>${esc(who(x))}</b><br><span class="src">NPI ${esc(x.npi)}</span></td><td data-l="Specialty">${esc(x.specialty || "")}</td><td data-l="Office">${esc(addr(x))}</td>
          <td data-l="Billed as">${x.rental === "Y" ? "Rental" : x.rental === "N" ? "Purchase" : ""}</td>
          <td class="num" data-l="Beneficiaries">${x.benes == null ? '<span class="wh">withheld by CMS (fewer than 11)</span>' : esc(x.benes)}</td><td class="num" data-l="Supplier claims">${esc(x.claims)}</td><td class="num" data-l="Suppliers">${esc(x.suppliers == null ? "" : x.suppliers)}</td>
          <td><button class="btn gh copy" data-copy="${i}" type="button">Copy office details</button></td></tr>`).join("")}</tbody></table></div>
        ${r.total > r.offset + r.rows.length ? `<button class="btn gh" data-a="more">Show more (${r.total - r.offset - r.rows.length} left)</button>` : ""}
        <div class="disc">${esc(r.notes.coverage)} ${esc(r.notes.location)} Claims are not prescriptions, new patients or units.</div>`;
    }
    function dist(x) { return x.distance_basis === "office" ? `${esc(x.miles)} mi` : `≈ ${esc(x.miles)} mi<br><span class="wh">ZIP-based estimate</span>`; }
    function radiusHtml(r) {
      const cov = r.coverage && r.coverage.partial ? `<div class="msg" role="note"><b>Partial coverage at the edge:</b> the 25-mile circle reaches into ${esc(r.coverage.outside.map((x) => `${x.name} (${x.zip_areas} ZIP area${x.zip_areas === 1 ? "" : "s"})`).join(", "))}, which this CMS release doesn't include (it holds ${esc((r.release.states || []).join(", "))}). Clinicians there are not listed.</div>` : "";
      const uns = r.unsettled ? `<div class="src">${r.unsettled} published row${r.unsettled === 1 ? "" : "s"} in ZIP areas crossing the 25-mile line could not be placed by address and ${r.unsettled === 1 ? "is" : "are"} not listed.</div>` : "";
      const geo = r.geocoder === "unavailable" ? `<div class="src">The address service didn't answer, so every distance is a ZIP-based estimate.</div>` : "";
      if (!r.total) return `<div class="msg"><b>No published matches</b> for ${esc(r.hcpcs)} within 25 miles of ZIP ${esc(r.center.zip)} (claims year ${esc(r.release.data_year)}). CMS publishes a row only with 11 or more supplier claims, so this is not proof of no local demand.</div>${cov}${uns}`;
      const rows = r.rows.slice(0, S.shown);
      return `<div class="src"><b>${r.total}</b> published row${r.total === 1 ? "" : "s"} within 25 straight-line miles of ZIP ${esc(r.center.zip)}'s center · ${esc(r.release.label)} · ${esc(r.hcpcs)} · nearest first. ${r.placed_by.office} placed by office address${r.placed_by.zip ? `, ${r.placed_by.zip} by ZIP-based estimate (≈)` : ""}. Each row is one clinician / code / rental status — counts are never added together.</div>${cov}
        <div class="table-scroll"><table><thead><tr><th class="num">Distance</th><th>Clinician</th><th>Specialty</th><th>Office (published address)</th><th>Billed as</th><th class="num">Beneficiaries</th><th class="num">Supplier claims</th><th>Claims year</th><th></th></tr></thead><tbody>
        ${rows.map((x, i) => `<tr><td class="num" data-l="Distance">${dist(x)}</td><td data-l="Clinician"><b>${esc(who(x))}</b><br><span class="src">NPI ${esc(x.npi)}</span></td><td data-l="Specialty">${esc(x.specialty || "")}</td><td data-l="Office">${esc(addr(x))}</td>
          <td data-l="Billed as">${x.rental === "Y" ? "Rental" : x.rental === "N" ? "Purchase" : ""}</td>
          <td class="num" data-l="Beneficiaries">${x.benes == null ? '<span class="wh">withheld by CMS (fewer than 11)</span>' : esc(x.benes)}</td><td class="num" data-l="Supplier claims">${esc(x.claims)}</td><td data-l="Claims year">${esc(r.release.data_year)}</td>
          <td><button class="btn gh copy" data-copy="${i}" type="button">Copy office details</button></td></tr>`).join("")}</tbody></table></div>
        ${r.total > rows.length ? `<button class="btn gh" data-a="more">Show more (${r.total - rows.length} left)</button>` : ""}${uns}${geo}
        <div class="disc">${esc(r.notes.distance)} ${esc(r.notes.coverage)} ${esc(r.notes.location)} Claims are not prescriptions, new patients or units.</div>`;
    }
    function rateHtml() {
      const RM = S.rmeta || {}; const st = (RM.states || []).find((x) => x.id === S.rate.state); const plans = st ? st.plans : [];
      const res = S.rateRes; const a = res && res.allowance; const pr = res && res.purchase_rental; const cap = pr && pr.capped;
      return `<h3 style="margin:0">Published allowance</h3><div class="src">For the payer, service date and rate ZIP you choose here — separate from the office search area.</div>
        <div class="row"><div><label for="rrState">State</label><select id="rrState"><option value="">Choose…</option>${(RM.states || []).map((x) => `<option value="${esc(x.id)}"${x.id === S.rate.state ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
          <div><label for="rrPlan">Payer</label><select id="rrPlan">${plans.map((p) => `<option value="${esc(p.id)}"${p.id === S.rate.plan ? " selected" : ""}>${esc(p.label)}</option>`).join("")}</select></div></div>
        <div class="row"><div><label for="rrZip">Rate ZIP</label><input id="rrZip" inputmode="numeric" value="${esc(S.rate.zip)}"></div><div><label for="rrDos">Service date</label><input id="rrDos" type="date" value="${esc(S.rate.dos)}"></div></div>
        <div style="margin-top:10px"><button class="btn gh" data-a="rate">Show allowance for ${esc(S.code || "the code")}</button></div>
        ${S.rateErr ? `<div class="msg err" role="alert">${esc(S.rateErr)}</div>` : ""}
        ${a && a.items && a.items.length ? a.items.map((i) => `<div style="margin-top:10px"><span class="amt">${money(i.amount)}</span> <span class="src">${esc(i.basis)}${i.modifier ? " · " + esc(i.modifier) : ""} · ${esc(i.unit || "")}</span></div>`).join("")
          + (cap && cap.months ? `<div class="src">${cap.months.map((m) => `Months ${esc(m.months)}: ${money(m.amount)} per month`).join(" · ")}</div>` : "")
          + `<div class="src">${esc(a.effective || "")} · Source: ${esc((a.source || {}).title || "")}</div>`
          : res && res.ok ? `<div class="msg">${esc((a && a.reason) || "No published rate for this payer, date and area.")}</div>` : ""}
        <div class="disc">${esc((window.HCPSReimb && window.HCPSReimb.DISCLAIMER) || "")}</div>`;
    }
    function bind() {
      const loc = $("#rfLoc"); if (loc) loc.onchange = () => { S.zips = loc.value; S.center = loc.value; const z = $("#rfZips"); if (z) z.value = S.zips; const c = $("#rfCenter"); if (c) c.value = S.center; };   // the search area only — rate inputs untouched
      const md = $("#rfMode"); if (md) md.onchange = () => { S.mode = md.value; S.res = null; render(); search(0); };
      const ce = $("#rfCenter"); if (ce) { ce.oninput = () => { S.center = ce.value; }; ce.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); search(0); } }; }
      const z = $("#rfZips"); if (z) z.oninput = () => { S.zips = z.value; };
      const q = $("#rfQ"); if (q) { q.oninput = () => { S.q = q.value; clearTimeout(S.qt); S.qt = setTimeout(findCodes, 300); }; q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); findCodes(true); } }; }
      host.querySelectorAll("[data-code]").forEach((b) => { b.onclick = () => { const c = S.codes.find((x) => x.hcpcs === b.getAttribute("data-code")); S.code = c.hcpcs; S.desc = c.hcpcs_desc || ""; render(); }; });
      const rt = $("#rfRent"); if (rt) rt.onchange = () => { S.rental = rt.value; };
      const sp = $("#rfSpec"); if (sp) sp.onchange = () => { S.spec = sp.value; search(0); };
      host.querySelectorAll("[data-a]").forEach((b) => { b.onclick = () => { const a = b.getAttribute("data-a");
        if (a === "search") search(0); else if (a === "more") { if (S.res && S.res.mode === "radius") { S.shown += 50; render(); } else search(S.offset + 50, true); } else if (a === "rate") rate(); else if (a === "back" && cfg.ret && cfg.ret.back) cfg.ret.back(); }; });
      host.querySelectorAll("[data-copy]").forEach((b) => { b.onclick = async () => { const x = S.res.rows[Number(b.getAttribute("data-copy"))]; const t = who(x) + "\n" + (x.specialty || "") + "\n" + addr(x) + "\nNPI " + x.npi;
        try { await navigator.clipboard.writeText(t); b.textContent = "Copied ✓"; } catch (e) { b.textContent = "Select and copy"; } }; });
      const ids = { rrState: "state", rrPlan: "plan", rrZip: "zip", rrDos: "dos" };
      Object.entries(ids).forEach(([id, k]) => { const el = $("#" + id); if (!el) return; el.onchange = el.oninput = () => { S.rate[k] = el.value.trim(); if (k === "state") { const st = ((S.rmeta || {}).states || []).find((x) => x.id === S.rate.state); S.rate.plan = st && st.plans.some((p) => p.id === "medicare") ? "medicare" : (st && st.plans[0] ? st.plans[0].id : ""); renderRate(); } }; });
    }
    function renderRate() { const c = $("#rfRate"); if (c) { c.innerHTML = rateHtml(); bind(); } }
    async function findCodes(pick) {
      const q = String(S.q || "").trim(); if (q.length < 3) return;
      let r = null; try { r = await cfg.api({ action: "codes", q }); } catch (e) { r = null; }
      S.codes = (r && r.ok && r.codes) || []; if (pick && S.codes.length === 1) { S.code = S.codes[0].hcpcs; S.desc = S.codes[0].hcpcs_desc || ""; }
      const keep = $("#rfQ") && document.activeElement === $("#rfQ"); render(); if (keep) { const n = $("#rfQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    }
    async function search(offset, append) {
      S.err = ""; const zips = String(S.zips || "").split(/[\s,;]+/).map(zip5).filter(Boolean);
      if (!S.code) { S.err = "Choose a HCPCS code first."; return render(); }
      if (S.mode === "radius") {
        const c = zip5(S.center); if (!c) { S.err = "Enter a five-digit ZIP for the search center."; return render(); }
        S.busy = true; render();
        let r = null; try { r = await cfg.api({ action: "radius", hcpcs: S.code, center_zip: c, rental: S.rental, specialty: S.spec }); } catch (e) { r = null; }
        S.busy = false; S.shown = 50;
        if (!r) S.err = "Referral data is temporarily unavailable — please try again shortly.";
        else if (!r.ok) S.err = r.message || r.error || "Referral data is temporarily unavailable — please try again shortly.";
        else S.res = r;
        render();
        if (!S.rateRes || S.rateCode !== S.code) rate();   // changing the search center never touches the rate inputs
        return;
      }
      if (!zips.length) { S.err = "Enter at least one five-digit office ZIP."; return render(); }
      S.busy = true; render();
      let r = null; try { r = await cfg.api({ action: "search", hcpcs: S.code, zips, rental: S.rental, specialty: S.spec, offset }); } catch (e) { r = null; }
      S.busy = false;
      if (!r) S.err = "Referral data is temporarily unavailable — please try again shortly.";
      else if (!r.ok) S.err = r.message || r.error || "Referral data is temporarily unavailable — please try again shortly.";
      else { if (append && S.res) r.rows = S.res.rows.concat(r.rows), r.offset = 0; S.res = r; S.offset = offset; }
      render();
      if (!append && (!S.rateRes || S.rateCode !== S.code)) rate();   // the allowance for the chosen code, with the rate inputs as they are
    }
    async function rate() {
      S.rateErr = ""; S.rateRes = null; const R = S.rate;
      if (!S.code) { S.rateErr = "Choose a HCPCS code first."; return renderRate(); }
      if (!R.state || !R.plan) { S.rateErr = "Choose a state and payer."; return renderRate(); }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(R.dos)) { S.rateErr = "Enter the service date."; return renderRate(); }
      if (R.plan === "medicare" && !zip5(R.zip)) { S.rateErr = "Enter the rate ZIP — Medicare prices by the patient's residence ZIP (or your branch ZIP for a planning estimate)."; return renderRate(); }
      let r = null; try { r = await cfg.reimbApi(Object.assign({ action: "lookup", code: S.code, state: R.state, plan: R.plan, dos: R.dos }, R.plan === "medicare" ? { zip: zip5(R.zip), zip_source: R.zip === ((S.rmeta || {}).branch_zip || "") ? "branch" : "patient" } : {})); } catch (e) { r = null; }
      S.rateCode = S.code;
      if (!r || !r.ok) S.rateErr = (r && r.error) || "The published allowance could not be loaded — the referral results are unaffected."; else S.rateRes = r;
      renderRate();
    }
    (async () => {
      let m = null, rm = null;
      try { [m, rm] = await Promise.all([cfg.api({ action: "meta" }), cfg.reimbApi({ action: "meta" }).catch(() => null)]); } catch (e) { m = null; }
      if (!m || m.enabled === false) { host.querySelector(".rf").innerHTML = `<h1>Find local referral sources</h1><div class="msg">${m && m.enabled === false ? "Find local referral sources isn't available for this account yet." : "Referral data is temporarily unavailable — please try again shortly."}</div>`; return; }
      S.meta = m; S.rmeta = rm && rm.ok ? rm : null;
      /* a head office with no ZIP on file (TEST Sandbox, live 2026-11-21) starts on the first listed location, the one the Branch list shows */
      if (!S.zips) S.zips = (m.location && m.location.zip) || ((m.locations || [])[0] || {}).zip || "";
      if (!S.center) S.center = S.zips;
      if (!S.rate.state && rm && rm.default_state) S.rate.state = rm.default_state;
      if (!S.rate.zip) S.rate.zip = (rm && rm.branch_zip) || (m.location && m.location.zip) || ((m.locations || [])[0] || {}).zip || "";
      if (!S.rate.dos) S.rate.dos = (rm && rm.today) || new Date().toISOString().slice(0, 10);
      if (pf.rate && pf.rate.plan) S.rate.plan = pf.rate.plan;
      render();
      if (S.code && !S.desc) { S.q = S.code; await findCodes(false); }
      if (S.code) await search(0);
    })();
    return { state: S };
  }
  window.HCPSReferrals = { mount };
})();
