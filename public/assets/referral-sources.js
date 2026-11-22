/* Find local referral sources (Dealer Portal pilot, owner 2026-11-21) — ONE results view, reached from a product's
   reimbursement panel, the reimbursement lookup and Reports & Growth Ideas.

   Results (full width, labeled cards when the columns don't fit): clinicians' published Original Medicare ordering activity for one HCPCS code in the dealer's office-search ZIPs
   (CMS "by Referring Provider and Service", read through referral-sources-api). Above them, a compact summary of the published allowance for the
   payer, service date and rate ZIP the dealer chose (the existing reimbursement lookup, reimbursement-api "lookup").
   The two are separate: changing the search ZIPs never changes the rate inputs, and one failing never hides the other.

   Counts are shown per row exactly as CMS publishes them (code / rental status / claims year) — never summed across rows;
   a withheld beneficiary count reads "withheld by CMS (fewer than 11)", never 0. All text is placed as text. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const zip5 = (z) => { const m = /^\s*(\d{5})/.exec(String(z || "")); return m ? m[1] : ""; };
  /* Layout (owner 2026-11-22): the allowance is a compact summary at the top (details on demand), the filters below it, and the
     results use the full page width — a table while every column fits, labelled stacked cards when it doesn't, so nothing is
     ever reached by scrolling sideways. */
  const CSS = `.rf{width:100%;max-width:none;box-sizing:border-box}.rf h1{margin:0}.rf .sub{color:#5b6b7a;font-size:13px;margin-top:4px}
    .rf .card{background:#fff;border:1px solid #dfe8f0;border-radius:12px;padding:14px;margin-top:12px;box-sizing:border-box}.rf label{display:block;font-size:12.5px;font-weight:700;color:#3b4b5b;margin:8px 0 3px}
    .rf .hint{font-weight:500;color:#6b7d90}
    .rf input,.rf select{width:100%;min-height:44px;font-size:16px;border:1px solid #cbd8e4;border-radius:8px;padding:8px 10px;box-sizing:border-box;background:#fff}.rf .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
    .rf .btn{min-height:44px;border-radius:8px;border:1px solid #1681c2;background:#1681c2;color:#fff;font-weight:700;padding:8px 14px;cursor:pointer}.rf .btn.gh{background:#fff;color:#1681c2}
    .rf .src{font-size:12px;color:#4a5b6b;margin-top:6px}.rf .msg{padding:10px 12px;border-radius:8px;background:#f4f8fb;color:#3b4b5b;font-size:13.5px;margin-top:10px}.rf .msg.err{background:#fdf1ed;color:#8a3412}
    .rf .codes{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.rf .codes button{min-height:40px;border:1px solid #cbd8e4;border-radius:999px;background:#fff;padding:6px 12px;font-size:13px;cursor:pointer;text-align:left}
    .rf .codes button[aria-pressed=true]{border-color:#1681c2;background:#e8f3fb;font-weight:700}
    .rf .wh{color:#8a5a00;font-size:12px;font-weight:600}.rf textarea.rfman{display:block;width:100%;margin-top:8px;font:13px/1.4 Inter,system-ui,sans-serif;padding:8px;border:1px solid #cbd8e4;border-radius:9px;resize:vertical;box-sizing:border-box}.rf .rfmanh{font-size:12px;color:#6b7d90;margin-top:4px}.rf .copy{min-height:44px;font-size:13px;padding:6px 12px;white-space:nowrap}
    .rf .disc{font-size:11.5px;color:#4a5b6b;border-top:1px solid #e3edf5;margin-top:10px;padding-top:8px}
    .rf .rfsum{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 18px;border-left:4px solid #ef6325;text-align:left}
    .rf .rfsum .lbl{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#6b7d90}
    .rf .rfsum .amt{font-size:22px;font-weight:800;color:#0f5c8f;line-height:1.1}.rf .rfsum .k{font-size:13px;color:#3b4b5b}.rf .rfsum .k b{color:#12253c}
    .rf .rfsum .tog{justify-self:end}.rf .ratebox{grid-column:1/-1;border-top:1px solid #edf2f6;margin-top:4px;padding-top:6px}
    .rf .rfresh{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:2px 0 8px}.rf .rfresh .rfn{font-size:18px;font-weight:800;color:#12253c}
    .rf .rfyr{display:inline-block;background:#fff3ec;color:#a8460f;border:1px solid #f6d3bf;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:800}
    .rf .rfres{container-type:inline-size;container-name:rfres}
    .rf table.rfl{width:100%;border-collapse:collapse;font-size:13.5px;table-layout:fixed}.rf .rfl th,.rf .rfl td{text-align:left;padding:9px 8px;border-bottom:1px solid #edf2f6;vertical-align:top;overflow-wrap:anywhere}
    .rf .rfl th{font-size:11.5px;color:#5b6b7a;text-transform:uppercase;letter-spacing:.4px;background:#f6f9fc}.rf .rfl .num{text-align:right}.rf .rfl .nm{font-weight:800;color:#12253c}.rf .rfl .mut{font-size:12px;color:#5b6b7a}
    .rf .rfl col.c-cl{width:23%}.rf .rfl col.c-of{width:24%}.rf .rfl col.c-di{width:9%}.rf .rfl col.c-bi{width:8%}.rf .rfl col.c-be{width:12%}.rf .rfl col.c-sc{width:9%}.rf .rfl col.c-cp{width:15%}.rf .rfl td.cp .copy{white-space:normal;width:100%}
    @container rfres (max-width: 980px){.rf table.rfl,.rf .rfl tbody{display:block}.rf .rfl colgroup,.rf .rfl thead{display:none}
      .rf .rfl tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px;border:1px solid #dfe8f0;border-radius:10px;padding:10px 12px;margin-bottom:10px}
      .rf .rfl td{display:block;border:0;padding:2px 0}.rf .rfl td.full{grid-column:1/-1}.rf .rfl td[data-l]::before{content:attr(data-l);display:block;font-size:11px;font-weight:800;color:#5b6b7a;text-transform:uppercase;letter-spacing:.4px}
      .rf .rfl .num{text-align:left}.rf .rfl td.cp{grid-column:1/-1}.rf .rfl td.cp .copy{width:100%}}
    .rf .rfsum .lbl+div{margin-top:2px}@container rfres (max-width: 420px){.rf .rfl tr{grid-template-columns:1fr}}`;

  /* Copy with a 1.5 s limit (a pending permission prompt can leave the clipboard promise unanswered), then the older
     selection copy; false = the dealer copies by hand from the selected box. */
  async function copyText(t) {
    try { if (navigator.clipboard && window.isSecureContext) { const r = await Promise.race([navigator.clipboard.writeText(t).then(() => true), new Promise((res) => setTimeout(() => res(false), 1500))]); if (r) return true; } } catch (e) {}
    try { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0;width:1px;height:1px"; document.body.appendChild(a); a.select(); const ok = document.execCommand && document.execCommand("copy"); a.remove(); if (ok) return true; } catch (e) {}
    return false;
  }
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
      const r = m.release; const lcd = m.last_check && m.last_check.at ? new Date(m.last_check.at) : null; const lc = lcd && !isNaN(lcd) ? ` · last checked ${lcd.toLocaleString()}` : "";
      const d = r.live_since ? new Date(r.live_since) : null; const since = d && !isNaN(d) ? ` · live in the portal since ${d.toLocaleDateString()}` : "";   /* a missing field is left out, never "undefined" / "Invalid Date" */
      return `${r.label || "CMS referral data"}${r.file_name ? ` · CMS file ${r.file_name}` : ""}${since}${lc}`;
    }
    function render() {
      const m = S.meta || {}; const locs = m.locations || [];
      const back = cfg.ret && cfg.ret.label ? `<button class="btn gh" data-a="back">← Back to ${esc(cfg.ret.label)}</button>` : "";
      host.querySelector(".rf").innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><h1>Find local referral sources</h1>
          <div class="sub">Clinicians whose offices are in your area and who ordered this equipment for Original Medicare patients — names and office addresses to plan practice visits.</div>
          <div class="src">${esc(sourceLine())} · <a href="${esc((m.source || {}).url || "#")}" target="_blank" rel="noopener">CMS source</a></div></div>${back}</div>
        <div class="card rfsum" id="rfRate">${rateHtml()}</div>
        <div class="card"><div class="row"><div><label for="rfLoc">Branch</label><select id="rfLoc">${locs.map((l) => `<option value="${esc(l.zip)}"${l.id === (m.location || {}).id ? " selected" : ""}>${esc(l.name)} · ${esc(l.city || "")} ${esc(l.zip)}</option>`).join("")}</select></div>
            <div><label for="rfMode">Search area</label><select id="rfMode"><option value="radius"${S.mode === "radius" ? " selected" : ""}>Within 25 miles (straight line)</option><option value="zips"${S.mode === "zips" ? " selected" : ""}>Exact office ZIPs only</option></select></div>
            <div>${S.mode === "radius" ? `<label for="rfCenter">Search center ZIP <span class="hint">— where to look for clinicians</span></label><input id="rfCenter" inputmode="numeric" value="${esc(S.center)}" placeholder="42101">`
              : `<label for="rfZips">Office search ZIPs <span class="hint">— comma-separated</span></label><input id="rfZips" inputmode="numeric" value="${esc(S.zips)}" placeholder="42101, 42103">`}</div></div>
          <label for="rfQ">Equipment — HCPCS code or product words</label><input id="rfQ" value="${esc(S.q || S.code)}" placeholder="E0260 or semi-electric hospital bed">
          <div class="codes" id="rfCodes">${S.codes.map((c) => `<button type="button" data-code="${esc(c.hcpcs)}" aria-pressed="${c.hcpcs === S.code}"><b>${esc(c.hcpcs)}</b> ${esc(c.hcpcs_desc || "")}</button>`).join("")}</div>
          ${S.code ? `<div class="src">Selected: <b>${esc(S.code)}</b> ${esc(S.desc)}${pf.product ? ` — from ${esc(pf.product.name)} (the portal's verified product configuration)` : ""}</div>` : ""}
          <div class="row"><div><label for="rfRent">Supplier billed as</label><select id="rfRent"><option value="">Rental or purchase</option><option value="Y"${S.rental === "Y" ? " selected" : ""}>Rental</option><option value="N"${S.rental === "N" ? " selected" : ""}>Purchase</option></select></div>
            <div><label for="rfSpec">Specialty</label><select id="rfSpec"><option value="">All specialties</option>${((S.res && S.res.specialties) || []).map((x) => `<option${x === S.spec ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
            <div style="display:flex;align-items:flex-end"><button class="btn" style="width:100%" data-a="search"${S.busy ? " disabled" : ""}>${S.busy ? "Searching…" : "Find referral sources"}</button></div></div></div>
        <div class="card rfres" id="rfOut">${resultsHtml() || `<div class="src">Choose a code and press Find referral sources.</div>`}</div>`;
      bind();
    }
    function who(r) { return r.entity === "O" ? r.last_org : [r.first_name, r.mi, r.last_org].filter(Boolean).join(" ") + (r.credentials ? ", " + r.credentials : ""); }
    function addr(r) { return [r.street1, r.street2, [r.city, r.state].filter(Boolean).join(", ") + " " + r.zip5].filter(Boolean).join(" · "); }
    function benes(x) { return x.benes == null ? '<span class="wh">withheld by CMS (fewer than 11)</span>' : esc(x.benes); }
    function dist(x) { return x.distance_basis === "office" ? `${esc(x.miles)} mi` : `≈ ${esc(x.miles)} mi <span class="wh">ZIP-based estimate</span>`; }
    /* one list for both search modes: a table while every column fits, labelled stacked cards when it doesn't (container query) */
    function listHtml(rows, radius) {
      return `<table class="rfl"><colgroup><col class="c-cl"><col class="c-of">${radius ? '<col class="c-di">' : ""}<col class="c-bi"><col class="c-be"><col class="c-sc"><col class="c-cp"></colgroup>
        <thead><tr><th>Clinician · NPI · specialty</th><th>Office (published address)</th>${radius ? '<th class="num">Distance</th>' : ""}<th>Billed as</th><th class="num">Beneficiaries</th><th class="num">Supplier claims</th><th></th></tr></thead><tbody>
        ${rows.map((x, i) => `<tr><td class="full" data-l="Clinician"><div class="nm">${esc(who(x))}</div><div class="mut">NPI ${esc(x.npi)}${x.specialty ? " · " + esc(x.specialty) : ""}</div></td>
          <td class="full" data-l="Office">${esc(addr(x))}</td>${radius ? `<td class="num" data-l="Distance">${dist(x)}</td>` : ""}
          <td data-l="Billed as">${x.rental === "Y" ? "Rental" : x.rental === "N" ? "Purchase" : ""}</td>
          <td class="num" data-l="Beneficiaries">${benes(x)}</td><td class="num" data-l="Supplier claims">${esc(x.claims)}</td>
          <td class="cp"><button class="btn gh copy" data-copy="${i}" type="button">Copy office details</button></td></tr>`).join("")}</tbody></table>`;
    }
    function resHead(n, yr, where) { return `<div class="rfresh"><span class="rfn">${n} clinician row${n === 1 ? "" : "s"}</span><span class="rfyr">Claims year ${esc(yr)}</span><span class="src" style="margin:0">${where}</span></div>`; }
    function resultsHtml() {
      if (S.err) return `<div class="msg err" role="alert">${esc(S.err)}</div>`;
      const r = S.res; if (!r) return "";
      if (r.mode === "radius") return radiusHtml(r);
      if (!r.total) return `<div class="msg"><b>No published matches</b> for ${esc(r.hcpcs)} in ${esc(r.zips.join(", "))} (claims year ${esc(r.release.data_year)}). CMS publishes a row only with 11 or more supplier claims, so this is not proof of no local demand. Add nearby ZIPs or choose another code.</div>`;
      return resHead(r.total, r.release.data_year, `${esc(r.hcpcs)} · office ZIPs ${esc(r.zips.join(", "))} · each row is one clinician / code / rental status — counts are never added together`)
        + listHtml(r.rows, false)
        + (r.total > r.offset + r.rows.length ? `<button class="btn gh" data-a="more">Show more (${r.total - r.offset - r.rows.length} left)</button>` : "")
        + `<div class="disc">${esc(r.notes.coverage)} ${esc(r.notes.location)} Claims are not prescriptions, new patients or units.</div>`;
    }
    function radiusHtml(r) {
      const cov = r.coverage && r.coverage.partial ? `<div class="msg" role="note"><b>Partial coverage at the edge:</b> the 25-mile circle reaches into ${esc(r.coverage.outside.map((x) => `${x.name} (${x.zip_areas} ZIP area${x.zip_areas === 1 ? "" : "s"})`).join(", "))}, which this CMS release doesn't include (it holds ${esc((r.release.states || []).join(", "))}). Clinicians there are not listed.</div>` : "";
      const uns = r.unsettled ? `<div class="src">${r.unsettled} published row${r.unsettled === 1 ? "" : "s"} in ZIP areas crossing the 25-mile line could not be placed by address and ${r.unsettled === 1 ? "is" : "are"} not listed.</div>` : "";
      const geo = r.geocoder === "unavailable" ? `<div class="src">The address service didn't answer, so every distance is a ZIP-based estimate.</div>` : "";
      if (!r.total) return `<div class="msg"><b>No published matches</b> for ${esc(r.hcpcs)} within 25 miles of ZIP ${esc(r.center.zip)} (claims year ${esc(r.release.data_year)}). CMS publishes a row only with 11 or more supplier claims, so this is not proof of no local demand.</div>${cov}${uns}`;
      const rows = r.rows.slice(0, S.shown);
      return resHead(r.total, r.release.data_year, `${esc(r.hcpcs)} · within 25 straight-line miles of ZIP ${esc(r.center.zip)}'s center · nearest first · ${r.placed_by.office} placed by office address${r.placed_by.zip ? `, ${r.placed_by.zip} by ZIP-based estimate (≈)` : ""} · counts are never added together`)
        + cov + listHtml(rows, true)
        + (r.total > rows.length ? `<button class="btn gh" data-a="more">Show more (${r.total - rows.length} left)</button>` : "") + uns + geo
        + `<div class="disc">${esc(r.notes.distance)} ${esc(r.notes.coverage)} ${esc(r.notes.location)} Claims are not prescriptions, new patients or units.</div>`;
    }
    /* the published allowance: a compact summary (code, amount, rental months or billing unit, payer, rate ZIP) and every
       input, the fee-schedule source and the full disclaimer one tap away under "View rate details" */
    function rateHtml() {
      const RM = S.rmeta || {}; const st = (RM.states || []).find((x) => x.id === S.rate.state); const plans = st ? st.plans : [];
      const plan = plans.find((p) => p.id === S.rate.plan); const res = S.rateRes; const a = res && res.allowance; const pr = res && res.purchase_rental; const cap = pr && pr.capped;
      const items = (a && a.items) || [];
      const sum = items.length ? items.map((i) => `<span class="amt">${money(i.amount)}</span> <span class="k">${esc(i.basis)}${i.modifier ? " · " + esc(i.modifier) : ""}</span>`).join(" ")
        + (cap && cap.months ? ` <span class="k">${cap.months.map((m) => `months ${esc(m.months)}: <b>${money(m.amount)}</b>`).join(" · ")}</span>` : (items[0] && items[0].unit ? ` <span class="k">${esc(items[0].unit)}</span>` : ""))
        : S.rateErr ? `<span class="k" role="alert">${esc(S.rateErr)}</span>` : res && res.ok ? `<span class="k">${esc((a && a.reason) || "No published rate for this payer, date and area.")}</span>` : `<span class="k">Choose a code to see the published allowance.</span>`;
      const box = S.rateOpen ? `<div class="ratebox"><div class="src" style="margin-top:0">For the payer, service date and rate ZIP chosen here — separate from the search center.</div>
          <div class="row"><div><label for="rrState">State</label><select id="rrState"><option value="">Choose…</option>${(RM.states || []).map((x) => `<option value="${esc(x.id)}"${x.id === S.rate.state ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
            <div><label for="rrPlan">Payer</label><select id="rrPlan">${plans.map((p) => `<option value="${esc(p.id)}"${p.id === S.rate.plan ? " selected" : ""}>${esc(p.label)}</option>`).join("")}</select></div>
            <div><label for="rrZip">Rate ZIP <span class="hint">— prices the allowance</span></label><input id="rrZip" inputmode="numeric" value="${esc(S.rate.zip)}"></div>
            <div><label for="rrDos">Service date</label><input id="rrDos" type="date" value="${esc(S.rate.dos)}"></div></div>
          <div style="margin-top:10px"><button class="btn gh" data-a="rate">Show allowance for ${esc(S.code || "the code")}</button></div>
          ${items.length ? `<div class="src">${items.map((i) => esc(i.unit || "")).filter(Boolean).join(" · ")}${a.area_note ? " · " + esc(a.area_note) : ""}</div><div class="src">${esc(a.effective || "")} · Source: ${esc((a.source || {}).title || "")}${(a.source || {}).url ? ` · <a href="${esc(a.source.url)}" target="_blank" rel="noopener">fee schedule</a>` : ""}</div>` : ""}
          ${cap && cap.note ? `<div class="src">${esc(cap.note)}</div>` : ""}
          <div class="disc">${esc((window.HCPSReimb && window.HCPSReimb.DISCLAIMER) || "")}</div></div>` : "";
      return `<div><div class="lbl">Published allowance${S.code ? " · " + esc(S.code) : ""}</div><div>${sum}</div>
          <div class="k">${esc((plan && plan.label) || "Choose a payer")} · Rate ZIP <b>${esc(S.rate.zip || "—")}</b>${S.rate.dos ? " · service date " + esc(S.rate.dos) : ""}</div></div>
        <span hidden data-rs="${esc([S.rate.state, S.rate.zip, S.rate.dos].join("|"))}"></span><button class="btn gh tog" data-a="ratetog" aria-expanded="${S.rateOpen ? "true" : "false"}">${S.rateOpen ? "Hide rate details" : "View rate details"}</button>${box}`;
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
        if (a === "search") search(0); else if (a === "more") { if (S.res && S.res.mode === "radius") { S.shown += 50; render(); } else search(S.offset + 50, true); } else if (a === "rate") rate(); else if (a === "ratetog") { S.rateOpen = !S.rateOpen; renderRate(); } else if (a === "back" && cfg.ret && cfg.ret.back) cfg.ret.back(); }; });
      host.querySelectorAll("[data-copy]").forEach((b) => { b.onclick = async () => { const x = S.res.rows[Number(b.getAttribute("data-copy"))]; const t = who(x) + "\n" + (x.specialty || "") + "\n" + addr(x) + "\nNPI " + x.npi;
        if (await copyText(t)) { b.textContent = "Copied ✓"; return; }
        /* clipboard refused or never answered: the office details in a selected box the dealer copies by hand (owner 2026-11-22) */
        const td = b.parentElement; let box = td.querySelector("textarea.rfman"); if (!box) { box = document.createElement("textarea"); box.className = "rfman"; box.readOnly = true; box.rows = 4; box.setAttribute("aria-label", "Office details — select and copy"); td.appendChild(box);
          const h = document.createElement("div"); h.className = "rfmanh"; h.textContent = "Copy didn't work here — the details are selected: press Ctrl+C (Mac: ⌘C), or long-press and choose Copy."; td.appendChild(h); }
        box.value = t; box.focus(); box.select(); b.textContent = "Select and copy below"; }; });
      const ids = { rrState: "state", rrPlan: "plan", rrZip: "zip", rrDos: "dos" };
      Object.entries(ids).forEach(([id, k]) => { const el = $("#" + id); if (!el) return; el.onchange = el.oninput = () => { S.rate[k] = el.value.trim(); if (k === "state") { const st = ((S.rmeta || {}).states || []).find((x) => x.id === S.rate.state); S.rate.plan = st && st.plans.some((p) => p.id === "medicare") ? "medicare" : (st && st.plans[0] ? st.plans[0].id : ""); renderRate(); } }; });
    }
    function renderRate() { const c = $("#rfRate"); if (c) { c.innerHTML = rateHtml(); bind(); } }   // the rate card only — the results and filters are untouched
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
