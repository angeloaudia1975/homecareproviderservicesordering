/* Catalog 5 Part E — grounded products, matched light, readable type in the Social Marketing Studio canvas (real Chromium).
   Draws a synthetic transparent "product" over a synthetic bright scene and a dark scene; nothing reaches a server, no AI call.
     PLAYWRIGHT_MODULE=playwright-core CHROME=/usr/bin/google-chrome node test/ad-scene-ground.browser.js */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const JS = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'ad-builder.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, w) => { if (!c) throw new Error(w); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e)); } }
const FORMATS = { square: { w: 1080, h: 1080, label: 'Square' } };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] }); const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>'); await page.addScriptTag({ content: JS });
  await t('pure rules: floor, ground plan, tint, audit', async () => {
    const r = await page.evaluate(() => { const P = window.__ADB_PURE; const box = { x: 100, y: 100, w: 400, h: 400 }, bb = { x0: 0.1, y0: 0.05, x1: 0.9, y1: 0.9 };
      const bright = P.groundPlan(box, bb, [235, 235, 240]), dark = P.groundPlan(box, bb, [10, 20, 40]);
      return { floor: P.READ_FLOOR, cy: bright.cy, baseY: bright.baseY, cx: bright.cx, boxCx: 300, bright: bright.color, dark: dark.color, rw: bright.rw, footW: bright.footW, tintBright: P.tintPlan([240, 240, 240]), tintDark: P.tintPlan([10, 10, 20]), tintNone: P.tintPlan(null),
        audit: P.readabilityAudit([{ type: 'text', size: 22 }, { type: 'text', size: 26 }, { type: 'shape', size: 5 }, { type: 'cta', size: 24, hidden: true }]).length }; });
    ok(r.floor >= 26, 'floor'); ok(Math.abs(r.cy - r.baseY) < 12 && r.cy <= r.baseY, 'shadow sits at the base'); ok(r.cx > r.boxCx, 'light from upper left → shadow pulled right'); ok(r.rw < r.footW, 'contact shadow narrower than the foot');
    const a = (c) => Number(c.match(/([\d.]+)\)$/)[1]); ok(a(r.bright) > a(r.dark), 'brighter floor → stronger shadow'); ok(r.tintNone === null, 'no sample → no cast');
    ok(r.tintBright.nudge && r.tintBright.nudge.startsWith('rgba(255') && r.tintDark.nudge.startsWith('rgba(0,0,0'), 'bright scene lifts, dark scene dims'); ok(r.audit === 1, 'audit counts only visible text below the floor'); });
  await t('a transparent product gets a contact shadow and the scene\'s light; an opaque photo goes on a card', async () => {
    const r = await page.evaluate(async () => {
      const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); f(x); return c.toDataURL('image/png'); };
      const cutout = mk(400, 300, (x) => { x.fillStyle = '#808080'; x.fillRect(100, 40, 200, 200); });      // grey block with transparent surround
      const opaque = mk(400, 300, (x) => { x.fillStyle = '#808080'; x.fillRect(0, 0, 400, 300); });
      const CTX = { ok: true, preview: false, head_office: true, can_edit: true, location_id: 'L1', locations: [{ id: 'L1', name: 'Acme', city: 'Dayton', can_edit: true }], dealer: { name: 'Acme', address: '', city: 'Dayton', state: 'OH', phone: '', website: '', link: '', has_logo: false },
        products: [{ manufacturer: 'm', code: 'C1', name: 'Cutout', category: 'Chairs', image: '/c', price: null, price_label: 'Call for Price' }], brand: { primary: '#123456', accent: '#cc3300', source: 'storefront' }, templates: [], formats: { square: { w: 1080, h: 1080, label: 'Square' } }, fonts: ['Inter'], ctas: [], limits: {} };
      let IMG = cutout; const api = async (b) => b.action === 'ads_context' ? CTX : b.action === 'ads_list' ? { ok: true, ads: [] } : b.action === 'ad_image' ? { ok: true, data_url: IMG } : { ok: true };
      await window.HCPSAdBuilder.mount(document.getElementById('host'), { api, esc: (s) => String(s) });
      const S = window.HCPSAdBuilder._state; const out = {};
      for (const [name, bg, img] of [['cutout-bright', '#f1f3f6', cutout], ['cutout-dark', '#0b1f33', cutout], ['opaque', '#f1f3f6', opaque]]) {
        IMG = img; S.images.clear(); const cur = { template: 'st-spotlight', format: 'square', font: 'Inter', colors: { bg, accent: '#ef6325', text: '#111111' }, products: [{ manufacturer: 'm', code: 'C1', show_price: true }], show: { logo: false }, headline: '', subheadline: '', body: '', cta: '', features: [],
          layouts: { square: [{ id: 'bgsh', type: 'shape', shape: 'rect', x: 0, y: 0, w: 1, h: 1, fill: bg }, { id: 'p', type: 'image', product: 0, x: 0.25, y: 0.2, w: 0.5, h: 0.5, fit: 'contain' }] } };
        const cv = document.createElement('canvas'); await window.HCPSAdBuilder._draw(cv, cur, 1); const x = cv.getContext('2d'); const px = (X, Y) => Array.from(x.getImageData(X, Y, 1, 1).data);
        // product image drawn at x 270..810 (540 wide), y 216..756 → contain: scale 1.35 → 540x405, top at 216+67=283; the grey block spans x 405..675, y 337..607
        out[name] = { base: px(540, name === 'opaque' ? 694 : 612), far: px(540, 800), above: px(540, 200), block: px(540, 470), side: px(150, 612), cardEdge: px(281, 420) }; }
      return out; });
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    ok(lum(r['cutout-bright'].base) < lum(r['cutout-bright'].far) - 20, 'a shadow darkens the floor just under the base (bright scene): ' + JSON.stringify(r['cutout-bright']));
    /* 2026-11-11: an opaque photo placed without a frame is shown on a white card that hugs it (never a bare rectangle on the scene) */
    ok(lum(r.opaque.cardEdge) > 250 && lum(r.opaque.block) < 140, 'an opaque photo sits on a card: ' + JSON.stringify(r.opaque));
    ok(lum(r['cutout-bright'].above) > 230, 'nothing is drawn above the product'); ok(lum(r['cutout-dark'].base) <= lum(r['cutout-dark'].far) + 1, 'dark scene: shadow never lightens the floor');
    const g = (p) => p[0]; ok(g(r['cutout-bright'].block) !== g(r['cutout-dark'].block), 'the product\'s light follows the scene (bright vs dark): ' + g(r['cutout-bright'].block) + ' vs ' + g(r['cutout-dark'].block)); });
  await t('readability: no text is drawn below the floor, even when the design asks for less (measured from the canvas)', async () => {
    const r = await page.evaluate(async () => { const P = window.__ADB_PURE; const cv = document.createElement('canvas'); const S = window.HCPSAdBuilder._state;
      const spy = []; const proto = CanvasRenderingContext2D.prototype, orig = Object.getOwnPropertyDescriptor(proto, 'font'); Object.defineProperty(proto, 'font', { set(v) { spy.push(v); orig.set.call(this, v); }, get() { return orig.get.call(this); } });
      const cur = { template: 'st-spotlight', format: 'square', font: 'Inter', colors: { bg: '#ffffff', accent: '#ef6325', text: '#111111' }, products: [], show: { logo: false }, headline: 'x', subheadline: '', body: '', cta: '', features: [],
        layouts: { square: [{ id: 't1', type: 'text', bind: 'custom', text: 'Small print that asks for 12px', x: 0.1, y: 0.1, w: 0.8, h: 0.05, size: 12, weight: 600, color: 'text', lines: 1 }, { id: 't2', type: 'text', bind: 'custom', text: 'A very long headline that cannot possibly fit on a single line of this narrow box at any size', x: 0.1, y: 0.3, w: 0.3, h: 0.05, size: 60, weight: 800, color: 'text', lines: 1 }] } };
      await window.HCPSAdBuilder._draw(cv, cur, 1); Object.defineProperty(proto, 'font', orig);
      const sizes = spy.map((f) => Number((String(f).match(/(\d+(?:\.\d+)?)px/) || [])[1])).filter((n) => n && n < 100 && n > 0); return { min: Math.min(...sizes), floor: P.READ_FLOOR, n: sizes.length }; });
    ok(r.n >= 2 && r.min >= r.floor - 0.01, 'smallest drawn font ' + r.min + ' < floor ' + r.floor); });
  await browser.close(); console.log(`\nad scene ground: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
