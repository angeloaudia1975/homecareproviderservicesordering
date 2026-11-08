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
  const blank = () => ({ template: 'st-spotlight', layouts: null, format: 'square', font: 'Inter', colors: Object.assign({}, PRESETS[0]), title: '', headline: '', subheadline: '', body: '', features: [], captions: {}, cta: 'Visit us today', caption: '', hashtags: [],
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
  async function drawLegacy(canvas) {
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

  /* ================= SOCIAL MARKETING STUDIO — engine (Concept 3, owner 2026-11-07 18:49 CT) =================
     A design is a list of layers (elements) per size: text, product photo, price, logo, shape. Positions are fractions of the
     canvas; text sizes are pixels at a 1080-px base; colors are #RRGGBB or a brand token (bg / accent / text / onaccent …),
     so the Brand Kit recolors a whole design. Words come from the ad's fields (headline, features …), the catalog (product
     name) or the account (store name, phone) — or a text box the dealer types, which the server checks like every other word.
     Photos and prices only point at the ad's own products: a price is never typed. Older ads keep their classic drawing until
     the dealer converts them. */
  const isStudio = (c) => /^st-/.test(String((c || S.cur || {}).template || ''));
  const LEGACY_MAP = { spotlight: 'st-spotlight', classic: 'st-card', split: 'st-split-left', grid: 'st-grid', lineup: 'st-lineup', brand: 'st-message' };
  let EID = 0; const nid = () => 'e' + (Date.now() % 46656).toString(36) + (EID++).toString(36);
  const TX = (bind, x, y, w, h, o) => Object.assign({ id: nid(), type: 'text', bind, x, y, w, h, size: 40, weight: 700, color: 'text', align: 'left', valign: 'top', lh: 1.18, lines: 3, bg: 'none', radius: 0, pad: 0 }, o || {});
  const IM = (i, x, y, w, h, o) => Object.assign({ id: nid(), type: 'image', product: i, x, y, w, h, fit: 'contain', zoom: 1, ox: 0, oy: 0, bg: 'white', radius: 24, pad: 22 }, o || {});
  const SH = (shape, x, y, w, h, o) => Object.assign({ id: nid(), type: 'shape', shape, x, y, w, h, fill: 'accent', stroke: 'none', sw: 0, radius: 0 }, o || {});
  const LG = (x, y, w, h, o) => Object.assign({ id: nid(), type: 'logo', x, y, w, h, bg: 'white', radius: 14, pad: 12 }, o || {});
  const PRC = (i, x, y, w, h, o) => Object.assign({ id: nid(), type: 'price', product: i, x, y, w, h, size: 34, weight: 800, color: 'navy', align: 'center', valign: 'middle', lh: 1.1, lines: 1, bg: 'white', radius: 999, pad: 18, pill: true }, o || {});
  const CTA = (x, y, w, h, o) => TX('cta', x, y, w, h, Object.assign({ size: 32, weight: 800, color: 'onaccent', align: 'center', valign: 'middle', lines: 1, bg: 'accent', radius: 999, pad: 20, pill: true }, o || {}));
  const HEAD = (x, y, w, h, o) => TX('headline', x, y, w, h, Object.assign({ size: 76, weight: 800, lines: 3, lh: 1.08 }, o || {}));
  const SUB = (x, y, w, h, o) => TX('subheadline', x, y, w, h, Object.assign({ size: 34, weight: 600, lines: 2, lh: 1.22 }, o || {}));
  const BODY = (x, y, w, h, o) => TX('body', x, y, w, h, Object.assign({ size: 30, weight: 500, lines: 4, lh: 1.3 }, o || {}));
  const NAME = (i, x, y, w, h, o) => TX('pname' + i, x, y, w, h, Object.assign({ size: 36, weight: 700, lines: 2 }, o || {}));
  const FEATS = (x, y, w, h, n, o) => { const out = []; const fh = h / n; for (let k = 0; k < n; k++) out.push(TX('feature' + k, x, y + k * fh, w, fh * 0.92, Object.assign({ size: 30, weight: 600, lines: 1, valign: 'middle', check: true }, o || {}))); return out; };
  function geo(fmt) { const F = fmt || { w: 1080, h: 1080 }; const r = F.h / F.w, u = Math.min(F.w, F.h) / 1080;
    return { r, tall: r > 1.2, wide: r < 0.8, mx: 0.06, my: (0.06 * F.w) / F.h, hx: (p) => (p * u) / F.w, hy: (p) => (p * u) / F.h }; }
  /* the store's details along the bottom (logo, name, address, phone / link) */
  function footerEls(G, o) { o = o || {}; const fh = G.tall ? 0.09 : G.wide ? 0.18 : 0.135, y = 1 - fh, lw = G.wide ? 0.15 : G.tall ? 0.22 : 0.19, lh = fh * 0.66;
    const tx = 0.04 + lw + 0.035, tw = 1 - tx - 0.04, fg = o.fg || 'text';
    return { top: y, els: [SH('rect', 0, y, 1, fh, { fill: o.bar || 'dark', opacity: o.barOp == null ? 0.2 : o.barOp }), LG(0.04, y + (fh - lh) / 2, lw, lh),
      TX('dname', tx, y + fh * 0.1, tw, fh * 0.34, { size: 34, weight: 800, color: fg, lines: 1, valign: 'middle' }),
      TX('daddr', tx, y + fh * 0.44, tw, fh * 0.24, { size: 24, weight: 500, color: fg, lines: 1, valign: 'middle' }),
      TX('dcontact', tx, y + fh * 0.68, tw, fh * 0.24, { size: 25, weight: 600, color: fg, lines: 1, valign: 'middle' })] };
  }
  const accentBar = (G) => SH('rect', 0, 0, 1, G.hy(14), { fill: 'accent' });
  /* landscape (1.91:1) version of a stacked design: photo left, words right — keeping the template's own look */
  function wideAlt(G, o) { o = o || {}; const f = footerEls(G, o.foot), B = f.top - G.my, tx = 0.52, tw = 0.43, out = [];
    if (o.dark) out.push(SH('rect', 0, 0, 1, f.top, { fill: 'dark' }));
    if (o.panel) out.push(SH('rect', 0.48, 0, 0.52, f.top, { fill: o.panel }));
    if (o.frame) out.push(SH('rect', G.mx * 0.5, G.my * 0.5, 1 - G.mx, B - G.my * 0.5, { fill: 'none', stroke: 'accent', sw: 3, radius: 8 }));
    if (o.circle) { const ch = B - G.my, cw = ch * G.r, cx = G.mx + (0.42 - cw) / 2; out.push(SH('circle', cx - 0.015, G.my - 0.015 / G.r, cw + 0.03, ch + 0.03 / G.r, { fill: 'accent', opacity: 0.35 }), SH('circle', cx, G.my, cw, ch, { fill: 'white' }), IM(0, cx + cw * 0.12, G.my + ch * 0.12, cw * 0.76, ch * 0.76, { bg: 'none', pad: 0 })); }
    else out.push(IM(0, G.mx, G.my, 0.42, B - G.my, o.img || {}));
    if (o.logo) out.push(LG(tx, G.my, 0.22, 0.16, { pad: 10 }));
    const hy = G.my + (o.logo ? 0.19 : 0);
    out.push(HEAD(tx, hy, tw, 0.3 - (o.logo ? 0.08 : 0), Object.assign({ size: 60, lines: 3 }, o.head || {})), NAME(0, tx, hy + 0.32 - (o.logo ? 0.08 : 0), tw, 0.1, Object.assign({ size: 28, lines: 2, weight: 600 }, o.name || {})),
      PRC(0, tx, B - 0.13, 0.2, 0.12, o.price || {}), CTA(tx + 0.22, B - 0.13, 0.21, 0.12, o.cta || {}));
    return out.concat(o.logo ? f.els.filter((e) => e.type !== 'logo') : f.els); }

  /* 24 starting designs — each a function of the size and the number of products (the template's kind decides which apply) */
  const STUDIO_TPL = {
    'st-spotlight'(G) { const f = footerEls(G), B = f.top - G.my; if (G.wide) return [accentBar(G), IM(0, G.mx, G.my, 0.42, B - G.my), HEAD(0.52, G.my, 0.43, 0.24, { size: 62 }), SUB(0.52, G.my + 0.25, 0.43, 0.09, { size: 28, lines: 1 }), NAME(0, 0.52, G.my + 0.35, 0.43, 0.1, { size: 28, weight: 600 }), PRC(0, 0.52, B - 0.13, 0.2, 0.12), CTA(0.74, B - 0.13, 0.21, 0.12), ...f.els];
      const hh = G.tall ? 0.12 : 0.15, py = G.my + hh + 0.07, ph = B - py - 0.2;
      return [accentBar(G), HEAD(G.mx, G.my, 1 - 2 * G.mx, hh, { align: 'center', lines: 2 }), SUB(G.mx, G.my + hh + 0.005, 1 - 2 * G.mx, 0.06, { align: 'center', lines: 1 }), IM(0, G.mx, py, 1 - 2 * G.mx, ph), NAME(0, G.mx, py + ph + 0.015, 1 - 2 * G.mx, 0.07, { align: 'center' }), PRC(0, 0.2, B - 0.08, 0.28, 0.075), CTA(0.52, B - 0.08, 0.3, 0.075), ...f.els]; },
    'st-split-left'(G) { const f = footerEls(G), B = f.top - G.my, pw = G.tall ? 1 - 2 * G.mx : 0.46;
      if (G.tall) return [IM(0, G.mx, G.my, pw, 0.42), HEAD(G.mx, G.my + 0.45, pw, 0.12, { size: 70 }), BODY(G.mx, G.my + 0.58, pw, 0.1), ...FEATS(G.mx, G.my + 0.69, pw, 0.1, 3), CTA(G.mx, B - 0.05, 0.4, 0.05), PRC(0, 0.54, B - 0.05, 0.4, 0.05), ...f.els];
      return [SH('rect', 0, 0, 0.5, f.top, { fill: 'white' }), IM(0, 0.02, G.my, 0.46, B - G.my, { bg: 'none', pad: 10 }), HEAD(0.54, G.my, 0.41, G.wide ? 0.3 : 0.24, { size: 66 }), BODY(0.54, G.my + (G.wide ? 0.31 : 0.25), 0.41, G.wide ? 0.18 : 0.16, { size: 28 }),
        ...FEATS(0.54, G.my + (G.wide ? 0.5 : 0.42), 0.41, G.wide ? 0.0001 + 0.12 : 0.16, G.wide ? 1 : 3, { size: 26 }), PRC(0, 0.54, B - (G.wide ? 0.13 : 0.16), 0.3, G.wide ? 0.12 : 0.065, { align: 'left', pill: true }), CTA(0.54, B - (G.wide ? 0.0001 : 0.08), 0.34, G.wide ? 0.0001 : 0.07, G.wide ? { hidden: true } : {}), ...f.els]; },
    'st-split-right'(G) { return STUDIO_TPL['st-split-left'](G).map((e) => { if (G.tall || e.type === 'logo' || /^d/.test(e.bind || '') || (e.type === 'shape' && e.y > 0.6)) return e; return Object.assign(e, { x: 1 - e.x - e.w }); }); },
    'st-card'(G) { if (G.wide) return wideAlt(G, { foot: { barOp: 0.3 }, img: { bg: 'white', radius: 30 }, price: { bg: 'navy', color: 'white' } }); const f = footerEls(G, { barOp: 0 }), B = f.top - G.my * 0.6; const cx = G.mx * 0.7, cw = 1 - 2 * cx;
      return [SH('rect', cx, G.my, cw, B - G.my, { fill: 'white', radius: 36 }), IM(0, cx + 0.02, G.my + 0.015, cw - 0.04, (B - G.my) * (G.wide ? 0.55 : 0.5), { bg: 'light' }),
        HEAD(cx + 0.05, G.my + (B - G.my) * (G.wide ? 0.58 : 0.54), cw - 0.1, (B - G.my) * 0.14, { size: 54, color: 'navy', align: 'center', lines: 2 }),
        NAME(0, cx + 0.05, G.my + (B - G.my) * 0.7, cw - 0.1, (B - G.my) * 0.07, { size: 30, color: 'dark', weight: 600, align: 'center', lines: 1 }),
        BODY(cx + 0.06, G.my + (B - G.my) * 0.77, cw - 0.12, (B - G.my) * 0.1, { size: 26, color: 'dark', align: 'center', lines: 2 }),
        PRC(0, 0.22, B - (B - G.my) * 0.11, 0.27, (B - G.my) * 0.08, { bg: 'navy', color: 'white' }), CTA(0.51, B - (B - G.my) * 0.11, 0.3, (B - G.my) * 0.08), ...f.els]; },
    'st-band'(G) { if (G.wide) return wideAlt(G, { panel: 'accent', img: { bg: 'none', pad: 6 }, head: { color: 'onaccent' }, name: { color: 'onaccent' }, cta: { bg: 'white', color: 'navy' } }); const f = footerEls(G), B = f.top - G.my, bh = G.wide ? 0.34 : G.tall ? 0.2 : 0.26;
      return [SH('rect', 0, 0, 1, bh, { fill: 'accent' }), HEAD(G.mx, G.my * 0.8, 1 - 2 * G.mx, bh - G.my * 1.4, { color: 'onaccent', align: 'center', valign: 'middle', lines: 2, size: 72 }),
        IM(0, G.mx, bh + 0.03, 1 - 2 * G.mx, B - bh - 0.15, { bg: 'none', pad: 6 }), NAME(0, G.mx, B - 0.11, 0.55, 0.1, { size: 34, valign: 'middle' }), PRC(0, 0.64, B - 0.095, 0.3, 0.075), ...f.els]; },
    'st-circle'(G) { if (G.wide) return wideAlt(G, { circle: true }); const f = footerEls(G), B = f.top - G.my, d = Math.min(0.62, (B - 0.18) * G.r) ; const cw = d, ch = d / G.r, cx = (1 - cw) / 2, cy = G.my + 0.16;
      return [SH('circle', cx - 0.03, cy - 0.03 / G.r, cw + 0.06, ch + 0.06 / G.r, { fill: 'accent', opacity: 0.35 }), SH('circle', cx, cy, cw, ch, { fill: 'white' }), IM(0, cx + cw * 0.1, cy + ch * 0.1, cw * 0.8, ch * 0.8, { bg: 'none', pad: 0 }),
        HEAD(G.mx, G.my, 1 - 2 * G.mx, 0.13, { align: 'center', lines: 2, size: 70 }), NAME(0, G.mx, cy + ch + 0.02, 1 - 2 * G.mx, 0.06, { align: 'center', lines: 1 }), PRC(0, 0.2, B - 0.075, 0.28, 0.07), CTA(0.52, B - 0.075, 0.3, 0.07), ...f.els]; },
    'st-minimal'(G) { const f = footerEls(G, { fg: 'navy', bar: 'light', barOp: 1 }), B = f.top - G.my;
      return [SH('rect', 0, 0, 1, 1, { fill: 'white' }), SH('rect', G.mx, G.my, 0.12, G.hy(8), { fill: 'accent' }), HEAD(G.mx, G.my + 0.03, G.wide ? 0.45 : 1 - 2 * G.mx, G.wide ? 0.4 : 0.14, { color: 'navy', size: 64, lines: 3 }),
        IM(0, G.wide ? 0.5 : G.mx, G.wide ? G.my : G.my + 0.2, G.wide ? 0.44 : 1 - 2 * G.mx, G.wide ? B - G.my : B - G.my - 0.33, { bg: 'none' }), NAME(0, G.mx, B - 0.11, G.wide ? 0.42 : 0.6, 0.06, { color: 'dark', size: 30, weight: 600, lines: 1 }),
        PRC(0, G.mx, B - 0.045, 0.26, 0.05, { bg: 'none', align: 'left', color: 'accent', pill: false, pad: 0 }), TX('cta', G.wide ? G.mx : 0.6, G.wide ? B - 0.2 : B - 0.105, 0.34, 0.05, { size: 28, color: 'accent', weight: 800, align: G.wide ? 'left' : 'right', lines: 1, upper: true }), ...f.els]; },
    'st-magazine'(G) { const f = footerEls(G), B = f.top - G.my;
      if (G.tall) return [HEAD(G.mx, G.my, 1 - 2 * G.mx, 0.2, { size: 104, lines: 3, lh: 0.98 }), SH('rect', G.mx, G.my + 0.215, 0.2, G.hy(10), { fill: 'accent' }), IM(0, G.mx, G.my + 0.24, 1 - 2 * G.mx, 0.38, { bg: 'none' }), BODY(G.mx, G.my + 0.64, 1 - 2 * G.mx, 0.12), CTA(G.mx, B - 0.055, 0.44, 0.05), ...f.els];
      return [HEAD(G.mx, G.my, 0.44, B - G.my - 0.2, { size: 96, lines: 4, lh: 0.98, valign: 'bottom' }), SH('rect', G.mx, B - 0.18, 0.16, G.hy(10), { fill: 'accent' }), BODY(G.mx, B - 0.16, 0.44, 0.11, { size: 26, lines: 3 }), CTA(G.mx, B - 0.045, 0.3, 0.05, { align: 'left', size: 26 }),
        IM(0, 0.53, G.my, 0.41, B - G.my, { bg: 'white', radius: 0 }), ...f.els]; },
    'st-features'(G) { const f = footerEls(G), B = f.top - G.my;
      if (G.wide) return [IM(0, G.mx, G.my, 0.4, B - G.my), HEAD(0.5, G.my, 0.45, 0.22, { size: 58, lines: 2 }), ...FEATS(0.5, G.my + 0.24, 0.45, 0.36, 3, { size: 28 }), CTA(0.5, B - 0.12, 0.3, 0.11), ...f.els];
      return [HEAD(G.mx, G.my, 1 - 2 * G.mx, 0.12, { size: 66, lines: 2, align: 'center' }), IM(0, 0.2, G.my + 0.14, 0.6, (B - G.my) * (G.tall ? 0.42 : 0.4)), ...FEATS(0.12, G.my + 0.16 + (B - G.my) * (G.tall ? 0.42 : 0.4), 0.76, (B - G.my) * 0.26, 3, { size: 32 }),
        PRC(0, 0.2, B - 0.07, 0.28, 0.065), CTA(0.52, B - 0.07, 0.3, 0.065), ...f.els]; },
    'st-price'(G) { const f = footerEls(G), B = f.top - G.my;
      return [SH('rect', 0, 0, 1, f.top, { fill: 'bg' }), SH('circle', G.wide ? 0.62 : 0.55, G.wide ? -0.25 : -0.12, G.wide ? 0.6 : 0.6, G.wide ? 0.9 : 0.6 / G.r, { fill: 'accent', opacity: 0.18 }),
        IM(0, G.wide ? G.mx : 0.12, G.wide ? G.my : G.my + 0.04, G.wide ? 0.44 : 0.76, G.wide ? B - G.my : (B - G.my) * 0.5, { bg: 'none' }),
        NAME(0, G.wide ? 0.54 : G.mx, G.wide ? G.my + 0.04 : G.my + 0.06 + (B - G.my) * 0.5, G.wide ? 0.41 : 1 - 2 * G.mx, 0.1, { align: G.wide ? 'left' : 'center', size: 40, lines: 2 }),
        PRC(0, G.wide ? 0.54 : 0.2, G.wide ? G.my + 0.2 : B - 0.2, G.wide ? 0.4 : 0.6, G.wide ? 0.2 : 0.11, { size: 70, bg: 'accent', color: 'onaccent' }),
        HEAD(G.wide ? 0.54 : G.mx, G.wide ? G.my + 0.43 : B - 0.08, G.wide ? 0.41 : 1 - 2 * G.mx, G.wide ? 0.2 : 0.07, { size: 34, weight: 700, align: G.wide ? 'left' : 'center', lines: 2 }), ...f.els]; },
    'st-showroom'(G) { const f = footerEls(G, { bar: 'accent', barOp: 0.95, fg: 'onaccent' }), B = f.top - G.my;
      return [TX('custom', G.mx, G.my, 1 - 2 * G.mx, 0.05, { text: 'Visit our showroom', size: 28, weight: 800, color: 'accent', upper: true, align: G.wide ? 'left' : 'center', lines: 1 }),
        HEAD(G.mx, G.my + 0.055, G.wide ? 0.46 : 1 - 2 * G.mx, G.wide ? 0.32 : 0.13, { size: 68, lines: 3, align: G.wide ? 'left' : 'center' }),
        IM(0, G.wide ? 0.54 : G.mx, G.wide ? G.my : G.my + 0.2, G.wide ? 0.4 : 1 - 2 * G.mx, G.wide ? B - G.my : B - G.my - 0.3, { bg: 'white' }),
        TX('daddr', G.mx, B - (G.wide ? 0.24 : 0.09), G.wide ? 0.44 : 1 - 2 * G.mx, 0.06, { size: 32, weight: 700, align: G.wide ? 'left' : 'center', lines: 1 }),
        TX('dphone', G.mx, B - (G.wide ? 0.15 : 0.035), G.wide ? 0.44 : 1 - 2 * G.mx, 0.05, { size: 30, weight: 600, color: 'accent', align: G.wide ? 'left' : 'center', lines: 1 }), ...f.els]; },
    'st-warm'(G) { if (G.wide) return wideAlt(G, { foot: { bar: 'white', barOp: 0.6, fg: 'navy' }, img: { radius: 200, pad: 26 }, head: { font: 'Georgia', weight: 700 }, price: { hidden: true } }); const f = footerEls(G, { bar: 'white', barOp: 0.6, fg: 'navy' }), B = f.top - G.my;
      return [SH('circle', -0.25, -0.2 / G.r, 0.7, 0.7 / G.r, { fill: 'accent', opacity: 0.16 }), SH('circle', 0.7, 0.55, 0.5, 0.5 / G.r, { fill: 'accent', opacity: 0.12 }),
        HEAD(G.mx, G.my, 1 - 2 * G.mx, G.tall ? 0.12 : 0.15, { size: 70, align: 'center', lines: 2, font: 'Georgia', weight: 700 }), SUB(G.mx + 0.05, G.my + (G.tall ? 0.125 : 0.155), 1 - 2 * G.mx - 0.1, 0.06, { align: 'center', italic: true, lines: 2 }),
        IM(0, 0.14, G.my + (G.tall ? 0.2 : 0.23), 0.72, B - G.my - (G.tall ? 0.3 : 0.33), { radius: 200, pad: 30 }), CTA(0.3, B - 0.075, 0.4, 0.07), ...f.els]; },
    'st-frame'(G) { if (G.wide) return wideAlt(G, { frame: true, img: { bg: 'none' }, head: { align: 'left' } }); const f = footerEls(G), B = f.top - G.my, t = G.hx(16), tv = G.hy(16);
      return [SH('rect', G.mx * 0.6, G.my * 0.6, 0.22, tv, { fill: 'accent' }), SH('rect', G.mx * 0.6, G.my * 0.6, t, 0.22 / G.r, { fill: 'accent' }), SH('rect', 1 - G.mx * 0.6 - 0.22, B + G.my * 0.4 - tv, 0.22, tv, { fill: 'accent' }), SH('rect', 1 - G.mx * 0.6 - t, B + G.my * 0.4 - 0.22 / G.r, t, 0.22 / G.r, { fill: 'accent' }),
        HEAD(G.mx + 0.03, G.my + 0.03, 1 - 2 * G.mx - 0.06, G.tall ? 0.12 : 0.15, { size: 66, align: 'center', lines: 2 }), IM(0, G.mx + 0.05, G.my + (G.tall ? 0.17 : 0.2), 1 - 2 * G.mx - 0.1, B - G.my - (G.tall ? 0.3 : 0.35), { bg: 'none' }),
        NAME(0, G.mx + 0.03, B - 0.13, 1 - 2 * G.mx - 0.06, 0.055, { align: 'center', lines: 1 }), PRC(0, 0.3, B - 0.07, 0.4, 0.06), ...f.els]; },
    'st-question'(G) { const f = footerEls(G), B = f.top - G.my;
      if (G.wide) return [TX('headline', G.mx, G.my, 0.5, 0.32, { size: 78, weight: 900, lines: 3, color: 'accent' }), BODY(G.mx, G.my + 0.33, 0.5, 0.15, { size: 28, lines: 2 }), CTA(G.mx, B - 0.12, 0.3, 0.11, { align: 'left' }), IM(0, 0.6, G.my, 0.34, B - G.my), ...f.els];
      return [TX('headline', G.mx, G.my, G.wide ? 0.5 : 1 - 2 * G.mx, G.wide ? 0.42 : 0.2, { size: 84, weight: 900, lines: 3, color: 'accent' }), BODY(G.mx, G.my + (G.wide ? 0.44 : 0.21), G.wide ? 0.5 : 1 - 2 * G.mx, G.wide ? 0.2 : 0.11, { size: 32 }),
        IM(0, G.wide ? 0.58 : 0.18, G.wide ? G.my : G.my + 0.34, G.wide ? 0.36 : 0.64, G.wide ? B - G.my : B - G.my - 0.44), NAME(0, G.mx, B - 0.08, G.wide ? 0.5 : 0.56, 0.07, { size: 30, valign: 'middle' }), CTA(G.wide ? G.mx : 0.62, G.wide ? B - 0.18 : B - 0.07, 0.32, 0.065), ...f.els]; },
    'st-premium'(G) { if (G.wide) return wideAlt(G, { dark: true, frame: true, foot: { bar: 'accent', barOp: 0.9, fg: 'onaccent' }, img: { bg: 'none' }, head: { color: 'white', font: 'Georgia' }, name: { color: 'white', upper: true }, price: { bg: 'accent', color: 'onaccent' }, cta: { hidden: true } }); const f = footerEls(G, { bar: 'accent', barOp: 0.9, fg: 'onaccent' }), B = f.top - G.my;
      return [SH('rect', 0, 0, 1, f.top, { fill: 'dark' }), SH('rect', G.mx, G.my, 1 - 2 * G.mx, B - G.my, { fill: 'none', stroke: 'accent', sw: 3, radius: 8 }),
        TX('headline', G.mx + 0.04, G.my + 0.03, 1 - 2 * G.mx - 0.08, G.tall ? 0.12 : 0.14, { size: 64, color: 'white', align: 'center', lines: 2, font: 'Georgia' }),
        IM(0, G.mx + 0.06, G.my + (G.tall ? 0.17 : 0.2), 1 - 2 * G.mx - 0.12, B - G.my - (G.tall ? 0.31 : 0.36), { bg: 'none' }),
        NAME(0, G.mx + 0.04, B - 0.12, 1 - 2 * G.mx - 0.08, 0.05, { color: 'white', align: 'center', lines: 1, upper: true, size: 28, weight: 700 }), PRC(0, 0.32, B - 0.065, 0.36, 0.05, { bg: 'accent', color: 'onaccent' }), ...f.els]; },
    'st-stacked'(G) { if (G.wide) return wideAlt(G, { panel: 'accent', img: { bg: 'white', radius: 30 }, head: { color: 'onaccent' }, name: { color: 'onaccent' }, price: { bg: 'navy', color: 'white' }, cta: { bg: 'white', color: 'navy' } }); const f = footerEls(G), B = f.top - G.my, cy = G.tall ? 0.36 : 0.32;
      return [SH('rect', 0, 0, 1, cy + 0.08, { fill: 'accent', opacity: 0.85 }), HEAD(G.mx, G.my, 1 - 2 * G.mx, cy - G.my - 0.02, { color: 'onaccent', align: 'center', valign: 'middle', size: 70, lines: 2 }),
        SH('rect', G.mx + 0.03, cy, 1 - 2 * G.mx - 0.06, B - cy, { fill: 'white', radius: 32 }), IM(0, G.mx + 0.06, cy + 0.02, 1 - 2 * G.mx - 0.12, (B - cy) * 0.66, { bg: 'none' }),
        NAME(0, G.mx + 0.06, cy + (B - cy) * 0.7, 1 - 2 * G.mx - 0.12, (B - cy) * 0.12, { color: 'navy', align: 'center', lines: 2, size: 32 }), PRC(0, 0.24, B - (B - cy) * 0.15, 0.24, (B - cy) * 0.11, { bg: 'navy', color: 'white' }), CTA(0.5, B - (B - cy) * 0.15, 0.28, (B - cy) * 0.11), ...f.els]; },
    'st-banner'(G) { const f = footerEls(G, { barOp: 0.35 }), bh = G.wide ? 0.3 : 0.24, by = f.top - bh;
      return [SH('rect', 0, 0, 1, by, { fill: 'white' }), IM(0, G.mx, G.my, 1 - 2 * G.mx, by - G.my - 0.02, { bg: 'none' }), SH('rect', 0, by, 1, bh, { fill: 'accent' }),
        HEAD(G.mx, by + bh * 0.08, 0.6, bh * 0.56, { color: 'onaccent', size: 54, lines: 2, valign: 'middle' }), TX('pname0', G.mx, by + bh * 0.64, 0.6, bh * 0.28, { size: 26, color: 'onaccent', weight: 600, lines: 1 }),
        PRC(0, 0.68, by + bh * 0.16, 0.27, bh * 0.3), TX('cta', 0.68, by + bh * 0.54, 0.27, bh * 0.3, { size: 26, color: 'onaccent', weight: 800, align: 'center', valign: 'middle', lines: 1, upper: true, bg: 'none' }), ...f.els]; },
    'st-logo-hero'(G) { if (G.wide) return wideAlt(G, { logo: true }); const f = footerEls(G), B = f.top - G.my;
      return [LG(0.28, G.my, 0.44, G.tall ? 0.09 : 0.14, { pad: 16 }), HEAD(G.mx, G.my + (G.tall ? 0.11 : 0.16), 1 - 2 * G.mx, 0.1, { size: 56, align: 'center', lines: 2 }),
        IM(0, G.mx, G.my + (G.tall ? 0.22 : 0.28), 1 - 2 * G.mx, B - G.my - (G.tall ? 0.31 : 0.38)), NAME(0, G.mx, B - 0.08, 0.56, 0.07, { valign: 'middle', size: 30 }), CTA(0.62, B - 0.075, 0.32, 0.065), ...f.els.filter((e) => e.type !== 'logo')]; },
    /* several products */
    'st-grid'(G, n) { const f = footerEls(G), B = f.top - G.my, top = G.my + (G.wide ? 0.22 : 0.14), cols = G.tall && n <= 2 ? 1 : G.wide ? n : 2, rows = Math.ceil(n / cols), gx = 0.03, gy = 0.025;
      const cw = (1 - 2 * G.mx - gx * (cols - 1)) / cols, ch = (B - 0.09 - top - gy * (rows - 1)) / rows; const out = [HEAD(G.mx, G.my, 1 - 2 * G.mx, top - G.my - 0.01, { align: 'center', lines: 2, size: 64 })];
      for (let i = 0; i < n; i++) { const x = G.mx + (i % cols) * (cw + gx), y = top + Math.floor(i / cols) * (ch + gy); out.push(IM(i, x, y, cw, ch * 0.74), NAME(i, x, y + ch * 0.76, cw, ch * 0.13, { size: 24, align: 'center', lines: 2 }), PRC(i, x + cw * 0.18, y + ch * 0.89, cw * 0.64, ch * 0.11, { size: 22, pad: 10 })); }
      return out.concat([CTA(0.3, B - 0.07, 0.4, 0.065)], f.els); },
    'st-lineup'(G, n) { const f = footerEls(G), B = f.top - G.my, top = G.my + (G.wide ? 0.24 : 0.15), vert = G.tall, gx = 0.03;
      const out = [HEAD(G.mx, G.my, 1 - 2 * G.mx, top - G.my - 0.01, { align: 'center', lines: 2, size: 64 })];
      for (let i = 0; i < n; i++) { if (vert) { const ch = (B - 0.09 - top) / n; const y = top + i * ch; out.push(IM(i, G.mx, y, 0.42, ch * 0.92), NAME(i, 0.52, y + ch * 0.2, 0.42, ch * 0.4, { size: 30 }), PRC(i, 0.52, y + ch * 0.62, 0.3, ch * 0.22, { size: 24 })); }
        else { const cw = (1 - 2 * G.mx - gx * (n - 1)) / n, x = G.mx + i * (cw + gx), ch = B - 0.09 - top; out.push(IM(i, x, top, cw, ch * 0.7), NAME(i, x, top + ch * 0.72, cw, ch * 0.16, { size: 24, align: 'center', lines: 2 }), PRC(i, x + cw * 0.12, top + ch * 0.89, cw * 0.76, ch * 0.11, { size: 22, pad: 10 })); } }
      return out.concat([CTA(0.3, B - 0.07, 0.4, 0.065)], f.els); },
    'st-duo'(G, n) { const f = footerEls(G, { barOp: 0.3 }), B = f.top - G.my, top = G.my + 0.16; const out = [SH('rect', 0.495, top, G.hx(6), B - top - 0.1, { fill: 'accent', opacity: 0.6 }), HEAD(G.mx, G.my, 1 - 2 * G.mx, 0.14, { align: 'center', lines: 2, size: 60 })];
      for (let i = 0; i < Math.min(2, n); i++) { const x = i ? 0.52 : G.mx, w = 0.48 - G.mx; out.push(IM(i, x, top, w, (B - top) * 0.62, { bg: 'none' }), NAME(i, x, top + (B - top) * 0.64, w, (B - top) * 0.14, { size: 28, align: 'center', lines: 2 }), PRC(i, x + w * 0.15, top + (B - top) * 0.8, w * 0.7, (B - top) * 0.1, { size: 24 })); }
      return out.concat(f.els); },
    'st-mosaic'(G, n) { const f = footerEls(G), B = f.top - G.my, top = G.my + 0.15, out = [HEAD(G.mx, G.my, 1 - 2 * G.mx, 0.13, { align: 'center', lines: 2, size: 60 })];
      const big = G.wide ? { x: G.mx, y: top, w: 0.5, h: B - top } : { x: G.mx, y: top, w: 1 - 2 * G.mx, h: (B - top) * 0.55 };
      out.push(IM(0, big.x, big.y, big.w, big.h, { bg: 'white' }), PRC(0, big.x + 0.02, big.y + 0.02, 0.26, 0.06, { size: 24, pad: 10 }));
      for (let i = 1; i < n; i++) { const k = i - 1, m = Math.max(1, n - 1); const x = G.wide ? 0.6 : G.mx + k * ((1 - 2 * G.mx) / m), y = G.wide ? top + k * ((B - top) / m) : top + (B - top) * 0.58, w = G.wide ? 1 - 0.6 - G.mx : (1 - 2 * G.mx) / m - 0.02, h = G.wide ? (B - top) / m - 0.02 : (B - top) * 0.3;
        out.push(IM(i, x, y, w, h * 0.78), NAME(i, x, y + h * 0.8, w, h * 0.2, { size: 22, align: 'center', lines: 1 })); }
      return out.concat([CTA(0.3, B - 0.06, 0.4, 0.055)], f.els); },
    /* no product */
    'st-message'(G) { if (G.wide) { const f = footerEls(G), B = f.top - G.my; return [SH('circle', 0.62, -0.3, 0.6, 1.1, { fill: 'accent', opacity: 0.18 }), LG(G.mx, G.my + 0.1, 0.3, 0.36, { pad: 18 }), HEAD(0.42, G.my, 0.52, 0.34, { size: 72, lines: 3, valign: 'middle' }), BODY(0.42, G.my + 0.36, 0.52, 0.14, { size: 28, lines: 2 }), CTA(0.42, B - 0.12, 0.3, 0.11), ...f.els.filter((e) => e.type !== 'logo')]; }
      const f = footerEls(G), B = f.top - G.my;
      return [SH('circle', 0.6, -0.15, 0.7, 0.7 / G.r, { fill: 'accent', opacity: 0.18 }), LG(0.3, G.my + (G.tall ? 0.08 : 0.04), 0.4, G.tall ? 0.1 : 0.16, { pad: 16 }), HEAD(G.mx, G.my + (G.tall ? 0.22 : 0.24), 1 - 2 * G.mx, G.tall ? 0.2 : 0.24, { align: 'center', size: 88, lines: 3, valign: 'middle' }),
        BODY(G.mx + 0.04, G.my + (G.tall ? 0.44 : 0.5), 1 - 2 * G.mx - 0.08, 0.14, { align: 'center', size: 32 }), CTA(0.28, B - 0.09, 0.44, 0.08), ...f.els.filter((e) => e.type !== 'logo')]; },
    'st-contact'(G) { const f = footerEls(G, { barOp: 0 }), B = f.top - G.my;
      return [SH('rect', G.mx, G.my, 1 - 2 * G.mx, B - G.my, { fill: 'white', radius: 32 }), LG(G.mx + 0.05, G.my + 0.04, 0.34, G.tall ? 0.08 : 0.13, { bg: 'none', pad: 0 }),
        HEAD(G.mx + 0.05, G.my + (G.tall ? 0.15 : 0.2), 1 - 2 * G.mx - 0.1, 0.16, { color: 'navy', size: 64, lines: 3 }), BODY(G.mx + 0.05, G.my + (G.tall ? 0.32 : 0.37), 1 - 2 * G.mx - 0.1, 0.12, { color: 'dark', size: 30 }),
        TX('dphone', G.mx + 0.05, B - (G.tall ? 0.2 : 0.27), 1 - 2 * G.mx - 0.1, 0.07, { size: 52, weight: 800, color: 'accent', lines: 1 }), TX('daddr', G.mx + 0.05, B - (G.tall ? 0.12 : 0.17), 1 - 2 * G.mx - 0.1, 0.05, { size: 30, color: 'dark', weight: 600, lines: 2 }),
        TX('dweb', G.mx + 0.05, B - (G.tall ? 0.06 : 0.09), 1 - 2 * G.mx - 0.1, 0.045, { size: 26, color: 'navy', weight: 600, lines: 1 }), ...f.els.filter((e) => e.type === 'shape')]; },
  };
  /* a fresh layout for a template and size (the photo / price / name layers follow the ad's products) */
  function buildLayout(tpl, fmtKey, n) {
    const fn = STUDIO_TPL[tpl] || STUDIO_TPL['st-spotlight']; const G = geo((S.ctx && S.ctx.formats[fmtKey]) || { w: 1080, h: 1080 });
    return fn(G, Math.max(0, Math.min(4, n == null ? 1 : n))).filter((e) => e && !(e.w < 0.002 || e.h < 0.002) && !e.hidden).map((e) => Object.assign({}, e, { id: nid() }));
  }
  /* the layers of the size on screen — made from the template the first time a size is opened */
  function layoutOf(cur, fmtKey, keep) {
    cur = cur || S.cur; fmtKey = fmtKey || cur.format;
    if (cur.layouts && Array.isArray(cur.layouts[fmtKey])) return cur.layouts[fmtKey];
    const L = buildLayout(cur.template, fmtKey, cur.products.length);
    if (keep !== false) { cur.layouts = Object.assign({}, cur.layouts || {}); cur.layouts[fmtKey] = L; }
    return L;
  }

  /* ---------- rendering ---------- */
  function onColor(hex) { const n = parseInt(String(hex || '#000000').slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b1f33' : '#ffffff'; }
  function tok(v, cur) { const c = (cur || S.cur).colors || {}; switch (v) {
    case 'bg': return c.bg || '#0b1f33'; case 'accent': return c.accent || '#ef6325'; case 'text': return c.text || onColor(c.bg || '#0b1f33'); case 'onaccent': return onColor(c.accent || '#ef6325');
    case 'white': return '#ffffff'; case 'navy': return '#0b1f33'; case 'dark': return '#111827'; case 'light': return '#f1f4f7'; case 'none': case null: case undefined: return null; default: return /^#[0-9a-f]{6}$/i.test(v) ? v : null; } }
  function textOf(el, cur) {
    cur = cur || S.cur; const d = (S.ctx && S.ctx.dealer) || {}, sh = cur.show || {}; let t = '';
    const b = el.bind || '', prodAt = (i) => { const r = cur.products[i]; return r ? productBy(r) : null; };
    if (b === 'custom') t = el.text || '';
    else if (b === 'headline' || b === 'subheadline' || b === 'body' || b === 'cta') t = cur[b] || '';
    else if (/^feature\d$/.test(b)) { const f = (cur.features || [])[Number(b.slice(7))]; t = f ? (el.check !== false ? '✓ ' : '') + f : ''; }
    else if (/^pname\d$/.test(b)) { const p = prodAt(Number(b.slice(5))); t = p ? p.name : ''; }
    else if (b === 'dname') t = sh.name !== false ? d.name || '' : '';
    else if (b === 'dphone') t = sh.phone !== false ? d.phone || '' : '';
    else if (b === 'daddr') t = sh.address !== false ? [d.address, [d.city, d.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';
    else if (b === 'dweb') t = sh.website !== false ? String(d.link || d.website || '').replace(/^https?:\/\//, '') : '';
    else if (b === 'dcontact') t = [sh.phone !== false ? d.phone : '', sh.website !== false ? String(d.link || d.website || '').replace(/^https?:\/\//, '') : ''].filter(Boolean).join('  ·  ');
    return el.upper ? t.toUpperCase() : t;
  }
  function priceOf(el, cur) { cur = cur || S.cur; const r = cur.products[el.product]; const p = r && productBy(r); if (!p || (cur.show && cur.show.price === false)) return ''; return priceText(p, r.show_price !== false) || ''; }
  function fitText(ctx, text, el, W, H, u, cur) {
    const w = el.w * W, h = el.h * H, pad = (el.pad || 0) * u; const fam = FONT_STACK[el.font || (cur || S.cur).font] || FONT_STACK.Inter;
    let size = el.size * u, lines; const min = Math.max(8, Math.min(size, 14 * u));
    for (;;) { ctx.font = `${el.italic ? 'italic ' : ''}${el.weight || 700} ${size}px ${fam}`; lines = wrap(ctx, text, Math.max(10, w - 2 * pad), 99);
      if ((lines.length <= el.lines && lines.length * size * (el.lh || 1.18) <= h - (el.pill ? 0 : 2 * pad) + 0.5) || size <= min) break; size = Math.max(min, size * 0.93); }
    lines = wrap(ctx, text, Math.max(10, w - 2 * pad), el.lines || 1); return { size, lines, pad, lh: size * (el.lh || 1.18), w, h };
  }
  function drawEl(ctx, el, W, H, u, cur, imgs, logo) {
    const x = el.x * W, y = el.y * H, w = el.w * W, h = el.h * H;
    ctx.save(); ctx.globalAlpha = el.opacity == null ? 1 : el.opacity;
    if (el.type === 'shape') {
      const fill = tok(el.fill, cur), stroke = tok(el.stroke, cur);
      if (el.shape === 'circle') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); }
      else rrect(ctx, x, y, w, h, Math.min((el.radius || 0) * u, Math.abs(w) / 2, Math.abs(h) / 2));
      if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke && el.sw) { ctx.lineWidth = el.sw * u; ctx.strokeStyle = stroke; ctx.stroke(); }
    } else if (el.type === 'image' || el.type === 'logo') {
      const img = el.type === 'logo' ? logo : imgs[el.product]; const bg = tok(el.bg, cur), rad = Math.min((el.radius || 0) * u, w / 2, h / 2), pad = (el.pad || 0) * u;
      if (el.type === 'logo' && !img) { ctx.restore(); return; }
      if (el.shadow || (bg && el.type === 'image')) { ctx.save(); ctx.shadowColor = 'rgba(11,31,51,0.18)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 8 * u; }
      rrect(ctx, x, y, w, h, rad); if (bg) { ctx.fillStyle = bg; ctx.fill(); }
      if (el.shadow || (bg && el.type === 'image')) ctx.restore();
      ctx.save(); rrect(ctx, x, y, w, h, rad); ctx.clip();
      if (img) { const aw = w - 2 * pad, ah = h - 2 * pad; let k = el.fit === 'cover' ? Math.max(aw / img.width, ah / img.height) : Math.min(aw / img.width, ah / img.height); k *= el.zoom || 1;
        const iw = img.width * k, ih = img.height * k, sx = Math.max(0, (iw - aw) / 2), sy = Math.max(0, (ih - ah) / 2);
        ctx.drawImage(img, x + pad + (aw - iw) / 2 - (el.ox || 0) * sx, y + pad + (ah - ih) / 2 - (el.oy || 0) * sy, iw, ih); }
      else if (el.type === 'image') { ctx.fillStyle = '#e8edf2'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#7a8794'; ctx.font = `600 ${Math.round(24 * u)}px ${FONT_STACK.Inter}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Photo coming soon', x + w / 2, y + h / 2); }
      ctx.restore();
    } else {
      const text = el.type === 'price' ? priceOf(el, cur) : textOf(el, cur); if (!text) { ctx.restore(); return; }
      const m = fitText(ctx, text, el, W, H, u, cur); const bg = tok(el.bg, cur), th = m.lines.length * m.lh;
      let ty = el.valign === 'middle' ? y + (h - th) / 2 : el.valign === 'bottom' ? y + h - th - m.pad : y + (el.pill ? (h - th) / 2 : m.pad);
      if (bg) { if (el.pill) { const tw = Math.max(...m.lines.map((l) => ctx.measureText(l).width)) + 2 * Math.max(m.pad, 14 * u); const ph = Math.max(h, th + 10 * u);
          const px = el.align === 'center' ? x + (w - tw) / 2 : el.align === 'right' ? x + w - tw : x; rrect(ctx, px, y + (h - ph) / 2, tw, ph, Math.min((el.radius || 999) * u, ph / 2)); ctx.fillStyle = bg; ctx.fill(); }
        else { rrect(ctx, x, y, w, h, Math.min((el.radius || 0) * u, w / 2, h / 2)); ctx.fillStyle = bg; ctx.fill(); } }
      ctx.fillStyle = tok(el.color, cur) || '#000000'; ctx.textBaseline = 'top'; ctx.textAlign = el.align || 'left';
      const ix = el.align === 'center' ? x + w / 2 : el.align === 'right' ? x + w - (el.pill ? Math.max(m.pad, 14 * u) : m.pad) : x + (el.pill ? Math.max(m.pad, 14 * u) : m.pad);
      m.lines.forEach((l, i) => ctx.fillText(l, ix, ty + i * m.lh + (m.lh - m.size) / 2));
    }
    ctx.restore();
  }
  /* draws the design; k = scale (thumbnails); cur = which ad (Creative Director previews, campaign) */
  async function drawStudio(canvas, cur, k) {
    cur = cur || S.cur; const F = (S.ctx && S.ctx.formats[cur.format]) || { w: 1080, h: 1080 }; k = k || 1;
    const W = F.w, H = F.h, u = Math.min(W, H) / 1080; canvas.width = Math.round(W * k); canvas.height = Math.round(H * k);
    const ctx = canvas.getContext('2d'); ctx.setTransform(k, 0, 0, k, 0, 0);
    const els = layoutOf(cur, cur.format, cur === S.cur);
    const usesLogo = els.some((e) => e.type === 'logo' && !e.hidden) && cur.show && cur.show.logo !== false;
    const prods = cur.products.map((r) => productBy(r));
    const [logo, ...imgs] = await Promise.all([usesLogo ? logoImage() : null, ...prods.map((p) => (p ? productImage(p) : null))]);
    ctx.fillStyle = tok('bg', cur); ctx.fillRect(0, 0, W, H);
    for (const el of els) if (!el.hidden) drawEl(ctx, el, W, H, u, cur, imgs, logo);
  }
  /* every draw goes through here: studio designs by their layers, older ads exactly as they were made */
  async function draw(canvas, cur, k) { if (isStudio(cur || S.cur)) return drawStudio(canvas, cur, k);
    if (cur && cur !== S.cur) { const keep = S.cur; S.cur = cur; try { return await drawLegacy(canvas); } finally { S.cur = keep; } } return drawLegacy(canvas); }

  /* ================= SOCIAL MARKETING STUDIO — editor ================= */
  const CSS = `
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
  @media(max-width:980px){.adb input[type=text],.adb textarea,.adb select{font-size:16px;min-height:44px}}
  .sms{--sms-line:#dfe5ea;--sms-ink:#0b1f33;--sms-mut:#5b6773;--sms-acc:#ef6325}
  .sms-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:0 0 10px}
  .sms-saved{margin:0 0 12px}.sms-saved>summary{cursor:pointer;font-weight:800;color:var(--sms-ink);min-height:44px;display:flex;align-items:center}
  .sms-wrap{display:grid;grid-template-columns:76px minmax(280px,340px) minmax(0,1fr);gap:0;border:1px solid var(--sms-line);border-radius:16px;background:#f6f8fa;overflow:hidden;min-height:640px}
  .sms-rail{background:#0b1f33;display:flex;flex-direction:column;gap:2px;padding:8px 6px}
  .sms-rail button{background:none;border:0;color:#c8d3de;border-radius:10px;padding:8px 2px;font:inherit;font-size:11px;font-weight:700;cursor:pointer;min-height:56px;display:flex;flex-direction:column;align-items:center;gap:3px}
  .sms-rail button svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8}
  .sms-rail button[aria-pressed=true]{background:#1a3654;color:#fff}.sms-rail button:hover{color:#fff}
  .sms-panel{background:#fff;border-right:1px solid var(--sms-line);padding:14px;overflow:auto;max-height:860px}
  .sms-panel h3{margin:2px 0 10px;font-size:16px;color:var(--sms-ink)} .sms-panel h4{margin:14px 0 6px;font-size:13px;color:var(--sms-ink)}
  .sms-stagecol{display:flex;flex-direction:column;min-width:0}
  .sms-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#fff;border-bottom:1px solid var(--sms-line)}
  .sms-bar .grp{display:flex;gap:4px;align-items:center;padding-right:8px;margin-right:2px;border-right:1px solid #eef2f5}
  .sms-bar .grp:last-child{border-right:0}
  .sms-ib{border:1px solid var(--sms-line);background:#fff;border-radius:8px;min-width:40px;min-height:40px;padding:0 8px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;color:var(--sms-ink);display:inline-flex;align-items:center;justify-content:center;gap:4px}
  .sms-ib:disabled{opacity:.4;cursor:default}.sms-ib[aria-pressed=true]{border-color:var(--sms-acc);background:#fff4ec}
  .sms-ib svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8}
  .sms-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:18px;min-height:520px;background:repeating-conic-gradient(#eef1f4 0 25%,#f6f8fa 0 50%) 0 0/24px 24px}
  .sms-cv{position:relative;display:inline-block;line-height:0;box-shadow:0 10px 34px rgba(11,31,51,.2);border-radius:6px;outline:none}
  .sms-cv:focus-visible{outline:3px solid #fcb21e;outline-offset:3px}
  .sms-cv canvas{display:block;max-width:100%;max-height:72vh;width:auto;height:auto;border-radius:6px;background:#e8edf2}
  .sms-ov{position:absolute;inset:0;touch-action:none;cursor:default}
  .sms-sel{position:absolute;border:2px solid #1681c2;box-shadow:0 0 0 1px #fff;pointer-events:none}
  .sms-sel.lock{border-style:dashed;border-color:#7a8794}
  .sms-h{position:absolute;width:14px;height:14px;background:#fff;border:2px solid #1681c2;border-radius:3px;pointer-events:auto;touch-action:none}
  .sms-h[data-h=nw]{left:-8px;top:-8px;cursor:nwse-resize}.sms-h[data-h=ne]{right:-8px;top:-8px;cursor:nesw-resize}.sms-h[data-h=sw]{left:-8px;bottom:-8px;cursor:nesw-resize}.sms-h[data-h=se]{right:-8px;bottom:-8px;cursor:nwse-resize}
  .sms-h[data-h=n]{left:calc(50% - 7px);top:-8px;cursor:ns-resize}.sms-h[data-h=s]{left:calc(50% - 7px);bottom:-8px;cursor:ns-resize}.sms-h[data-h=w]{top:calc(50% - 7px);left:-8px;cursor:ew-resize}.sms-h[data-h=e]{top:calc(50% - 7px);right:-8px;cursor:ew-resize}
  @media (pointer:coarse){.sms-h{width:22px;height:22px}.sms-h[data-h=nw],.sms-h[data-h=sw],.sms-h[data-h=w]{left:-12px}.sms-h[data-h=ne],.sms-h[data-h=se],.sms-h[data-h=e]{right:-12px}.sms-h[data-h=nw],.sms-h[data-h=ne],.sms-h[data-h=n]{top:-12px}.sms-h[data-h=sw],.sms-h[data-h=se],.sms-h[data-h=s]{bottom:-12px}}
  .sms-guide{position:absolute;background:#ef6325;pointer-events:none}
  .sms-hover{position:absolute;border:1px dashed #1681c2;pointer-events:none}
  .sms-drop{outline:3px dashed #1681c2;outline-offset:6px}
  .sms-legacy{position:absolute;left:10px;right:10px;bottom:10px;line-height:1.4;background:rgba(11,31,51,.92);color:#fff;border-radius:10px;padding:10px 12px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .sms-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;background:#fff;border-top:1px solid var(--sms-line)}
  .sms-foot .btn{min-height:44px}
  .sms-tpls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .sms-tpl{border:2px solid transparent;border-radius:10px;background:#f3f6f8;padding:6px;cursor:pointer;font:inherit;text-align:center;min-height:44px}
  .sms-tpl canvas{width:100%;height:auto;display:block;border-radius:6px;background:#e8edf2}
  .sms-tpl span{display:block;font-size:12px;font-weight:700;margin-top:5px;color:var(--sms-ink)}
  .sms-tpl[aria-pressed=true]{border-color:var(--sms-acc)}
  .sms-els{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .sms-el{border:1px solid var(--sms-line);background:#fff;border-radius:10px;min-height:64px;font:inherit;font-size:12px;font-weight:700;color:var(--sms-ink);cursor:grab;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px}
  .sms-el svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.7}
  .sms-el:active{cursor:grabbing}
  .sms-layers{list-style:none;margin:0;padding:0}
  .sms-layers li{display:flex;align-items:center;gap:4px;border:1px solid var(--sms-line);border-radius:8px;margin:0 0 5px;background:#fff}
  .sms-layers li.on{border-color:#1681c2;background:#f0f7fd}
  .sms-layers .nm{flex:1;min-width:0;text-align:left;background:none;border:0;font:inherit;font-size:13px;padding:8px;cursor:pointer;min-height:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sms-layers .sms-ib{min-width:34px;min-height:34px;border:0}
  .sms-insp{border:1px solid #bfd6ee;background:#f3f8fd;border-radius:12px;padding:10px 12px;margin:0 0 12px}
  .sms-insp h4{margin:0 0 6px}
  .sms-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}
  .sms-row label{font-size:12px;font-weight:700;color:var(--sms-mut);min-width:64px}
  .sms-row input[type=range]{flex:1;min-width:120px;min-height:32px}
  .sms-row select,.sms-row input[type=number]{border:1px solid #cfd8e0;border-radius:8px;padding:6px 8px;font:inherit;font-size:14px;min-height:38px}
  .sms-row input[type=number]{width:74px}
  .sms-sw{display:flex;gap:5px;flex-wrap:wrap}.sms-sw button{width:30px;height:30px;border-radius:8px;border:2px solid #fff;box-shadow:0 0 0 1px #cfd8e0;cursor:pointer;padding:0}
  .sms-sw button[aria-pressed=true]{box-shadow:0 0 0 2px #ef6325}
  .sms-sw input[type=color]{width:34px;height:32px;border:0;padding:0;background:none}
  .sms-brand{display:flex;gap:10px;align-items:center;border:1px solid var(--sms-line);border-radius:12px;padding:10px;background:#fff}
  .sms-brand .lg{width:96px;height:56px;display:flex;align-items:center;justify-content:center;background:#f3f6f8;border-radius:8px;font-size:11px;color:var(--sms-mut);text-align:center}
  .sms-brand img{max-width:96px;max-height:56px}
  .sms-cd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
  .sms-cd div{border:1px solid var(--sms-line);border-radius:10px;padding:6px;background:#fff;text-align:center;font-size:12px}
  .sms-cd canvas{width:100%;height:auto;display:block;border-radius:6px}
  .sms-cd .btn{min-height:40px;width:100%;margin-top:6px}
  .sms .adb-sec{margin-bottom:10px}
  @media(max-width:980px){
    .sms-wrap{grid-template-columns:minmax(0,1fr);min-height:0}
    .sms-rail{flex-direction:row;overflow-x:auto;padding:6px;order:0}.sms-rail button{min-width:64px;min-height:52px}
    .sms-stagecol{order:1}.sms-panel{order:2;border-right:0;border-top:1px solid var(--sms-line);max-height:none}
    .sms-stage{padding:10px;min-height:0}.sms-cv canvas{max-height:60vh}
    .sms-row input[type=number],.sms-row select{font-size:16px}
  }`;
  const ICON = {
    tpl: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    prod: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    el: '<circle cx="7" cy="7" r="4"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M14 3l7 0M3 17l7 4"/>',
    brand: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-2 2.5-2H18a3 3 0 003-3c0-4.5-4-8.5-9-8.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    ai: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', post: '<path d="M4 4h16v12H8l-4 4z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', rect: '<rect x="4" y="6" width="16" height="12" rx="2"/>', circle: '<circle cx="12" cy="12" r="8"/>', line: '<path d="M4 12h16"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', price: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    logo: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>', pill: '<rect x="3" y="8" width="18" height="8" rx="4"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const TABS = [['tpl', 'Templates'], ['prod', 'Products'], ['text', 'Text'], ['el', 'Elements'], ['brand', 'Brand Kit'], ['ai', 'AI Director'], ['layers', 'Layers'], ['post', 'Caption & post']];
  const ED = { tab: 'tpl', sel: null, hist: [], fut: [], drag: null, guides: [], thumbs: 0 };
  const deep = (o) => JSON.parse(JSON.stringify(o));
  const els = () => (isStudio() ? layoutOf() : []);
  const selEl = () => els().find((x) => x.id === ED.sel) || null;
  /* undo / redo: whole-design snapshots (cheap — a design is a few KB) */
  function snap() { ED.hist.push(deep(S.cur)); if (ED.hist.length > 80) ED.hist.shift(); ED.fut = []; toolbar(); }
  function undo() { if (!ED.hist.length) return; ED.fut.push(deep(S.cur)); S.cur = ED.hist.pop(); if (ED.sel && !selEl()) ED.sel = null; form(); redraw(); }
  function redo() { if (!ED.fut.length) return; ED.hist.push(deep(S.cur)); S.cur = ED.fut.pop(); if (ED.sel && !selEl()) ED.sel = null; form(); redraw(); }
  const LABEL = { headline: 'Headline', subheadline: 'Subheadline', body: 'Message', cta: 'Call to action', dname: 'Store name', dphone: 'Phone', daddr: 'Address', dweb: 'Website', dcontact: 'Phone · website', custom: 'Text' };
  function elName(e) { if (e.type === 'text') { const b = e.bind || ''; if (/^feature/.test(b)) return 'Feature ' + (Number(b.slice(7)) + 1); if (/^pname/.test(b)) return 'Product name ' + (Number(b.slice(5)) + 1);
      return (LABEL[b] || 'Text') + (b === 'custom' ? ': ' + String(e.text || '').slice(0, 22) : ''); }
    if (e.type === 'image') { const r = S.cur.products[e.product]; const p = r && productBy(r); return 'Photo — ' + (p ? p.name : 'product ' + (e.product + 1)); }
    if (e.type === 'price') return 'Price — product ' + (e.product + 1); if (e.type === 'logo') return 'Your logo'; return { rect: 'Rectangle', circle: 'Circle', line: 'Line' }[e.shape] || 'Shape'; }

  function shell() {
    const c = S.ctx;
    A.host.innerHTML = `<style>${CSS}</style><div class="sms adb">
      <div class="ph"><div><h1>Social Marketing Studio</h1><div class="sub">Design Facebook, Instagram and LinkedIn ads on the canvas — your authorized products, official photos, your brand. Prices come from your catalog automatically.</div></div>
        <div><button type="button" class="btn pri" id="adbNew">+ New design</button></div></div>
      ${c.preview ? '<div class="card"><div class="msg">HCPS read-only preview — designs can be made and downloaded but not saved.</div></div>' : ''}
      ${c.blocked ? '<div class="card"><div class="msg">HCPS has paused public marketing for this location — please contact HCPS.</div></div>' : ''}
      <div id="adbList"></div>
      <div class="sms-wrap">
        <nav class="sms-rail" aria-label="Studio tools">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${ED.tab === k}">${svg(k)}${e(l)}</button>`).join('')}</nav>
        <div class="sms-panel" id="adbForm"></div>
        <div class="sms-stagecol"><div class="sms-bar" id="smsBar"></div>
          <div class="sms-stage" id="smsStage"><div class="sms-cv" id="smsCv" tabindex="0" aria-label="Design canvas — select a layer, drag to move, arrow keys to nudge">
            <canvas id="adbCanvas" role="img" aria-label="Ad preview"></canvas><div class="sms-ov" id="smsOv"></div></div></div>
          <div class="sms-foot"><button type="button" class="btn pri" id="adbSave">Save</button><button type="button" class="btn gh" id="adbDup">Save as a copy</button>
            <button type="button" class="btn gh" id="adbPng">⬇ PNG</button><button type="button" class="btn gh" id="adbJpg">⬇ JPEG</button><button type="button" class="btn gh" id="adbCopy">Copy caption</button>
            <div class="adb-msg" id="adbMsg" role="status" style="flex-basis:100%"></div></div></div></div></div>`;
    A.host.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { ED.tab = b.getAttribute('data-tab'); A.host.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); form(); }; });
    $('#adbNew').onclick = () => { S.cur = blank(); applyBrand(S.cur); S.row = null; S.problems = []; S.suggestions = null; S.aiResult = null; S.history = []; S.campaign = null; ED.sel = null; ED.hist = []; ED.fut = []; form(); redraw(); say(''); };
    $('#adbSave').onclick = () => save(false); $('#adbDup').onclick = () => save(true);
    $('#adbPng').onclick = () => download('png'); $('#adbJpg').onclick = () => download('jpeg');
    $('#adbCopy').onclick = async () => { if (!(await freshCheck())) return; const t = captionText(); try { await navigator.clipboard.writeText(t); say('Caption copied.', 'ok'); } catch (x) { say('Copy did not work in this browser — select the caption text instead.', 'err'); } };
    bindStage();
  }
  const captionText = () => [S.cur.caption, S.cur.hashtags.map((h) => '#' + h).join(' ')].filter(Boolean).join('\n\n');
  /* the saved feature list has no gaps: a cleared middle feature closes up, and the feature boxes are re-pointed so each
     keeps showing its own words after reopening (review) */
  function compactFeatures(cur) {
    const f = cur.features || [], map = {}; let n = 0; const kept = [];
    f.forEach((v, i) => { if (String(v).trim()) { map[i] = n++; kept.push(v); } });
    if (kept.length === f.length) return; let spare = n; f.forEach((v, i) => { if (!(i in map)) map[i] = Math.min(3, spare++); });
    cur.features = kept;
    for (const els of Object.values(cur.layouts || {})) for (const x of els) if (x.type === 'text' && /^feature\d$/.test(x.bind || '')) { const i = Number(x.bind.slice(7)); if (i in map) x.bind = 'feature' + map[i]; }
  }
  function say(m, cls) { const el = $('#adbMsg'); if (el) { el.textContent = m || ''; el.className = 'adb-msg' + (cls ? ' ' + cls : ''); } }
  /* the Brand Kit: the storefront's colors (or HCPS navy / orange) — the text color always readable on the background */
  function applyBrand(cur) { const b = (S.ctx && S.ctx.brand) || { primary: '#0b1f33', accent: '#ef6325' }; cur.colors = { bg: b.primary, accent: b.accent, text: onColor(b.primary) }; }

  /* ---------- toolbar above the canvas ---------- */
  function toolbar() {
    const host = $('#smsBar'); if (!host) return; const c = S.ctx, x = selEl(), st = isStudio();
    host.innerHTML = `<div class="grp" role="group" aria-label="Size">${Object.entries(c.formats).map(([k, f]) => `<button type="button" class="sms-ib" data-fmt="${e(k)}" aria-pressed="${S.cur.format === k}" title="${e(f.label)}">${e(f.label.split(' ')[0])}</button>`).join('')}</div>
      <div class="grp"><button type="button" class="sms-ib" id="smsUndo" aria-label="Undo" title="Undo (Ctrl+Z)"${ED.hist.length ? '' : ' disabled'}>${svg('undo')}</button><button type="button" class="sms-ib" id="smsRedo" aria-label="Redo" title="Redo (Ctrl+Y)"${ED.fut.length ? '' : ' disabled'}>${svg('redo')}</button></div>
      ${st ? `<div class="grp" role="group" aria-label="Align selected">${[['l', 'Align left', '⟸'], ['c', 'Center horizontally', '↔'], ['r', 'Align right', '⟹'], ['t', 'Align top', '⇑'], ['m', 'Center vertically', '↕'], ['b', 'Align bottom', '⇓']].map(([k, l, g]) => `<button type="button" class="sms-ib" data-al="${k}" aria-label="${l}" title="${l}"${x ? '' : ' disabled'}>${g}</button>`).join('')}</div>
      <div class="grp"><button type="button" class="sms-ib" data-z="1" aria-label="Bring forward" title="Bring forward"${x ? '' : ' disabled'}>${svg('up')}</button><button type="button" class="sms-ib" data-z="-1" aria-label="Send backward" title="Send backward"${x ? '' : ' disabled'}>${svg('down')}</button>
        <button type="button" class="sms-ib" id="smsDupEl" aria-label="Duplicate layer" title="Duplicate (Ctrl+D)"${x ? '' : ' disabled'}>${svg('dup')}</button><button type="button" class="sms-ib" id="smsDel" aria-label="Delete layer" title="Delete"${x ? '' : ' disabled'}>${svg('del')}</button></div>
      <div class="grp"><button type="button" class="sms-ib" id="smsAll4" title="Make the other sizes from this design's template">All 4 sizes</button><button type="button" class="sms-ib" id="smsReset" title="Start this size again from the template">Reset size</button></div>` : ''}`;
    host.querySelectorAll('[data-fmt]').forEach((b) => { b.onclick = () => { snap(); S.cur.format = b.getAttribute('data-fmt'); ED.sel = null; form(); redraw(); }; });
    const u = host.querySelector('#smsUndo'); if (u) u.onclick = undo; const r = host.querySelector('#smsRedo'); if (r) r.onclick = redo;
    host.querySelectorAll('[data-al]').forEach((b) => { b.onclick = () => { const el = selEl(); if (!el || el.locked) return; snap(); const k = b.getAttribute('data-al');
      if (k === 'l') el.x = 0.05; if (k === 'c') el.x = (1 - el.w) / 2; if (k === 'r') el.x = 0.95 - el.w; if (k === 't') el.y = 0.04; if (k === 'm') el.y = (1 - el.h) / 2; if (k === 'b') el.y = 0.96 - el.h; redraw(); }; });
    host.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => zMove(Number(b.getAttribute('data-z'))); });
    const d = host.querySelector('#smsDupEl'); if (d) d.onclick = dupEl; const dl = host.querySelector('#smsDel'); if (dl) dl.onclick = delEl;
    const a4 = host.querySelector('#smsAll4'); if (a4) a4.onclick = () => { snap(); for (const k of Object.keys(c.formats)) layoutOf(S.cur, k); say('All four sizes are ready — switch sizes above to check and adjust each one.', 'ok'); };
    const rs = host.querySelector('#smsReset'); if (rs) rs.onclick = () => { snap(); S.cur.layouts = Object.assign({}, S.cur.layouts); delete S.cur.layouts[S.cur.format]; ED.sel = null; form(); redraw(); };
  }
  function zMove(d) { const L = els(), i = L.findIndex((x) => x.id === ED.sel); if (i < 0) return; const j = Math.max(0, Math.min(L.length - 1, i + d)); if (j === i) return; snap(); const [x] = L.splice(i, 1); L.splice(j, 0, x); form(); redraw(); }
  function dupEl() { const L = els(), x = selEl(); if (!x) return; if (L.length >= 40) { say('A design can hold up to 40 layers.', 'err'); return; } snap(); const c = Object.assign(deep(x), { id: nid(), x: Math.min(0.95, x.x + 0.03), y: Math.min(0.95, x.y + 0.03), locked: false }); L.splice(L.indexOf(x) + 1, 0, c); ED.sel = c.id; form(); redraw(); }
  function delEl() { const L = els(), i = L.findIndex((x) => x.id === ED.sel); if (i < 0) return; snap(); L.splice(i, 1); ED.sel = null; form(); redraw(); }

  /* ---------- the canvas: select, move, resize, snap to guides; drop new elements ---------- */
  function cvScale() { const cv = $('#adbCanvas'); const F = S.ctx.formats[S.cur.format]; return cv && cv.clientWidth ? { k: cv.clientWidth / F.w, W: F.w, H: F.h, cw: cv.clientWidth, ch: cv.clientHeight } : null; }
  function overlay() {
    const ov = $('#smsOv'); if (!ov) return; const sc = cvScale(); toolbar();
    if (!isStudio()) { if (ov.querySelector('#smsConvert')) return;   // already showing — re-rendering would swallow a tap on it
      ov.innerHTML = S.ctx.can_edit && !S.ctx.preview ? `<div class="sms-legacy">This ad uses a classic layout. <button type="button" class="btn pri acsm" id="smsConvert">Open in the Studio to edit on the canvas</button></div>` : ''; const cb = ov.querySelector('#smsConvert'); if (cb) cb.onclick = convertLegacy; return; }
    if (!sc) return; const x = selEl();
    let h = ED.guides.map((g) => g.v ? `<div class="sms-guide" style="left:${g.p * sc.cw - 1}px;top:0;width:2px;height:100%"></div>` : `<div class="sms-guide" style="top:${g.p * sc.ch - 1}px;left:0;height:2px;width:100%"></div>`).join('');
    if (x && !x.hidden) h += `<div class="sms-sel${x.locked ? ' lock' : ''}" style="left:${x.x * sc.cw}px;top:${x.y * sc.ch}px;width:${x.w * sc.cw}px;height:${x.h * sc.ch}px">${x.locked ? '' : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((k) => `<span class="sms-h" data-h="${k}"></span>`).join('')}</div>`;
    ov.innerHTML = h;
  }
  function convertLegacy() { snap(); S.cur.template = LEGACY_MAP[S.cur.template] || 'st-spotlight'; S.cur.layouts = null; ED.sel = null; form(); redraw(); say('Now in the Studio — drag, resize and restyle anything on the canvas. Save to keep it.', 'ok'); }
  function hit(fx, fy) { const L = els(); for (let i = L.length - 1; i >= 0; i--) { const x = L[i]; if (x.hidden) continue; if (fx >= x.x && fx <= x.x + x.w && fy >= x.y && fy <= x.y + x.h) return x; } return null; }
  function bindStage() {
    const ov = $('#smsOv'), cvw = $('#smsCv'), stage = $('#smsStage'); if (!ov) return;
    const pos = (ev) => { const r = ov.getBoundingClientRect(); return { fx: (ev.clientX - r.left) / r.width, fy: (ev.clientY - r.top) / r.height }; };
    ov.addEventListener('pointerdown', (ev) => {
      if (!isStudio() || S.ctx.preview && false) return; const p = pos(ev); const handle = ev.target.closest && ev.target.closest('[data-h]');
      let el = handle ? selEl() : hit(p.fx, p.fy);
      if (!el) { ED.sel = null; overlay(); form(); return; }
      if (ED.sel !== el.id) { ED.sel = el.id; form(); }
      if (el.locked) { overlay(); return; }
      ED.drag = { id: el.id, h: handle ? handle.getAttribute('data-h') : null, sx: p.fx, sy: p.fy, o: { x: el.x, y: el.y, w: el.w, h: el.h }, moved: false, before: deep(S.cur) };
      ov.setPointerCapture(ev.pointerId); ev.preventDefault(); overlay(); cvw.focus({ preventScroll: true });
    });
    ov.addEventListener('pointermove', (ev) => {
      const D = ED.drag; if (!D) return; const el = selEl(); if (!el) return; const p = pos(ev); let dx = p.fx - D.sx, dy = p.fy - D.sy; if (!D.moved && Math.abs(dx) + Math.abs(dy) < 0.003) return; D.moved = true; ED.guides = [];
      if (!D.h) { let nx = D.o.x + dx, ny = D.o.y + dy; const SN = 0.012;
        const cx = nx + el.w / 2, cy = ny + el.h / 2;
        if (Math.abs(cx - 0.5) < SN) { nx = 0.5 - el.w / 2; ED.guides.push({ v: true, p: 0.5 }); } else if (Math.abs(nx - 0.06) < SN) { nx = 0.06; ED.guides.push({ v: true, p: 0.06 }); } else if (Math.abs(nx + el.w - 0.94) < SN) { nx = 0.94 - el.w; ED.guides.push({ v: true, p: 0.94 }); }
        if (Math.abs(cy - 0.5) < SN) { ny = 0.5 - el.h / 2; ED.guides.push({ v: false, p: 0.5 }); }
        el.x = Math.min(1.2, Math.max(-0.2, nx)); el.y = Math.min(1.2, Math.max(-0.2, ny)); }
      else { const o = D.o, h = D.h, MIN = 0.02; let x = o.x, y = o.y, w = o.w, hh = o.h;
        if (h.includes('e')) w = Math.max(MIN, o.w + dx); if (h.includes('s')) hh = Math.max(MIN, o.h + dy);
        if (h.includes('w')) { w = Math.max(MIN, o.w - dx); x = o.x + o.w - w; } if (h.includes('n')) { hh = Math.max(MIN, o.h - dy); y = o.y + o.h - hh; }
        if (ev.shiftKey && h.length === 2) { const ratio = o.w / o.h; if (w / hh > ratio) w = hh * ratio; else hh = w / ratio; if (h.includes('w')) x = o.x + o.w - w; if (h.includes('n')) y = o.y + o.h - hh; }
        Object.assign(el, { x, y, w, h: hh }); }
      overlay(); redraw();
    });
    const end = () => { const D = ED.drag; ED.drag = null; ED.guides = []; if (D && D.moved) { ED.hist.push(D.before); if (ED.hist.length > 80) ED.hist.shift(); ED.fut = []; form(); } overlay(); };
    ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
    ov.addEventListener('dblclick', () => { const x = selEl(); if (x && x.type === 'text') { const t = A.host.querySelector('#smsTxt'); if (t) t.focus(); } });
    cvw.addEventListener('keydown', (ev) => {
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
      if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); return; }
      const el = selEl(); if (!el) return;
      if (mod && ev.key.toLowerCase() === 'd') { ev.preventDefault(); dupEl(); return; }
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); delEl(); return; }
      if (ev.key === 'Escape') { ED.sel = null; form(); overlay(); return; }
      const st = ev.shiftKey ? 0.02 : 0.004, mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[ev.key];
      if (mv && !el.locked) { ev.preventDefault(); if (!ev.repeat) snap(); el.x += mv[0]; el.y += mv[1]; overlay(); redraw(); }
    });
    /* drag an element from the Elements panel onto the canvas */
    stage.addEventListener('dragover', (ev) => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('text/x-sms')) { ev.preventDefault(); cvw.classList.add('sms-drop'); } });
    stage.addEventListener('dragleave', () => cvw.classList.remove('sms-drop'));
    stage.addEventListener('drop', (ev) => { cvw.classList.remove('sms-drop'); const k = ev.dataTransfer && ev.dataTransfer.getData('text/x-sms'); if (!k) return; ev.preventDefault(); const r = ov.getBoundingClientRect(); addEl(k, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height); });
    if (window.ResizeObserver) new ResizeObserver(() => overlay()).observe(cvw);
  }
  /* new layers (from the Elements panel: click, or drag onto the canvas) */
  const ADDS = {
    heading: () => TX('custom', 0, 0, 0.6, 0.1, { text: 'Your headline', size: 64, weight: 800, lines: 2 }), text: () => TX('custom', 0, 0, 0.5, 0.08, { text: 'Add your text', size: 32, weight: 500, lines: 3 }),
    badge: () => TX('custom', 0, 0, 0.3, 0.06, { text: 'In stock locally', size: 26, weight: 800, color: 'onaccent', bg: 'accent', pill: true, align: 'center', valign: 'middle', lines: 1, pad: 16 }),
    cta: () => CTA(0, 0, 0.32, 0.07), rect: () => SH('rect', 0, 0, 0.3, 0.2, { radius: 18 }), circle: () => SH('circle', 0, 0, 0.25, 0.25), line: () => SH('rect', 0, 0, 0.4, 0.006),
    photo: () => (S.cur.products.length ? IM(0, 0, 0, 0.4, 0.4) : null), price: () => (S.cur.products.length ? PRC(0, 0, 0, 0.28, 0.07) : null), logo: () => LG(0, 0, 0.24, 0.12),
    phone: () => TX('dphone', 0, 0, 0.45, 0.06, { size: 34, weight: 800, lines: 1 }), address: () => TX('daddr', 0, 0, 0.6, 0.05, { size: 26, weight: 600, lines: 2 }), feature: () => TX('feature0', 0, 0, 0.6, 0.05, { size: 30, weight: 600, lines: 1 }),
  };
  function addEl(k, fx, fy) {
    if (!isStudio()) { say('Open this ad in the Studio first.', 'err'); return; } const L = els(); if (L.length >= 40) { say('A design can hold up to 40 layers.', 'err'); return; }
    const mk = ADDS[k]; const el = mk && mk(); if (!el) { say('Choose a product first (Products).', 'err'); return; }
    if (k === 'line') el.h = 0.006 * (S.ctx.formats[S.cur.format].w / S.ctx.formats[S.cur.format].h);
    if (k === 'circle') el.h = el.w * (S.ctx.formats[S.cur.format].w / S.ctx.formats[S.cur.format].h);
    snap(); el.x = Math.min(0.95 - el.w, Math.max(0.03, (fx == null ? 0.5 : fx) - el.w / 2)); el.y = Math.min(0.95 - el.h, Math.max(0.03, (fy == null ? 0.45 : fy) - el.h / 2));
    L.push(el); ED.sel = el.id; form(); redraw();
  }

  /* ---------- inspector: the selected layer ---------- */
  const COLOR_TOKENS = [['bg', 'Background'], ['accent', 'Accent'], ['text', 'Text'], ['white', 'White'], ['navy', 'Navy'], ['dark', 'Dark'], ['light', 'Light']];
  function swatches(name, val, allowNone) {
    const opts = (allowNone ? [['none', 'None']] : []).concat(COLOR_TOKENS);
    return `<div class="sms-sw">${opts.map(([k, l]) => `<button type="button" data-${name}="${k}" aria-pressed="${val === k}" title="${l}" aria-label="${l}" style="background:${k === 'none' ? 'repeating-linear-gradient(45deg,#fff 0 4px,#e3e8ee 4px 8px)' : tok(k)}"></button>`).join('')}
      <input type="color" data-${name}c aria-label="Custom color" value="${e(/^#[0-9a-f]{6}$/i.test(val || '') ? val : tok(val) || '#ffffff')}"></div>`;
  }
  function inspHtml() {
    const x = selEl(); if (!x) return '<div class="sms-insp"><h4>Nothing selected</h4><div style="font-size:12.5px;color:#5b6773">Tap a layer on the canvas to move, resize or restyle it. Ctrl+Z undoes.</div></div>';
    const c = S.ctx, words = ['headline', 'subheadline', 'body', 'cta'];
    let h = `<div class="sms-insp" id="smsInsp"><h4>${e(elName(x))}</h4>`;
    if (x.type === 'text') {
      if (x.bind === 'custom') h += `<label class="l" for="smsTxt">Text</label><input type="text" id="smsTxt" maxlength="160" value="${e(x.text || '')}"><div class="warn" id="wTxt"></div>`;
      else if (words.includes(x.bind)) h += x.bind === 'cta' ? `<label class="l" for="smsTxt">Call to action</label><select id="smsTxt">${['', ...c.ctas].map((t) => `<option${t === S.cur.cta ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>`
        : `<label class="l" for="smsTxt">${e(LABEL[x.bind])} (the ad's ${e(LABEL[x.bind].toLowerCase())})</label><input type="text" id="smsTxt" maxlength="${x.bind === 'body' ? c.limits.body : x.bind === 'subheadline' ? (c.limits.subheadline || 100) : c.limits.headline}" value="${e(S.cur[x.bind] || '')}"><div class="warn" id="wTxt"></div>`;
      else if (/^feature/.test(x.bind)) { const i = Number(x.bind.slice(7)); h += `<label class="l" for="smsTxt">Feature ${i + 1} (from the product's facts)</label><input type="text" id="smsTxt" maxlength="${c.limits.feature || 90}" value="${e((S.cur.features || [])[i] || '')}"><div class="warn" id="wTxt"></div>`; }
      else h += `<div style="font-size:12.5px;color:#5b6773;margin:0 0 6px">${/^pname/.test(x.bind) ? 'The product\'s name from your catalog.' : 'From your account — change it in Account or My Storefront.'}</div>`;
    }
    if (x.type === 'text' || x.type === 'price') h += `<div class="sms-row"><label for="smsFont">Font</label><select id="smsFont"><option value="">Design font</option>${c.fonts.map((f) => `<option${f === x.font ? ' selected' : ''}>${e(f)}</option>`).join('')}</select></div>
      <div class="sms-row"><label for="smsSize">Size</label><input type="range" id="smsSize" min="12" max="200" value="${Math.round(x.size)}"><input type="number" id="smsSizeN" min="12" max="200" value="${Math.round(x.size)}" aria-label="Font size"></div>
      <div class="sms-row"><label>Style</label><button type="button" class="sms-ib" data-tog="bold" aria-pressed="${x.weight >= 700}" aria-label="Bold"><b>B</b></button><button type="button" class="sms-ib" data-tog="italic" aria-pressed="${!!x.italic}" aria-label="Italic"><i>I</i></button><button type="button" class="sms-ib" data-tog="upper" aria-pressed="${!!x.upper}" aria-label="Capitals">AA</button>
        ${['left', 'center', 'right'].map((a) => `<button type="button" class="sms-ib" data-align="${a}" aria-pressed="${x.align === a}" aria-label="Align ${a}">${{ left: '⇤', center: '≡', right: '⇥' }[a]}</button>`).join('')}</div>
      <div class="sms-row"><label>Color</label>${swatches('tc', x.color)}</div><div class="sms-row"><label>Highlight</label>${swatches('tb', x.bg, true)}<button type="button" class="sms-ib" data-tog="pill" aria-pressed="${!!x.pill}" aria-label="Rounded label">Pill</button></div>
      <div class="sms-row"><label for="smsLines">Max lines</label><input type="number" id="smsLines" min="1" max="12" value="${x.lines || 1}"></div>`;
    if (x.type === 'image' || x.type === 'price') { const opts = S.cur.products.map((r, i) => { const p = productBy(r); return `<option value="${i}"${x.product === i ? ' selected' : ''}>${e(p ? p.name : 'Product ' + (i + 1))}</option>`; }).join('');
      h += `<div class="sms-row"><label for="smsProd">Product</label><select id="smsProd" style="flex:1;min-width:0">${opts}</select></div>`; }
    if (x.type === 'image') h += `<div class="sms-row"><label>Fit</label><button type="button" class="sms-ib" data-fit="contain" aria-pressed="${x.fit !== 'cover'}">Whole photo</button><button type="button" class="sms-ib" data-fit="cover" aria-pressed="${x.fit === 'cover'}">Fill frame</button></div>
      <div class="sms-row"><label for="smsZoom">Crop zoom</label><input type="range" id="smsZoom" min="1" max="4" step="0.05" value="${x.zoom || 1}"></div>
      <div class="sms-row"><label for="smsOx">Pan ↔</label><input type="range" id="smsOx" min="-1" max="1" step="0.02" value="${x.ox || 0}"></div><div class="sms-row"><label for="smsOy">Pan ↕</label><input type="range" id="smsOy" min="-1" max="1" step="0.02" value="${x.oy || 0}"></div>
      <div class="sms-row"><label>Frame</label>${swatches('ib', x.bg, true)}</div><div class="sms-row"><label for="smsRad">Corners</label><input type="range" id="smsRad" min="0" max="300" value="${x.radius || 0}"></div>`;
    if (x.type === 'logo') h += `<div class="sms-row"><label>Backing</label>${swatches('ib', x.bg, true)}</div><div class="sms-row"><label for="smsRad">Corners</label><input type="range" id="smsRad" min="0" max="200" value="${x.radius || 0}"></div>${c.dealer.has_logo ? '' : '<div class="warn">Add your logo in Account to show it.</div>'}`;
    if (x.type === 'shape') h += `<div class="sms-row"><label>Fill</label>${swatches('sf', x.fill, true)}</div><div class="sms-row"><label>Outline</label>${swatches('ss', x.stroke, true)}<input type="number" id="smsSw" min="0" max="40" value="${x.sw || 0}" aria-label="Outline width"></div>
      ${x.shape === 'rect' ? `<div class="sms-row"><label for="smsRad">Corners</label><input type="range" id="smsRad" min="0" max="600" value="${x.radius || 0}"></div>` : ''}`;
    h += `<div class="sms-row"><label for="smsOp">Opacity</label><input type="range" id="smsOp" min="0.05" max="1" step="0.05" value="${x.opacity == null ? 1 : x.opacity}"></div>
      <div class="sms-row"><label>Position</label>${['x', 'y', 'w', 'h'].map((k) => `<input type="number" data-geo="${k}" step="1" value="${Math.round(x[k] * 100)}" aria-label="${{ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[k]} %" title="${{ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[k]} (%)">`).join('')}</div>
      <div class="sms-row"><button type="button" class="sms-ib" data-tog="locked" aria-pressed="${!!x.locked}">${x.locked ? '🔒 Locked' : 'Lock'}</button><button type="button" class="sms-ib" data-tog="hidden" aria-pressed="${!!x.hidden}">${x.hidden ? 'Hidden' : 'Hide'}</button></div></div>`;
    return h;
  }
  function bindInsp(host) {
    const x = selEl(); if (!x) return; const c = S.ctx;
    const names = S.cur.products.map((r) => productBy(r)).filter(Boolean); const allow = [c.dealer.name, c.dealer.city].concat(...names.map((p) => [p.name, p.category, p.brand]));
    let typed = false; const once = () => { if (!typed) { snap(); typed = true; } };
    const ch = (f) => (ev) => { once(); f(ev); redraw(); };
    const t = host.querySelector('#smsTxt');
    if (t) { if (t.tagName === 'SELECT') t.onchange = ch(() => { S.cur.cta = t.value; });
      else t.oninput = ch(() => { const v = t.value; if (x.bind === 'custom') x.text = v; else if (/^feature/.test(x.bind)) { const i = Number(x.bind.slice(7)); const f = (S.cur.features || []).slice(); const filled = f.filter((s) => String(s).trim()).length;
          /* the saved list has no gaps — a box past the filled features keeps its words as its own text box (review) */
          if (i > filled && i >= f.length) { x.bind = 'custom'; x.text = v; } else { while (f.length <= i) f.push(''); f[i] = v; S.cur.features = f; } } else S.cur[x.bind] = v;
        const w = warnWords(v, allow), wt = host.querySelector('#wTxt'); if (wt) wt.textContent = w ? `"${w}" can't be used in an ad (prices, discounts, offers or claims).` : ''; }); }
    const f = host.querySelector('#smsFont'); if (f) f.onchange = ch(() => { x.font = f.value || null; });
    const sz = host.querySelector('#smsSize'), szn = host.querySelector('#smsSizeN');
    if (sz) sz.oninput = ch(() => { x.size = Number(sz.value); szn.value = sz.value; }); if (szn) szn.onchange = ch(() => { x.size = Math.max(12, Math.min(200, Number(szn.value) || x.size)); sz.value = x.size; });
    host.querySelectorAll('[data-tog]').forEach((b) => { b.onclick = () => { snap(); const k = b.getAttribute('data-tog'); if (k === 'bold') x.weight = x.weight >= 700 ? 500 : 800; else x[k] = !x[k]; form(); redraw(); }; });
    host.querySelectorAll('[data-align]').forEach((b) => { b.onclick = () => { snap(); x.align = b.getAttribute('data-align'); form(); redraw(); }; });
    const sw = (attr, key) => { host.querySelectorAll(`[data-${attr}]`).forEach((b) => { b.onclick = () => { snap(); x[key] = b.getAttribute(`data-${attr}`); form(); redraw(); }; });
      const ci = host.querySelector(`[data-${attr}c]`); if (ci) ci.oninput = ch(() => { x[key] = ci.value.toLowerCase(); }); };
    sw('tc', 'color'); sw('tb', 'bg'); sw('ib', 'bg'); sw('sf', 'fill'); sw('ss', 'stroke');
    const ln = host.querySelector('#smsLines'); if (ln) ln.onchange = ch(() => { x.lines = Math.max(1, Math.min(12, Number(ln.value) || 1)); });
    const pr = host.querySelector('#smsProd'); if (pr) pr.onchange = ch(() => { x.product = Number(pr.value); });
    host.querySelectorAll('[data-fit]').forEach((b) => { b.onclick = () => { snap(); x.fit = b.getAttribute('data-fit'); form(); redraw(); }; });
    for (const [id, k] of [['#smsZoom', 'zoom'], ['#smsOx', 'ox'], ['#smsOy', 'oy'], ['#smsRad', 'radius'], ['#smsOp', 'opacity'], ['#smsSw', 'sw']]) { const el = host.querySelector(id); if (el) el.oninput = ch(() => { x[k] = Number(el.value); }); }
    host.querySelectorAll('[data-geo]').forEach((i) => { i.onchange = ch(() => { const k = i.getAttribute('data-geo'), v = Number(i.value) / 100; if (Number.isFinite(v)) x[k] = k === 'w' || k === 'h' ? Math.max(0.02, Math.min(2, v)) : Math.max(-0.5, Math.min(1.5, v)); overlay(); }); });
  }

  /* ---------- the tool panels ---------- */
  function form() {
    const c = S.ctx, cur = S.cur, host = $('#adbForm'); if (!host) return;
    if (!isStudio() && ED.tab !== 'post' && ED.tab !== 'ai' && ED.tab !== 'prod' && ED.tab !== 'text') ED.tab = ED.tab === 'tpl' ? 'tpl' : ED.tab;
    A.host.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.getAttribute('data-tab') === ED.tab)));
    const locHtml = c.locations.length > 1 ? `<label class="l" for="adbLoc">Location</label><select id="adbLoc">${c.locations.map((l) => `<option value="${e(l.id)}"${l.id === S.loc ? ' selected' : ''}>${e(l.name)}${l.city ? ' — ' + e(l.city) : ''}</option>`).join('')}</select>` : '';
    const kind = (c.templates[cur.template] || {}).kind || 'single', max = (c.templates[cur.template] || {}).max || 4;
    const names = cur.products.map((r) => productBy(r)).filter(Boolean);
    const allow = [c.dealer.name, c.dealer.city].concat(...names.map((p) => [p.name, p.category, p.brand]));
    let body = '';
    const insp = isStudio() && ['text', 'el', 'layers', 'brand', 'tpl', 'prod'].includes(ED.tab) ? inspHtml() : '';
    if (ED.tab === 'tpl') {
      const n = cur.products.length, studio = Object.entries(c.templates).filter(([, t]) => t.studio);
      const fits = (t) => (t.kind === 'general' ? true : t.kind === 'single' ? n <= 1 : n >= 2 && n <= (t.max || 4));
      const order = studio.slice().sort((a, b) => Number(fits(b[1])) - Number(fits(a[1])));
      body = `<h3>Templates</h3><p style="font-size:12.5px;color:#5b6773;margin:-4px 0 10px">${studio.length} starting designs with your product and brand. Pick one, then change anything on the canvas.</p>
        <div class="sms-tpls">${order.map(([k, t]) => `<button type="button" class="sms-tpl" data-tpl="${e(k)}" aria-pressed="${cur.template === k}"${fits(t) ? '' : ' style="opacity:.55"'}><canvas data-tth="${e(k)}" width="10" height="10"></canvas><span>${e(t.label)}${t.kind === 'multi' ? ` · 2–${t.max || 4} products` : t.kind === 'general' ? ' · no product' : ''}</span></button>`).join('')}</div>`;
    } else if (ED.tab === 'prod') {
      const q = S.q.trim().toLowerCase(); const plist = c.products.filter((p) => !q || (p.name + ' ' + p.code + ' ' + (p.category || '') + ' ' + p.manufacturer).toLowerCase().includes(q)).slice(0, 80);
      body = `<h3>Products</h3>${locHtml}<p style="font-size:12.5px;color:#5b6773;margin:0 0 8px">${kind === 'general' ? 'This template shows no product — pick a product template to add one.' : kind === 'single' ? 'One product for this template.' : `2–${max} products for this template.`} Only your authorized, listed products with their official photos.</p>
        <input type="text" id="adbQ" placeholder="Search your products (${c.products.length})" value="${e(S.q)}" aria-label="Search products">
        <div class="adb-sel">${cur.products.map((r, i) => { const p = productBy(r); return p ? `<span>${e(p.name)} <label><input type="checkbox" data-sp="${i}"${r.show_price !== false ? ' checked' : ''}> price</label><button type="button" data-rm="${i}" aria-label="Remove ${e(p.name)}">✕</button></span>` : ''; }).join('')}</div>
        <div class="adb-plist" role="listbox" aria-label="Products">${plist.map((p) => `<div class="adb-p${cur.products.some((r) => keyOf(r) === keyOf(p)) ? ' on' : ''}" role="option" tabindex="0" aria-selected="${cur.products.some((r) => keyOf(r) === keyOf(p))}" data-pk="${e(keyOf(p))}">${p.image ? `<img alt="" src="${e(p.image)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph0'}))">` : '<span class="ph0"></span>'}<span class="n"><b>${e(p.name)}</b><span>${e(p.code)} · ${e(p.category || '')}${p.price != null ? ' · ' + e(p.price_label || '') + ' ' + money(p.price) : ' · Call for Price'}</span></span></div>`).join('')}</div>`;
    } else if (ED.tab === 'text') {
      body = `<h3>Text</h3><label class="l" for="adbTitle">Name of this design (only you see it)</label><input type="text" id="adbTitle" maxlength="${c.limits.title}" value="${e(cur.title || '')}">
        <label class="l" for="adbHead">Headline</label><input type="text" id="adbHead" maxlength="${c.limits.headline}" value="${e(cur.headline)}"><div class="warn" id="wHead"></div>
        <label class="l" for="adbSub">Subheadline</label><input type="text" id="adbSub" maxlength="${c.limits.subheadline || 100}" value="${e(cur.subheadline || '')}"><div class="warn" id="wSub"></div>
        <label class="l" for="adbBody">Message</label><textarea id="adbBody" maxlength="${c.limits.body}">${e(cur.body)}</textarea><div class="warn" id="wBody"></div>
        <label class="l" for="adbFeat">Benefits / features (one per line, up to 4)</label><textarea id="adbFeat" rows="3">${e((cur.features || []).join('\n'))}</textarea><div class="warn" id="wFeat"></div>
        <label class="l" for="adbCta">Call to action</label><select id="adbCta">${['', ...c.ctas].map((t) => `<option${t === cur.cta ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>
        <label class="l" for="adbFont">Design font</label><select id="adbFont">${c.fonts.map((f) => `<option${f === cur.font ? ' selected' : ''}>${e(f)}</option>`).join('')}</select>
        <p style="font-size:12px;color:#5b6773;margin:8px 0 0">Prices are placed from your catalog automatically (MAP rules applied). Ads can't mention discounts, sales, free offers, guarantees, insurance or medical claims.</p>`;
    } else if (ED.tab === 'el') {
      const it = [['heading', 'Heading', 'text'], ['text', 'Text box', 'text'], ['badge', 'Label', 'pill'], ['cta', 'Button', 'pill'], ['feature', 'Benefit', 'text'], ['photo', 'Product photo', 'photo'], ['price', 'Price', 'price'], ['logo', 'Logo', 'logo'], ['phone', 'Phone', 'phone'], ['address', 'Address', 'logo'], ['rect', 'Rectangle', 'rect'], ['circle', 'Circle', 'circle'], ['line', 'Line', 'line']];
      body = `<h3>Elements</h3><p style="font-size:12.5px;color:#5b6773;margin:-4px 0 10px">Drag onto the canvas, or tap to add in the middle.</p><div class="sms-els">${it.map(([k, l, ic]) => `<button type="button" class="sms-el" draggable="true" data-add="${k}">${svg(ic)}${e(l)}</button>`).join('')}</div>`;
    } else if (ED.tab === 'brand') {
      const b = c.brand || {};
      body = `<h3>Brand Kit</h3><div class="sms-brand"><div class="lg" id="smsLogo">${c.dealer.has_logo ? 'Loading…' : 'No logo yet'}</div><div style="font-size:12.5px"><b>${e(c.dealer.name || '')}</b><br>${e([c.dealer.city, c.dealer.state].filter(Boolean).join(', '))}${c.dealer.phone ? '<br>' + e(c.dealer.phone) : ''}<br><span style="color:#5b6773">Logo and details come from your Account.</span></div></div>
        <h4>Your brand colors</h4><div class="adb-acts" style="margin-top:0"><button type="button" class="btn pri" id="smsBrand" style="background:${e(b.primary)};border-color:${e(b.primary)};color:${onColor(b.primary)}">Apply my brand colors</button></div>
        <p style="font-size:12px;color:#5b6773">${b.source === 'storefront' ? 'From your published storefront theme.' : 'HCPS navy and orange — publish a storefront theme in My Storefront to use your own.'}</p>
        <h4>Color schemes</h4><div class="adb-sw">${PRESETS.map((p, i) => `<button type="button" data-pre="${i}" title="${e(p.name)}" aria-label="${e(p.name)} colors" style="background:linear-gradient(135deg,${p.bg} 60%,${p.accent} 60%)"></button>`).join('')}</div>
        <div class="adb-colors">${[['bg', 'Background'], ['accent', 'Accent'], ['text', 'Text']].map(([k, l]) => `<label>${l} <input type="color" data-col="${k}" value="${e(cur.colors[k] || '#000000')}"></label>`).join('')}</div>
        <h4>Show on the design</h4><div class="adb-opts">${[['logo', 'Logo', c.dealer.has_logo], ['name', 'Store name', true], ['address', 'Address', true], ['phone', 'Phone', !!c.dealer.phone], ['website', c.dealer.link ? 'Storefront link' : 'Website', !!(c.dealer.link || c.dealer.website)], ['price', 'Prices', kind !== 'general']]
          .filter((x) => x[2]).map(([k, l]) => `<label class="adb-opt" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" data-show="${k}"${cur.show[k] ? ' checked' : ''}> ${e(l)}</label>`).join('')}</div>`;
    } else if (ED.tab === 'ai') {
      body = `<h3>AI Creative Director</h3>${aiHtml()}`;
    } else if (ED.tab === 'layers') {
      const L = els().slice().reverse();
      body = `<h3>Layers</h3>${isStudio() ? `<p style="font-size:12.5px;color:#5b6773;margin:-4px 0 8px">Top of the list = in front. ${L.length}/40 layers.</p><ul class="sms-layers">${L.map((x) => `<li class="${x.id === ED.sel ? 'on' : ''}"><button type="button" class="nm" data-lsel="${e(x.id)}">${x.hidden ? '◌ ' : ''}${x.locked ? '🔒 ' : ''}${e(elName(x))}</button>
          <button type="button" class="sms-ib" data-lup="${e(x.id)}" aria-label="Bring forward">${svg('up')}</button><button type="button" class="sms-ib" data-ldn="${e(x.id)}" aria-label="Send backward">${svg('down')}</button><button type="button" class="sms-ib" data-lhide="${e(x.id)}" aria-label="${x.hidden ? 'Show' : 'Hide'}">${x.hidden ? '👁' : '—'}</button></li>`).join('')}</ul>` : '<p>Open this ad in the Studio to work with layers.</p>'}`;
    } else if (ED.tab === 'post') {
      body = `<h3>Caption &amp; post</h3><div class="adb-sec"><h3>Post caption</h3>${Object.keys(cur.captions || {}).length ? `<div class="adb-tabs" role="group" aria-label="Caption for">${Object.keys(cur.captions).map((k) => `<button type="button" data-capk="${e(k)}" aria-pressed="${cur.caption === cur.captions[k]}">${e(PLAT[k] || k)}</button>`).join('')}</div>` : ''}
        <label class="l" for="adbCap">Caption</label><textarea id="adbCap" maxlength="${c.limits.caption}">${e(cur.caption)}</textarea><div class="warn" id="wCap"></div>
        <label class="l" for="adbTags">Hashtags</label><input type="text" id="adbTags" value="${e(cur.hashtags.map((h) => '#' + h).join(' '))}">
        <div class="adb-acts"><button type="button" class="btn gh" id="adbSug">Suggest captions</button></div><div id="adbSugs">${(S.suggestions && S.suggestions.captions || []).map((t, i) => `<div class="adb-cap" tabindex="0" data-cap="${i}">${e(t)}</div>`).join('')}</div></div>
        <div class="adb-sec adb-pub" id="adbPub"><h3>Schedule &amp; publish</h3>${pubHtml()}</div>`;
    }
    host.innerHTML = insp + body;
    bindInsp(host);
    const lsel = host.querySelector('#adbLoc'); if (lsel) lsel.onchange = async () => { await openLocation(lsel.value); };
    host.querySelectorAll('[data-tpl]').forEach((b) => { b.onclick = () => { const k = b.getAttribute('data-tpl'), t = c.templates[k]; snap(); cur.template = k; cur.layouts = null; ED.sel = null;
      if (t.kind === 'general') cur.products = []; else if (t.kind === 'single') cur.products = cur.products.slice(0, 1); else cur.products = cur.products.slice(0, t.max || 4);
      if (t.kind === 'multi' && cur.products.length < 2) say(`Add ${2 - cur.products.length} more product(s) in Products for this template.`, 'err'); form(); redraw(); }; });
    host.querySelectorAll('[data-pk]').forEach((el) => { const pick = () => { const k = el.getAttribute('data-pk'); const p = c.products.find((x) => keyOf(x) === k); if (!p) return;
      const i = cur.products.findIndex((r) => keyOf(r) === k); snap();
      if (i >= 0) cur.products.splice(i, 1); else if (kind === 'single') cur.products = [{ manufacturer: p.manufacturer, code: p.code, show_price: true }];
      else if (kind === 'general') { say('This template shows no product — choose a product template first.', 'err'); return; }
      else if (cur.products.length < max) cur.products.push({ manufacturer: p.manufacturer, code: p.code, show_price: true }); else { say(`This template shows up to ${max} products.`, 'err'); return; }
      if (kind === 'multi' && cur.layouts) { cur.layouts = null; say('The grid was re-laid for the new number of products — Undo (Ctrl+Z) brings back your previous design.', 'ok'); }   // the grid re-flows for the new number of products
      form(); redraw(); }; el.onclick = pick; el.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } }; });
    host.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = () => { snap(); const ri = Number(b.getAttribute('data-rm')); cur.products.splice(ri, 1); if (kind === 'multi' && cur.layouts) { cur.layouts = null; say('The grid was re-laid for the new number of products — Undo (Ctrl+Z) brings back your previous design.', 'ok'); } else if (cur.layouts) for (const f of Object.keys(cur.layouts)) cur.layouts[f] = cur.layouts[f].filter((x) => x.product !== ri).map((x) => (x.product != null && x.product > ri ? Object.assign({}, x, { product: x.product - 1 }) : x)); form(); redraw(); }; });
    host.querySelectorAll('[data-sp]').forEach((b) => { b.onchange = () => { snap(); cur.products[Number(b.getAttribute('data-sp'))].show_price = b.checked; redraw(); }; });
    const qq = host.querySelector('#adbQ'); if (qq) qq.oninput = () => { S.q = qq.value; const pos = qq.selectionStart; form(); const n = $('#adbQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } };
    let typed = false; const once = () => { if (!typed) { snap(); typed = true; } };
    const bind = (id, k, warnId) => { const el = host.querySelector(id); if (!el) return; el.oninput = () => { once(); cur[k] = el.value; if (warnId) { const w = warnWords(el.value, allow); host.querySelector(warnId).textContent = w ? `"${w}" can't be used in an ad (prices, discounts, offers or claims).` : ''; } redraw(); }; if (warnId) { const w = warnWords(el.value, allow); const wt = host.querySelector(warnId); if (wt) wt.textContent = w ? `"${w}" can't be used in an ad (prices, discounts, offers or claims).` : ''; } };
    bind('#adbTitle', 'title'); bind('#adbHead', 'headline', '#wHead'); bind('#adbSub', 'subheadline', '#wSub'); bind('#adbBody', 'body', '#wBody'); bind('#adbCap', 'caption', '#wCap');
    const fe = host.querySelector('#adbFeat'); if (fe) fe.oninput = () => { once(); cur.features = fe.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 4); const w = cur.features.map((x) => warnWords(x, allow)).find(Boolean); host.querySelector('#wFeat').textContent = w ? `"${w}" can't be used in an ad (prices, discounts, offers or claims).` : ''; redraw(); };
    const cta = host.querySelector('#adbCta'); if (cta) cta.onchange = (ev) => { snap(); cur.cta = ev.target.value; redraw(); };
    const fnt = host.querySelector('#adbFont'); if (fnt) fnt.onchange = (ev) => { snap(); cur.font = ev.target.value; redraw(); };
    host.querySelectorAll('[data-capk]').forEach((b) => { b.onclick = () => { cur.caption = cur.captions[b.getAttribute('data-capk')] || ''; form(); }; });
    const tags = host.querySelector('#adbTags'); if (tags) tags.onchange = (ev) => { cur.hashtags = String(ev.target.value).split(/[\s,]+/).map((t) => t.replace(/^#/, '').replace(/[^A-Za-z0-9]/g, '')).filter(Boolean).slice(0, 15); };
    host.querySelectorAll('[data-pre]').forEach((b) => { b.onclick = () => { snap(); const p = PRESETS[Number(b.getAttribute('data-pre'))]; cur.colors = { bg: p.bg, accent: p.accent, text: p.text }; form(); redraw(); }; });
    host.querySelectorAll('[data-col]').forEach((i) => { i.oninput = () => { once(); cur.colors[i.getAttribute('data-col')] = i.value; redraw(); }; });
    host.querySelectorAll('[data-show]').forEach((i) => { i.onchange = () => { snap(); cur.show[i.getAttribute('data-show')] = i.checked; redraw(); }; });
    const br = host.querySelector('#smsBrand'); if (br) br.onclick = () => { snap(); applyBrand(cur); form(); redraw(); say('Your brand colors are applied.', 'ok'); };
    const lg = host.querySelector('#smsLogo'); if (lg && c.dealer.has_logo) logoImage().then((im) => { if (im && host.contains(lg)) { lg.innerHTML = ''; const i2 = new Image(); i2.alt = 'Your logo'; i2.src = im.src; lg.appendChild(i2); } else if (host.contains(lg)) lg.textContent = 'Logo not available'; });
    const sug = host.querySelector('#adbSug'); if (sug) sug.onclick = async () => { const r = await A.api({ action: 'ads_suggest', location_id: S.loc, products: cur.products, cta: cur.cta }); if (r && r.ok) { S.suggestions = r; if (!cur.hashtags.length) cur.hashtags = r.hashtags.slice(); form(); } else say((r && r.error) || 'No suggestions just now.', 'err'); };
    host.querySelectorAll('[data-cap]').forEach((el) => { const use = () => { cur.caption = S.suggestions.captions[Number(el.getAttribute('data-cap'))]; form(); }; el.onclick = use; el.onkeydown = (ev) => { if (ev.key === 'Enter') use(); }; });
    host.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => addEl(b.getAttribute('data-add')); b.ondragstart = (ev) => { ev.dataTransfer.setData('text/x-sms', b.getAttribute('data-add')); ev.dataTransfer.effectAllowed = 'copy'; }; });
    host.querySelectorAll('[data-lsel]').forEach((b) => { b.onclick = () => { ED.sel = b.getAttribute('data-lsel'); form(); overlay(); }; });
    host.querySelectorAll('[data-lup]').forEach((b) => { b.onclick = () => { ED.sel = b.getAttribute('data-lup'); zMove(1); }; });
    host.querySelectorAll('[data-ldn]').forEach((b) => { b.onclick = () => { ED.sel = b.getAttribute('data-ldn'); zMove(-1); }; });
    host.querySelectorAll('[data-lhide]').forEach((b) => { b.onclick = () => { const x = els().find((y) => y.id === b.getAttribute('data-lhide')); if (!x) return; snap(); x.hidden = !x.hidden; form(); redraw(); }; });
    if (ED.tab === 'ai') bindAi(host);
    if (ED.tab === 'post') bindPub();
    if (ED.tab === 'tpl') drawThumbs(host);
    const ro = !S.ctx.can_edit || S.ctx.preview; ['#adbSave', '#adbDup'].forEach((id) => { const b = $(id); if (b) b.style.display = ro ? 'none' : ''; });
    toolbar(); overlay();
  }
  /* live template thumbnails with the dealer's product and brand (drawn a few at a time so the panel opens at once) */
  async function drawThumbs(host) { const run = ++ED.thumbs; const cvs = [...host.querySelectorAll('[data-tth]')];
    for (const cv of cvs) { if (run !== ED.thumbs || !host.contains(cv)) return; const k = cv.getAttribute('data-tth'), t = S.ctx.templates[k] || {};
      const prods = t.kind === 'general' ? [] : S.cur.products.length ? S.cur.products.slice(0, t.kind === 'single' ? 1 : t.max || 4) : [];
      const pv = Object.assign(deep(S.cur), { template: k, layouts: null, products: prods }); pv.layouts = { [pv.format]: buildLayout(k, pv.format, prods.length) };
      try { await drawStudio(cv, pv, 0.16); } catch (x) {} await new Promise((r) => setTimeout(r, 0)); } }

  function list() {
    const host = $('#adbList'); if (!host) return;
    const mine = S.ads.filter((a) => a.dealer_id === S.loc);
    host.innerHTML = mine.length ? `<h3 style="margin:4px 0 8px">Your saved designs</h3><div class="adb-list">${mine.map((a) => `<div class="adb-card"><b>${e(a.title || a.headline || 'Untitled ad')}</b>
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
    S.problems = r.problems || []; S.cur.products = S.cur.products.filter((p) => productBy(p)); S.cur.layouts = r.ad.layouts || null; S.cd = null;
    ED.sel = null; ED.hist = []; ED.fut = [];
    form(); redraw(); say(S.problems.length ? S.problems.map((p) => `${p.code}: ${p.problem}`).join(' ') : 'Opened.', S.problems.length ? 'err' : 'ok');
    window.scrollTo({ top: 0 });
  }

  /* ---------------- AI Build My Ad / Generate Complete Campaign ---------------- */
  function aiHtml() {
    const c = S.ctx; if (c.preview || !c.can_edit) return '';
    const sel = (k, l) => `<label class="l" for="adbAi_${k}">${l}</label><select id="adbAi_${k}" data-ai="${k}">${AI_OPTS[k].map(([v, t]) => `<option value="${e(v)}"${S.ai[k] === v ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>`;
    const R = S.aiResult;
    return `<div class="adb-sec adb-ai" id="adbAi">
      <p style="font-size:13px;color:#3b4552;margin:0 0 6px">${T().kind === 'general' ? 'No product needed — the store itself is the subject.' : S.cur.products.length ? 'For: <b>' + e(S.cur.products.map((r) => (productBy(r) || {}).name).filter(Boolean).join(', ')) + '</b>.' : 'Pick a product in Products first.'} One click writes the ad from the product's official facts and designs <b>three different finished ads</b> — choose one and change anything on the canvas. Optional:</p>
      <div class="row">${sel('goal', 'Goal')}${sel('audience', 'Audience')}${sel('tone', 'Tone')}${sel('platform', 'Platform')}</div>
      <div class="go"><button type="button" class="btn pri" id="adbAiGo">✨ Create 3 designs</button><button type="button" class="btn gh" id="adbAiCamp">✨ Generate Complete Campaign</button>
        ${S.history.length ? '<button type="button" class="btn gh" id="adbAiBack">↶ Back to the previous version</button>' : ''}</div>
      ${R ? `<div class="adb-why"><b>Why this ad works</b><ul>${(R.why || []).map((w) => `<li>${e(w)}</li>`).join('')}</ul>
        ${(R.alt_headlines || []).length ? `<div style="margin-top:8px"><b>Other headlines</b> — tap to use:</div><div class="adb-alts">${R.alt_headlines.map((h, i) => `<button type="button" data-alt="${i}">${e(h)}</button>`).join('')}</div>` : ''}
        <div style="margin-top:8px;color:#5b6773;font-size:12px">Written by AI from your catalog's facts and checked by HCPS's ad rules. Review it before posting — results are never guaranteed.</div></div>` : ''}
      ${S.cd ? `<div class="adb-why"><b>Three designs — pick the one you like</b><div class="sms-cd">${S.cd.cands.map((x, i) => `<div><canvas data-cdv="${i}" aria-label="Design ${i + 1}"></canvas><b>${e((S.ctx.templates[x.template] || {}).label || '')}</b><button type="button" class="btn ${i ? 'gh' : 'pri'}" data-cduse="${i}">Use this design</button></div>`).join('')}</div>
        <div style="font-size:12px;color:#5b6773;margin-top:6px">Every design uses the same checked words and your catalog prices. Not quite right? Create 3 designs again for new layouts.</div></div>` : ''}
      ${S.campaign ? campHtml() : ''}</div>`;
  }
  /* AI Creative Director: one AI-written ad (the server's checked words) laid out three ways — different templates, colors and headlines */
  const CD_SETS = { single: [['st-spotlight', 'st-split-left', 'st-premium'], ['st-card', 'st-band', 'st-warm'], ['st-circle', 'st-magazine', 'st-stacked'], ['st-features', 'st-frame', 'st-banner'], ['st-showroom', 'st-question', 'st-minimal'], ['st-price', 'st-split-right', 'st-logo-hero']],
    multi: [['st-grid', 'st-lineup', 'st-mosaic'], ['st-mosaic', 'st-duo', 'st-grid']], general: [['st-message', 'st-contact', 'st-message']] };
  function creativeSet(ad, run) {
    const n = (ad.products || []).length, kind = n === 0 ? 'general' : n === 1 ? 'single' : 'multi', sets = CD_SETS[kind], set = sets[run % sets.length];
    const fit = (k) => { const t = S.ctx.templates[k] || {}; return t.kind === 'multi' ? n >= 2 && n <= (t.max || 4) : true; };
    const tpls = set.map((k) => (fit(k) ? k : kind === 'multi' ? 'st-grid' : k));
    const b = S.ctx.brand || { primary: '#0b1f33', accent: '#ef6325' };
    const pals = [{ bg: b.primary, accent: b.accent, text: onColor(b.primary) }, { bg: '#ffffff', accent: b.accent, text: '#0b1f33' }, run % 2 ? { bg: '#fff7ef', accent: b.accent, text: '#2a1a10' } : { bg: '#1f2329', accent: b.accent, text: '#ffffff' }];
    const heads = [ad.headline].concat((S.aiResult && S.aiResult.alt_headlines) || []);
    return tpls.map((t, i) => Object.assign(blank(), deep(ad), { template: t, layouts: null, colors: pals[i], headline: heads[i] || ad.headline }));
  }
  async function drawCandidates() { if (!S.cd) return; for (let i = 0; i < S.cd.cands.length; i++) { const cv = A.host.querySelector(`[data-cdv="${i}"]`); if (!cv) continue; const x = S.cd.cands[i]; x.layouts = { [x.format]: buildLayout(x.template, x.format, x.products.length) }; try { await drawStudio(cv, x, 0.3); } catch (er) {} } }
  function campHtml() { const C = S.campaign; return `<div class="adb-why"><b>Campaign: ${e(C.campaign.name)}</b> — ${C.ads.length} sizes. ${C.saved ? 'Saved — each size is in your saved ads.' : 'Not saved yet.'}
    <div class="adb-camp">${C.ads.map((a, i) => `<div><canvas data-cv="${i}" aria-label="${e(a.format)} preview"></canvas><b>${e((S.ctx.formats[a.format] || {}).label ? S.ctx.formats[a.format].label.split('—')[0] : a.format)}</b><br>${e(a.headline)}
      <button type="button" class="btn gh" data-cedit="${i}">Edit this size</button><button type="button" class="btn gh" data-cdl="${i}">⬇ PNG</button></div>`).join('')}</div>
    <div class="go">${C.saved ? '' : '<button type="button" class="btn pri" id="adbCampSave">Save campaign</button>'}<button type="button" class="btn gh" id="adbCampClose">Close campaign</button></div></div>`; }
  async function drawCampaign() { if (!S.campaign) return; const keep = S.cur;
    for (let i = 0; i < S.campaign.ads.length; i++) { const cv = A.host.querySelector(`[data-cv="${i}"]`); if (!cv) continue; const a = Object.assign(blank(), S.campaign.ads[i]); try { await draw(cv, a, isStudio(a) ? 0.3 : undefined); } catch (x) {} }
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
    host.querySelectorAll('[data-cduse]').forEach((b) => { b.onclick = () => { const x = S.cd.cands[Number(b.getAttribute('data-cduse'))]; snap(); S.cur = deep(x); S.row = null; ED.sel = null; form(); redraw(); say('Design chosen — click anything on the canvas to change it, then save.', 'ok'); }; });
    if (S.cd) drawCandidates();
    const cc = host.querySelector('#adbCampClose'); if (cc) cc.onclick = () => { S.campaign = null; form(); };
    if (S.campaign) drawCampaign();
  }
  async function aiBuild(campaign) {
    if (S.busy) return; const kind = T().kind;
    if (kind !== 'general' && !S.cur.products.length) { say('Pick a product first (or choose the "Store message" template).', 'err'); return; }
    S.busy = true; const btn = $(campaign ? '#adbAiCamp' : '#adbAiGo'); if (btn) { btn.disabled = true; btn.textContent = '✨ Designing…'; }
    say(campaign ? 'Writing a complete campaign from your product facts… (about 10–20 seconds)' : 'Writing your ad from the product facts… (about 10–20 seconds)');
    try {
      const avoid = [S.cur.headline, ...((S.aiResult && S.aiResult.alt_headlines) || [])].filter(Boolean);
      const body = Object.assign({ action: campaign ? 'ads_campaign' : 'ads_ai', location_id: S.loc, products: S.cur.products.map((r) => ({ manufacturer: r.manufacturer, code: r.code })), format: S.cur.format, avoid, variant: S.history.length % 10 }, S.ai);
      const r = await A.api(body);
      if (!r || !r.ok) { say(((r && r.error) || 'The AI could not write an ad just now.') + ' Your current ad is unchanged.', 'err'); return; }
      if (S.cur.headline || S.cur.products.length) S.history.push({ cur: JSON.parse(JSON.stringify(S.cur)), ai: S.aiResult });   // regenerate never loses the previous version
      for (const p of r.products || []) { const i = S.ctx.products.findIndex((x) => keyOf(x) === keyOf(p)); if (i >= 0) S.ctx.products[i] = Object.assign({}, S.ctx.products[i], p); }
      S.aiResult = { why: r.why, alt_headlines: r.alt_headlines };
      if (campaign) { const ads = r.ads.map((a) => Object.assign({}, a, { template: LEGACY_MAP[a.template] || a.template, layouts: null }));
        S.campaign = { campaign: r.campaign, ads, saved: false }; S.cur = Object.assign(blank(), deep(ads[0])); S.cd = null; }
      else { const keepFmt = S.cur.format; const ad = Object.assign(blank(), r.ad, { format: keepFmt }); S.cd = { cands: creativeSet(ad, ED.cdRun = (ED.cdRun || 0) + 1) }; S.cur = deep(S.cd.cands[0]); S.campaign = null; }
      S.row = null; ED.sel = null; ED.tab = 'ai'; form(); redraw();
      say((campaign ? 'Campaign ready — four sizes below. Edit any size, download, or save the campaign.' : 'Three designs are ready — the first is on the canvas. Pick the one you like, then change anything.') + (r.captions_source === 'rules' ? ' The AI captions didn\'t pass HCPS\'s checks this time, so HCPS\'s standard captions are filled in — regenerate for AI captions.' : ''), 'ok');
    } finally { S.busy = false; const b2 = $(campaign ? '#adbAiCamp' : '#adbAiGo'); if (b2) { b2.disabled = false; b2.textContent = campaign ? '✨ Generate Complete Campaign' : '✨ Create 3 designs'; } }
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
    cv.setAttribute('aria-label', 'Ad preview: ' + [S.cur.headline, ...S.cur.products.map((r) => (productBy(r) || {}).name).filter(Boolean), S.cur.cta].filter(Boolean).join(' — ')); drawing = draw(cv).catch(() => {}); await drawing; drawing = null; overlay(); if (again) { again = false; redraw(); } }

  async function save(asCopy) {
    if (S.busy) return; S.busy = true; say('Saving…');
    try {
      compactFeatures(S.cur);
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
    if (!keep || !S.cur) { S.cur = blank(); applyBrand(S.cur); S.row = null; ED.sel = null; ED.hist = []; ED.fut = []; S.cd = null; }
    S.cur.products = (S.cur.products || []).filter((p) => productBy(p));
    S.social = null; shell(); list(); form(); redraw(); loadSocial(); return true;
  }
  window.HCPSAdBuilder = {
    async mount(host, deps) {
      A = { host, api: deps.api, esc: deps.esc };
      host.innerHTML = '<div class="ph"><div><h1>Social Ads</h1><div class="sub">Loading your products…</div></div></div>';
      if (await openLocation(null)) await refreshList();
    },
    _draw: draw, _state: S, _ed: ED, _templates: STUDIO_TPL, _build: buildLayout,
  };
})();
