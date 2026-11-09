/* Dealer Brand & Logo Studio in the REAL portal page (public/index.html → Account Center → Brand & Logo Studio).
   dealer-tools-api is answered by the admin repo's REAL Studio handler (_logo_studio_api.js) over an in-memory database, so
   the server's own rules judge every design the browser makes. Checks at 390 / 768 / 1280 px: the button shows only when the
   server opens the Studio; 4 designs from the verified name; customising redraws the vector logo; previews; terms gate the
   downloads; SVG download passes the server's SVG check; PNG downloads are transparent at 1200 / 3000 px; publish changes
   the ONE branding source and the Account Center logo; the original stays in the history and can be restored; a refused
   tagline is explained; no horizontal scroll; 44 px targets; 16 px inputs.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… node test/logo-studio.browser.js */
const { chromium, open, path, fs } = require('./_shop-harness.js');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const LS = require(path.join(ADM, 'netlify', 'functions', '_logo_studio.js'));
const LSA = require(path.join(ADM, 'netlify', 'functions', '_logo_studio_api.js'));
const SHOTS = process.env.SHOTS || '/tmp/logo-studio-shots'; fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }
const ORIGINAL = 'https://deploy-preview-99--hcpsonlineordering.netlify.app/assets/logos/yuwell.jpg';

function world(enabled) {
  const db = { dealers: [{ id: 'd-test', business_name: 'James Medical Equipment Bowling Green', city: 'Bowling Green', state: 'KY', parent_id: null, logo_url: ORIGINAL }],
    app_settings: enabled ? [{ key: 'logo_studio', value: { all: false, pilot_dealers: ['d-test'] } }] : [], dealer_logo_events: [], n: 1 };
  const where = (rows, q) => { for (const part of (q || '').split('&')) { const [k, v] = part.split('='); if (!v || ['select', 'order', 'limit'].includes(k)) continue; const val = decodeURIComponent(v);
    if (val.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === val.slice(3)); else if (val.startsWith('in.(')) { const s = val.slice(4, -1).split(','); rows = rows.filter((r) => s.includes(String(r[k]))); } else if (val.startsWith('gte.')) rows = rows.filter((r) => r[k] >= val.slice(4)); else if (k === 'or') { const cs = val.slice(1, -1).split(',').map((c) => c.split('.eq.')); rows = rows.filter((r) => cs.some(([f, x]) => String(r[f]) === x)); } } return rows; };
  const sb = async (m, p, body) => { const [tb, q] = p.split('?'); const rows = db[tb];
    if (m === 'GET') { let r = where(rows, q); if (/order=created_at\.desc/.test(q)) r = r.slice().reverse(); return JSON.parse(JSON.stringify(r)); }
    if (m === 'POST') { const row = Object.assign({ id: db.n++, created_at: new Date(Date.now() + db.n * 1000).toISOString() }, body); rows.push(row); return [row]; }
    if (m === 'PATCH') { where(rows, q).forEach((r) => Object.assign(r, body)); return null; } };
  return { db, sb };
}
const realFetch = global.fetch;
global.fetch = async (u, o) => { if (/\/storage\/v1\/object\/dealer-logos\//.test(String(u))) return { ok: true, status: 200, text: async () => '' }; return realFetch(u, o); };
function tools(W, center) {
  return async (b) => {
    if (b.action === 'account_center') { const c = JSON.parse(JSON.stringify(center)); c.company.logo_url = W.db.dealers[0].logo_url; return c; }
    if (b.action === 'account_get') return { ok: true, resale: null, applications: [], terms: [] };
    if (b.action === 'branding_get') return { ok: true, logo_url: W.db.dealers[0].logo_url };
    if (String(b.action).startsWith('logo_studio_')) { const r = await LSA.handle(b, { dealer_id: 'd-test', email: 'owner@james.test' }, { sb: W.sb, json: (c, o) => ({ c, o }), SUPABASE_URL: 'https://deploy-preview-99--hcpsonlineordering.netlify.app', SERVICE_ROLE: 'k' });
      /* a published PNG is "hosted" at an /assets address the page can show */
      if (r.o && r.o.logo_url && /dealer-logos/.test(r.o.logo_url) && b.action === 'logo_studio_publish') { const png = Buffer.from(String(b.png).split(',')[1], 'base64'); fs.writeFileSync(path.join(__dirname, '..', 'public', 'assets', 'logos', '_ls_test.png'), png); }
      return { status: r.c, body: r.o }; }
    return { ok: true };
  };
}
const CENTER = { ok: true, company: { business_name: 'James Medical Equipment Bowling Green', hcps_account: 'H-1', contact_name: 'Ann', email: 'ann@james.test', phone: '270-904-8521', website: '', logo_url: null, default_ship_key: null, head_office: true },
  contacts: [], addresses: [{ key: 'main', label: 'Business address', address: '1010 Fairview Dr.', city: 'Bowling Green', state: 'KY', zip: '42101' }], locations: [{ id: 'd-test', name: 'James Medical Equipment Bowling Green', city: 'Bowling Green', state: 'KY', is_self: true, accounts: [] }], pending: [], scope: 'company' };

async function openCenter(page) {
  await page.evaluate(() => { window.__PREVIEW__ = null; });
  await page.evaluate(() => showP360('account'));
  await page.waitForFunction(() => { const v = document.querySelector('#view-account'); return v && /Your logo/.test(v.innerText) && !/Loading your account/.test(v.innerText); }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
}
const layoutCheck = (page) => page.evaluate(() => { const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const root = document.getElementById('lsRoot');
  return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, panW: root ? root.querySelector('.ls-pan').scrollWidth : 0, panC: root ? root.querySelector('.ls-pan').clientWidth : 0,
    small: [...root.querySelectorAll('button:not(.sm),select,input:not([type=checkbox]):not([type=color]),summary')].filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5).map((b) => b.outerHTML.slice(0, 60)),
    font: [...root.querySelectorAll('input:not([type=checkbox]):not([type=color]),select')].filter(vis).filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16).length,
    broken: [...root.querySelectorAll('img')].filter((i) => vis(i) && i.complete && i.naturalWidth === 0).length }; });

(async () => {
  const browser = await chromium.launch();
  try {
    await t('closed for a dealer the server has not opened: no Studio button, nothing called but the state read', async () => {
      const W = world(false); const { ctx, page, seen } = await open(browser, 1280, 900, { tools: tools(W, CENTER) }); await openCenter(page);
      ok(!(await page.$('#lsEntry a')), 'button hidden'); ok((seen.toolCalls || []).filter((b) => String(b.action).startsWith('logo_studio_') && b.action !== 'logo_studio_state').length === 0); await ctx.close(); });
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const W = world(true); const { ctx, page } = await open(browser, w, h, { tools: tools(W, CENTER) });
      page.on('dialog', (d) => d.accept());
      await openCenter(page);
      await t(`${label}: the Studio button shows in "Your logo" and opens the Studio with the verified name`, async () => {
        await page.click('#lsEntry a'); await page.waitForSelector('#lsRoot .ls-sec h3', { timeout: 20000 });
        const txt = await page.textContent('#lsRoot'); ok(/James Medical Equipment/.test(txt) && /Bowling Green/.test(txt) && /No phone numbers, addresses/.test(txt), txt.slice(0, 300)); });
      await t(`${label}: a refused tagline is explained and makes no designs`, async () => {
        await page.fill('#lsTag', 'Call 270-904-8521'); await page.click('[data-ls=concepts]'); await page.waitForSelector('#lsRoot .ls-err', { timeout: 10000 });
        ok(/Phone numbers, addresses/.test(await page.textContent('#lsRoot .ls-err'))); ok(!(await page.$('.ls-card')));
        await page.fill('#lsTag', 'Comfort and independence at home'); });
      await t(`${label}: four designs drawn as vectors from the verified name`, async () => {
        await page.click('[data-ls=style][data-v=modern]'); await page.click('[data-ls=palette][data-v="navy-green"]');
        await page.click('[data-ls=concepts]'); await page.waitForFunction(() => document.querySelectorAll('#lsRoot .ls-card img').length === 4 && [...document.querySelectorAll('#lsRoot .ls-card img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
        await page.screenshot({ path: `${SHOTS}/${label}-concepts.png`, fullPage: false }); });
      await t(`${label}: customising redraws the logo (lettering, colour, lines, caps, tagline) and every preview renders`, async () => {
        await page.click('[data-ls=pick][data-v="0"]'); await page.waitForSelector('#lsRoot .ls-stage img');
        const svg0 = await page.evaluate(() => window.HCPSLogoStudio._S.svg);
        await page.selectOption('[data-ed=font]', 'lora'); await page.waitForFunction((s) => window.HCPSLogoStudio._S.svg && window.HCPSLogoStudio._S.svg !== s, svg0, { timeout: 15000 });
        await page.evaluate(() => { const i = document.querySelector('[data-col=a]'); i.value = '#13a3b4'; i.dispatchEvent(new Event('change', { bubbles: true })); });
        await page.waitForFunction(() => /#13a3b4/.test(window.HCPSLogoStudio._S.svg));
        await page.click('[data-ed=upper]'); await page.waitForFunction(() => window.HCPSLogoStudio._S.cur.upper === true);
        for (const v of ['white', 'dark', 'store', 'ad', 'small']) { await page.click(`[data-ls=view][data-v=${v}]`); await page.waitForSelector('#lsRoot .ls-stage img'); }
        await page.click('[data-ls=view][data-v=store]'); await page.screenshot({ path: `${SHOTS}/${label}-customise.png`, fullPage: false });
        const s = await page.evaluate(() => window.HCPSLogoStudio._S.svg); ok(!LS.svgProblem(s), LS.svgProblem(s)); ok(!/<text/.test(s) && !/270-904/.test(s)); });
      await t(`${label}: downloads need the terms; SVG passes the server check, PNGs are transparent at 1200 and 3000 px`, async () => {
        ok(await page.isDisabled('[data-ls=dl-svg]') && await page.isDisabled('[data-ls=publish]'), 'locked before terms');
        await page.check('#lsTerms');
        const [d1] = await Promise.all([page.waitForEvent('download'), page.click('[data-ls=dl-svg]')]); const svg = fs.readFileSync(await d1.path(), 'utf8'); ok(!LS.svgProblem(svg) && /\.svg$/.test(d1.suggestedFilename()), d1.suggestedFilename());
        for (const [btn, wid] of [['dl-png', 1200], ['dl-hi', 3000]]) { const [d] = await Promise.all([page.waitForEvent('download'), page.click(`[data-ls=${btn}]`)]); const b = fs.readFileSync(await d.path());
          ok(b.slice(1, 4).toString() === 'PNG' && b.readUInt32BE(16) === wid, btn + ' ' + b.readUInt32BE(16));
          const alpha = await page.evaluate(async (u) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, 1, 1).data[3]; }, 'data:image/png;base64,' + b.toString('base64'));
          ok(alpha === 0, 'transparent corner ' + alpha); } });
      await t(`${label}: B14 large views — enlarge one design, compare all four, transparent / dark backgrounds, Escape closes`, async () => {
        await page.click('[data-ls=zoom][data-v=cur]'); await page.waitForSelector('#lsRoot .ls-zoom img');
        const big = await page.$eval('#lsRoot .ls-zoom img', (i) => i.getBoundingClientRect().width); ok(big > 300, 'large: ' + big);
        await page.click('[data-ls=zbg][data-v=check]'); await page.click('[data-ls=zbg][data-v=dark]'); ok(await page.$('#lsRoot .ls-zgrid.bg-dark'));
        await page.keyboard.press('Escape'); ok(!(await page.$('#lsRoot .ls-zoom')) && await page.$('#lsRoot .ls-pan'), 'Escape closes only the large view');
        await page.click('[data-ls=compare]'); await page.waitForFunction(() => document.querySelectorAll('#lsRoot .ls-zoom figure img').length === 4);
        const L = await layoutCheck(page); ok(L.sw <= L.cw + 1, 'no sideways scroll in compare'); await page.screenshot({ path: `${SHOTS}/${label}-compare.png` });
        await page.click('[data-ls=unzoom]'); });
      await t(`${label}: B16 horizontal / square / icon versions download as SVG and PNG at their sizes`, async () => {
        await page.waitForSelector('#lsRoot .ls-fmt'); ok((await page.$$('#lsRoot .ls-fmt')).length === 4);
        for (const k of ['horizontal', 'square', 'icon', 'reversed']) { const [d] = await Promise.all([page.waitForEvent('download'), page.click(`[data-ls=fsvg][data-v=${k}]`)]); ok(!LS.svgProblem(fs.readFileSync(await d.path(), 'utf8')), k); }
        for (const [k, w, sq] of [['square', 1200, true], ['icon', 512, true], ['horizontal', 3000, false]]) { const [d] = await Promise.all([page.waitForEvent('download'), page.click(`[data-ls=fpng][data-v="${k}:${w}"]`)]); const b = fs.readFileSync(await d.path());
          ok(b.readUInt32BE(16) === w && (sq ? b.readUInt32BE(20) === w : b.readUInt32BE(20) < w), `${k} ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`); } });
      await t(`${label}: B15 "Show four different designs" gives a new distinct set; Recommended marked`, async () => {
        const before = await page.evaluate(() => window.HCPSLogoStudio._S.concepts.map((c) => c.font + c.symbol).join());
        ok(/Recommended/.test(await page.textContent('#lsRoot .ls-cards')));
        await page.click('[data-ls=more]'); await page.waitForFunction((b) => { const S = window.HCPSLogoStudio._S; return S.concepts.length === 4 && S.concepts.map((c) => c.font + c.symbol).join() !== b && S.concepts.every((c) => c._svg); }, before, { timeout: 20000 });
        const fonts = await page.evaluate(() => window.HCPSLogoStudio._S.concepts.map((c) => c.font)); ok(new Set(fonts).size === 4, fonts.join());
        await page.click('[data-ls=pick][data-v="0"]'); await page.waitForFunction(() => window.HCPSLogoStudio._S.vars); W.lastPick = await page.evaluate(() => window.HCPSLogoStudio._S.cur.font); });
      await t(`${label}: no horizontal scroll, 44 px targets, 16 px inputs, no broken images`, async () => {
        const L = await layoutCheck(page); ok(L.sw <= L.cw + 1 && L.panW <= L.panC + 1, JSON.stringify(L)); ok(!L.small.length, L.small.join(' | ')); ok(L.font === 0 && L.broken === 0, JSON.stringify(L)); });
      await t(`${label}: publish → the one branding source and Account Center show it; the original stays in the history and is restored`, async () => {
        await page.click('[data-ls=publish]'); await page.waitForSelector('#lsRoot .ls-ok', { timeout: 20000 });
        ok(/studio-[0-9a-f]{32}\.png$/.test(W.db.dealers[0].logo_url), W.db.dealers[0].logo_url);
        const ev = W.db.dealer_logo_events.filter((e) => e.kind !== 'concepts'); ok(ev[0].kind === 'baseline' && ev[0].logo_url === ORIGINAL && ev[1].kind === 'studio' && !LS.svgProblem(ev[1].svg));
        const v = LS.validSpec(ev[1].spec, W.db.dealers[0]); ok(!v.error && ev[1].spec.font === W.lastPick, JSON.stringify(ev[1].spec) + ' vs ' + W.lastPick);
        await page.waitForSelector('#lsRoot .ls-h.on'); const hist = await page.$$eval('#lsRoot .ls-h', (x) => x.map((e) => e.textContent)); ok(hist.length === 2 && /In use/.test(hist[0]) && /Original logo/.test(hist[1]), hist.join(' | '));
        await page.click('#lsRoot [data-ls=restore]'); await page.waitForFunction(() => /Logo restored/.test(document.querySelector('#lsRoot').textContent));
        ok(W.db.dealers[0].logo_url === ORIGINAL, 'restored'); await page.screenshot({ path: `${SHOTS}/${label}-history.png`, fullPage: false });
        await page.click('[data-ls=close]'); await page.waitForFunction((u) => [...document.querySelectorAll('#view-account img')].some((i) => i.src === u), ORIGINAL, { timeout: 15000 }); });
      await ctx.close();
    }
    await t('PART A (desktop + iphone): Russell Springs starts from the Bowling Green Studio design, sees its OWN city, and publishes it itself; Bowling Green untouched', async () => {
      for (const [w, h] of [[1280, 900], [390, 844]]) {
        const W = world(true); const RS = W.db.dealers[0]; Object.assign(RS, { business_name: 'James Medical Equipment Russell Springs', city: 'Russell Springs', logo_url: null });
        const BG = { id: 'd-bg', business_name: 'James Medical Equipment Bowling Green', city: 'Bowling Green', state: 'KY', parent_id: 'd-test', logo_url: ORIGINAL }; W.db.dealers.push(BG);
        const spec = LS.validSpec(Object.assign({}, LS.concepts(BG, {})[0], { sub: 'Bowling Green' }), BG).spec;
        W.db.dealer_logo_events.push({ id: 900, dealer_id: 'd-bg', kind: 'studio', logo_url: ORIGINAL, spec, svg: '<svg/>', terms_version: 'LS-1', created_at: '2026-11-08T23:18:00Z' });
        const center = JSON.parse(JSON.stringify(CENTER)); center.company.business_name = RS.business_name;
        const { ctx, page } = await open(browser, w, h, { tools: tools(W, center) }); page.on('dialog', (d) => d.accept()); await openCenter(page);
        await page.click('#lsEntry a'); await page.waitForSelector('#lsRoot .ls-fam', { timeout: 20000 });
        ok(/Bowling Green location already has a Studio logo/.test(await page.textContent('#lsRoot .ls-fam')), 'offer shown');
        await page.click('#lsRoot [data-ls=fam]'); await page.waitForSelector('#lsRoot [data-ls=publish]', { timeout: 20000 });
        ok(W.db.dealer_logo_events.filter((e) => e.dealer_id === 'd-test').length === 0 && !RS.logo_url, 'nothing published by choosing it');
        await page.check('#lsTerms'); await page.waitForFunction(() => !document.querySelector('#lsRoot [data-ls=publish]').disabled, null, { timeout: 20000 });
        await page.click('#lsRoot [data-ls=publish]'); await page.waitForSelector('#lsRoot .ls-ok', { timeout: 20000 });
        const ev = W.db.dealer_logo_events.filter((e) => e.dealer_id === 'd-test' && e.kind === 'studio'); ok(ev.length === 1 && ev[0].spec.sub === 'Russell Springs' && ev[0].spec.font === spec.font && ev[0].spec.symbol === spec.symbol && ev[0].terms_version === LS.TERMS_VERSION, JSON.stringify(ev[0] && ev[0].spec));
        ok(/studio-[0-9a-f]{32}\.png$/.test(RS.logo_url) && BG.logo_url === ORIGINAL, 'each location its own logo');
        const L = await layoutCheck(page); ok(L.sw <= L.cw + 1 && L.broken === 0, JSON.stringify(L));
        await ctx.close(); } });
  } finally { await browser.close(); try { fs.unlinkSync(path.join(__dirname, '..', 'public', 'assets', 'logos', '_ls_test.png')); } catch (e) {} }
  console.log(`\nlogo studio (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
