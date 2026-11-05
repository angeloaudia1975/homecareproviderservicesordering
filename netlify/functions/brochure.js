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
//   POST { action:'html',  product:{...}, include_msrp? }  → { html }
//   POST { action:'email', product:{...}, to, message?, include_msrp? } → sends it
//
// PRICING: dealer cost NEVER appears. This is a document a dealer hands to a
// patient or a referral source. MSRP is included only when explicitly asked for.
//
// Env: RESEND_API_KEY (email only), BROCHURE_FROM / ORDER_EMAIL_FROM, SITE_URL.
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (code, obj) => ({ statusCode: code, headers: CORS, body: JSON.stringify(obj) });

const SITE = (process.env.SITE_URL || 'https://homecareproviderservices.us').replace(/\/+$/, '');
const FROM = process.env.BROCHURE_FROM || process.env.ORDER_EMAIL_FROM || 'HomeCare Provider Services <orders@homecareproviderservices.us>';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
function renderBrochure(p, opts) {
  opts = opts || {};
  const showMsrp = !!opts.include_msrp;

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

  const msrp = showMsrp ? money(p.msrp) : '';
  const quote = showMsrp ? money(p.quote_price) : '';

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
    <div class="spacer">Product Information${code ? `<br><b>Item ${code}</b>` : ''}</div>
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
              : `<div class="l">Manufacturer's suggested retail</div><div class="v">${msrp}</div>`}
      ${quote && msrp ? `<div class="note">MSRP ${msrp}</div>` : ''}
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

  <div class="foot">
    ${hcpsLogo ? `<img src="${hcpsLogo}" alt="HomeCare Provider Services" onerror="this.style.display='none'">` : ''}
    <div class="ft"><b>Provided by HomeCare Provider Services</b><br>
      ${esc(SITE.replace(/^https?:\/\//, ''))}${srcUrl ? ` &nbsp;·&nbsp; Manufacturer information available on request` : ''}</div>
    <div class="fr">Specifications subject to change<br>without notice.</div>
  </div>
</div>
</body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'Bad JSON' }); }
  const product = b.product || {};
  if (!product.name && !product.code) return json(400, { ok: false, error: 'A product is required.' });

  const html = renderBrochure(product, { include_msrp: !!b.include_msrp });
  const action = String(b.action || 'html');

  if (action === 'html') return json(200, { ok: true, html });

  if (action === 'email') {
    const to = String(b.to || '').trim();
    if (!EMAIL_RE.test(to)) return json(400, { ok: false, error: 'Enter a valid email address.' });
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return json(500, { ok: false, error: 'Email is not configured on this site yet (RESEND_API_KEY).' });

    const note = String(b.message || '').slice(0, 2000);
    const intro = note
      ? `<div style="max-width:7.5in;margin:0 auto 18px;font-family:Helvetica,Arial,sans-serif;font-size:11.5pt;color:#1e2732;white-space:pre-wrap">${esc(note)}</div>`
      : '';
    // The brochure body, with the print toolbar stripped — it is meaningless in mail.
    const body = html.replace(/<div class="toolbar">[\s\S]*?<\/div>\s*(?=<div class="sheet">)/, '');
    const subject = `${str(product.name, 120)}${product.code ? ` (Item ${str(product.code, 40)})` : ''}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [to],
        reply_to: EMAIL_RE.test(String(b.reply_to || '')) ? String(b.reply_to).trim() : undefined,
        subject,
        html: body.replace('<body>', '<body>' + intro),
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return json(502, { ok: false, error: 'Could not send that brochure.', detail: t.slice(0, 200) });
    }
    return json(200, { ok: true, sent_to: to });
  }

  return json(400, { ok: false, error: 'Unknown action' });
};

module.exports.renderBrochure = renderBrochure;
