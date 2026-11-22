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
      if (b.action === 'ads_save' && window.__failSaves > 0) { window.__failSaves--; return { ok: false, error: 'The library could not be reached just now.' }; }
      if (b.action === 'ads_save') { window.__keys = window.__keys || [];
        const had = b.save_key && window.__saved.find((y) => y.key === b.save_key); if (had) { window.__keys.push(b.save_key); return { ok: true, row: { id: had.id, version: 1, dealer_id: 'L1' }, existing: true }; }
        const id = 'a' + (window.__saved.length + 1); window.__saved.push({ id, ad: b.ad, key: b.save_key }); window.__keys.push(b.save_key);
        if (window.__loseSaves > 0) { window.__loseSaves--; throw new Error('network'); }   // saved on the server, but the answer never arrives
        return { ok: true, row: { id, version: 1, dealer_id: 'L1' } }; }
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
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__failSaves = 0; });
    await mount();
    const make = async () => { await page.click('[data-tab="ai"]'); await page.click('#adbAiGo');
      await page.waitForFunction(() => { const S = window.HCPSAdBuilder._state; return S.cd && S.cd.cands && !S.cd.saving && document.querySelectorAll('[data-cddl]').length === 3 && /Saved|not saved yet|Retry/i.test(document.querySelector('#adbMsg').textContent); }, null, { timeout: 15000 }); };
    await make();
    const a = await page.evaluate(() => ({ saved: window.__saved.map((x) => ({ title: x.ad.title, caption: x.ad.caption, tags: x.ad.hashtags, head: x.ad.headline })), marks: [...document.querySelectorAll('.adb-cds')].map((x) => x.textContent), msg: document.querySelector('#adbMsg').textContent, list: document.querySelectorAll('[data-sdl]').length, ls: localStorage.getItem('hcps_adb_gen_v1:L1'), row: window.HCPSAdBuilder._state.row }));
    await t('every generated design and its caption is saved at once as a private library draft; each says "✓ Saved to your library"; nothing left only in the browser', () => ok(a.saved.length === 3 && a.saved.every((x, i) => new RegExp('AI design ' + (i + 1) + '$').test(x.title) && x.head) && a.marks.every((m) => /Saved to your library/.test(m)) && /Saved all 3 designs and their captions/.test(a.msg) && a.list === 3 && !a.ls && a.row && a.row.id === 'a1', JSON.stringify(a)));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-cddl="1"]')]);
    await t('⬇ PNG on a design still makes an image file', () => ok(/\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename()));
    // a save that fails: the designs stay, downloadable, with Retry; the unsaved one is kept in this browser
    await page.evaluate(() => { window.__failSaves = 1; });
    await make();
    const f = await page.evaluate(() => ({ marks: [...document.querySelectorAll('.adb-cds')].map((x) => x.textContent), retry: !!document.querySelector('#adbCdRetry'), dl: document.querySelectorAll('[data-cddl]').length, msg: document.querySelector('#adbMsg').textContent, ls: !!localStorage.getItem('hcps_adb_gen_v1:L1'), n: window.__saved.length }));
    await t('a failed save keeps the designs on screen with ⬇ PNG and a Retry, says which were saved, and keeps them in this browser', () => ok(f.retry && f.dl === 3 && f.marks.filter((m) => /Not saved yet/.test(m)).length === 1 && /Saved 2 of 3/.test(f.msg) && f.ls && f.n === 5, JSON.stringify(f)));
    await page.click('#adbCdRetry'); await page.waitForFunction(() => /Saved all 3/.test(document.querySelector('#adbMsg').textContent), null, { timeout: 10000 });
    const rt = await page.evaluate(() => ({ n: window.__saved.length, retry: !!document.querySelector('#adbCdRetry'), ls: localStorage.getItem('hcps_adb_gen_v1:L1') }));
    await t('Retry saves the missing design only (no duplicates) and clears the browser copy', () => ok(rt.n === 6 && !rt.retry && !rt.ls, JSON.stringify(rt)));
    // "sign out and back in": a fresh mount with no browser storage — the designs come from the library
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await mount();
    const back = await page.evaluate(() => ({ list: [...document.querySelectorAll('#adbList .adb-card b')].map((b) => b.textContent), gen: (document.querySelector('#adbGen') || {}).innerText || '' }));
    await t('after signing out and back in (nothing left in the browser) all six designs are in Your saved designs', () => ok(back.list.length === 6 && back.list.every((x) => /AI design \d$/.test(x)) && !back.gen, JSON.stringify(back)));
    await page.evaluate(() => window.scrollTo(0, 0)); await page.click('[data-open="a2"]'); await page.waitForTimeout(400);
    const vis = await page.evaluate(() => { const r = document.querySelector('.sms-wrap').getBoundingClientRect(); return { top: Math.round(r.top), y: Math.round(scrollY), h: innerHeight }; });
    await t('Open brings the editor itself to the top of the screen (not the top of the Studio, above the library)', () => ok(vis.top >= 0 && vis.top <= 200 && vis.y > 0, JSON.stringify(vis)));
    const op = await page.evaluate(() => { const S = window.HCPSAdBuilder._state; const sv = window.__saved.find((x) => x.id === 'a2').ad; return { head: S.cur.headline, want: sv.headline, row: S.row && S.row.id, caps: JSON.stringify(S.cur.captions) === JSON.stringify(sv.captions || {}) && JSON.stringify(S.cur.hashtags) === JSON.stringify(sv.hashtags || []) }; });
    await t('a saved design reopens with its own words and caption, ready to edit and re-save', () => ok(op.head && op.head === op.want && op.row === 'a2' && op.caps, JSON.stringify(op)));
    const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-sdl="a3"]')]);
    await t('a saved design downloads straight from Your saved designs (opened and re-checked first)', async () => { const c = await page.evaluate(() => window.__calls.slice(-6)); ok(/\.png$/.test(dl2.suggestedFilename()) && c.includes('ads_get') && c.includes('ads_check'), dl2.suggestedFilename() + ' ' + c.join(',')); });
    // + New design
    await page.evaluate(() => window.scrollTo(0, 0)); await page.click('#adbNew'); await page.waitForTimeout(300);
    const nw = await page.evaluate(() => { const S = window.HCPSAdBuilder._state; return { cd: S.cd, products: S.cur.products.length, head: S.cur.headline, msg: document.querySelector('#adbMsg').textContent, y: window.scrollY }; });
    await t('"+ New design": the picker closes, the canvas is empty, the page moves to it and says so', () => ok(nw.cd === null && nw.products === 0 && !nw.head && /New design/.test(nw.msg) && nw.y > 0, JSON.stringify(nw)));
    // lost save response (owner 2026-11-21): the server made the draft but the answer never arrived — Retry returns that draft
    await page.evaluate(() => { window.__loseSaves = 1; window.__keys = []; });
    await mount();
    const n0 = await page.evaluate(() => window.__saved.length);
    await make();
    const lost = await page.evaluate(() => ({ n: window.__saved.length, retry: !!document.querySelector('#adbCdRetry'), keys: window.__keys.slice(), ad: window.__saved[window.__saved.length - 1].ad.save_key }));
    await page.click('#adbCdRetry'); await page.waitForFunction(() => /Saved all 3/.test(document.querySelector('#adbMsg').textContent), null, { timeout: 10000 });
    const lr = await page.evaluate(() => ({ n: window.__saved.length, keys: window.__keys.slice() }));
    await t('a lost save response: Retry sends the same key and gets the existing draft — no duplicate (3 drafts, not 4)', () => ok(lost.n === n0 + 3 && lost.retry && lr.n === n0 + 3 && lr.keys.length === 4 && lr.keys[3] === lr.keys[0] && new Set(lr.keys.slice(0, 3)).size === 3 && lost.ad === undefined, JSON.stringify({ n0, lost, lr })));
    await make();
    const again = await page.evaluate(() => ({ n: window.__saved.length, keys: window.__keys.slice(-3) }));
    await t('a deliberate new "Create 3 designs" still makes three NEW drafts (new keys)', () => ok(again.n === n0 + 6 && again.keys.every((k) => !lr.keys.includes(k)), JSON.stringify({ again, lr })));
  } finally { await browser.close(); }
  console.log(`\nad generated designs: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
