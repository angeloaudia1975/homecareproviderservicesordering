/* 360 DEALER PORTAL — DEALER BRAND & LOGO STUDIO (Catalog 5 launch requirement, Angelo 2026-11-08).
   Server: dealer-tools-api logo_studio_* (admin repo, _logo_studio_api.js). The server picks the wording (the dealer's
   verified business name and city) and checks every design again on publish; this file draws the logo as vector paths
   (logo-render.js + opentype.js + open-licence fonts), previews it, exports SVG / PNG and publishes it.
   Publishing writes the ONE branding source (dealers.logo_url) that Account Center, the storefront, Social Marketing Studio
   and quotes read. Nothing changes until the dealer presses "Make this my logo"; every earlier logo can be restored.
   Phone numbers and addresses are never part of the artwork. */
(function () {
  'use strict';
  let A = null;   // { api(body), esc, base, onChange(url) }
  const S = { st: null, prefs: { style: 'modern', palette: 'navy-green', symbol: '', location: true, tagline: '' }, concepts: [], cur: null, view: 'white', busy: false, err: '', msg: '', terms: false, svg: '', size: null };
  const FONTS = {};   // id -> Promise<{name, sub}>
  const LABEL = { left: 'Symbol + name', stack: 'Stacked', badge: 'Monogram badge', word: 'Wordmark' };
  const FONT_LABEL = { poppins: 'Poppins (modern)', montserrat: 'Montserrat (geometric)', raleway: 'Raleway (elegant)', nunito: 'Nunito (friendly)', oswald: 'Oswald (bold, condensed)', lora: 'Lora (classic serif)', merriweather: 'Merriweather (sturdy serif)', playfair: 'Playfair (refined serif)' };
  const SYM_LABEL = { swoosh: 'Swoosh', leaf: 'Leaf', home: 'Home', heart: 'Heart', wave: 'Waves', path: 'Path & sun', ring: 'Ring monogram', shield: 'Shield monogram' };
  const esc = (s) => (A && A.esc ? A.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const $ = (sel) => document.querySelector('#lsRoot ' + sel);

  function loadScript(src) { return new Promise((res, rej) => { if (src.includes('opentype') && window.opentype) return res(); if (src.includes('logo-render') && window.LogoRender) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
  function font(id) {
    if (!FONTS[id]) FONTS[id] = Promise.all(['name', 'sub'].map((k) => fetch(`${A.base}/fonts/${id}-${k}.woff`).then((r) => { if (!r.ok) throw new Error('font'); return r.arrayBuffer(); }).then((b) => window.opentype.parse(b))))
      .then(([name, sub]) => ({ name, sub })).catch((e) => { delete FONTS[id]; throw e; });
    return FONTS[id];
  }
  async function draw(spec) { const f = await font(spec.font); return window.LogoRender.render(spec, f); }
  function splitLines(primary, two) { const w = String(primary).split(' '); if (!two || w.length < 2) return [primary]; let best = 1, bd = Infinity;
    for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } } return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; }
  const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  async function toPng(svg, width) {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const w0 = Number(m[1]), h0 = Number(m[2]);
    const W = Math.round(width), H = Math.max(1, Math.round(width * h0 / w0));
    const img = new Image(); img.decoding = 'sync';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl(svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${W}" height="${H}"`)); });
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H);
    return c.toDataURL('image/png');
  }
  function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  const fileBase = () => (S.st && S.st.name ? S.st.name : 'logo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'logo';

  /* ---------- views ---------- */
  function shell(inner) {
    let root = document.getElementById('lsRoot');
    if (!root) { root = document.createElement('div'); root.id = 'lsRoot'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Brand & Logo Studio'); document.body.appendChild(root); injectCss(); }
    root.innerHTML = `<div class="ls-pan"><div class="ls-top"><div><b>Brand &amp; Logo Studio</b><span>Your verified business name, professional lettering and an original symbol — included with your HCPS account.</span></div><button class="ls-x" type="button" data-ls="close" aria-label="Close">×</button></div>${S.err ? `<div class="ls-err" role="alert">${esc(S.err)}</div>` : ''}${S.msg ? `<div class="ls-ok" role="status">${esc(S.msg)}</div>` : ''}${inner}</div>`;
    root.onclick = onClick; root.onchange = onChange; root.oninput = onInput;
  }
  function render() {
    const st = S.st; if (!st) return shell('<div class="ls-sec">Loading…</div>');
    if (!st.enabled) return shell(`<div class="ls-sec">${esc(st.reason || 'Logo Studio is not enabled for this account yet.')}</div>`);
    const prefs = S.prefs; const P = st.palettes || {};
    const step1 = `<div class="ls-sec"><h3>1 · Your style</h3>
      <div class="ls-note">Name on the logo: <b>${esc(st.name)}</b>${st.location ? ` · location line: <b>${esc(st.location)}</b>` : ''} (from your verified account — to change it, update Account Center first).</div>
      <div class="ls-row">${(st.styles || []).map((x) => `<button type="button" class="ls-chip${prefs.style === x ? ' on' : ''}" data-ls="style" data-v="${esc(x)}">${esc(x[0].toUpperCase() + x.slice(1))}</button>`).join('')}</div>
      <div class="ls-lbl">Colours</div><div class="ls-row">${Object.keys(P).map((k) => `<button type="button" class="ls-pal${prefs.palette === k ? ' on' : ''}" data-ls="palette" data-v="${esc(k)}" title="${esc(k)}" aria-label="${esc(k)} colours">${['name', 'a', 'b'].map((r) => `<i style="background:${esc(P[k][r])}"></i>`).join('')}</button>`).join('')}</div>
      <div class="ls-lbl">Symbol</div><div class="ls-row"><button type="button" class="ls-chip${!prefs.symbol ? ' on' : ''}" data-ls="symbol" data-v="">Surprise me</button>${(st.symbols || []).map((x) => `<button type="button" class="ls-chip${prefs.symbol === x ? ' on' : ''}" data-ls="symbol" data-v="${esc(x)}">${esc(SYM_LABEL[x] || x)}</button>`).join('')}</div>
      <div class="ls-grid2"><label class="ls-fld">Tagline (optional)<input id="lsTag" maxlength="${(st.limits && st.limits.taglineChars) || 48}" value="${esc(prefs.tagline)}" placeholder="e.g. Comfort and independence at home"></label>
      ${st.location ? `<label class="ls-chk"><input type="checkbox" id="lsLoc" ${prefs.location ? 'checked' : ''}> Show “${esc(st.location)}” under the name</label>` : ''}</div>
      <div class="ls-note">No phone numbers, addresses or web addresses in a logo — your storefront, ads and quotes show them separately.</div>
      <button type="button" class="ls-btn pri" data-ls="concepts" ${S.busy ? 'disabled' : ''}>${S.concepts.length ? 'Show new designs' : 'Show my designs'}</button></div>`;
    const step2 = S.concepts.length ? `<div class="ls-sec"><h3>2 · Pick a design</h3><div class="ls-cards">${S.concepts.map((c, i) => `<button type="button" class="ls-card${S.cur && S.cur._i === i ? ' on' : ''}" data-ls="pick" data-v="${i}"><img alt="Design ${i + 1}: ${esc(LABEL[c.layout])}" src="${c._svg ? svgUrl(c._svg) : ''}"><span>${esc(LABEL[c.layout])} · ${esc((FONT_LABEL[c.font] || c.font).split(' (')[0])}</span></button>`).join('')}</div></div>` : '';
    const c = S.cur;
    const step3 = c ? `<div class="ls-sec"><h3>3 · Make it yours</h3><div class="ls-edit">
      <div class="ls-ctl">
        <label class="ls-fld">Layout<select data-ed="layout">${(st.layouts || []).map((x) => `<option value="${x}"${c.layout === x ? ' selected' : ''}>${esc(LABEL[x])}</option>`).join('')}</select></label>
        <label class="ls-fld">Lettering<select data-ed="font">${(st.fonts || []).map((x) => `<option value="${x}"${c.font === x ? ' selected' : ''}>${esc(FONT_LABEL[x] || x)}</option>`).join('')}</select></label>
        <label class="ls-fld">Symbol<select data-ed="symbol">${(st.symbols || []).filter((x) => c.layout !== 'badge' || x === 'ring' || x === 'shield').map((x) => `<option value="${x}"${c.symbol === x ? ' selected' : ''}>${esc(SYM_LABEL[x] || x)}</option>`).join('')}</select></label>
        <div class="ls-colors">${[['name', 'Name'], ['sub', 'Location & tagline'], ['a', 'Accent 1'], ['b', 'Accent 2']].map(([k, l]) => `<label>${l}<input type="color" data-col="${k}" value="${esc(c.colors[k])}"></label>`).join('')}</div>
        <label class="ls-chk"><input type="checkbox" data-ed="two" ${c.name.length > 1 ? 'checked' : ''}> Name on two lines</label>
        <label class="ls-chk"><input type="checkbox" data-ed="upper" ${c.upper ? 'checked' : ''}> All capitals</label>
        ${st.location ? `<label class="ls-chk"><input type="checkbox" data-ed="loc" ${c.sub ? 'checked' : ''}> Show “${esc(st.location)}”</label>` : ''}
        <label class="ls-fld">Tagline<input data-ed="tagline" maxlength="${(st.limits && st.limits.taglineChars) || 48}" value="${esc(c.tagline)}"></label>
      </div>
      <div class="ls-prev"><div class="ls-row">${[['white', 'On white'], ['dark', 'On dark'], ['store', 'Storefront'], ['ad', 'Ad footer'], ['small', 'Small']].map(([k, l]) => `<button type="button" class="ls-chip${S.view === k ? ' on' : ''}" data-ls="view" data-v="${k}">${l}</button>`).join('')}</div>${preview()}</div>
    </div></div>` : '';
    const step4 = c ? `<div class="ls-sec"><h3>4 · Download or publish</h3>
      <details class="ls-terms"><summary>Logo usage terms (${esc(st.terms_version)})</summary><ul>${(st.terms || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>
      <label class="ls-chk"><input type="checkbox" id="lsTerms" ${S.terms ? 'checked' : ''}> I have read the logo usage terms</label>
      <div class="ls-row"><button type="button" class="ls-btn" data-ls="dl-svg" ${S.terms && S.svg ? '' : 'disabled'}>Download SVG (vector)</button><button type="button" class="ls-btn" data-ls="dl-png" ${S.terms && S.svg ? '' : 'disabled'}>Transparent PNG</button><button type="button" class="ls-btn" data-ls="dl-hi" ${S.terms && S.svg ? '' : 'disabled'}>High-resolution PNG</button></div>
      <button type="button" class="ls-btn pri" data-ls="publish" ${S.terms && S.svg && !S.busy ? '' : 'disabled'}>Make this my logo</button>
      <div class="ls-note">Publishing shows this logo on your Account Center, storefront, Social Marketing Studio ads and quotes. Your current logo stays in your history and can be restored.</div></div>` : '';
    const hist = (st.history || []).length ? `<div class="ls-sec"><h3>Your logos</h3><div class="ls-hist">${st.history.map((h) => `<div class="ls-h${h.current ? ' on' : ''}"><img alt="" src="${esc(h.logo_url)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ls-ph',textContent:'Image unavailable'}))"><span>${h.current ? '<b>In use</b>' : esc(h.kind === 'baseline' ? 'Original logo' : h.kind === 'studio' ? 'Studio design' : h.kind === 'upload' ? 'Uploaded' : h.kind === 'link' ? 'Linked' : 'Restored')}${h.at ? ' · ' + esc(new Date(h.at).toLocaleDateString()) : ''}</span>${!h.current && h.id ? `<button type="button" class="ls-btn sm" data-ls="restore" data-v="${h.id}">Restore</button>` : ''}${h.vector && h.id ? `<button type="button" class="ls-btn sm" data-ls="hsvg" data-v="${h.id}">SVG</button>` : ''}</div>`).join('')}</div></div>` : '';
    shell(step1 + step2 + step3 + step4 + hist);
  }
  function preview() {
    if (!S.svg) return '<div class="ls-stage">Drawing…</div>';
    const img = `<img alt="Logo preview" src="${svgUrl(S.svg)}">`;
    if (S.view === 'dark') return `<div class="ls-stage dark">${img}<div class="ls-note" style="color:#cfd8e3">Light text versions come later — choose lighter colours if this logo will sit on dark backgrounds.</div></div>`;
    if (S.view === 'store') return `<div class="ls-stage store"><div class="ls-mhead"><div class="ls-mlogo">${img}</div><div class="ls-mph">Phone and “Request information” are shown here by your storefront</div></div><div class="ls-mnav"><span>Home</span><span>Products</span><span>About us</span><span>Contact</span></div></div>`;
    if (S.view === 'ad') return `<div class="ls-stage ad"><div class="ls-mad"><div class="ls-mplate">${img}</div><div><b>${esc(S.st.full_name)}</b><span>Address and phone come from your account</span></div></div></div>`;
    if (S.view === 'small') return `<div class="ls-stage"><div class="ls-sm"><div style="height:40px">${img}</div><div style="height:24px">${img}</div></div></div>`;
    return `<div class="ls-stage">${img}</div>`;
  }

  /* ---------- actions ---------- */
  async function refreshCur() { if (!S.cur) return; try { const r = await draw(S.cur); S.svg = r.svg; S.size = { w: r.w, h: r.h }; } catch (e) { S.err = 'The lettering could not be loaded — check your connection and try again.'; } render(); }
  async function onClick(ev) {
    const t = ev.target.closest('[data-ls]'); if (!t) return; const k = t.dataset.ls, v = t.dataset.v; S.err = ''; S.msg = '';
    if (k === 'close') { close(); return; }
    if (k === 'style' || k === 'palette' || k === 'symbol') { S.prefs[k] = v; render(); return; }
    if (k === 'view') { S.view = v; render(); return; }
    if (k === 'concepts') {
      S.busy = true; render();
      const r = await A.api({ action: 'logo_studio_concepts', prefs: S.prefs }).catch(() => null); S.busy = false;
      if (!r || !r.ok) { S.err = (r && r.error) || 'Designs could not be made just now — please try again.'; render(); return; }
      S.concepts = r.concepts.map((c, i) => Object.assign(c, { _i: i })); S.cur = null; S.svg = '';
      await Promise.all(S.concepts.map(async (c) => { try { c._svg = (await draw(c)).svg; } catch (e) { c._svg = ''; } }));
      render(); return;
    }
    if (k === 'pick') { const c = S.concepts[Number(v)]; S.cur = JSON.parse(JSON.stringify(c)); S.cur._i = Number(v); delete S.cur._svg; S.svg = c._svg || ''; render(); if (!S.svg) refreshCur(); return; }
    if (k === 'dl-svg') { download(fileBase() + '-logo.svg', svgUrl(S.svg)); return; }
    if (k === 'dl-png' || k === 'dl-hi') { try { download(fileBase() + (k === 'dl-hi' ? '-logo-3000px.png' : '-logo.png'), await toPng(S.svg, k === 'dl-hi' ? 3000 : 1200)); } catch (e) { S.err = 'The PNG could not be made in this browser — download the SVG instead.'; render(); } return; }
    if (k === 'publish') {
      if (!window.confirm('Make this your logo on your storefront, ads, quotes and Account Center? Your current logo stays in your history.')) return;
      S.busy = true; render();
      let png; try { png = await toPng(S.svg, 1200); } catch (e) { S.busy = false; S.err = 'The logo image could not be made in this browser.'; render(); return; }
      const spec = Object.assign({}, S.cur); delete spec._i;
      const r = await A.api({ action: 'logo_studio_publish', spec, svg: S.svg, png, terms_version: S.st.terms_version }).catch(() => null); S.busy = false;
      if (!r || !r.ok) { S.err = (r && r.error) || 'The logo could not be published just now — please try again.'; render(); return; }
      S.msg = 'Your new logo is live on your account, storefront, ads and quotes.'; if (A.onChange) A.onChange(r.logo_url); await loadState(); return;
    }
    if (k === 'restore') {
      if (!window.confirm('Use this logo again everywhere (account, storefront, ads, quotes)?')) return;
      const r = await A.api({ action: 'logo_studio_restore', id: Number(v) }).catch(() => null);
      if (!r || !r.ok) { S.err = (r && r.error) || 'The logo could not be restored just now.'; render(); return; }
      S.msg = 'Logo restored.'; if (A.onChange) A.onChange(r.logo_url); await loadState(); return;
    }
    if (k === 'hsvg') { const r = await A.api({ action: 'logo_studio_svg', id: Number(v) }).catch(() => null); if (r && r.ok && r.svg) download(r.file || 'logo.svg', svgUrl(r.svg)); else { S.err = (r && r.error) || 'No vector file for that logo.'; render(); } }
  }
  function onChange(ev) {
    const t = ev.target;
    if (t.id === 'lsLoc') { S.prefs.location = t.checked; return; }
    if (t.id === 'lsTerms') { S.terms = t.checked; render(); return; }
    if (!S.cur) return;
    if (t.dataset.col) { S.cur.colors[t.dataset.col] = t.value.toLowerCase(); refreshCur(); return; }
    const e = t.dataset.ed; if (!e) return;
    if (e === 'layout') { S.cur.layout = t.value; if (t.value === 'badge' && S.cur.symbol !== 'ring' && S.cur.symbol !== 'shield') S.cur.symbol = 'ring'; if (t.value === 'word') S.cur.name = [S.cur.name.join(' ')]; }
    else if (e === 'font' || e === 'symbol') S.cur[e] = t.value;
    else if (e === 'two') S.cur.name = splitLines(S.cur.name.join(' '), t.checked);
    else if (e === 'upper') S.cur.upper = t.checked;
    else if (e === 'loc') S.cur.sub = t.checked ? S.st.location : '';
    else if (e === 'tagline') S.cur.tagline = t.value.trim();
    refreshCur();
  }
  function onInput(ev) { if (ev.target.id === 'lsTag') S.prefs.tagline = ev.target.value; }
  function close() { const r = document.getElementById('lsRoot'); if (r) r.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  async function loadState() { const r = await A.api({ action: 'logo_studio_state' }).catch(() => null); if (!r || !r.ok) { S.err = (r && r.error) || 'Logo Studio could not be opened just now.'; S.st = { enabled: false, reason: S.err }; S.err = ''; } else S.st = r; render(); }

  async function open(opts) {
    A = opts; S.err = ''; S.msg = ''; S.st = null; render(); document.addEventListener('keydown', onKey);
    try { await Promise.all([loadScript(A.base + '/opentype.min.js'), loadScript(A.base + '/logo-render.js')]); } catch (e) { S.st = { enabled: false, reason: 'Logo Studio could not be loaded — check your connection and try again.' }; render(); return; }
    await loadState();
  }
  /* is the Studio open for this account? (Account Center shows its button only then) */
  async function available(api) { const r = await api({ action: 'logo_studio_state' }).catch(() => null); return !!(r && r.ok && r.enabled); }

  function injectCss() {
    if (document.getElementById('lsCss')) return; const s = document.createElement('style'); s.id = 'lsCss';
    s.textContent = `#lsRoot{position:fixed;inset:0;z-index:9999;background:rgba(8,20,36,.55);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:24px 12px}
#lsRoot .ls-pan{background:#fff;border-radius:16px;max-width:1080px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);font:14px/1.45 Inter,Arial,sans-serif;color:#0b1f33}
#lsRoot .ls-top{display:flex;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #e3e9ef}#lsRoot .ls-top b{font-size:19px;display:block}#lsRoot .ls-top span{color:#56687a;font-size:13px}
#lsRoot .ls-x{border:0;background:#eef2f6;border-radius:10px;width:44px;height:44px;font-size:24px;cursor:pointer}
#lsRoot .ls-sec{padding:16px 20px;border-bottom:1px solid #eef2f6}#lsRoot h3{margin:0 0 10px;font-size:16px}
#lsRoot .ls-row{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}#lsRoot .ls-lbl{font-weight:700;font-size:13px;margin-top:6px}
#lsRoot .ls-chip{min-height:44px;padding:0 14px;border-radius:999px;border:1px solid #c9d4df;background:#fff;cursor:pointer;font:600 14px Inter,Arial}#lsRoot .ls-chip.on{background:#0b1f33;color:#fff;border-color:#0b1f33}
#lsRoot .ls-pal{display:flex;gap:0;min-height:44px;min-width:66px;border-radius:12px;border:2px solid #dfe6ed;overflow:hidden;padding:0;cursor:pointer}#lsRoot .ls-pal i{flex:1;display:block}#lsRoot .ls-pal.on{border-color:#ef6325}
#lsRoot .ls-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:end}
#lsRoot .ls-fld{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:13px;margin-bottom:8px}#lsRoot .ls-fld input,#lsRoot .ls-fld select{min-height:44px;border:1px solid #c9d4df;border-radius:10px;padding:0 10px;font-size:16px}
#lsRoot .ls-chk{display:flex;align-items:center;gap:8px;min-height:44px;font-size:14px}#lsRoot .ls-chk input{width:20px;height:20px}
#lsRoot .ls-btn{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #c9d4df;background:#fff;font:700 14px Inter,Arial;cursor:pointer}#lsRoot .ls-btn.pri{background:#ef6325;border-color:#ef6325;color:#fff;margin-top:6px}#lsRoot .ls-btn:disabled{opacity:.45;cursor:not-allowed}#lsRoot .ls-btn.sm{min-height:36px;padding:0 10px;font-size:12.5px}
#lsRoot .ls-note{color:#56687a;font-size:12.5px;margin:4px 0 8px}#lsRoot .ls-err{background:#fdecec;color:#8a1c1c;padding:10px 20px}#lsRoot .ls-ok{background:#e9f7ee;color:#17603a;padding:10px 20px}
#lsRoot .ls-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#lsRoot .ls-card{border:2px solid #e3e9ef;border-radius:14px;background:#fff;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:8px;align-items:stretch;text-align:left}
#lsRoot .ls-card img{width:100%;height:120px;object-fit:contain}#lsRoot .ls-card span{font-size:12.5px;color:#56687a}#lsRoot .ls-card.on{border-color:#ef6325;box-shadow:0 0 0 3px rgba(239,99,37,.15)}
#lsRoot .ls-edit{display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:18px}#lsRoot .ls-colors{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0}#lsRoot .ls-colors label{font-size:12.5px;display:flex;flex-direction:column;gap:4px}#lsRoot .ls-colors input{width:100%;height:40px;border:1px solid #c9d4df;border-radius:8px;padding:2px}
#lsRoot .ls-stage{border:1px solid #e3e9ef;border-radius:14px;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#fff}#lsRoot .ls-stage img{max-width:100%;max-height:220px}
#lsRoot .ls-stage.dark{background:#0b1f33}#lsRoot .ls-stage.store,#lsRoot .ls-stage.ad{padding:0;justify-content:flex-start;align-items:stretch;overflow:hidden}
#lsRoot .ls-mhead{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;background:#fff}#lsRoot .ls-mlogo{height:64px;max-width:60%}#lsRoot .ls-mlogo img{height:64px;width:auto;max-width:100%;object-fit:contain}
#lsRoot .ls-mph{font-size:12px;color:#56687a;border:1px dashed #c9d4df;border-radius:10px;padding:8px;max-width:38%}#lsRoot .ls-mnav{display:flex;gap:18px;flex-wrap:wrap;background:#0f2c5c;color:#fff;padding:12px 18px;font-weight:600}
#lsRoot .ls-mad{margin-top:auto;display:flex;gap:14px;align-items:center;background:#0b1f33;color:#fff;padding:14px}#lsRoot .ls-mplate{background:#fff;border-radius:10px;padding:8px;height:70px;width:42%}#lsRoot .ls-mplate img{height:54px;width:100%;object-fit:contain}#lsRoot .ls-mad b{display:block}#lsRoot .ls-mad span{font-size:12px;color:#c9d6e3}
#lsRoot .ls-sm{display:flex;flex-direction:column;gap:16px;align-items:center}#lsRoot .ls-sm img{height:100%;width:auto}
#lsRoot .ls-hist{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}#lsRoot .ls-h{border:1px solid #e3e9ef;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}#lsRoot .ls-h.on{border-color:#2f9e5b}#lsRoot .ls-h img{height:56px;width:100%;object-fit:contain;background:#f7f9fb;border-radius:8px}#lsRoot .ls-h span{font-size:12px;color:#56687a}#lsRoot .ls-ph{display:flex;align-items:center;justify-content:center;height:56px;background:#f2f4f7;border-radius:8px}
#lsRoot .ls-terms{margin-bottom:6px}#lsRoot .ls-terms summary{cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center}#lsRoot .ls-terms li{margin:4px 0;font-size:13px;color:#33475b}
@media(max-width:760px){#lsRoot{padding:0}#lsRoot .ls-pan{border-radius:0}#lsRoot .ls-edit,#lsRoot .ls-grid2{grid-template-columns:minmax(0,1fr)}#lsRoot .ls-cards{grid-template-columns:minmax(0,1fr)}#lsRoot .ls-mph{display:none}#lsRoot .ls-mlogo{max-width:100%}}
@media(prefers-reduced-motion:reduce){#lsRoot *{transition:none!important}}`;
    document.head.appendChild(s);
  }
  window.HCPSLogoStudio = { open, available, close, _S: S };
})();
