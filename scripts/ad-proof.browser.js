/* Social Marketing Studio — rendering proof. Runs the REAL Studio code (public/assets/ad-builder.js) in Chromium, drives the
   AI Director button exactly as a dealer does, and writes the designs it produces as PNG files. The server answers are
   played from local files you pass in (the product's official photo, its cutout from netlify/functions/_cutout.js in the
   admin repo, the cached Gemini scenes, the manufacturer logo, the dealer logo) — so no AI or paid call is made.
     node scripts/ad-proof.browser.js <assets.json> <outDir>
   assets.json: { dealer:{…}, product:{manufacturer,code,name,category,brand,description,image,price,price_label},
                  photo, cutout?, cutout_status?, scenes:{premium,features,lifestyle-chair,…}, brand_logo, brand_clear?, brand_dark_ok?,
                  dealer_logo?, ai:{ headline, subheadline, body, features[], cta, alt_headlines[] }, formats?:[…] } */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const JS = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'ad-builder.js'), 'utf8');
const [cfgPath, out] = process.argv.slice(2); const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); fs.mkdirSync(out, { recursive: true });
const dataUrl = (f) => { if (!f) return null; const b = fs.readFileSync(path.resolve(path.dirname(cfgPath), f)); const ext = path.extname(f).slice(1).toLowerCase();
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${b.toString('base64')}`; };
const A = { photo: dataUrl(cfg.photo), cutout: dataUrl(cfg.cutout), brand: dataUrl(cfg.brand_logo), clear: dataUrl(cfg.brand_clear), logo: dataUrl(cfg.dealer_logo), scenes: {} };
for (const [k, f] of Object.entries(cfg.scenes || {})) A.scenes[k] = dataUrl(f);
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }); const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.setContent('<!doctype html><html><body><div id="host"></div></body></html>'); await page.addScriptTag({ content: JS });
  const res = await page.evaluate(async ({ cfg, A }) => {
    const calls = [];
    const CTX = { ok: true, preview: false, head_office: true, can_edit: true, location_id: 'L1', locations: [{ id: 'L1', name: cfg.dealer.name, city: cfg.dealer.city, can_edit: true }],
      dealer: Object.assign({ has_logo: !!A.logo }, cfg.dealer), products: [cfg.product], lines: [], brand: { primary: '#0b1f33', accent: '#ef6325', source: 'default' },
      templates: { 'st-ai-premium': { kind: 'single', label: 'AI Premium', studio: true }, 'st-ai-lifestyle': { kind: 'single', label: 'AI Lifestyle', studio: true }, 'st-ai-features': { kind: 'single', label: 'AI Features', studio: true }, 'st-spotlight': { kind: 'single', label: 'Spotlight', studio: true } },
      formats: { square: { w: 1080, h: 1080, label: 'Square — Instagram / Facebook feed' }, portrait: { w: 1080, h: 1350, label: 'Portrait' }, story: { w: 1080, h: 1920, label: 'Story' }, landscape: { w: 1200, h: 628, label: 'Landscape' } },
      fonts: ['Inter', 'Archivo', 'Georgia', 'Trebuchet', 'Verdana'], ctas: ['Ask about this product', 'Visit us today'], limits: {}, publishing: { enabled: false } };
    const api = async (b) => { calls.push(b.action);
      if (b.action === 'ads_context') return CTX; if (b.action === 'ads_list') return { ok: true, ads: [] };
      if (b.action === 'ad_image') return b.logo ? (A.logo ? { ok: true, data_url: A.logo } : { ok: false }) : { ok: true, data_url: A.photo };
      if (b.action === 'ad_cutout') return A.cutout ? { ok: true, status: cfg.cutout_status || 'removed', reason: 'Background removed automatically.', data_url: A.cutout } : { ok: true, status: 'review', reason: cfg.cutout_reason || 'Not cut', data_url: null };
      if (b.action === 'ad_scene') return A.scenes[b.scene] ? { ok: true, data_url: A.scenes[b.scene] } : { ok: false };
      if (b.action === 'ad_brand_logo') return A.brand ? { ok: true, data_url: A.brand, clear_url: A.clear, dark_ok: cfg.brand_dark_ok !== false } : { ok: false };
      if (b.action === 'ads_ai') return { ok: true, ad: Object.assign({ template: 'st-ai-premium', format: b.format, products: [{ manufacturer: cfg.product.manufacturer, code: cfg.product.code, show_price: true }], show: { logo: true, name: true, address: true, phone: true, website: true, price: true }, captions: {}, hashtags: [] }, cfg.ai),
        alt_headlines: cfg.ai.alt_headlines || [], why: [], products: [cfg.product] };
      return { ok: true }; };
    await window.HCPSAdBuilder.mount(document.getElementById('host'), { api, esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) });
    const S = window.HCPSAdBuilder._state;
    /* the dealer's own path: the product is on the ad, then "AI Director → Create 3 designs" */
    S.cur.products = [{ manufacturer: cfg.product.manufacturer, code: cfg.product.code, show_price: true }];
    const tab = document.querySelector('[data-tab="ai"]'); if (tab) tab.click(); await new Promise((r) => setTimeout(r, 50));
    const go = document.querySelector('#adbAiGo'); if (!go) return { error: 'no AI Director button', calls };
    go.click(); for (let i = 0; i < 100 && !(S.cd && S.cd.cands); i++) await new Promise((r) => setTimeout(r, 50));
    if (!(S.cd && S.cd.cands)) return { error: 'AI Director produced no designs', calls };
    const outs = [];
    for (const fmt of cfg.formats || ['square']) for (const cand of S.cd.cands) {
      const x = JSON.parse(JSON.stringify(cand)); x.format = fmt; x.layouts = null;
      const cv = document.createElement('canvas'); await window.HCPSAdBuilder._draw(cv, x, 1);
      outs.push({ name: cand.template + '-' + fmt, png: cv.toDataURL('image/png') }); }
    /* the editor's own canvas (what the dealer sees) */
    await new Promise((r) => setTimeout(r, 400)); const ed = document.querySelector('#adbCanvas, canvas.adb-canvas, .adb-stage canvas');
    return { outs, calls, templates: S.cd.cands.map((c) => c.template), editor: ed ? ed.toDataURL('image/png') : null };
  }, { cfg, A });
  if (res.error) { console.error(res.error, res.calls); process.exit(1); }
  for (const o of res.outs) fs.writeFileSync(path.join(out, o.name + '.png'), Buffer.from(o.png.split(',')[1], 'base64'));
  if (res.editor) fs.writeFileSync(path.join(out, 'editor-canvas.png'), Buffer.from(res.editor.split(',')[1], 'base64'));
  console.log('designs:', res.templates.join(', '), '| server calls:', [...new Set(res.calls)].join(', '), '| files:', res.outs.length);
  await browser.close();
})();
