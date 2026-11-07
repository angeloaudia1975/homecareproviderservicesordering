/* 360 DEALER PORTAL — SOCIAL MEDIA AD BUILDER (Catalog 4 §8, owner directive 2026-11-06 20:55 CT).
   Server: dealer-ads-api (admin repo). This file draws the ad on a <canvas> and exports PNG / JPEG.
   Rules the editor keeps (the server checks them again on save and before every download):
   - products: only the location's authorized, listed products, with their official photo, name and description;
   - the price is the storefront's advertised price (MAP / advertising rules) or "Call for Price" — never typed;
   - the dealer's own words carry no prices, discounts, promotions or claims;
   - the dealer's name, address, phone, website and logo come from the account.
   Photos and the logo come through the server as data URLs, so the canvas can always be exported. */
(function () {
  'use strict';
  const PRESETS = [
    { name: 'HCPS navy', bg: '#0b1f33', accent: '#ef6325', text: '#ffffff' },
    { name: 'Clean white', bg: '#ffffff', accent: '#1681c2', text: '#0b1f33' },
    { name: 'Blue', bg: '#0f5c8f', accent: '#fcb21e', text: '#ffffff' },
    { name: 'Warm', bg: '#fff7ef', accent: '#ef6325', text: '#2a1a10' },
    { name: 'Charcoal', bg: '#1f2329', accent: '#2f9e5b', text: '#ffffff' },
    { name: 'Sage', bg: '#eef4ef', accent: '#2f6b4f', text: '#18301f' },
    { name: 'Plum', bg: '#3b2140', accent: '#f2b84b', text: '#ffffff' },
  ];
  /* AI Build My Ad choices (the server's lists; defaults = the first of each) */
  const AI_OPTS = { goal: [['awareness', 'Introduce the product'], ['showroom', 'Bring people to the showroom'], ['inquiry', 'Get calls and questions'], ['gift', 'A choice for a loved one'], ['trust', 'Build trust in the store']],
    audience: [['caregivers', 'Family caregivers'], ['seniors', 'Older adults'], ['referral', 'Referral partners'], ['local', 'Local community']],
    tone: [['warm', 'Warm'], ['expert', 'Knowledgeable'], ['simple', 'Simple'], ['friendly', 'Friendly']],
    platform: [['all', 'All platforms'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn']] };
  const PLAT = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', short: 'Short' };
  const FONT_STACK = { Inter: '"Inter", "Helvetica Neue", Arial, sans-serif', Archivo: '"Archivo", "Arial Narrow", Arial, sans-serif', Georgia: 'Georgia, "Times New Roman", serif',
    Trebuchet: '"Trebuchet MS", Tahoma, sans-serif', Verdana: 'Verdana, Geneva, sans-serif' };
  /* a light mirror of the server's word check, for instant feedback; the server's answer is the one that counts */
  const CLAIMS = [/\$\s*\d|\d[\d,.]*\s*(?:dollars?|usd)\b/i, /\d+(?:\.\d+)?\s*%|\bpercent\b/i,
    /\b(?:discount(?:s|ed)?|sale|clearance|markdowns?|save|savings|rebates?|coupons?|promo|promos|promotion(?:s|al)?|deal|deals|bogo|half[- ]off)\b/i, /\bfree\b/i,
    /\b(?:lowest|cheapest|best)\s+price/i, /\blimited[- ]time\b|\btoday only\b/i, /\bguarantee|\bwarrant(?:y|ies|ied)\b/i,
    /\b(?:cures?|heals?|healing|treats?|treatment|prevents?|clinically|fda[- ](?:approved|cleared))\b/i, /\b(?:medicare|medicaid|insurance|covered by|reimburs)/i,
    /\bfinanc(?:e|ing)\b|\bper month\b/i, /#\s?1\b|\b(?:number one|best[- ]selling|top[- ]rated|award[- ]winning)\b/i];
  const warnWords = (t, allow) => { let s = String(t || ''); for (const a of allow || []) if (a && a.length >= 3) s = s.split(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join(' ');
    for (const re of CLAIMS) { const m = s.match(re); if (m) return m[0]; } return null; };

  let A = null;   // { api(body), esc, host }
  const S = { ctx: null, loc: null, ads: [], cur: null, row: null, images: new Map(), logo: null, busy: false, msg: '', err: '', q: '', suggestions: null, problems: [],
    ai: { goal: 'awareness', audience: 'caregivers', tone: 'warm', platform: 'all' }, aiResult: null, history: [], campaign: null };
  const blank = () => ({ template: 'spotlight', format: 'square', font: 'Inter', colors: Object.assign({}, PRESETS[0]), title: '', headline: '', subheadline: '', body: '', features: [], captions: {}, cta: 'Visit us today', caption: '', hashtags: [],
    products: [], show: { logo: true, name: true, address: true, phone: true, website: true, price: true } });

  const $ = (sel) => A.host.querySelector(sel);
  const e = (s) => A.esc(s);
  const keyOf = (p) => `${p.manufacturer}|${String(p.code).toUpperCase()}`;
  const productBy = (r) => (S.ctx && S.ctx.products || []).find((p) => keyOf(p) === keyOf(r));
  const T = () => (S.ctx && S.ctx.templates[S.cur.template]) || { kind: 'single' };
  const fmt = () => (S.ctx && S.ctx.formats[S.cur.format]) || { w: 1080, h: 1080 };
  const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const priceText = (p, show) => { if (!show || !S.cur.show.price) return null; if (p.price != null) return (p.price_label ? p.price_label + ' ' : '') + money(p.price) + (p.price_unit ? ' ' + p.price_unit : ''); return 'Call for Price'; };

  /* ---------------- images (data URLs from the server; never a third-party request from the page) ---------------- */
  function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  async function productImage(p) {
    const k = keyOf(p); if (S.images.has(k)) return S.images.get(k);
    const pr = (async () => { if (!p.image) return null; const r = await A.api({ action: 'ad_image', location_id: S.loc, manufacturer: p.manufacturer, code: p.code }); return r && r.ok ? loadImg(r.data_url) : null; })();
    S.images.set(k, pr); return pr;
  }
  async function logoImage() {
    if (S.logo && S.logo.loc === S.loc) return S.logo.p;
    const p = (async () => { if (!S.ctx.dealer.has_logo) return null; const r = await A.api({ action: 'ad_image', location_id: S.loc, logo: true }); return r && r.ok ? loadImg(r.data_url) : null; })();
    S.logo = { loc: S.loc, p }; return p;
  }

  /* ---------------- canvas drawing ---------------- */
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean); const lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; } }
    if (line) lines.push(line);
    if (lines.length > maxLines) { const out = lines.slice(0, maxLines); let last = out[maxLines - 1]; while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1); out[maxLines - 1] = last.replace(/\s+$/, '') + '…'; return out; }
    return lines;
  }
  /* text in a box: shrinks the size until it fits maxLines; returns the height used */
  function textBox(ctx, text, x, y, w, o) {
    if (!text) return 0; let size = o.size;
    let lines; for (;;) { ctx.font = `${o.weight || 700} ${size}px ${FONT_STACK[S.cur.font] || FONT_STACK.Inter}`; lines = wrap(ctx, text, w, 99); if (lines.length <= o.lines || size <= o.min) break; size = Math.max(o.min, Math.round(size * 0.92)); }
    lines = wrap(ctx, text, w, o.lines);
    ctx.fillStyle = o.color; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'top';
    const lh = Math.round(size * (o.lh || 1.18)); const ax = o.align === 'center' ? x + w / 2 : o.align === 'right' ? x + w : x;
    lines.forEach((l, i) => ctx.fillText(l, ax, y + i * lh));
    return lines.length * lh;
  }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function photo(ctx, img, x, y, w, h, s) {
    ctx.save(); rrect(ctx, x, y, w, h, 18 * s); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
    if (img) { const pad = 18 * s, k = Math.min((w - 2 * pad) / img.width, (h - 2 * pad) / img.height); const iw = img.width * k, ih = img.height * k; ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
    else { ctx.fillStyle = '#e8edf2'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#7a8794'; ctx.font = `600 ${Math.round(26 * s)}px ${FONT_STACK.Inter}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Photo coming soon', x + w / 2, y + h / 2); }
    ctx.restore();
  }
  function chip(ctx, text, x, y, s, bg, fg, align) {
    if (!text) return 0; ctx.font = `800 ${Math.round(30 * s)}px ${FONT_STACK[S.cur.font] || FONT_STACK.Inter}`; const w = ctx.measureText(text).width + 36 * s, h = 52 * s;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    rrect(ctx, left, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill(); ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, left + w / 2, y + h / 2 + 1); return h;
  }
  function contrast(hex) { const n = parseInt(String(hex || '#000000').slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b1f33' : '#ffffff'; }
  function footer(ctx, W, H, s, logo) {
    const c = S.cur.colors, d = S.ctx.dealer, sh = S.cur.show; const fh = Math.round(150 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, H - fh, W, fh);
    let x = 40 * s;
    if (sh.logo && logo) { const lh = fh - 44 * s, k = Math.min(lh / logo.height, (W * 0.28) / logo.width), lw = logo.width * k, hh = logo.height * k;
      ctx.save(); rrect(ctx, x - 8 * s, H - fh + (fh - hh) / 2 - 8 * s, lw + 16 * s, hh + 16 * s, 10 * s); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      ctx.drawImage(logo, x, H - fh + (fh - hh) / 2, lw, hh); x += lw + 34 * s; }
    const lines = [];
    if (sh.name && d.name) lines.push({ t: d.name, w: 800, sz: 36 });
    const addr = sh.address ? [d.address, [d.city, d.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';
    const contact = [sh.phone ? d.phone : '', sh.website ? (d.link || d.website || '').replace(/^https?:\/\//, '') : ''].filter(Boolean).join('  ·  ');
    if (addr) lines.push({ t: addr, w: 500, sz: 25 }); if (contact) lines.push({ t: contact, w: 600, sz: 26 });
    let y = H - fh + (fh - lines.reduce((t, l) => t + l.sz * s * 1.3, 0)) / 2;
    for (const l of lines) { ctx.font = `${l.w} ${Math.round(l.sz * s)}px ${FONT_STACK[S.cur.font] || FONT_STACK.Inter}`; ctx.fillStyle = c.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(wrap(ctx, l.t, W - x - 36 * s, 1)[0] || '', x, y); y += l.sz * s * 1.3; }
    return fh;
  }
  async function draw(canvas) {
    const F = fmt(), W = F.w, H = F.h, s = Math.min(W, H) / 1080, c = S.cur.colors;
    canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d');
    const prods = S.cur.products.map((r) => ({ r, p: productBy(r) })).filter((x) => x.p);
    const [logo, ...imgs] = await Promise.all([S.cur.show.logo ? logoImage() : null, ...prods.map((x) => productImage(x.p))]);
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c.accent; ctx.fillRect(0, 0, W, 14 * s);
    const fh = footer(ctx, W, H, s, logo);
    const M = 56 * s, top = 56 * s, bottom = H - fh - 36 * s, tall = H / W > 1.2, wide = W / H > 1.4;
    const ctaFg = contrast(c.accent);
    /* live check 2026-11-07: with a subheadline and a long message the photo shrank to a thumbnail — on non-tall sizes the words
       get fewer lines so the product photo keeps its room */
    const words = (x, y, w, align, big, compact) => { let yy = y;
      yy += textBox(ctx, S.cur.headline, x, yy, w, { size: (big || 78) * s, min: 40 * s, lines: compact && S.cur.subheadline ? 2 : 3, color: c.text, align, weight: 800 }); if (S.cur.headline) yy += 16 * s;
      if (S.cur.subheadline) yy += textBox(ctx, S.cur.subheadline, x, yy, w, { size: 36 * s, min: 24 * s, lines: compact ? 1 : 2, color: c.text, align, weight: 600, lh: 1.25 }) + 14 * s;
      yy += textBox(ctx, S.cur.body, x, yy, w, { size: 32 * s, min: 22 * s, lines: compact ? 3 : 4, color: c.text, align, weight: 500, lh: 1.3 }); if (S.cur.body) yy += 20 * s; return yy; };
    const tpl = S.cur.template;
    if (tpl === 'brand') {
      let y = top + (tall ? (bottom - top) * 0.16 : 20 * s);   // tall formats: the message sits higher than the middle, not at the very top
      if (logo && S.cur.show.logo) { const k = Math.min((W * 0.5) / logo.width, (H * 0.22) / logo.height), lw = logo.width * k, lh = logo.height * k;
        ctx.save(); rrect(ctx, (W - lw) / 2 - 20 * s, y - 20 * s, lw + 40 * s, lh + 40 * s, 20 * s); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); ctx.drawImage(logo, (W - lw) / 2, y, lw, lh); y += lh + 60 * s; }
      y = words(M, y, W - 2 * M, 'center', 92); chip(ctx, S.cur.cta, W / 2, Math.min(y + 10 * s, bottom - 52 * s), s, c.accent, ctaFg, 'center'); return;
    }
    if (T().kind === 'multi') {
      let y = words(M, top, W - 2 * M, 'center', 70) + 4 * s;
      const n = prods.length, ctaH = S.cur.cta ? 72 * s : 0; const areaH = bottom - y - ctaH;
      const cols = tpl === 'lineup' ? (tall ? 1 : n) : (n <= 2 ? (tall ? 1 : 2) : 2), rows = Math.ceil(n / cols);
      const gap = 24 * s, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = (areaH - gap * (rows - 1)) / rows;
      prods.forEach((x, i) => { const cx = M + (i % cols) * (cw + gap), cy = y + Math.floor(i / cols) * (ch + gap);
        const nameH = 92 * s; photo(ctx, imgs[i], cx, cy, cw, Math.max(60 * s, ch - nameH), s);
        const ny = cy + ch - nameH + 10 * s; textBox(ctx, x.p.name, cx, ny, cw, { size: 28 * s, min: 18 * s, lines: 2, color: c.text, align: 'center', weight: 700 });
        const pt = priceText(x.p, x.r.show_price !== false); if (pt) { ctx.font = `800 ${Math.round(24 * s)}px ${FONT_STACK[S.cur.font]}`; ctx.fillStyle = c.accent; ctx.textAlign = 'center'; ctx.fillText(pt, cx + cw / 2, ny + 64 * s); } });
      if (S.cur.cta) chip(ctx, S.cur.cta, W / 2, bottom - 54 * s, s, c.accent, ctaFg, 'center');
      return;
    }
    const x0 = prods[0]; if (!x0) { textBox(ctx, 'Choose a product', M, H / 2 - 40 * s, W - 2 * M, { size: 48 * s, min: 30 * s, lines: 1, color: c.text, align: 'center' }); return; }
    const pt = priceText(x0.p, x0.r.show_price !== false), img = imgs[0];
    if (tpl === 'split' && !tall) {
      const pw = wide ? W * 0.46 : W * 0.5; photo(ctx, img, M, top, pw - M, bottom - top, s);
      const tx = pw + 30 * s, tw = W - tx - M; let y = words(tx, top, tw, 'left', wide ? 62 : 66);
      y += textBox(ctx, x0.p.name, tx, y, tw, { size: 36 * s, min: 24 * s, lines: 2, color: c.text, weight: 700 }) + 16 * s;
      for (const f of (S.cur.features || []).slice(0, wide ? 2 : 3)) y += textBox(ctx, '✓ ' + f, tx, y, tw, { size: 28 * s, min: 20 * s, lines: 1, color: c.text, weight: 600 }) + 6 * s;
      if ((S.cur.features || []).length) y += 10 * s;
      if (pt) y += chip(ctx, pt, tx, y, s, '#ffffff', '#0b1f33') + 18 * s;
      if (S.cur.cta) chip(ctx, S.cur.cta, tx, Math.min(y, bottom - 52 * s), s, c.accent, ctaFg);
      return;
    }
    if (tpl === 'classic') {
      const card = { x: M * 0.7, y: top, w: W - 1.4 * M, h: bottom - top }; ctx.save(); rrect(ctx, card.x, card.y, card.w, card.h, 28 * s); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      const ph = card.h * (tall ? 0.5 : wide ? 0.62 : 0.52); photo(ctx, img, card.x + 20 * s, card.y + 20 * s, card.w - 40 * s, ph, s);
      let y = card.y + ph + 44 * s; const ix = card.x + 40 * s, iw = card.w - 80 * s;
      y += textBox(ctx, S.cur.headline || x0.p.name, ix, y, iw, { size: 54 * s, min: 30 * s, lines: 2, color: '#0b1f33', weight: 800, align: 'center' }) + 10 * s;
      if (S.cur.headline) y += textBox(ctx, x0.p.name, ix, y, iw, { size: 30 * s, min: 20 * s, lines: 1, color: '#3b4552', weight: 600, align: 'center' }) + 10 * s;
      y += textBox(ctx, S.cur.body, ix, y, iw, { size: 28 * s, min: 20 * s, lines: wide ? 1 : 3, color: '#3b4552', weight: 500, align: 'center', lh: 1.3 }) + 14 * s;
      if ((S.cur.features || []).length && !wide) y += textBox(ctx, S.cur.features.slice(0, 3).join('  ·  '), ix, y, iw, { size: 24 * s, min: 18 * s, lines: 2, color: '#0f5c8f', weight: 700, align: 'center', lh: 1.3 }) + 12 * s;
      const row = Math.min(y, card.y + card.h - 76 * s);
      if (pt && S.cur.cta && !wide) { chip(ctx, pt, W / 2 - 12 * s, row, s, '#0b1f33', '#ffffff', 'right'); chip(ctx, S.cur.cta, W / 2 + 12 * s, row, s, c.accent, ctaFg, 'left'); }
      else { if (pt) chip(ctx, pt, W / 2, row, s, '#0b1f33', '#ffffff', 'center'); else if (S.cur.cta) chip(ctx, S.cur.cta, W / 2, row, s, c.accent, ctaFg, 'center'); }
      return;
    }
    /* spotlight (and split on tall formats) */
    let y = words(M, top, W - 2 * M, 'center', tall ? 84 : wide ? 54 : 64, !tall);
    const feats = tall ? (S.cur.features || []).slice(0, 3) : []; if (feats.length) { for (const f of feats) y += textBox(ctx, '✓ ' + f, M, y, W - 2 * M, { size: 32 * s, min: 22 * s, lines: 1, color: c.text, weight: 600, align: 'center' }) + 6 * s; y += 12 * s; }
    const below = 150 * s + (S.cur.cta ? 70 * s : 0); const ph = Math.max(120 * s, bottom - y - below);
    const pw = wide ? Math.min(W * 0.5, ph * 1.3) : W - 2 * M; photo(ctx, img, (W - pw) / 2, y, pw, ph, s); y += ph + 20 * s;
    y += textBox(ctx, x0.p.name, M, y, W - 2 * M, { size: 38 * s, min: 24 * s, lines: 2, color: c.text, weight: 700, align: 'center' }) + 12 * s;
    if (pt) y += chip(ctx, pt, W / 2, y, s, '#ffffff', '#0b1f33', 'center') + 14 * s;
    if (S.cur.cta) chip(ctx, S.cur.cta, W / 2, Math.min(y, bottom - 52 * s), s, c.accent, ctaFg, 'center');
  }

  /* ---------------- editor ---------------- */
  const CSS = `
  .adb{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:18px;align-items:start}
  @media(max-width:980px){.adb{grid-template-columns:minmax(0,1fr)}.adb-prev{order:-1;position:static!important}}
  .adb-sec{border:1px solid var(--line,#dfe5ea);border-radius:12px;background:#fff;margin:0 0 12px;padding:12px 14px}
  .adb-sec h3{margin:0 0 8px;font-size:15px;font-weight:800;color:var(--navy,#0b1f33)}
  .adb-opts{display:flex;flex-wrap:wrap;gap:8px}
  .adb-opt{border:1.5px solid var(--line,#dfe5ea);border-radius:10px;background:#fff;padding:8px 12px;min-height:44px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;color:var(--navy,#0b1f33)}
  .adb-opt.on{border-color:#ef6325;background:#fff4ec}
  .adb-opt small{display:block;font-weight:500;color:#5b6773;font-size:11.5px}
  .adb-consent{border:1.5px solid #1681c2;border-radius:12px;background:#f3f8fc;padding:12px 14px;margin:10px 0;font-size:13.5px;line-height:1.5}
  .adb-consent:focus{outline:3px solid #fcb21e;outline-offset:2px}
  .adb-consent h4{margin:0 0 6px;font-size:15px;color:var(--navy,#0b1f33)}
  .adb-consent ul{margin:6px 0 8px;padding-left:20px} .adb-consent li{margin:3px 0}
  .adb-consent a{color:#0f5c8f;text-decoration:underline}
  .adb-consent .btn{min-height:44px}
  .adb label.l{display:block;font-size:12px;font-weight:700;color:#5b6773;margin:8px 0 3px}
  .adb input[type=text],.adb textarea,.adb select{width:100%;box-sizing:border-box;border:1px solid var(--line,#cfd8e0);border-radius:8px;padding:9px 10px;font:inherit;font-size:14.5px}
  .adb textarea{min-height:70px}
  .adb .warn{color:#9b1c1c;font-size:12.5px;min-height:15px;margin-top:3px}
  .adb-plist{max-height:300px;overflow:auto;border:1px solid var(--line,#dfe5ea);border-radius:10px;margin-top:8px}
  .adb-p{display:flex;gap:10px;align-items:center;padding:8px 10px;border-top:1px solid #eef2f5;cursor:pointer;min-height:44px}
  .adb-p:first-child{border-top:0}.adb-p.on{background:#fff4ec}
  .adb-p img,.adb-p .ph0{width:44px;height:44px;object-fit:contain;background:#f3f6f8;border-radius:6px;flex:0 0 44px}
  .adb-p .n{flex:1;min-width:0;font-size:13.5px}.adb-p .n b{display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.adb-p .n span{color:#5b6773;font-size:12px}
  .adb-sel{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .adb-sel span{display:inline-flex;gap:6px;align-items:center;background:#eef4f9;border-radius:999px;padding:5px 6px 5px 11px;font-size:12.5px;font-weight:700}
  .adb-sel button{border:0;background:#fff;border-radius:999px;min-width:30px;min-height:30px;cursor:pointer}
  .adb-sel label{font-weight:500}
  .adb-prev{position:sticky;top:12px}
  .adb-prev canvas{width:auto;max-width:100%;max-height:78vh;margin:0 auto;height:auto;border-radius:12px;box-shadow:0 8px 30px rgba(11,31,51,.16);background:#e8edf2;display:block}
  .adb-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .adb-acts .btn{min-height:44px}
  .adb button.btn,#adbNew{font:inherit;cursor:pointer}
  .adb-card button.btn{min-height:44px}
  .adb-msg{font-size:13px;margin-top:8px;min-height:16px}.adb-msg.err{color:#b42323}.adb-msg.ok{color:#17663a}
  .adb-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:14px}
  .adb-card{border:1px solid var(--line,#dfe5ea);border-radius:12px;background:#fff;padding:12px;display:flex;flex-direction:column;gap:6px}
  .adb-card b{font-size:14px}.adb-card span{color:#5b6773;font-size:12.5px}
  .adb-card .r{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .adb-sw{display:flex;gap:6px;flex-wrap:wrap}.adb-sw button{width:44px;height:44px;border-radius:10px;border:2px solid #fff;box-shadow:0 0 0 1px #cfd8e0;cursor:pointer}
  .adb-colors{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}.adb-colors label{font-size:12.5px;display:flex;gap:6px;align-items:center}
  .adb-colors input{width:48px;height:44px;border:0;padding:0;background:none}
  .adb-cap{border:1px dashed #cfd8e0;border-radius:10px;padding:8px 10px;margin-top:6px;font-size:13.5px;cursor:pointer}
  .adb-pub{background:#f6f8fa;border-style:dashed}
  .adb-ai{background:linear-gradient(135deg,#f3f8ff,#fff6ef);border-color:#bfd6ee}
  .adb-ai .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
  .adb-ai .go{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .adb-ai .go .btn{min-height:44px;font-weight:800}
  .adb-why{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #dfe5ea;font-size:13.5px}
  .adb-why ul{margin:6px 0 0 18px;padding:0}
  .adb-alts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.adb-alts button{border:1px solid #cfd8e0;background:#fff;border-radius:999px;padding:6px 12px;min-height:44px;font:inherit;font-size:13px;cursor:pointer}
  .adb-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.adb-tabs button{border:1px solid #cfd8e0;background:#fff;border-radius:8px;padding:6px 12px;min-height:44px;font:inherit;font-size:13px;cursor:pointer}.adb-tabs button[aria-pressed=true]{border-color:#ef6325;background:#fff4ec;font-weight:700}
  .adb-camp{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px}.adb-camp div{border:1px solid #dfe5ea;border-radius:10px;padding:8px;background:#fff;text-align:center;font-size:12.5px}.adb-camp canvas{width:100%;height:auto;border-radius:6px;background:#e8edf2}
  .adb-camp .btn{min-height:44px;margin-top:6px;width:100%}
  @media(max-width:980px){.adb input[type=text],.adb textarea,.adb select{font-size:16px;min-height:44px}}`;

  function shell() {
    const c = S.ctx;
    A.host.innerHTML = `<style>${CSS}</style>
      <div class="ph"><div><h1>Social Ads</h1><div class="sub">Make Facebook, Instagram and LinkedIn ads with your authorized products, official photos and your store details.</div></div>
        <div><button type="button" class="btn pri" id="adbNew">+ New ad</button></div></div>
      ${c.preview ? '<div class="card"><div class="msg">HCPS read-only preview — ads can be designed and downloaded but not saved.</div></div>' : ''}
      ${c.blocked ? '<div class="card"><div class="msg">HCPS has paused public marketing for this location — please contact HCPS.</div></div>' : ''}
      <div id="adbList"></div>
      <div class="adb"><div id="adbForm"></div><div class="adb-prev"><canvas id="adbCanvas" role="img" aria-label="Ad preview"></canvas>
        <div class="adb-acts">
          <button type="button" class="btn pri" id="adbSave">Save</button><button type="button" class="btn gh" id="adbDup">Save as a copy</button>
          <button type="button" class="btn gh" id="adbPng">⬇ PNG</button><button type="button" class="btn gh" id="adbJpg">⬇ JPEG</button><button type="button" class="btn gh" id="adbCopy">Copy caption</button>
        </div><div class="adb-msg" id="adbMsg" role="status"></div></div></div>`;
    $('#adbNew').onclick = () => { S.cur = blank(); S.row = null; S.problems = []; S.suggestions = null; S.aiResult = null; S.history = []; S.campaign = null; form(); redraw(); say(''); };
    $('#adbSave').onclick = () => save(false); $('#adbDup').onclick = () => save(true);
    $('#adbPng').onclick = () => download('png'); $('#adbJpg').onclick = () => download('jpeg');
    $('#adbCopy').onclick = async () => { if (!(await freshCheck())) return; const t = captionText(); try { await navigator.clipboard.writeText(t); say('Caption copied.', 'ok'); } catch (x) { say('Copy did not work in this browser — select the caption text instead.', 'err'); } };
  }
  const captionText = () => [S.cur.caption, S.cur.hashtags.map((h) => '#' + h).join(' ')].filter(Boolean).join('\n\n');
  function say(m, cls) { const el = $('#adbMsg'); if (el) { el.textContent = m || ''; el.className = 'adb-msg' + (cls ? ' ' + cls : ''); } }

  function list() {
    const host = $('#adbList'); if (!host) return;
    const mine = S.ads.filter((a) => a.dealer_id === S.loc);
    host.innerHTML = mine.length ? `<h3 style="margin:4px 0 8px">Your saved ads</h3><div class="adb-list">${mine.map((a) => `<div class="adb-card"><b>${e(a.title || a.headline || 'Untitled ad')}</b>
      <span>${e((S.ctx.templates[a.template] || {}).label || a.template)} · ${e((S.ctx.formats[a.format] || {}).label || a.format).split('—')[0]}</span>
      ${a.campaign ? `<span>Campaign: ${e(a.campaign.name || '')}</span>` : ''}${a.ai ? '<span>✨ Written with AI</span>' : ''}<span>Updated ${e(new Date(a.updated_at).toLocaleDateString())}</span>
      <div class="r"><button type="button" class="btn gh acsm" data-open="${e(a.id)}">Open</button><button type="button" class="btn gh acsm" data-dup="${e(a.id)}">Duplicate</button>${S.ctx.can_edit ? `<button type="button" class="btn gh acsm" data-arch="${e(a.id)}">Archive</button>` : ''}</div></div>`).join('')}</div>` : '';
    host.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => open(b.getAttribute('data-open')); });
    host.querySelectorAll('[data-dup]').forEach((b) => { b.onclick = async () => { const r = await A.api({ action: 'ads_duplicate', id: b.getAttribute('data-dup') }); if (r && r.ok) { await refreshList(); open(r.row.id); say(r.dropped ? `Copied. ${r.dropped} product(s) no longer authorized were left out.` : 'Copied.', 'ok'); } else say((r && r.error) || 'Could not copy.', 'err'); }; });
    host.querySelectorAll('[data-arch]').forEach((b) => { b.onclick = async () => { if (!window.confirm('Archive this ad? It leaves your list.')) return; const r = await A.api({ action: 'ads_archive', id: b.getAttribute('data-arch') }); if (r && r.ok) { if (S.row && S.row.id === b.getAttribute('data-arch')) { S.row = null; } await refreshList(); } else say((r && r.error) || 'Could not archive.', 'err'); }; });
  }
  async function refreshList() { const r = await A.api({ action: 'ads_list' }); S.ads = r && r.ok ? r.ads : []; list(); if (r && !r.ok && r.error) say(r.error, 'err'); }
  async function open(id) {
    const r = await A.api({ action: 'ads_get', id }); if (!r || !r.ok) { say((r && r.error) || 'That ad could not be opened.', 'err'); return; }
    if (r.row.dealer_id !== S.loc) await openLocation(r.row.dealer_id, true);
    S.row = r.row; S.cur = Object.assign(blank(), r.ad); S.cur.features = r.ad.features || []; S.cur.captions = r.ad.captions || {}; S.aiResult = r.ad.ai ? { why: r.ad.ai.why, alt_headlines: r.ad.ai.alt_headlines } : null; S.campaign = null; S.cur.colors = Object.assign(blank().colors, r.ad.colors || {}); S.cur.show = Object.assign(blank().show, r.ad.show || {});
    S.problems = r.problems || []; S.cur.products = S.cur.products.filter((p) => productBy(p));
    form(); redraw(); say(S.problems.length ? S.problems.map((p) => `${p.code}: ${p.problem}`).join(' ') : 'Opened.', S.problems.length ? 'err' : 'ok');
    window.scrollTo({ top: 0 });
  }

  function form() {
    const c = S.ctx, cur = S.cur, host = $('#adbForm');
    const locHtml = `<select id="adbLoc">${c.locations.map((l) => `<option value="${e(l.id)}"${l.id === S.loc ? ' selected' : ''}>${e(l.name)}${l.city ? ' — ' + e(l.city) : ''}</option>`).join('')}</select>`;
    const kind = T().kind, max = (c.templates[cur.template] || {}).max || 4;
    const names = cur.products.map((r) => productBy(r)).filter(Boolean);
    const allow = [c.dealer.name, c.dealer.city].concat(...names.map((p) => [p.name, p.category, p.brand]));
    const q = S.q.trim().toLowerCase();
    const plist = c.products.filter((p) => !q || (p.name + ' ' + p.code + ' ' + (p.category || '') + ' ' + p.manufacturer).toLowerCase().includes(q)).slice(0, 80);
    host.innerHTML = `${c.locations.length > 1 ? '<label class="l" for="adbLoc">Location</label>' + locHtml : ''}
      ${aiHtml()}
      <div class="adb-sec"><h3>1 · Template</h3><div class="adb-opts">${Object.entries(c.templates).map(([k, t]) => `<button type="button" class="adb-opt${cur.template === k ? ' on' : ''}" data-tpl="${e(k)}">${e(t.label)}</button>`).join('')}</div></div>
      <div class="adb-sec"><h3>2 · Size</h3><div class="adb-opts">${Object.entries(c.formats).map(([k, f]) => `<button type="button" class="adb-opt${cur.format === k ? ' on' : ''}" data-fmt="${e(k)}">${e(f.label.split('—')[0])}<small>${e(f.w)}×${e(f.h)} · ${e((f.label.split('—')[1] || '').trim())}</small></button>`).join('')}</div></div>
      ${kind === 'general' ? '' : `<div class="adb-sec"><h3>3 · ${kind === 'single' ? 'Product' : `Products (2–${max})`}</h3>
        <input type="text" id="adbQ" placeholder="Search your authorized products (${c.products.length})" value="${e(S.q)}" aria-label="Search products">
        <div class="adb-sel">${cur.products.map((r, i) => { const p = productBy(r); return p ? `<span>${e(p.name)} <label><input type="checkbox" data-sp="${i}"${r.show_price !== false ? ' checked' : ''}> price</label><button type="button" data-rm="${i}" aria-label="Remove ${e(p.name)}">✕</button></span>` : ''; }).join('')}</div>
        <div class="adb-plist" role="listbox" aria-label="Products">${plist.map((p) => `<div class="adb-p${cur.products.some((r) => keyOf(r) === keyOf(p)) ? ' on' : ''}" role="option" tabindex="0" aria-selected="${cur.products.some((r) => keyOf(r) === keyOf(p)) ? 'true' : 'false'}" data-pk="${e(keyOf(p))}">${p.image ? `<img alt="" loading="lazy" src="${e(/^\//.test(p.image) ? p.image : p.image)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph0'}))">` : '<div class="ph0"></div>'}<div class="n"><b>${e(p.name)}</b><span>${e(p.code)} · ${e(p.category || '')} · ${e(p.price != null ? (p.price_label ? p.price_label + ' ' : '') + money(p.price) : 'Call for Price')}</span></div></div>`).join('') || '<div class="adb-p">No products match.</div>'}</div></div>`}
      <div class="adb-sec"><h3>${kind === 'general' ? '3' : '4'} · Words</h3>
        <label class="l" for="adbTitle">Name of this ad (only you see it)</label><input type="text" id="adbTitle" maxlength="${c.limits.title}" value="${e(cur.title || '')}">
        <label class="l" for="adbHead">Headline</label><input type="text" id="adbHead" maxlength="${c.limits.headline}" value="${e(cur.headline)}"><div class="warn" id="wHead"></div>
        <label class="l" for="adbSub">Subheadline (optional)</label><input type="text" id="adbSub" maxlength="${c.limits.subheadline || 100}" value="${e(cur.subheadline || '')}"><div class="warn" id="wSub"></div>
        <label class="l" for="adbBody">Message</label><textarea id="adbBody" maxlength="${c.limits.body}">${e(cur.body)}</textarea><div class="warn" id="wBody"></div>
        <label class="l" for="adbFeat">Feature bullets (one per line, up to 4 — from the product's own facts)</label><textarea id="adbFeat" rows="3">${e((cur.features || []).join('\n'))}</textarea><div class="warn" id="wFeat"></div>
        <label class="l" for="adbCta">Call to action</label><select id="adbCta">${['', ...c.ctas].map((t) => `<option${t === cur.cta ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>
        <label class="l" for="adbFont">Font</label><select id="adbFont">${c.fonts.map((f) => `<option${f === cur.font ? ' selected' : ''}>${e(f)}</option>`).join('')}</select>
        <p style="font-size:12px;color:#5b6773;margin:8px 0 0">Prices are added automatically from the catalog (MAP rules applied). Ads can't mention discounts, sales, free offers, guarantees, insurance or medical claims.</p></div>
      <div class="adb-sec"><h3>Colors &amp; details</h3><div class="adb-sw">${PRESETS.map((p, i) => `<button type="button" data-pre="${i}" title="${e(p.name)}" aria-label="${e(p.name)} colors" style="background:linear-gradient(135deg,${p.bg} 60%,${p.accent} 60%)"></button>`).join('')}</div>
        <div class="adb-colors">${[['bg', 'Background'], ['accent', 'Accent'], ['text', 'Text']].map(([k, l]) => `<label>${l} <input type="color" data-col="${k}" value="${e(cur.colors[k] || '#000000')}"></label>`).join('')}</div>
        <div class="adb-opts" style="margin-top:10px">${[['logo', 'Logo', c.dealer.has_logo], ['name', 'Store name', true], ['address', 'Address', true], ['phone', 'Phone', !!c.dealer.phone], ['website', c.dealer.link ? 'Storefront link' : 'Website', !!(c.dealer.link || c.dealer.website)], ['price', 'Prices', kind !== 'general']]
          .filter((x) => x[2]).map(([k, l]) => `<label class="adb-opt" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-show="${k}"${cur.show[k] ? ' checked' : ''}> ${e(l)}</label>`).join('')}</div>
        ${c.dealer.has_logo ? '' : '<p style="font-size:12px;color:#5b6773">Add your logo in Account &amp; Pricing to show it on ads.</p>'}</div>
      <div class="adb-sec"><h3>Post caption</h3>${Object.keys(cur.captions || {}).length ? `<div class="adb-tabs" role="group" aria-label="Caption for">${Object.keys(cur.captions).map((k) => `<button type="button" data-capk="${e(k)}" aria-pressed="${cur.caption === cur.captions[k]}">${e(PLAT[k] || k)}</button>`).join('')}</div>` : ''}<textarea id="adbCap" maxlength="${c.limits.caption}" aria-label="Caption">${e(cur.caption)}</textarea><div class="warn" id="wCap"></div>
        <label class="l" for="adbTags">Hashtags</label><input type="text" id="adbTags" value="${e(cur.hashtags.map((h) => '#' + h).join(' '))}">
        <div class="adb-acts"><button type="button" class="btn gh" id="adbSug">Suggest captions</button></div><div id="adbSugs">${(S.suggestions && S.suggestions.captions || []).map((t, i) => `<div class="adb-cap" tabindex="0" data-cap="${i}">${e(t)}</div>`).join('')}</div></div>
      <div class="adb-sec adb-pub" id="adbPub"><h3>Schedule &amp; publish</h3>${pubHtml()}</div>`;
    const lsel = host.querySelector('#adbLoc'); if (lsel) lsel.onchange = async () => { await openLocation(lsel.value); };
    host.querySelectorAll('[data-tpl]').forEach((b) => { b.onclick = () => { cur.template = b.getAttribute('data-tpl'); const k = T().kind, mx = (c.templates[cur.template] || {}).max || 4;
      if (k === 'general') cur.products = []; else if (k === 'single') cur.products = cur.products.slice(0, 1); else cur.products = cur.products.slice(0, mx); form(); redraw(); }; });
    host.querySelectorAll('[data-fmt]').forEach((b) => { b.onclick = () => { cur.format = b.getAttribute('data-fmt'); form(); redraw(); }; });
    host.querySelectorAll('[data-pk]').forEach((el) => { const pick = () => { const k = el.getAttribute('data-pk'); const p = c.products.find((x) => keyOf(x) === k); if (!p) return;
      const i = cur.products.findIndex((r) => keyOf(r) === k);
      if (i >= 0) cur.products.splice(i, 1); else if (kind === 'single') cur.products = [{ manufacturer: p.manufacturer, code: p.code, show_price: true }];
      else if (cur.products.length < max) cur.products.push({ manufacturer: p.manufacturer, code: p.code, show_price: true }); else { say(`This template shows up to ${max} products.`, 'err'); return; }
      form(); redraw(); }; el.onclick = pick; el.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } }; });
    host.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { cur.products.splice(Number(b.getAttribute('data-rm')), 1); form(); redraw(); }; });
    host.querySelectorAll('[data-sp]').forEach((b) => { b.onchange = () => { cur.products[Number(b.getAttribute('data-sp'))].show_price = b.checked; redraw(); }; });
    const qq = host.querySelector('#adbQ'); if (qq) qq.oninput = () => { S.q = qq.value; const pos = qq.selectionStart; form(); const n = $('#adbQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } };
    const bind = (id, k, warnId) => { const el = host.querySelector(id); if (!el) return; el.oninput = () => { cur[k] = el.value; if (warnId) { const w = warnWords(el.value, allow); host.querySelector(warnId).textContent = w ? `"${w}" can't be used in an ad (prices, discounts, offers or claims).` : ''; } redraw(); }; if (warnId) el.oninput(); };
    bind('#adbTitle', 'title'); bind('#adbHead', 'headline', '#wHead'); bind('#adbSub', 'subheadline', '#wSub'); bind('#adbBody', 'body', '#wBody'); bind('#adbCap', 'caption', '#wCap');
    const fe = host.querySelector('#adbFeat'); if (fe) fe.oninput = () => { cur.features = fe.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 4); const w = cur.features.map((x) => warnWords(x, allow)).find(Boolean); host.querySelector('#wFeat').textContent = w ? `"${w}" can't be used in an ad (prices, discounts, offers or claims).` : ''; redraw(); };
    host.querySelectorAll('[data-capk]').forEach((b) => { b.onclick = () => { cur.caption = cur.captions[b.getAttribute('data-capk')] || ''; form(); }; });
    bindAi(host);
    host.querySelector('#adbCta').onchange = (ev) => { cur.cta = ev.target.value; redraw(); };
    host.querySelector('#adbFont').onchange = (ev) => { cur.font = ev.target.value; redraw(); };
    host.querySelector('#adbTags').onchange = (ev) => { cur.hashtags = String(ev.target.value).split(/[\s,]+/).map((t) => t.replace(/^#/, '').replace(/[^A-Za-z0-9]/g, '')).filter(Boolean).slice(0, 15); };
    host.querySelectorAll('[data-pre]').forEach((b) => { b.onclick = () => { const p = PRESETS[Number(b.getAttribute('data-pre'))]; cur.colors = { bg: p.bg, accent: p.accent, text: p.text }; form(); redraw(); }; });
    host.querySelectorAll('[data-col]').forEach((i) => { i.oninput = () => { cur.colors[i.getAttribute('data-col')] = i.value; redraw(); }; });
    host.querySelectorAll('[data-show]').forEach((i) => { i.onchange = () => { cur.show[i.getAttribute('data-show')] = i.checked; redraw(); }; });
    host.querySelector('#adbSug').onclick = async () => { const r = await A.api({ action: 'ads_suggest', location_id: S.loc, products: cur.products, cta: cur.cta }); if (r && r.ok) { S.suggestions = r; if (!cur.hashtags.length) cur.hashtags = r.hashtags.slice(); form(); } else say((r && r.error) || 'No suggestions just now.', 'err'); };
    host.querySelectorAll('[data-cap]').forEach((el) => { const use = () => { cur.caption = S.suggestions.captions[Number(el.getAttribute('data-cap'))]; form(); }; el.onclick = use; el.onkeydown = (ev) => { if (ev.key === 'Enter') use(); }; });
    const ro = !S.ctx.can_edit || S.ctx.preview; ['#adbSave', '#adbDup'].forEach((id) => { const b = $(id); if (b) b.style.display = ro ? 'none' : ''; });
    bindPub();
  }

  /* ---------------- AI Build My Ad / Generate Complete Campaign ---------------- */
  function aiHtml() {
    const c = S.ctx; if (c.preview || !c.can_edit) return '';
    const sel = (k, l) => `<label class="l" for="adbAi_${k}">${l}</label><select id="adbAi_${k}" data-ai="${k}">${AI_OPTS[k].map(([v, t]) => `<option value="${e(v)}"${S.ai[k] === v ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>`;
    const R = S.aiResult;
    return `<div class="adb-sec adb-ai" id="adbAi"><h3>✨ AI Build My Ad</h3>
      <p style="font-size:13px;color:#3b4552;margin:0 0 6px">Pick ${T().kind === 'general' ? 'nothing — the store itself is the subject' : 'your product(s) below'}, then one click writes the whole ad from the product's official facts: headline, message, features, call to action, design and captions. Everything stays editable. Optional:</p>
      <div class="row">${sel('goal', 'Goal')}${sel('audience', 'Audience')}${sel('tone', 'Tone')}${sel('platform', 'Platform')}</div>
      <div class="go"><button type="button" class="btn pri" id="adbAiGo">✨ AI Build My Ad</button><button type="button" class="btn gh" id="adbAiCamp">✨ Generate Complete Campaign</button>
        ${S.history.length ? '<button type="button" class="btn gh" id="adbAiBack">↶ Back to the previous version</button>' : ''}</div>
      ${R ? `<div class="adb-why"><b>Why this ad works</b><ul>${(R.why || []).map((w) => `<li>${e(w)}</li>`).join('')}</ul>
        ${(R.alt_headlines || []).length ? `<div style="margin-top:8px"><b>Other headlines</b> — tap to use:</div><div class="adb-alts">${R.alt_headlines.map((h, i) => `<button type="button" data-alt="${i}">${e(h)}</button>`).join('')}</div>` : ''}
        <div style="margin-top:8px;color:#5b6773;font-size:12px">Written by AI from your catalog's facts and checked by HCPS's ad rules. Review it before posting — results are never guaranteed.</div></div>` : ''}
      ${S.campaign ? campHtml() : ''}</div>`;
  }
  function campHtml() { const C = S.campaign; return `<div class="adb-why"><b>Campaign: ${e(C.campaign.name)}</b> — ${C.ads.length} sizes. ${C.saved ? 'Saved — each size is in your saved ads.' : 'Not saved yet.'}
    <div class="adb-camp">${C.ads.map((a, i) => `<div><canvas data-cv="${i}" aria-label="${e(a.format)} preview"></canvas><b>${e((S.ctx.formats[a.format] || {}).label ? S.ctx.formats[a.format].label.split('—')[0] : a.format)}</b><br>${e(a.headline)}
      <button type="button" class="btn gh" data-cedit="${i}">Edit this size</button><button type="button" class="btn gh" data-cdl="${i}">⬇ PNG</button></div>`).join('')}</div>
    <div class="go">${C.saved ? '' : '<button type="button" class="btn pri" id="adbCampSave">Save campaign</button>'}<button type="button" class="btn gh" id="adbCampClose">Close campaign</button></div></div>`; }
  async function drawCampaign() { if (!S.campaign) return; const keep = S.cur;
    for (let i = 0; i < S.campaign.ads.length; i++) { const cv = A.host.querySelector(`[data-cv="${i}"]`); if (!cv) continue; S.cur = Object.assign(blank(), S.campaign.ads[i]); try { await draw(cv); } catch (x) {} }
    S.cur = keep; }
  function bindAi(host) {
    host.querySelectorAll('[data-ai]').forEach((el) => { el.onchange = () => { S.ai[el.getAttribute('data-ai')] = el.value; }; });
    const go = host.querySelector('#adbAiGo'); if (go) go.onclick = () => aiBuild(false);
    const cp = host.querySelector('#adbAiCamp'); if (cp) cp.onclick = () => aiBuild(true);
    const bk = host.querySelector('#adbAiBack'); if (bk) bk.onclick = () => { const prev = S.history.pop(); if (prev) { S.cur = prev.cur; S.aiResult = prev.ai; form(); redraw(); say('Back to the previous version.', 'ok'); } };
    host.querySelectorAll('[data-alt]').forEach((b) => { b.onclick = () => { const h = S.aiResult.alt_headlines[Number(b.getAttribute('data-alt'))]; S.history.push({ cur: JSON.parse(JSON.stringify(S.cur)), ai: S.aiResult }); S.cur.headline = h; form(); redraw(); }; });
    host.querySelectorAll('[data-cedit]').forEach((b) => { b.onclick = () => { const a = S.campaign.ads[Number(b.getAttribute('data-cedit'))]; S.history.push({ cur: JSON.parse(JSON.stringify(S.cur)), ai: S.aiResult }); S.cur = Object.assign(blank(), JSON.parse(JSON.stringify(a))); S.row = null; form(); redraw(); say('Editing the ' + a.format + ' ad — Save makes it its own ad.', 'ok'); }; });
    host.querySelectorAll('[data-cdl]').forEach((b) => { b.onclick = async () => { const keep = S.cur; S.cur = Object.assign(blank(), S.campaign.ads[Number(b.getAttribute('data-cdl'))]); try { await download('png'); } finally { S.cur = keep; redraw(); } }; });
    const cs = host.querySelector('#adbCampSave'); if (cs) cs.onclick = async () => { if (S.busy) return; S.busy = true; say('Saving the campaign…');
      try { const r = await A.api({ action: 'ads_campaign_save', location_id: S.loc, campaign: S.campaign.campaign, ads: S.campaign.ads }); if (r && r.ok) { S.campaign.saved = true; await refreshList(); form(); say(`Saved ${r.rows.length} ads as one campaign.`, 'ok'); } else say((r && r.error) || 'Could not save the campaign.', 'err'); } finally { S.busy = false; } };
    const cc = host.querySelector('#adbCampClose'); if (cc) cc.onclick = () => { S.campaign = null; form(); };
    if (S.campaign) drawCampaign();
  }
  async function aiBuild(campaign) {
    if (S.busy) return; const kind = T().kind;
    if (kind !== 'general' && !S.cur.products.length) { say('Pick a product first (or choose the "Store message" template).', 'err'); return; }
    S.busy = true; const btn = $(campaign ? '#adbAiCamp' : '#adbAiGo'); if (btn) { btn.disabled = true; btn.textContent = '✨ Writing…'; }
    say(campaign ? 'Writing a complete campaign from your product facts… (about 10–20 seconds)' : 'Writing your ad from the product facts… (about 10–20 seconds)');
    try {
      const avoid = [S.cur.headline, ...((S.aiResult && S.aiResult.alt_headlines) || [])].filter(Boolean);
      const body = Object.assign({ action: campaign ? 'ads_campaign' : 'ads_ai', location_id: S.loc, products: S.cur.products.map((r) => ({ manufacturer: r.manufacturer, code: r.code })), format: S.cur.format, avoid, variant: S.history.length % 10 }, S.ai);
      const r = await A.api(body);
      if (!r || !r.ok) { say(((r && r.error) || 'The AI could not write an ad just now.') + ' Your current ad is unchanged.', 'err'); return; }
      if (S.cur.headline || S.cur.products.length) S.history.push({ cur: JSON.parse(JSON.stringify(S.cur)), ai: S.aiResult });   // regenerate never loses the previous version
      for (const p of r.products || []) { const i = S.ctx.products.findIndex((x) => keyOf(x) === keyOf(p)); if (i >= 0) S.ctx.products[i] = Object.assign({}, S.ctx.products[i], p); }
      if (campaign) { S.campaign = { campaign: r.campaign, ads: r.ads, saved: false }; S.cur = Object.assign(blank(), JSON.parse(JSON.stringify(r.ads[0]))); }
      else { const keepFmt = S.cur.format; S.cur = Object.assign(blank(), r.ad); S.cur.format = keepFmt; S.campaign = null; }
      S.row = null; S.aiResult = { why: r.why, alt_headlines: r.alt_headlines }; form(); redraw();
      say((campaign ? 'Campaign ready — four sizes below. Edit any size, download, or save the campaign.' : 'Your ad is ready. Edit anything, try another headline, regenerate, or save it.') + (r.captions_source === 'rules' ? ' The AI captions didn\'t pass HCPS\'s checks this time, so HCPS\'s standard captions are filled in — regenerate for AI captions.' : ''), 'ok');
    } finally { S.busy = false; const b2 = $(campaign ? '#adbAiCamp' : '#adbAiGo'); if (b2) { b2.disabled = false; b2.textContent = campaign ? '✨ Generate Complete Campaign' : '✨ AI Build My Ad'; } }
  }

  /* ---------------- scheduling & publishing (off until the platforms approve HCPS's apps) ---------------- */
  const PNAME = { facebook: 'Facebook Page', instagram: 'Instagram', linkedin: 'LinkedIn Page' };
  /* Authorization notice shown BEFORE the platform's sign-in (owner directive 2026-11-07). The permission lists must match
     _social_publish.js authorizeUrl() in the admin repo (test/social-consent.test.js checks it). */
  const POLICY = 'https://www.homecareproviderservices.org/privacy/', DELETION = 'https://www.homecareproviderservices.org/data-deletion/';
  const CONSENT = {
    facebook: { via: 'Facebook', what: 'a Facebook Page you manage', perms: ['pages_show_list — list the Pages you manage so you can choose one', 'pages_read_engagement — read the chosen Page\'s basic details', 'pages_manage_posts — publish the posts you approve to that Page'] },
    instagram: { via: 'Facebook', what: 'an Instagram professional account linked to a Facebook Page you manage', perms: ['pages_show_list / pages_read_engagement — find the Page your Instagram account is linked to', 'instagram_basic — read the account\'s name and ID', 'instagram_content_publish — publish the posts you approve to it', 'business_management — reach Pages you manage through Meta Business Manager'] },
    linkedin: { via: 'LinkedIn', what: 'a LinkedIn company page you administer', perms: ['r_organization_admin — list the company pages you administer so you can choose one', 'w_organization_social — publish the posts you approve to that page'] },
  };
  function consentHtml(platform) {
    const c = CONSENT[platform]; if (!c) return '';
    return `<div class="adb-consent" role="region" aria-labelledby="adbConsentH" tabindex="-1">
      <h4 id="adbConsentH">Connect ${e(PNAME[platform])} to HCPS</h4>
      <p>You are about to connect ${e(c.what)} to HomeCare Provider Services (HCPS) for this location. ${e(c.via)} will ask you to sign in and show the permissions HCPS requests:</p>
      <ul>${c.perms.map((x) => `<li>${e(x)}</li>`).join('')}</ul>
      <ul class="adb-consent-k">
        <li>You choose which ${platform === 'linkedin' ? 'company page' : platform === 'instagram' ? 'account' : 'Page'} to connect. Access to anything you don't choose is deleted.</li>
        <li>HCPS publishes only posts you approve, one by one, in the calendar below. It does not read your messages, followers or ads.</li>
        <li>You stay in control of your account and can disconnect here at any time, or remove "HCPS Social Publishing" in ${e(c.via)}'s settings.</li>
        <li>Already connected? Signing in again just refreshes that account's access. Any other account it lists waits for you to choose it; if you don't, its access is removed after about an hour.</li>
        <li>Each post you approve is tied to the account you approve it for. It never goes to a different Page or account; if that account is disconnected, the post doesn't publish.</li>
      </ul>
      <p style="font-size:12.5px">Read the <a href="${POLICY}#social" target="_blank" rel="noopener">HCPS Privacy Policy</a> and <a href="${DELETION}" target="_blank" rel="noopener">Data Deletion Instructions</a>.</p>
      <div class="adb-acts"><button type="button" class="btn pri" data-consent-go="${e(platform)}">Continue to ${e(c.via)}</button> <button type="button" class="btn gh" data-consent-cancel>Cancel</button></div>
    </div>`;
  }
  /* the begin link must be HCPS's own OAuth endpoint (the site's primary domain, or its Netlify name) — never another host */
  const BEGIN_RE = /^https:\/\/(?:www\.homecareproviderservices\.org|homecareproviderservices\.netlify\.app)\/\.netlify\/functions\/social-oauth-callback\?begin=[0-9a-f]{32}$/;
  const STATUS = { draft: 'Draft', awaiting_approval: 'Waiting for your approval', approved: 'Approved — scheduled', paused: 'Paused', publishing: 'Publishing…', published: 'Published', partially_published: 'Partly published', failed: 'Failed', cancelled: 'Cancelled' };
  function pubHtml() {
    const P = S.social; if (!P) return '<p style="font-size:13px;margin:0">Loading…</p>';
    const open = P.platforms.filter((x) => x.ok);
    const conns = P.connections.filter((c) => c.status === 'connected');
    let h = '';
    if (!open.length) h += `<p style="font-size:13px;margin:0 0 8px">${e(S.ctx.publishing.note)}</p>`;
    else {
      h += `<div class="adb-opts">${open.map((x) => `<button type="button" class="adb-opt" data-conn="${e(x.platform)}">Connect ${e(PNAME[x.platform])}</button>`).join('')}</div>`;
      h += '<div id="adbConsent" aria-live="polite"></div>';
      const pend = P.connections.filter((c) => c.status === 'pending');
      if (pend.length) h += `<p style="font-size:12.5px;margin:8px 0 4px"><b>Choose the account to post to:</b></p><div class="adb-opts">${pend.map((c) => `<button type="button" class="adb-opt" data-choose="${e(c.id)}">${e(PNAME[c.platform])}: ${e(c.account_name || c.external_id)}</button>`).join('')}</div>`;
      h += conns.length ? `<p style="font-size:12.5px;margin:8px 0 4px">Connected: ${conns.map((c) => `${e(PNAME[c.platform])} — ${e(c.account_name || c.external_id)} <button type="button" class="btn gh acsm" data-disc="${e(c.id)}">Disconnect</button>`).join(' · ')}</p>` : '';
      const usable = open.filter((x) => conns.some((c) => c.platform === x.platform));
      if (usable.length && S.ctx.can_edit) h += `<div class="adb-opts" style="margin-top:8px">${usable.map((x) => `<label class="adb-opt" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-plat="${e(x.platform)}"> ${e(PNAME[x.platform])}</label>`).join('')}</div>
        <label class="l" for="adbWhen">Date and time</label><input type="datetime-local" id="adbWhen" style="min-height:44px;font-size:16px;border:1px solid #cfd8e0;border-radius:8px;padding:8px">
        <div class="adb-acts"><button type="button" class="btn pri" id="adbSched">Schedule — I'll approve it next</button></div>`;
    }
    const posts = P.posts || [];
    if (posts.length) h += `<h3 style="margin:12px 0 6px">Calendar</h3>${posts.map((x) => `<div class="adb-card" style="margin-bottom:8px"><b>${e(new Date(x.scheduled_at).toLocaleString())}</b>
      <span>${e(x.platforms.map((p) => PNAME[p]).join(', '))} · ${e(STATUS[x.status] || x.status)}${x.last_error ? ' — ' + e(x.last_error) : ''}</span>
      ${S.pick && S.pick.pid === x.id ? `<p style="font-size:12.5px;margin:6px 0 4px"><b>Post to which ${e({ facebook: 'Facebook Page', instagram: 'Instagram account', linkedin: 'LinkedIn page' }[S.pick.platform] || 'account')}?</b></p><div class="adb-opts">${S.pick.accounts.map((c) => `<button type="button" class="adb-opt" data-pick="${e(c.id)}">${e(c.name)}</button>`).join('')}</div>` : ''}
      <div class="r">${x.status === 'awaiting_approval' ? `<button type="button" class="btn pri acsm" data-pa="post_approve" data-pid="${e(x.id)}" data-pv="${e(x.version)}">Approve</button>` : ''}
      ${x.status === 'approved' ? `<button type="button" class="btn gh acsm" data-pa="post_pause" data-pid="${e(x.id)}" data-pv="${e(x.version)}">Pause</button>` : ''}
      ${x.status === 'paused' ? `<button type="button" class="btn gh acsm" data-pa="post_resume" data-pid="${e(x.id)}" data-pv="${e(x.version)}">Resume</button>` : ''}
      ${['draft', 'awaiting_approval', 'approved', 'paused', 'failed'].includes(x.status) ? `<button type="button" class="btn gh acsm" data-pa="post_cancel" data-pid="${e(x.id)}" data-pv="${e(x.version)}">Cancel</button>` : ''}</div></div>`).join('')}`;
    return h;
  }
  async function loadSocial() { const r = await A.api({ action: 'social_status', location_id: S.loc }); S.social = r && r.ok ? r : { platforms: [], connections: [], posts: [] }; const el = $('#adbPub'); if (el) { el.innerHTML = '<h3>Schedule &amp; publish</h3>' + pubHtml(); bindPub(); } }
  function bindPub() {
    const host = $('#adbPub'); if (!host) return;
    host.querySelectorAll('[data-conn]').forEach((b) => { b.onclick = () => {
      const box = $('#adbConsent'); if (!box) return; box.innerHTML = consentHtml(b.getAttribute('data-conn'));
      const reg = box.querySelector('.adb-consent'); if (reg) reg.focus();
      const cancel = box.querySelector('[data-consent-cancel]'); if (cancel) cancel.onclick = () => { box.innerHTML = ''; b.focus(); };
      const go = box.querySelector('[data-consent-go]'); if (go) go.onclick = async () => {
        go.disabled = true; const r = await A.api({ action: 'social_connect', location_id: S.loc, platform: go.getAttribute('data-consent-go') });
        if (r && r.ok && BEGIN_RE.test(r.url)) window.location.assign(r.url); else { go.disabled = false; say((r && r.error) || 'Not available yet.', 'err'); }
      };
    }; });
    host.querySelectorAll('[data-choose]').forEach((b) => { b.onclick = async () => { const r = await A.api({ action: 'social_connect_choose', id: b.getAttribute('data-choose') }); if (r && r.ok) { say('Connected.', 'ok'); loadSocial(); } else say((r && r.error) || 'Could not connect that account.', 'err'); }; });
    host.querySelectorAll('[data-disc]').forEach((b) => { b.onclick = async () => { if (!window.confirm('Disconnect this account? Scheduled posts to it will not publish.')) return; const r = await A.api({ action: 'social_disconnect', id: b.getAttribute('data-disc') }); if (r && r.ok) loadSocial(); else say((r && r.error) || 'Could not disconnect.', 'err'); }; });
    /* approving names the account each platform posts to; with more than one connected account the dealer chooses */
    const approve = async (pid, pv, picked) => { const r = await A.api({ action: 'post_approve', id: pid, version: pv, connections: picked });
      if (r && r.ok) { S.pick = null; say('Approved — it will publish at the scheduled time to the account you chose.', 'ok'); loadSocial(); return; }
      if (r && r.choose && Array.isArray(r.accounts)) { S.pick = { pid, pv, platform: r.choose, accounts: r.accounts, picked }; const el = $('#adbPub'); if (el) { el.innerHTML = '<h3>Schedule &amp; publish</h3>' + pubHtml(); bindPub(); } return; }
      S.pick = null; say((r && r.error) || 'Could not approve the post.', 'err'); };
    host.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { const P = S.pick; if (!P) return; approve(P.pid, P.pv, Object.assign({}, P.picked, { [P.platform]: b.getAttribute('data-pick') })); }; });
    host.querySelectorAll('[data-pa]').forEach((b) => { b.onclick = async () => { const act = b.getAttribute('data-pa'); if (act === 'post_cancel' && !window.confirm('Cancel this post?')) return;
      if (act === 'post_approve') return approve(b.getAttribute('data-pid'), Number(b.getAttribute('data-pv')), {});
      const r = await A.api({ action: act, id: b.getAttribute('data-pid'), version: Number(b.getAttribute('data-pv')) }); if (r && r.ok) { say('Updated.', 'ok'); loadSocial(); } else say((r && r.error) || 'Could not update the post.', 'err'); }; });
    const sch = host.querySelector('#adbSched'); if (sch) sch.onclick = async () => {
      if (!S.row) { say('Save the ad first, then schedule it.', 'err'); return; }
      const platforms = [...host.querySelectorAll('[data-plat]:checked')].map((i) => i.getAttribute('data-plat')); const when = host.querySelector('#adbWhen').value;
      if (!platforms.length || !when) { say('Choose where and when to post.', 'err'); return; }
      if (!(await freshCheck())) return; const cv = document.createElement('canvas'); await draw(cv);
      const r = await A.api({ action: 'post_save', ad_id: S.row.id, platforms, scheduled_at: new Date(when).toISOString(), caption: captionText(), media: cv.toDataURL('image/jpeg', 0.9) });   // JPEG keeps a story-size image under the request limit
      if (r && r.ok) { say('Scheduled. Approve it in the calendar below when you are ready — nothing posts without your approval.', 'ok'); loadSocial(); } else say((r && r.error) || 'Could not schedule.', 'err');
    };
  }

  let drawing = null, again = false;
  async function redraw() { if (drawing) { again = true; return; } const cv = $('#adbCanvas'); if (!cv) return;
    cv.setAttribute('aria-label', 'Ad preview: ' + [S.cur.headline, ...S.cur.products.map((r) => (productBy(r) || {}).name).filter(Boolean), S.cur.cta].filter(Boolean).join(' — ')); drawing = draw(cv).catch(() => {}); await drawing; drawing = null; if (again) { again = false; redraw(); } }

  async function save(asCopy) {
    if (S.busy) return; S.busy = true; say('Saving…');
    try {
      const body = { action: 'ads_save', location_id: S.loc, ad: S.cur };
      if (S.row && !asCopy) { body.id = S.row.id; body.version = S.row.version; }
      if (asCopy) body.ad = Object.assign({}, S.cur, { title: ((S.cur.title || S.cur.headline || 'Ad').slice(0, 72)) + ' (copy)' });
      const r = await A.api(body);
      if (r && r.ok) { S.row = r.row; if (asCopy) S.cur.title = body.ad.title; await refreshList(); form(); say(asCopy ? 'Saved as a new copy.' : 'Saved.', 'ok'); }
      else say((r && r.error) || 'Could not save just now.', 'err');
    } finally { S.busy = false; }
  }
  async function download(kind) {
    if (S.busy) return; S.busy = true; say('Checking the ad…');
    try {
      if (!(await freshCheck())) return;   // review #115: the export is drawn from the prices the server just confirmed
      const cv = document.createElement('canvas'); await draw(cv); redraw();
      const blob = await new Promise((res) => cv.toBlob(res, kind === 'png' ? 'image/png' : 'image/jpeg', 0.92));
      if (!blob) { say('This browser could not create the image.', 'err'); return; }
      const a = document.createElement('a'); const name = ((S.cur.title || S.cur.headline || 'hcps-ad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hcps-ad') + '-' + S.cur.format + '.' + (kind === 'png' ? 'png' : 'jpg');
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      say(`Downloaded ${name}.`, 'ok');
    } finally { S.busy = false; }
  }
  /* the server's check of the current ad; on success the products' current prices replace the ones loaded with the page */
  async function freshCheck() {
    const r = await A.api({ action: 'ads_check', location_id: S.loc, ad: S.cur });
    if (!r || !r.ok) { say((r && r.error) || 'The ad could not be checked just now — please try again.', 'err'); return false; }
    for (const p of r.products || []) { const i = S.ctx.products.findIndex((x) => keyOf(x) === keyOf(p)); if (i >= 0) S.ctx.products[i] = Object.assign({}, S.ctx.products[i], p); }
    return true;
  }
  async function openLocation(loc, keep) {
    const r = await A.api({ action: 'ads_context', location_id: loc });
    if (!r || !r.ok) { A.host.innerHTML = `<div class="ph"><div><h1>Social Ads</h1></div></div><div class="card"><div class="msg">${e((r && r.error) || 'The ad builder could not be loaded just now — please try again.')}</div></div>`; return false; }
    S.ctx = r; S.loc = r.location_id; S.images = new Map(); S.logo = null;
    if (!keep || !S.cur) { S.cur = blank(); S.row = null; }
    S.cur.products = (S.cur.products || []).filter((p) => productBy(p));
    S.social = null; shell(); list(); form(); redraw(); loadSocial(); return true;
  }
  window.HCPSAdBuilder = {
    async mount(host, deps) {
      A = { host, api: deps.api, esc: deps.esc };
      host.innerHTML = '<div class="ph"><div><h1>Social Ads</h1><div class="sub">Loading your products…</div></div></div>';
      if (await openLocation(null)) await refreshList();
    },
    _draw: draw, _state: S,
  };
})();
