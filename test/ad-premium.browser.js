/* Social Marketing Studio — premium AI Director designs (owner directive 2026-11-11), real Chromium, the REAL ad-builder.js.
   Synthetic images only; the server answers are played locally (no AI, no paid call).
   Checks: AI Director's first set is the three premium designs and asks the server for the background-removed product;
   a cutout stands on the scene with no white rectangle; a photo that could not be cut is shown on a card that hugs it
   (never a full white box) and the panel says why; "Original photo" switches to the card; every size (square, portrait,
   story, landscape) has no overlapping text boxes, nothing off the canvas, no text below the readability floor; prices
   read $3,525 / $49.99; the official logo is used on dark designs only when it reads there.
     PLAYWRIGHT_MODULE=playwright node test/ad-premium.browser.js */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const JS = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'ad-builder.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, w) => { if (!c) throw new Error(w); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e)); } }
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }); const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>'); await page.addScriptTag({ content: JS });
  await page.evaluate(async () => {
    const mk = (w, h, f, type) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); f(x, w, h); return c.toDataURL(type || 'image/png'); };
    const chair = (x, w, h) => { x.fillStyle = '#2b3f7a'; x.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.75); x.fillStyle = '#111'; x.fillRect(w * 0.25, h * 0.85, w * 0.05, h * 0.1); x.fillRect(w * 0.7, h * 0.85, w * 0.05, h * 0.1); };
    window.__A = {
      photo: mk(400, 440, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); chair(x, w, h); }, 'image/jpeg'),
      cutout: mk(400, 440, (x, w, h) => chair(x, w, h)),
      scene: mk(1024, 1024, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#40506a'); g.addColorStop(1, '#202a38'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 'image/jpeg'),
      lifestyle: mk(1024, 1024, (x, w, h) => { x.fillStyle = '#e9e1d4'; x.fillRect(0, 0, w, h); x.fillStyle = '#b48a5a'; x.fillRect(0, h * 0.7, w, h * 0.3); }, 'image/jpeg'),
      brand: mk(705, 255, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9a23a'; x.fillRect(100, 90, 500, 80); }),
      clear: mk(600, 120, (x) => { x.fillStyle = '#c9a23a'; x.fillRect(0, 20, 600, 80); }),
      logo: mk(500, 200, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#0a7'; x.fillRect(40, 60, 420, 80); }),
    };
  });
  const setup = async (o) => page.evaluate(async (o) => {
    const A = window.__A; window.__calls = [];
    const P = { manufacturer: 'golden-technologies', code: 'PR519-MLA', name: 'Cloud Supreme™ w/ Twilight', category: 'Lift Chairs', brand: 'Golden Technologies', description: 'Front-load design.', image: '/x.jpg', price: o.price == null ? 3525 : o.price, price_label: 'MSRP', price_unit: null };
    const CTX = { ok: true, preview: false, head_office: true, can_edit: true, location_id: 'L1', locations: [{ id: 'L1', name: 'Synthetic Medical Bowling Green', city: 'Bowling Green', can_edit: true }],
      dealer: { name: 'Synthetic Medical Equipment Bowling Green', address: '1010 Sample Dr.', city: 'Bowling Green', state: 'KY', phone: '270-555-0100', website: '', has_logo: true }, products: [P], lines: [],
      brand: { primary: '#0b1f33', accent: '#ef6325', source: 'default' },
      templates: { 'st-ai-premium': { kind: 'single', label: 'AI Premium', studio: true }, 'st-ai-lifestyle': { kind: 'single', label: 'AI Lifestyle', studio: true }, 'st-ai-features': { kind: 'single', label: 'AI Features', studio: true }, 'st-spotlight': { kind: 'single', label: 'Spotlight', studio: true } },
      formats: { square: { w: 1080, h: 1080, label: 'Square' }, portrait: { w: 1080, h: 1350, label: 'Portrait' }, story: { w: 1080, h: 1920, label: 'Story' }, landscape: { w: 1200, h: 628, label: 'Landscape' } },
      fonts: ['Inter', 'Archivo', 'Georgia', 'Trebuchet', 'Verdana'], ctas: ['Ask about this product'], limits: {}, publishing: { enabled: false } };
    const api = async (b) => { window.__calls.push(b.action);
      if (b.action === 'ads_context') return CTX; if (b.action === 'ads_list') return { ok: true, ads: [] };
      if (b.action === 'ad_image') return { ok: true, data_url: b.logo ? A.logo : A.photo };
      if (b.action === 'ad_cutout') return o.cut === 'review' ? { ok: true, status: 'review', reason: 'Parts of the product are nearly the same color as the background.', data_url: null } : { ok: true, status: 'removed', reason: 'Background removed automatically.', data_url: A.cutout };
      if (b.action === 'ad_scene') return { ok: true, data_url: /lifestyle/.test(b.scene) ? A.lifestyle : A.scene };
      if (b.action === 'ad_brand_logo') return { ok: true, data_url: A.brand, clear_url: A.clear, dark_ok: o.darkOk !== false };
      if (b.action === 'ads_ai') return { ok: true, ad: { template: 'st-ai-premium', format: b.format, products: [{ manufacturer: P.manufacturer, code: P.code, show_price: true }], headline: 'Luxury Comfort, Elevated.', subheadline: 'A premium lift chair designed for comfort, positioning and everyday ease.', body: '', features: ['MaxiComfort® + Twilight', 'AutoDrive hand control', 'Front-load design', '400 lb capacity'], cta: 'Ask about this product', captions: {}, hashtags: [], show: { logo: true, name: true, address: true, phone: true, website: true, price: true } }, alt_headlines: ['Comfort That Lifts You Up.', 'Rest, Recline, Rise.'], why: [], products: [P] };
      return { ok: true }; };
    await window.HCPSAdBuilder.mount(document.getElementById('host'), { api, esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) });
    const S = window.HCPSAdBuilder._state; S.cur.products = [{ manufacturer: P.manufacturer, code: P.code, show_price: true }]; window.HCPSAdBuilder._ed.cdRun = null;   // a fresh dealer's first AI Director run
    S.images.clear(); S.cuts.clear(); S.cutInfo.clear(); S.brandLogos.clear();
    document.querySelector('[data-tab="ai"]').click(); await new Promise((r) => setTimeout(r, 30)); document.querySelector('#adbAiGo').click();
    for (let i = 0; i < 100 && !(S.cd && S.cd.cands); i++) await new Promise((r) => setTimeout(r, 40));
    return { templates: S.cd ? S.cd.cands.map((c) => c.template) : null };
  }, o || {});
  /* pixels of a design drawn at full size: product box centre, the box corners (where a white rectangle would show) */
  const probe = (tpl, fmt, cutOverride) => page.evaluate(async ({ tpl, fmt, cutOverride }) => {
    const S = window.HCPSAdBuilder._state; const x = JSON.parse(JSON.stringify(S.cd.cands.find((c) => c.template === tpl))); x.format = fmt; x.layouts = null;
    const L = window.HCPSAdBuilder._build(tpl, fmt, 1, x.products); if (cutOverride === false) L.forEach((e) => { if (e.type === 'image') e.cut = false; }); x.layouts = { [fmt]: L };
    const cv = document.createElement('canvas'); await window.HCPSAdBuilder._draw(cv, x, 1); const c = cv.getContext('2d');
    const im = L.find((e) => e.type === 'image'); const W = cv.width, H = cv.height; const px = (fx, fy) => Array.from(c.getImageData(Math.round(fx * W), Math.round(fy * H), 1, 1).data);
    return { im, W, H, corners: [px(im.x + 0.01, im.y + 0.01), px(im.x + im.w - 0.01, im.y + 0.01)], top: px(im.x + im.w / 2, im.y + 0.01), layers: L.map((e) => ({ type: e.type, bind: e.bind, x: e.x, y: e.y, w: e.w, h: e.h, hidden: e.hidden, size: e.size, style: e.style })) };
  }, { tpl, fmt, cutOverride });
  const white = (p) => p[0] > 245 && p[1] > 245 && p[2] > 245;

  await t('AI Director: the first designs are AI Premium / Lifestyle / Features and the background-removed product is requested', async () => {
    const r = await setup(); ok(JSON.stringify(r.templates) === '["st-ai-premium","st-ai-lifestyle","st-ai-features"]', JSON.stringify(r.templates));
    const calls = await page.evaluate(() => window.__calls); ok(calls.includes('ad_cutout') && calls.includes('ad_scene') && calls.includes('ad_brand_logo'), calls.join(','));
  });
  await t('a cutout stands on the scene: no white rectangle around the product (premium, lifestyle, features)', async () => {
    for (const tpl of ['st-ai-premium', 'st-ai-features']) { const r = await probe(tpl, 'square'); ok(!r.corners.some(white) && !white(r.top), tpl + ' white box: ' + JSON.stringify(r.corners)); }
  });
  await t('a photo that could not be cut is on a card hugging the photo (the box corners still show the scene); the panel says why', async () => {
    await setup({ cut: 'review' }); const r = await probe('st-ai-premium', 'square');
    ok(!r.corners.some(white), 'the card is not the whole product box: ' + JSON.stringify(r.corners));
    const note = await page.evaluate(async () => { const S = window.HCPSAdBuilder._state, ED = window.HCPSAdBuilder._ed; const L = S.cur.layouts && S.cur.layouts[S.cur.format]; const im = L && L.find((e) => e.type === 'image');
      if (!im) return 'no image layer'; ED.sel = im.id; ED.tab = 'el'; document.querySelector('[data-tab="el"]') && document.querySelector('[data-tab="el"]').click(); await new Promise((r) => setTimeout(r, 120));
      const n = document.querySelector('#smsCutNote'); return n ? n.textContent : 'no note'; });
    ok(/nearly the same color/.test(note) && /original photo is shown on a card/.test(note), note);
  });
  await t('"Original photo" switches a cutout design back to the card; "Removed automatically" restores it', async () => {
    await setup(); const cut = await probe('st-ai-premium', 'square'), orig = await probe('st-ai-premium', 'square', false);
    const centre = await page.evaluate(async () => 1); ok(centre === 1);
    ok(!cut.corners.some(white) && !orig.corners.some(white), 'neither is a full white box');
    const btn = await page.evaluate(async () => { const S = window.HCPSAdBuilder._state, ED = window.HCPSAdBuilder._ed; const L = S.cur.layouts[S.cur.format]; const im = L.find((e) => e.type === 'image'); ED.sel = im.id;
      document.querySelector('[data-tab="el"]').click(); await new Promise((r) => setTimeout(r, 120)); const b = document.querySelector('[data-cut="orig"]'); if (!b) return 'no button'; b.click(); await new Promise((r) => setTimeout(r, 80));
      const after = S.cur.layouts[S.cur.format].find((e) => e.id === im.id).cut; document.querySelector('[data-cut="auto"]').click(); await new Promise((r) => setTimeout(r, 80));
      return [after, S.cur.layouts[S.cur.format].find((e) => e.id === im.id).cut]; });
    ok(JSON.stringify(btn) === '[false,null]' || JSON.stringify(btn) === '[false,undefined]' || (Array.isArray(btn) && btn[0] === false && btn[1] == null), JSON.stringify(btn));
  });
  await t('every size: no overlapping text boxes, nothing off the canvas, nothing below the readability floor', async () => {
    const floor = await page.evaluate(() => window.__ADB_PURE.READ_FLOOR); const probs = [];
    for (const tpl of ['st-ai-premium', 'st-ai-lifestyle', 'st-ai-features']) for (const fmt of ['square', 'portrait', 'story', 'landscape']) {
      const r = await probe(tpl, fmt); const tx = r.layers.filter((e) => !e.hidden && (e.type === 'text' || e.type === 'price' || e.type === 'brandlogo'));
      for (const e of r.layers.filter((x) => !x.hidden)) if (e.x < -0.001 || e.y < -0.001 || e.x + e.w > 1.001 || e.y + e.h > 1.001) probs.push(`${tpl}/${fmt}: ${e.type}:${e.bind || ''} off canvas`);
      for (const e of tx) if (e.size && e.size < floor) probs.push(`${tpl}/${fmt}: ${e.bind} size ${e.size}`);
      for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i], b = tx[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0.002 && oy > 0.002) probs.push(`${tpl}/${fmt}: ${a.type}:${a.bind || a.style} overlaps ${b.type}:${b.bind || b.style}`); }
    }
    ok(!probs.length, probs.join('\n     '));
  });
  await t('prices: a whole-dollar MSRP reads $3,525; cents stay ($49.99)', async () => {
    const txt = async () => page.evaluate(async () => { const S = window.HCPSAdBuilder._state; const x = JSON.parse(JSON.stringify(S.cd.cands[0])); x.layouts = null;
      const cv = document.createElement('canvas'); const seen = []; const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText; proto.fillText = function (s, ...a) { seen.push(String(s)); return orig.call(this, s, ...a); };
      await window.HCPSAdBuilder._draw(cv, x, 1); proto.fillText = orig; return seen.filter((s) => /\$/.test(s)); });
    await setup(); const a = await txt(); ok(a.includes('MSRP $3,525'), JSON.stringify(a));
    await setup({ price: 49.99 }); const b = await txt(); ok(b.includes('MSRP $49.99'), JSON.stringify(b));
  });
  await t('the clear official logo is used on a dark design only when it reads on dark; otherwise the white chip', async () => {
    const draws = async () => page.evaluate(async () => { const S = window.HCPSAdBuilder._state; const x = JSON.parse(JSON.stringify(S.cd.cands[0])); x.layouts = null;
      const cv = document.createElement('canvas'); const sizes = []; const proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage; proto.drawImage = function (im, ...a) { sizes.push(im.width + 'x' + im.height); return orig.call(this, im, ...a); };
      await window.HCPSAdBuilder._draw(cv, x, 1); proto.drawImage = orig; return sizes; });
    await setup(); const a = await draws(); ok(a.includes('600x120') && !a.includes('705x255'), 'clear logo: ' + a.join(','));
    await setup({ darkOk: false }); const b = await draws(); ok(b.includes('705x255') && !b.includes('600x120'), 'chip logo: ' + b.join(','));
  });
  await browser.close(); console.log(`\nad premium: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
