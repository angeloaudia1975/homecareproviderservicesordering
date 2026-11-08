/* Dealer Brand & Logo Studio — vector renderer (2026-11-08). spec + opentype fonts → an SVG of PATHS only (text is
   converted to outlines, so the file looks identical everywhere and needs no fonts). The server accepts only this
   vocabulary (svg / g translate·scale / path d + fill) — _logo_studio.js svgProblem. Every symbol is an original HCPS
   shape drawn in a 100×100 box: parts marked "a" / "b" take the accent colours, "w" white. */
(function (root) {
  const SYMBOLS = {
    swoosh: [['a', 'M6 74C22 46 52 24 96 14C66 30 44 50 28 78C22 87 11 86 6 74Z'], ['b', 'M14 91C30 71 52 58 80 54C62 64 46 77 36 93C30 99 18 99 14 91Z']],
    leaf: [['a', 'M50 4C82 18 96 50 76 80C66 94 50 98 40 92C14 76 10 40 50 4Z'], ['w', 'M44 92C46 66 52 40 62 20C56 44 52 68 50 92Z']],
    home: [['a', 'M2 54L50 8L98 54L82 54L50 25L18 54Z'], ['b', 'M18 62C30 92 70 92 82 62C68 78 32 78 18 62Z'], ['b', 'M44 38H56V50H44Z']],
    heart: [['a', 'M50 90C20 68 6 52 6 33C6 18 17 8 30 8C39 8 46 13 50 21C54 13 61 8 70 8C83 8 94 18 94 33C94 52 80 68 50 90Z'], ['w', 'M24 54C36 40 54 34 74 36C58 42 46 50 38 62Z']],
    wave: [['a', 'M4 34C20 22 36 22 50 34C64 46 80 46 96 34L96 46C80 58 64 58 50 46C36 34 20 34 4 46Z'], ['b', 'M4 54C20 42 36 42 50 54C64 66 80 66 96 54L96 66C80 78 64 78 50 66C36 54 20 54 4 66Z'], ['a', 'M4 74C20 62 36 62 50 74C64 86 80 86 96 74L96 86C80 98 64 98 50 86C36 74 20 74 4 86Z']],
    path: [['a', 'M32 28A18 18 0 1 0 68 28A18 18 0 1 0 32 28Z'], ['b', 'M30 98C38 74 56 62 60 44C64 64 56 78 70 98Z']],
    ring: [['a', 'M50 2A48 48 0 1 0 50.01 2ZM50 11A39 39 0 1 1 49.99 11Z', 'evenodd']],
    shield: [['a', 'M50 3L92 16V46C92 72 74 88 50 97C26 88 8 72 8 46V16Z']],
  };
  const MONO_IN = { ring: 'b', shield: 'w' };
  const r2 = (n) => Math.round(n * 100) / 100;
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : '#000000');

  function text(font, str, size, spacing) {
    const p = font.getPath(str, 0, 0, size, { kerning: true, letterSpacing: spacing || 0 });
    const d = p.toPathData(2); const bb = p.getBoundingBox();
    return { d, x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 };
  }
  /* render(spec, fonts) — fonts = { name: opentype.Font, sub: opentype.Font } for spec.font */
  function render(spec, fonts, opts) {
    opts = opts || {};
    const C = { name: hex(spec.colors.name), sub: hex(spec.colors.sub), a: hex(spec.colors.a), b: hex(spec.colors.b), w: '#ffffff' };
    const items = [];   // { d, fill, x, y, s (scale), rule, bb:{x1,y1,x2,y2} in local units }
    const addText = (t, x, y, fill) => { if (t.d) items.push({ d: t.d, fill, x, y, s: 1, bb: t }); };
    const addSym = (name, x, y, size, roles) => { for (const [role, d, rule] of SYMBOLS[name] || []) items.push({ d, fill: (roles && roles[role]) || C[role], x, y, s: size / 100, rule, bb: { x1: 0, y1: 0, x2: 100, y2: 100 } }); };
    const nameStr = (s) => (spec.upper ? s.toUpperCase() : s);
    const NS = 100, sp = spec.upper ? 0.04 : 0;
    const lines = spec.name.map((s) => text(fonts.name, nameStr(s), NS, sp));
    const sub = spec.sub ? text(fonts.sub, spec.sub, NS * 0.5) : null;
    const tag = spec.tagline ? text(fonts.sub, spec.tagline, NS * 0.34) : null;
    const step = NS * 1.08;
    /* the text block, left-aligned at x0 or centred on cx; returns its box */
    function block(x0, top, centre) {
      const capH = Math.max(...lines.map((l) => -l.y1));
      let y = top + capH; let maxW = Math.max(...lines.map((l) => l.w), sub ? sub.w : 0, tag ? tag.w : 0); let bottom = y;
      lines.forEach((l, i) => { const by = y + i * step; addText(l, centre ? x0 + (maxW - l.w) / 2 - l.x1 : x0 - l.x1, by, C.name); bottom = by + l.y2; });
      if (sub) { const by = bottom + NS * 0.18 - sub.y1; addText(sub, centre ? x0 + (maxW - sub.w) / 2 - sub.x1 : x0 - sub.x1 + NS * 0.02, by, C.sub); bottom = by + sub.y2; }
      if (tag) { const by = bottom + NS * 0.2 - tag.y1; addText(tag, centre ? x0 + (maxW - tag.w) / 2 - tag.x1 : x0 - tag.x1 + NS * 0.02, by, C.sub); bottom = by + tag.y2; }
      return { x1: x0, y1: top, x2: x0 + maxW, y2: bottom, h: bottom - top, w: maxW };
    }
    const nameH = (() => { const capH = Math.max(...lines.map((l) => -l.y1)); return capH + (lines.length - 1) * step + Math.max(...lines.map((l) => l.y2)); })();
    if (spec.layout === 'icon') {   /* the symbol alone (a monogram keeps its initials) — profile pictures, favicons */
      const S = 200; addSym(spec.symbol, 0, 0, S); if (MONO_IN[spec.symbol]) monogram(S, 0, 0, MONO_IN[spec.symbol]);
    } else if (spec.layout === 'left') {
      const S = Math.max(nameH * 1.05, 120); addSym(spec.symbol, 0, 0, S);
      if (MONO_IN[spec.symbol]) monogram(S, 0, 0, MONO_IN[spec.symbol]);
      block(S * 1.16, (S - nameH) / 2, false);
    } else if (spec.layout === 'stack') {
      const blockW = Math.max(...lines.map((l) => l.w), sub ? sub.w : 0, tag ? tag.w : 0); const S = Math.min(320, Math.max(175, blockW * 0.3));
      const bx = block(0, S * 1.14, true); const cx = (bx.x2 - bx.x1) / 2; addSym(spec.symbol, cx - S / 2, 0, S);
      if (MONO_IN[spec.symbol]) monogram(S, cx - S / 2, 0, MONO_IN[spec.symbol]);
    } else if (spec.layout === 'badge') {
      const D = Math.max(nameH * 1.12, 150);
      if (spec.symbol === 'shield') { addSym('shield', 0, 0, D, { a: C.a }); monogram(D, 0, 0, 'w'); }
      else { items.push({ d: 'M50 0A50 50 0 1 0 50.01 0Z', fill: C.a, x: 0, y: 0, s: D / 100, bb: { x1: 0, y1: 0, x2: 100, y2: 100 } });
        items.push({ d: 'M50 6A44 44 0 1 0 50.01 6ZM50 9A41 41 0 1 1 49.99 9Z', fill: C.w, x: 0, y: 0, s: D / 100, rule: 'evenodd', bb: { x1: 0, y1: 0, x2: 100, y2: 100 } }); monogram(D, 0, 0, 'w'); }
      block(D * 1.14, (D - nameH) / 2, false);
    } else {   /* word: the name with an accent sweep under it */
      const bx = { lines };
      const l = lines[0]; addText(l, -l.x1, -l.y1, C.name); const w = l.w; let bottom = l.h;
      const sw = w, sh = NS * 0.42, y = bottom + NS * 0.14;
      items.push({ d: `M0 ${r2(sh * 0.8)}C${r2(sw * 0.3)} ${r2(sh * 0.1)} ${r2(sw * 0.7)} 0 ${r2(sw)} ${r2(sh * 0.25)}C${r2(sw * 0.66)} ${r2(sh * 0.3)} ${r2(sw * 0.32)} ${r2(sh * 0.5)} ${r2(sw * 0.04)} ${r2(sh)}Z`, fill: C.a, x: 0, y, s: 1, bb: { x1: 0, y1: 0, x2: sw, y2: sh } });
      items.push({ d: `M${r2(sw * 0.55)} ${r2(sh * 0.62)}C${r2(sw * 0.72)} ${r2(sh * 0.44)} ${r2(sw * 0.86)} ${r2(sh * 0.4)} ${r2(sw)} ${r2(sh * 0.42)}C${r2(sw * 0.86)} ${r2(sh * 0.5)} ${r2(sw * 0.74)} ${r2(sh * 0.62)} ${r2(sw * 0.6)} ${r2(sh * 0.86)}Z`, fill: C.b, x: 0, y, s: 1, bb: { x1: 0, y1: 0, x2: sw, y2: sh } });
      bottom = y + sh;
      if (sub) { const by = bottom + NS * 0.16 - sub.y1; addText(sub, w - sub.w - sub.x1, by, C.sub); bottom = by + sub.y2; }
      if (tag) { const by = bottom + NS * 0.16 - tag.y1; addText(tag, w - tag.w - tag.x1, by, C.sub); bottom = by + tag.y2; }
      void bx;
    }
    function monogram(S, x, y, role) {
      const t = text(fonts.name, spec.initials || 'A', S * (spec.initials && spec.initials.length > 2 ? 0.3 : 0.38));
      const cy = spec.symbol === 'shield' && spec.layout !== 'badge' ? S * 0.5 : S * 0.5;
      addText(t, x + S / 2 - t.w / 2 - t.x1, y + cy - t.h / 2 - t.y1, role === 'w' ? '#ffffff' : (C[role] || C.name));
    }
    /* bounds → viewBox with a small margin */
    let X1 = Infinity, Y1 = Infinity, X2 = -Infinity, Y2 = -Infinity;
    for (const it of items) { X1 = Math.min(X1, it.x + it.bb.x1 * it.s); Y1 = Math.min(Y1, it.y + it.bb.y1 * it.s); X2 = Math.max(X2, it.x + it.bb.x2 * it.s); Y2 = Math.max(Y2, it.y + it.bb.y2 * it.s); }
    const m = Math.max(X2 - X1, Y2 - Y1) * (opts.square ? 0.1 : 0.04); let W = X2 - X1 + 2 * m, H = Y2 - Y1 + 2 * m, ox = m - X1, oy = m - Y1;
    if (opts.square) { const side = Math.max(W, H); ox += (side - W) / 2; oy += (side - H) / 2; W = H = side; }
    W = r2(W); H = r2(H); ox = r2(ox); oy = r2(oy);
    const body = items.map((it) => `<g transform="translate(${r2(it.x + ox)} ${r2(it.y + oy)})${it.s !== 1 ? ` scale(${r2(it.s * 10000) / 10000})` : ''}"><path d="${it.d}" fill="${it.fill}"${it.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/></g>`).join('');
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`, w: W, h: H };
  }
  const FONT_FILES = (base, id) => ({ name: `${base}/fonts/${id}-name.woff`, sub: `${base}/fonts/${id}-sub.woff` });
  /* the chosen design in the shapes a business needs (checklist B16): the published master stays the design itself */
  function variants(spec, fonts) {
    const c = (o) => Object.assign({}, spec, o);
    const horizontal = spec.layout === 'stack' ? c({ layout: 'left' }) : spec;
    const two = (n) => { const w = n.join(' ').split(' '); if (n.length > 1 || w.length < 2) return n; let best = 1, bd = Infinity;
      for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } } return [w.slice(0, best).join(' '), w.slice(best).join(' ')]; };
    const square = c({ layout: 'stack', name: two(spec.name), symbol: spec.layout === 'word' ? 'swoosh' : spec.symbol });
    const icon = c({ layout: 'icon', symbol: spec.layout === 'word' ? 'ring' : spec.symbol });
    return { horizontal: render(horizontal, fonts), square: render(square, fonts, { square: true }), icon: render(icon, fonts, { square: true }) };
  }
  const api = { render, variants, SYMBOLS, FONT_FILES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LogoRender = api;
})(typeof window !== 'undefined' ? window : globalThis);
