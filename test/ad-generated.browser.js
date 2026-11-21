/* Social Marketing Studio — generated designs stay reachable, and "+ New design" works (owner 2026-11-20 23:31: three
   StrongBack designs were made with "Create 3 designs" but never saved, and "+ New design" seemed to do nothing).
   Real Chromium, the REAL ad-builder.js; the server is played locally (no AI, nothing saved anywhere real).
   Checks: each of the 3 designs has ⬇ PNG (an image file is made); "Save all 3" saves three designs; unsaved designs are
   remembered in this browser and offered again after leaving the studio ("Your last generated designs — not saved yet"),
   and reopen into the picker; "+ New design" closes the picker, empties the canvas, scrolls to it and says so; a saved
   design downloads straight from "Your saved designs".
     PLAYWRIGHT_MODULE=playwright node test/ad-generated.browser.js */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const JS = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'ad-builder.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, w) => { if (!c) throw new Error(w); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e)); } }
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.route('https://studio.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="host"></div></body></html>' }));
  await page.goto('https://studio.test/');   // a real origin, so localStorage works as on the portal
  await page.addScriptTag({ content: JS });
  const mount = () => page.evaluate(async () => {
    const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c.toDataURL('image/png'); };
    const photo = mk(400, 440, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#189fe0'; x.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.75); });
    const P = { manufacturer: 'strongback-mobility', code: 'SB-TEST', name: 'Synthetic Lightweight Wheelchair', category: 'Wheelchairs', brand: 'Strongback', description: 'Synthetic.', image: '/x.jpg', price: 499, price_label: 'MSRP', price_unit: null };
    window.__calls = window.__calls || []; window.__saved = window.__saved || [];
    const CTX = { ok: true, preview: false, head_office: true, can_edit: true, location_id: 'L1', locations: [{ id: 'L1', name: 'Synthetic Medical', city: 'Nashville', can_edit: true }],
      dealer: { name: 'Synthetic Medical', address: '1 Sample St.', city: 'Nashville', state: 'TN', phone: '615-555-0100', website: '', has_logo: false }, products: [P], lines: [],
      brand: { primary: '#0b1f33', accent: '#ef6325', source: 'default' },
      templates: { 'st-ai-premium': { kind: 'single', label: 'AI Premium', studio: true }, 'st-ai-lifestyle': { kind: 'single', label: 'AI Lifestyle', studio: true }, 'st-ai-features': { kind: 'single', label: 'AI Features', studio: true }, 'st-spotlight': { kind: 'single', label: 'Spotlight', studio: true } },
      formats: { square: { w: 1080, h: 1080, label: 'Square' }, portrait: { w: 1080, h: 1350, label: 'Portrait' }, story: { w: 1080, h: 1920, label: 'Story' }, landscape: { w: 1200, h: 628, label: 'Landscape' } },
      fonts: ['Inter'], ctas: ['Ask about this product'], limits: {}, publishing: { enabled: false } };
    const AD = { template: 'st-ai-premium', format: 'square', products: [{ manufacturer: P.manufacturer, code: P.code, show_price: true }], headline: 'Light to Lift, Built to Last.', subheadline: 'A lightweight chair.', body: '', features: ['Lightweight frame'], cta: 'Ask about this product', captions: {}, hashtags: [], show: { logo: false, name: true, address: true, phone: true, website: true, price: true } };
    const api = async (b) => { window.__calls.push(b.action);
      if (b.action === 'ads_context') return CTX;
      if (b.action === 'ads_list') return { ok: true, ads: window.__saved.map((x) => ({ id: x.id, dealer_id: 'L1', title: x.ad.title, template: x.ad.template, format: x.ad.format, updated_at: new Date().toISOString() })) };
      if (b.action === 'ads_save') { const id = 'a' + (window.__saved.length + 1); window.__saved.push({ id, ad: b.ad }); return { ok: true, row: { id, version: 1, dealer_id: 'L1' } }; }
      if (b.action === 'ads_get') { const x = window.__saved.find((y) => y.id === b.id); return x ? { ok: true, row: { id: x.id, version: 1, dealer_id: 'L1' }, ad: x.ad, problems: [] } : { ok: false, error: 'nf' }; }
      if (b.action === 'ads_check') return { ok: true, products: [P] };
      if (b.action === 'ad_image' || b.action === 'ad_cutout') return { ok: true, status: 'removed', data_url: photo };
      if (b.action === 'ad_scene') return { ok: true, data_url: photo };
      if (b.action === 'ads_ai') return { ok: true, ad: Object.assign({}, AD, { format: b.format }), alt_headlines: ['Go Further.', 'Ride Light.'], why: [], products: [P] };
      return { ok: true }; };
    document.getElementById('host').innerHTML = '';
    await window.HCPSAdBuilder.mount(document.getElementById('host'), { api, esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) });
    window.HCPSAdBuilder._state.cur.products = [{ manufacturer: P.manufacturer, code: P.code, show_price: true }];
  });
  try {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await mount();
    await page.click('[data-tab="ai"]'); await page.click('#adbAiGo');
    await page.waitForFunction(() => { const S = window.HCPSAdBuilder._state; return S.cd && S.cd.cands && document.querySelectorAll('[data-cddl]').length === 3; }, null, { timeout: 15000 });
    const pick = await page.evaluate(() => ({ dl: document.querySelectorAll('[data-cddl]').length, all: !!document.querySelector('#adbCdSaveAll'), note: /Not saved yet/.test(document.querySelector('.adb-ai').innerText), remembered: !!localStorage.getItem('hcps_adb_gen_v1:L1') }));
    await t('the three designs each have ⬇ PNG and "Save all 3", say they are not saved yet, and are remembered in this browser', () => ok(pick.dl === 3 && pick.all && pick.note && pick.remembered, JSON.stringify(pick)));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-cddl="1"]')]);
    await t('⬇ PNG on design 2 makes an image file', () => ok(/\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename()));
    // leave the studio without saving and come back
    await mount();
    const back = await page.evaluate(() => ({ gen: (document.querySelector('#adbGen') || {}).innerText || '', saved: window.__saved.length }));
    await t('after leaving the studio, "Your last generated designs — not saved yet" is offered (nothing was saved on the server)', () => ok(/Your last generated designs/.test(back.gen) && /not saved yet/.test(back.gen) && back.saved === 0, JSON.stringify(back)));
    await page.click('#adbGenOpen');
    const re = await page.evaluate(() => ({ cands: (window.HCPSAdBuilder._state.cd || { cands: [] }).cands.length, head: window.HCPSAdBuilder._state.cur.headline }));
    await t('"Open these designs" brings the three designs back into the picker', () => ok(re.cands === 3 && re.head === 'Light to Lift, Built to Last.', JSON.stringify(re)));
    // + New design
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#adbNew'); await page.waitForTimeout(300);
    const nw = await page.evaluate(() => { const S = window.HCPSAdBuilder._state; return { cd: S.cd, products: S.cur.products.length, head: S.cur.headline, msg: document.querySelector('#adbMsg').textContent, pickers: document.querySelectorAll('[data-cddl]').length, gen: /Your last generated designs/.test((document.querySelector('#adbGen') || {}).innerText || ''), y: window.scrollY }; });
    await t('"+ New design": the picker closes, the canvas is empty, the page moves to it and says so; the unsaved designs stay offered', () => ok(nw.cd === null && nw.products === 0 && !nw.head && nw.pickers === 0 && /New design/.test(nw.msg) && nw.gen && nw.y > 0, JSON.stringify(nw)));
    // Save all 3
    await page.click('#adbGenSave'); await page.waitForFunction(() => /Saved all 3/.test(document.querySelector('#adbMsg').textContent), null, { timeout: 10000 });
    const sv = await page.evaluate(() => ({ n: window.__saved.length, titles: window.__saved.map((x) => x.ad.title), list: document.querySelectorAll('[data-sdl]').length, gen: (document.querySelector('#adbGen') || {}).innerText || '', ls: localStorage.getItem('hcps_adb_gen_v1:L1') }));
    await t('"Save all 3" saves three designs (titled design 1–3), lists them with ⬇ PNG, and stops offering the unsaved set', () => ok(sv.n === 3 && sv.titles.every((x, i) => new RegExp('design ' + (i + 1) + '$').test(x)) && sv.list === 3 && !sv.gen && !sv.ls, JSON.stringify(sv)));
    const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-sdl="a2"]')]);
    await t('a saved design downloads straight from Your saved designs (opened and re-checked first)', async () => { const c = await page.evaluate(() => window.__calls.slice(-6)); ok(/\.png$/.test(dl2.suggestedFilename()) && c.includes('ads_get') && c.includes('ads_check'), dl2.suggestedFilename() + ' ' + c.join(',')); });
  } finally { await browser.close(); }
  console.log(`\nad generated designs: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
