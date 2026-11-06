// netlify/functions/brochure.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT BROCHURE GENERATOR — a customer-facing handout built from the approved
// product content, so a dealer never has to design one per SKU.
//
//   Approved product content → Product detail page → this renderer
//
// The layout lives HERE, not in the portal, for one reason that matters: the same
// brochure has to be printable AND emailable, and two templates would drift within
// a month. The portal sends STRUCTURED FIELDS — never HTML — and this function
// renders and escapes every one of them. That also closes the obvious hole: if the
// client could post finished HTML we would be an open relay for anyone wanting to
// send branded mail from our domain.
//
//   POST { action:'html',  product:{...}, include_msrp? }  → { html }   (product.quote_price = the dealer's chosen price)
//   POST { action:'email', product:{...}, to, message?, include_msrp? } → sends it
//
// PRICING: dealer cost NEVER appears. This is a document a dealer hands to a
// patient or a referral source. MSRP is included only when explicitly asked for.
//
// Env: RESEND_API_KEY (email only), BROCHURE_FROM / ORDER_EMAIL_FROM, SITE_URL.
// ─────────────────────────────────────────────────────────────────────────────

/* The page calls this function from its own origin; no other site may (C3-07 stage 0). */
const CORS = {
  'Access-Control-Allow-Origin': process.env.BROCHURE_ORIGIN || 'https://hcpsonlineordering.netlify.app',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const SEND = require('./_send_limit.js');
const json = (code, obj) => ({ statusCode: code, headers: CORS, body: JSON.stringify(obj) });

const SITE = (process.env.SITE_URL || 'https://homecareproviderservices.us').replace(/\/+$/, '');
const FROM = process.env.BROCHURE_FROM || process.env.ORDER_EMAIL_FROM || 'HomeCare Provider Services <orders@homecareproviderservices.us>';
/* One plain address only — no display name, angle brackets or comments (they would let one person count as many
   recipients for the send limit, and the mail provider would read them as a display name). */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Image sources we can vouch for. Three things are allowed and nothing else:
   an http(s) URL, a site-relative path, or a base64 raster data URL — the HCPS
   header logo is an inline PNG, so rejecting data: outright left the footer logo
   blank. SVG is deliberately NOT allowed as a data URL: an SVG is a document and
   can carry script, unlike a PNG or JPEG. javascript:, data:text/html and anything
   else return empty and the tag is simply not emitted. */
const safeUrl = u => {
  const s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s) && s.length < 600000) return s;
  return '';
};
const money = v => {
  const n = Number(v);
  return isFinite(n) && n > 0 ? '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
};
const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n || 40);
const str = (s, n) => String(s == null ? '' : s).slice(0, n || 4000);

/* The brochure. One page where the content allows, flowing to a second where it
   does not — with print rules that keep a table or a feature list from being cut
   in half across the break, which is what makes a printed handout look amateur. */
const dealerLogo = u => { const s = String(u || '').trim();
  if (/^https:\/\/[^\s"'<>`]+$/i.test(s) && s.length <= 2000) return s;
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(s) && s.length < 600000) return s;
  return ''; };
function renderBrochure(p, opts) {
  opts = opts || {};
  const showMsrp = !!opts.include_msrp;
  /* C3-07 Stage 4: dealer-branded — the signed-in dealer's own name, logo and contact details, read from HCPS's dealer
     record by the handler (never from the request). Signed out it stays an HCPS handout, as before. */
  const D = opts.dealer || null;
  const dName = D ? esc(str(D.business_name, 120)) : '';
  /* the dealer's logo is dealer-supplied: https or a raster data URL only, and always attribute-escaped */
  const dLogo = D ? esc(dealerLogo(D.logo_url)) : '';
  const dAddr = D ? esc([str(D.address, 120), [str(D.city, 60), [str(D.state, 20), str(D.zip, 12)].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) : '';
  const dContact = D ? [str(D.phone, 40), str(D.email, 200), str(D.website, 200).replace(/^https?:\/\//i, '')].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ') : '';

  const name = esc(str(p.name, 200)) || 'Product';
  const code = esc(str(p.code, 60));
  const mfr = esc(str(p.manufacturer, 120));
  const mfrLogo = safeUrl(p.manufacturer_logo);
  const hcpsLogo = safeUrl(p.hcps_logo);
  const tagline = esc(str(p.tagline, 300));
  const desc = esc(str(p.description, 4000));
  const warranty = esc(str(p.warranty, 1200));
  const srcUrl = safeUrl(p.source_url);

  const images = arr(p.images, 5).map(safeUrl).filter(Boolean);
  const hero = images[0] || '';
  const secondary = images.slice(1, 4);

  const features = arr(p.features, 12).map(f => esc(str(f, 300))).filter(Boolean);
  const clinical = arr(p.clinical, 12).map(f => esc(str(f, 120))).filter(Boolean);
  const specs = arr(p.specs, 30)
    .map(s => ({ k: esc(str(s && (s.label || s.name), 120)), v: esc(str(s && s.value, 300)) }))
    .filter(s => s.k && s.v);
  const billing = arr(p.billing_codes, 8).map(b => esc(str(b, 40))).filter(Boolean);

  const sizing = (p.sizing && Array.isArray(p.sizing.columns) && Array.isArray(p.sizing.rows))
    ? { columns: p.sizing.columns.slice(0, 8).map(c => esc(str(c, 60))),
        rows: p.sizing.rows.slice(0, 30).map(r => (Array.isArray(r) ? r : []).slice(0, 8).map(c => esc(str(c, 80)))) }
    : null;
  const sizingNote = esc(str(p.sizing_note, 400));

  /* C3-07 Stage 4: the dealer's chosen customer price (saved retail or a one-time price) shows when sent; MSRP only when
     asked for. Dealer cost is never a field this renderer reads. */
  const msrp = showMsrp ? money(p.msrp) : '';
  const quote = money(p.quote_price);

  const secHtml = (title, body) => body ? `<section class="sec"><h2>${title}</h2>${body}</section>` : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — HomeCare Provider Services</title>
<style>
  @page { size: Letter; margin: 0.5in; }
  *{box-sizing:border-box}
  body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1e2732;background:#fff;font-size:11.5pt;line-height:1.5}
  .sheet{max-width:7.5in;margin:0 auto;padding:0 0 0.3in}
  /* Manufacturer identity at the top — the product keeps its own brand. */
  .mhead{display:flex;align-items:center;gap:14px;border-bottom:3px solid #ef6325;padding-bottom:10px;margin-bottom:16px}
  .mhead img{max-height:52px;max-width:210px;object-fit:contain}
  .mhead .mname{font-size:15pt;font-weight:800;letter-spacing:.01em;color:#10263f}
  .mhead .spacer{margin-left:auto;text-align:right;font-size:9pt;color:#6b7580;line-height:1.35}
  h1{font-size:21pt;line-height:1.15;margin:0 0 4px;color:#10263f;font-weight:800}
  .tag{font-size:12pt;color:#5a6672;margin:0 0 10px;font-style:italic}
  .meta{font-size:9.5pt;color:#6b7580;margin-bottom:14px}
  .meta b{color:#1e2732}
  .hero{display:flex;gap:16px;align-items:flex-start;margin-bottom:18px}
  .hero .main{flex:0 0 3.1in;border:1px solid #e2e6ea;border-radius:8px;overflow:hidden;background:#fff}
  .hero .main img{width:100%;height:auto;display:block}
  .hero .side{flex:1;min-width:0}
  .thumbs{display:flex;gap:7px;margin-top:9px}
  .thumbs img{width:1in;height:1in;object-fit:contain;border:1px solid #e2e6ea;border-radius:6px;background:#fff}
  .sec{margin:0 0 15px;break-inside:avoid;page-break-inside:avoid}
  .sec h2{font-size:10pt;text-transform:uppercase;letter-spacing:.09em;color:#ef6325;margin:0 0 7px;font-weight:800;
    border-bottom:1px solid #e8ebee;padding-bottom:4px}
  .sec p{margin:0 0 8px}
  ul.feat{margin:0;padding-left:1.05em}
  ul.feat li{margin-bottom:4px;break-inside:avoid}
  table.spec{width:100%;border-collapse:collapse;font-size:10.5pt}
  table.spec td{padding:5px 8px;border-bottom:1px solid #eef1f4;vertical-align:top}
  table.spec td.k{color:#6b7580;width:38%;font-weight:600}
  table.size{width:100%;border-collapse:collapse;font-size:10pt}
  table.size th{background:#f4f6f8;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;
    letter-spacing:.05em;color:#5a6672;border-bottom:1px solid #dfe4ea}
  table.size td{padding:5px 8px;border-bottom:1px solid #eef1f4}
  table.size tr{break-inside:avoid}
  .chips span{display:inline-block;border:1px solid #dfe4ea;border-radius:999px;padding:2px 10px;margin:0 5px 5px 0;font-size:9.5pt;color:#3c4855}
  .price{border:1px solid #e2e6ea;border-radius:9px;padding:11px 14px;background:#fbfcfd;margin-bottom:14px}
  .price .l{font-size:9pt;text-transform:uppercase;letter-spacing:.07em;color:#6b7580;font-weight:700}
  .price .v{font-size:19pt;font-weight:800;color:#10263f}
  .note{font-size:9pt;color:#6b7580;margin-top:3px}
  /* HCPS attribution at the foot of every page when printed. */
  .foot{border-top:2px solid #10263f;margin-top:20px;padding-top:11px;display:flex;align-items:center;gap:13px;break-inside:avoid}
  .foot img{max-height:40px;max-width:190px;object-fit:contain}
  .foot .ft{font-size:10pt;color:#3c4855;line-height:1.45}
  .foot .ft b{color:#10263f}
  .foot .fr{margin-left:auto;text-align:right;font-size:9pt;color:#6b7580}
  .mhead .spacer img.dlogo{max-height:40px;max-width:170px;object-fit:contain;margin-bottom:3px}
  .hcpsline{font-size:8pt;color:#8a939c;text-align:center;margin-top:8px}
  .toolbar{position:sticky;top:0;background:#10263f;color:#fff;padding:10px 14px;display:flex;gap:9px;align-items:center;
    font-size:13px;z-index:5}
  .toolbar button{border:0;border-radius:7px;padding:8px 15px;font-weight:700;font-size:13px;cursor:pointer;
    background:#ef6325;color:#fff}
  .toolbar button.ghost{background:rgba(255,255,255,.14);color:#fff}
  .toolbar .hint{margin-left:auto;color:#b8c4d4;font-size:11.5px}
  @media print{ .toolbar{display:none} body{font-size:10.5pt} .sheet{max-width:none} }
</style></head>
<body>
<div class="toolbar">
  <button onclick="window.print()">🖨 Print / Save as PDF</button>
  <button class="ghost" onclick="window.close()">Close</button>
  <span class="hint">Choose “Save as PDF” as the printer destination to keep a copy.</span>
</div>
<div class="sheet">
  <div class="mhead">
    ${mfrLogo ? `<img src="${mfrLogo}" alt="${mfr} logo" onerror="this.style.display='none'">` : ''}
    <div class="mname">${mfr}</div>
    <div class="spacer">${dName ? `${dLogo ? `<img class="dlogo" src="${dLogo}" alt="${dName} logo" onerror="this.style.display='none'"><br>` : ''}Presented by <b>${dName}</b>` : 'Product Information'}${code ? `<br><b>Item ${code}</b>` : ''}</div>
  </div>

  <h1>${name}</h1>
  ${tagline ? `<div class="tag">${tagline}</div>` : ''}
  <div class="meta">${[code ? `Item <b>${code}</b>` : '', mfr ? `Manufacturer <b>${mfr}</b>` : '',
      billing.length ? `HCPC <b>${billing.join(' · ')}</b>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>

  <div class="hero">
    ${hero ? `<div class="main"><img src="${hero}" alt="${name}"></div>` : ''}
    <div class="side">
      ${desc ? `<p>${desc.replace(/\n{2,}/g, '</p><p>')}</p>` : ''}
      ${secondary.length ? `<div class="thumbs">${secondary.map(u => `<img src="${u}" alt="">`).join('')}</div>` : ''}
    </div>
  </div>

  ${(msrp || quote) ? `<div class="price">
      ${quote ? `<div class="l">Your price</div><div class="v">${quote}</div>`
              : `<div class="l">${p.msrp_calculated === true ? 'Retail price' : 'Manufacturer\'s suggested retail'}</div><div class="v">${msrp}</div>`}
      ${quote && msrp ? `<div class="note">${p.msrp_calculated === true ? 'Retail price' : 'MSRP'} ${msrp}</div>` : ''}
      <div class="note">Pricing shown is for reference and may vary. Contact us for a written quote.</div>
    </div>` : ''}

  ${secHtml('Key features', features.length ? `<ul class="feat">${features.map(f => `<li>${f}</li>`).join('')}</ul>` : '')}
  ${secHtml('Clinical applications', clinical.length ? `<div class="chips">${clinical.map(c => `<span>${c}</span>`).join('')}</div>` : '')}
  ${secHtml('Specifications', specs.length ? `<table class="spec">${specs.map(s => `<tr><td class="k">${s.k}</td><td>${s.v}</td></tr>`).join('')}</table>` : '')}
  ${secHtml('Sizing', sizing && sizing.rows.length
      ? `<table class="size"><thead><tr>${sizing.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>`
        + `<tbody>${sizing.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        + (sizingNote ? `<div class="note">${sizingNote}</div>` : '')
      : '')}
  ${secHtml('Warranty', warranty ? `<p>${warranty}</p>` : '')}

  ${dName ? `<div class="foot dfoot">
    ${dLogo ? `<img src="${dLogo}" alt="${dName} logo" onerror="this.style.display='none'">` : ''}
    <div class="ft"><b>${dName}</b>${dAddr ? `<br>${dAddr}` : ''}${dContact ? `<br>${dContact}` : ''}</div>
    <div class="fr">Specifications subject to change<br>without notice.</div>
  </div>
  <div class="hcpsline">Product information supplied through HomeCare Provider Services</div>` : `<div class="foot">
    ${hcpsLogo ? `<img src="${hcpsLogo}" alt="HomeCare Provider Services" onerror="this.style.display='none'">` : ''}
    <div class="ft"><b>Provided by HomeCare Provider Services</b><br>
      ${esc(SITE.replace(/^https?:\/\//, ''))}${srcUrl ? ` &nbsp;·&nbsp; Manufacturer information available on request` : ''}</div>
    <div class="fr">Specifications subject to change<br>without notice.</div>
  </div>`}
</div>
</body></html>`;
}

/* EMAIL NEEDS A SIGNED-IN, APPROVED DEALER (C3-07 stage 0 security fix, 2026-11-05). The email action used to send an
   HCPS-addressed message to any address for anyone who called it — an open relay. Now: the caller's Supabase session
   must belong to an approved dealer user; the reply-to is that dealer's own email (never a caller-chosen address);
   one recipient per message. Rendering a brochure to print (action "html") still needs no sign-in — it sends nothing. */
/* C3-07 P4 (owner 2026-11-06): a Golden brochure's price is read from Golden ON THE SERVER for the signed-in dealer — the
   admin site's golden-proxy "retail" action (Golden's MSRP for the item / configuration, else HCPS calculated retail =
   2× Golden's standard dealer price at or above eMAP, labelled as calculated) — never the figure the page sent. Signed
   out, or Golden unreadable → no price printed. → { price, calculated } | null */
const GOLDEN_FN = (process.env.HCPS_FUNCTIONS_BASE || 'https://homecareproviderservices.netlify.app/.netlify/functions').replace(/\/+$/, '');
async function goldenRetail(p, event) {
  const h = (event && event.headers) || {};
  const auth = String(h.authorization || h.Authorization || ''), prev = String(h['x-hcps-preview'] || h['X-HCPS-Preview'] || '');
  if (!/^Bearer\s+\S+/i.test(auth) && !/^[0-9a-f]{48}$/.test(prev)) return null;
  const code = String(p._goldenKey || p.code || '').trim().slice(0, 120); if (!code) return null;
  try {
    const hd = { 'content-type': 'application/json' }; if (/^Bearer\s+\S+/i.test(auth)) hd.authorization = auth; else hd['x-hcps-preview'] = prev;
    const r = await fetch(`${GOLDEN_FN}/golden-proxy`, { method: 'POST', headers: hd, body: JSON.stringify({ action: 'retail', code }) });
    if (!r.ok) return null; const j = await r.json();
    const v = Number(j && j.price); if (!(j && j.ok && isFinite(v) && v > 0)) return null;
    return { price: Math.round(v * 100) / 100, calculated: j.source === 'calculated' };
  } catch (e) { console.error('golden retail lookup failed', e && e.message); return null; }
}
/* C3-07 owner 2026-11-06 15:23: any other line's default customer price, read on the server for the signed-in dealer —
   admin dealer-quotes-api default_retail: official MSRP, else HCPS calculated retail (2 × standard dealer cost) under the
   manufacturer's advertising rules. → { price, calculated } | undefined (not signed in / unreadable → official MSRP only) */
async function defaultRetail(p, event) {
  const h = (event && event.headers) || {}; const auth = String(h.authorization || h.Authorization || '');
  const slug = String(p._mfrSlug || '').trim().toLowerCase(), code = String(p.code || '').trim();
  if (!/^Bearer\s+\S+/i.test(auth) || !/^[a-z0-9-]{2,60}$/.test(slug) || !code || code.length > 60 || p._upgrade) return undefined;
  try {
    const r = await fetch(`${GOLDEN_FN}/dealer-quotes-api`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify({ action: 'default_retail', manufacturer: slug, code }) });
    if (!r.ok) return undefined; const j = await r.json(); if (!(j && j.ok)) return undefined;
    const v = Number(j.price); return isFinite(v) && v > 0 ? { price: Math.round(v * 100) / 100, calculated: j.source === 'calculated' } : null;
  } catch (e) { console.error('default retail lookup failed', e && e.message); return undefined; }
}
async function verifiedMsrp(p) {
  const slug = String(p._mfrSlug || '').trim().toLowerCase(), code = String(p.code || '').trim();
  if (slug === 'golden-technologies' || slug === 'golden') return null;   // Golden: goldenRetail(), on the server
  if (p._upgrade || !/^[a-z0-9-]{2,60}$/.test(slug) || !code || code.length > 60) return null;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE; if (!url || !key) return null;
  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async path => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error('read ' + r.status); return r.json(); };
  const num = v => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
  const q = `manufacturer=eq.${encodeURIComponent(slug)}&code=eq.${encodeURIComponent(code)}`;
  try {
    const rec = await get(`product_skus?${q}&select=msrp&limit=1`);
    if (rec && rec.length) return num(rec[0].msrp);                    // the commercial master answers when it has the SKU
    const ov = await get(`product_overrides?${q}&select=patch&limit=1`);
    const om = ov && ov[0] && ov[0].patch && num(ov[0].patch.msrp); if (om) return om;
    const cp = await get(`custom_products?${q}&select=msrp&limit=1`);
    return (cp && cp[0] && num(cp[0].msrp)) || null;
  } catch (e) { console.error('msrp lookup failed', e && e.message); return null; }   // no verified figure → none printed
}

async function approvedDealer(event) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const tok = auth.replace(/^Bearer\s+/i, '').trim();
  if (!tok || !url || !key) return null;
  try {
    const ur = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${tok}` } });
    if (!ur.ok) return null;
    const u = await ur.json();
    if (!u || !u.id) return null;
    const rr = await fetch(`${url}/rest/v1/dealer_users?uid=eq.${encodeURIComponent(u.id)}&select=status,dealer_id,email`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!rr.ok) return null;
    const rows = await rr.json();
    const du = rows && rows[0];
    if (!du || du.status !== 'approved' || !du.dealer_id) return null;
    return { dealer_id: du.dealer_id, email: String(du.email || u.email || '').trim() };
  } catch (e) { return null; }
}

/* The dealer's identity for a branded brochure — HCPS's own record of the signed-in dealer's location. website / logo_url
   are read one at a time (a column not there yet is simply blank); a branch with no logo uses its head office's. Any
   read failure → no branding (the HCPS handout), never a guess. */
async function dealerBrand(dealerId) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key || !dealerId) return null;
  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async path => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: H }); if (!r.ok) return null; return r.json(); };
  try {
    const id = encodeURIComponent(dealerId);
    const d = await get(`dealers?id=eq.${id}&select=id,parent_id,business_name,address,city,state,zip,phone,email`);
    const self = d && d[0]; if (!self || !self.business_name) return null;
    for (const col of ['website', 'logo_url']) { const r = await get(`dealers?id=eq.${id}&select=${col}`); self[col] = (r && r[0] && r[0][col]) || null; }
    if (!self.logo_url && self.parent_id) { const r = await get(`dealers?id=eq.${encodeURIComponent(self.parent_id)}&select=logo_url`); self.logo_url = (r && r[0] && r[0].logo_url) || null; }
    return self;
  } catch (e) { console.error('brochure brand lookup failed', e && e.message); return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad JSON' }); }
  const product = b.product || {};
  if (!product.name && !product.code) return json(400, { ok: false, error: 'A product is required.' });

  /* VERIFIED MSRP, decided here (C3-07 Stage 4 review): the printed "Manufacturer's suggested retail" is looked up on
     HCPS's own catalog records — never taken from the request — and is dropped when there is none (or for an upgraded
     configuration). Golden's price is read from Golden on the server by goldenRetail() (C3-07 P4) — never the page's. */
  const isGolden = /^golden(-technologies)?$/.test(String(product._mfrSlug || '').trim().toLowerCase());
  product.msrp_calculated = false;
  if (b.include_msrp && isGolden) { const g = await goldenRetail(product, event); product.msrp = g ? g.price : null; product.msrp_calculated = !!(g && g.calculated); }
  else if (b.include_msrp) {
    const d = await defaultRetail(product, event);
    if (d === undefined) product.msrp = await verifiedMsrp(product);
    else { product.msrp = d ? d.price : null; product.msrp_calculated = !!(d && d.calculated); }
  }
  const action = String(b.action || 'html');
  /* Branded only for a signed-in, approved dealer; a request cannot name or style the dealer. */
  const who = await approvedDealer(event);
  const brand = who ? await dealerBrand(who.dealer_id) : null;
  const html = renderBrochure(product, { include_msrp: !!b.include_msrp, dealer: brand });

  if (action === 'html') return json(200, { ok: true, html });

  if (action === 'email') {
    if (!who) return json(401, { ok: false, error: 'Please sign in again to email a brochure.' });
    const to = String(b.to || '').trim();
    if (!EMAIL_RE.test(to)) return json(400, { ok: false, error: 'Enter a valid email address.' });
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return json(500, { ok: false, error: 'Email is not configured on this site yet (RESEND_API_KEY).' });
    /* C3-07 Stage 4: per-dealer and per-recipient limits, recorded before sending (see _send_limit.js). */
    const lim = await SEND.reserve({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE, dealer_id: (brand && brand.parent_id) || who.dealer_id, kind: 'brochure', to });   // limits per company (head office), not per branch login
    if (!lim.ok) return json(lim.status || 429, { ok: false, error: lim.error });

    const note = String(b.message || '').slice(0, 2000);
    const intro = note
      ? `<div style="max-width:7.5in;margin:0 auto 18px;font-family:Helvetica,Arial,sans-serif;font-size:11.5pt;color:#1e2732;white-space:pre-wrap">${esc(note)}</div>`
      : '';
    // The brochure body, with the print toolbar stripped — it is meaningless in mail.
    const body = html.replace(/<div class="toolbar">[\s\S]*?<\/div>\s*(?=<div class="sheet">)/, '');
    const subject = `${str(product.name, 120)}${product.code ? ` (Item ${str(product.code, 40)})` : ''}`.replace(/[\r\n\t]+/g, ' ');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: brand ? `"${String(brand.business_name).replace(/["\\<>\r\n]/g, '').slice(0, 70)} via HCPS" <${(FROM.match(/<([^>]+)>/) || [, FROM])[1]}>` : FROM, to: [to],   // display name quoted ("Smith Medical, LLC")
        reply_to: EMAIL_RE.test(who.email) ? who.email : undefined,
        subject,
        html: body.replace('<body>', () => '<body>' + intro),   // a function replacer: "$&" in a message is text, not a pattern
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('brochure email refused by the provider', res.status, t.slice(0, 200));
      await SEND.markFailed({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE, id: lim.id });
      return json(502, { ok: false, error: 'Could not send that brochure.' });
    }
    console.log('brochure emailed', JSON.stringify({ dealer_id: who.dealer_id, to_domain: to.split('@')[1] || '' }));
    return json(200, { ok: true, sent_to: to });
  }

  return json(400, { ok: false, error: 'Unknown action' });
};

module.exports.renderBrochure = renderBrochure;
