/* MANAGE DEALER (owner 2026-11-13) — the REAL storefront page in Chromium (_shop-harness.js: everything answered locally;
   nothing reaches HCPS, Supabase or a manufacturer). At 390 / 768 / 1280 px: the Manage Dealer banner names the location
   and the mode, has View as Dealer + Exit Dealer Account, never covers the page, 44 px targets on phones, no horizontal
   scroll; the manage token leaves the address bar at once; reads stay on the preview token and only the allowed writes
   carry the manage token; an order needs the explicit final confirmation and goes with the on-behalf confirmation;
   View as Dealer ends the session and makes everything read-only again; without a session nothing can be ordered.
   PLAYWRIGHT_MODULE=… node test/manage-dealer.browser.js */
const { chromium, open, path, fs } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const TOK = 'a'.repeat(64);
const INFO = { ok: true, staff: { name: 'Angelo Audia', email: 'angelo@homecareproviderservices.us', role: 'president' }, dealer: { id: 'hq', name: 'Acme Medical HQ' },
  location: { id: 'br-1', name: 'Acme Medical Xenia', is_head_office: false },
  actions: [{ key: 'order_create', label: 'Place an order on the dealer\'s behalf' }, { key: 'account_change', label: 'x' }, { key: 'logo_edit', label: 'x' }, { key: 'default_ship', label: 'x' }, { key: 'showroom_edit', label: 'x' }], expires_at: new Date(Date.now() + 3600e3).toISOString() };
const manageAuth = (state) => (b) => { if (b.action === 'manage_end') { state.ended = b.why; return { ok: true, ended: true }; } return state.info; };
const tools = () => (b) => b.action === 'account_center' ? { ok: true, company: { business_name: 'Acme Medical Xenia' }, contacts: [], addresses: [], locations: [{ id: 'br-1', name: 'Acme Medical Xenia', is_self: true, accounts: [] }], pending: [] } : { ok: true, applied: true, message: 'Saved' };
async function stageOrder(page) {
  await page.evaluate(() => {
    const p = { code: 'A1', name: 'Widget', manufacturer: 'yuwell', base_price: 10, tiers: [] };
    CART.clear(); CART.set('yuwell|A1', { p, qty: 2 }); MFR.yuwell = Object.assign(MFR.yuwell || {}, { po: 'PO-77' });
    ['f_biz', 'f_contact', 'f_email'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = ['Acme Medical Xenia', 'Sam', 'sam@acme.test'][i]; });
    window.serverPriceCheck = async () => ({ changed: false, orders: [] }); window.needsAccess = () => false; window.cartRuleProblems = () => [];
  });
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const st = { info: JSON.parse(JSON.stringify(INFO)) };
      const { ctx, page, seen } = await open(browser, w, h, { host: 'https://hcpsonlineordering.netlify.app', hash: '#manage=' + TOK, manageAuth: manageAuth(st), tools: tools(), submit: () => ({ status: 200, body: { ok: true, recorded: true, status: 'submitted', orders: [{ order_id: 'o1', manufacturer_slug: 'yuwell' }], results: [] } }) });
      await page.waitForFunction(() => document.getElementById('previewbar'), null, { timeout: 20000 });
      const r = await page.evaluate(() => { const b = document.getElementById('previewbar'), bb = b.getBoundingClientRect(), hd = document.querySelector('header');
        return { text: b.innerText, hash: location.hash, managing: b.classList.contains('managing'), barBottom: bb.bottom, headerTop: hd ? hd.getBoundingClientRect().top : 999,
          btns: [...b.querySelectorAll('button')].map(x => ({ t: x.textContent.trim(), h: x.getBoundingClientRect().height })), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
      await t(`${label}: Manage Dealer banner — location, head office/location tag, who, recorded; View as Dealer + Exit Dealer Account`, () => {
        ok(r.managing && /Manage Dealer/.test(r.text) && /Acme Medical Xenia/.test(r.text) && /Location/.test(r.text) && /Angelo Audia/.test(r.text) && /recorded under your name/.test(r.text), r.text);
        ok(r.btns.some(b => /View as Dealer/.test(b.t)) && r.btns.some(b => /Exit Dealer Account/.test(b.t)), JSON.stringify(r.btns));
        if (w < 641) ok(r.btns.every(b => b.h >= 44), 'touch targets ' + JSON.stringify(r.btns));
        ok(r.headerTop >= r.barBottom - 1, 'the banner covers the header: ' + r.barBottom + ' > ' + r.headerTop); ok(r.sw <= r.cw + 1, 'horizontal scroll'); });
      if (label !== 'tablet') await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', `manage-on-${label}.png`) });
      await t(`${label}: the manage token is removed from the address bar; the server was asked who manages which location`, () => { ok(r.hash === '', r.hash); ok((seen.manage || [])[0].action === 'manage_info' && seen.manage[0].token === TOK); });
      // reads vs writes
      await page.evaluate(() => { window.__PREVIEW__ = window.__PREVIEW__; showP360('account'); });
      await page.waitForFunction(() => { const v = document.querySelector('#view-account'); return v && /Account Center/.test(v.innerText) && !/Loading your account/.test(v.innerText); }, null, { timeout: 30000 });
      await page.evaluate(() => acCompanyOpen()); await page.fill('#acPh', '555-999-0000'); await page.click('#acSave');
      await page.waitForFunction(() => !document.querySelector('#modal.on'), null, { timeout: 10000 });
      await t(`${label}: reads use the preview token; an allowed write (company change) carries the manage token`, () => {
        const calls = (seen.toolCalls || []).map((b, i) => [b.action, seen.toolAuth[i]]);
        const by = a => (calls.find(c => c[0] === a) || [])[1] || '';
        ok(/^Bearer preview:p{48}$/.test(by('account_center')), by('account_center')); ok(by('account_change_request') === 'Bearer manage:' + TOK, JSON.stringify(calls)); });
      // order: cancel, then confirm
      await stageOrder(page);
      await page.evaluate(() => { submitOrder(); });
      await page.waitForSelector('#obModal', { timeout: 10000 }).catch(async e => { throw new Error('no confirmation; toast: ' + await page.evaluate(() => (document.getElementById('toast') || {}).textContent)); });
      const m = await page.evaluate(() => { const x = document.getElementById('obModal'); return { text: x.innerText, go: x.querySelector('#obGo').disabled, w: x.querySelector('.br-box').getBoundingClientRect().width }; });
      await t(`${label}: the final confirmation names the dealer, says it is a real order placed by HCPS, and the button stays off until ticked`, () => {
        ok(/real order/i.test(m.text) && /Placed by HCPS on behalf of Acme Medical Xenia/.test(m.text) && /PO PO-77/.test(m.text) && m.go === true, m.text.slice(0, 300)); ok(m.w <= w, 'fits'); });
      await page.click('#obNo'); await page.waitForTimeout(300);
      await t(`${label}: Cancel submits nothing`, () => ok(!(seen.submits || []).length, 'submitted'));
      await page.evaluate(() => { submitOrder(); }); await page.waitForSelector('#obModal');
      await page.check('#obOk'); await page.click('#obGo');
      await page.waitForFunction(() => true); await page.waitForTimeout(800);
      await t(`${label}: confirmed → sent with the manage token and the on-behalf confirmation for THIS location`, () => {
        const s = (seen.submits || [])[0]; ok(s, 'no submit'); ok(s.auth === 'Bearer manage:' + TOK, s.auth);
        ok(s.body.on_behalf && s.body.on_behalf.confirm === true && s.body.on_behalf.location_id === 'br-1', JSON.stringify(s.body.on_behalf)); });
      // switch to view
      page.once('dialog', d => d.accept());
      await page.click('#previewbar .pv-v'); await page.waitForTimeout(800);
      const v = await page.evaluate(() => ({ text: document.getElementById('previewbar').innerText, managing: document.getElementById('previewbar').classList.contains('managing') }));
      await t(`${label}: View as Dealer ends the session on the server and the page is read-only again`, () => { ok(st.ended === 'view', 'manage_end ' + st.ended); ok(!v.managing && /View as Dealer/.test(v.text) && /read-only/.test(v.text), v.text); });
      const n = (seen.submits || []).length; await stageOrder(page); await page.evaluate(() => { submitOrder(); }); await page.waitForTimeout(400);
      const n2 = (seen.toolCalls || []).length; await page.evaluate(() => acCompanyOpen()); await page.fill('#acPh', '555-999-0001'); await page.click('#acSave'); await page.waitForTimeout(600);
      await t(`${label}: after View as Dealer: no order can be sent, writes are back on the preview token`, () => { ok((seen.submits || []).length === n, 'submitted after view'); ok(/^Bearer preview:/.test(seen.toolAuth[n2] || ''), String(seen.toolAuth[n2])); });
      if (label === 'iphone' || label === 'desktop') await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', `manage-${label}.png`) });
      await ctx.close();
    }
    // the dealer's own tools inside the session (desktop)
    { const st = { info: JSON.parse(JSON.stringify(INFO)) };
      const probe = (h) => h.replace('Object.assign(window,{apTradeRef,', 'Object.assign(window,{__t:{quotesCall,appsCall,api,API_BASE},apTradeRef,');   // test-only handle on the Hub's own functions
      const { ctx, page, seen } = await open(browser, 1280, 900, { host: 'https://hcpsonlineordering.netlify.app', hash: '#manage=' + TOK, manageAuth: manageAuth(st), tools: tools(), html: probe });
      await page.waitForFunction(() => document.getElementById('previewbar') && window.__t);
      const dialogs = []; page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
      await page.evaluate(async () => {
        const { quotesCall, appsCall, api, API_BASE } = window.__t;
        await quotesCall({ action: 'quote_save', title: 'Q' }); await retailCall({ action: 'retail_set', rows: [] }); await appsCall({ action: 'app_save', id: 'x' });
        await api(API_BASE + '/dealer-storefront-api', { action: 'sf_save', mode: 'draft' }); await api(API_BASE + '/dealer-storefront-api', { action: 'sf_save', mode: 'publish' });
        await api(API_BASE + '/dealer-ads-api', { action: 'ads_save', ad: {} });
        await _brPost({ action: 'html', product: { name: 'W', code: 'A1' } }); await _brPost({ action: 'email', to: 'cust@example.test', product: { name: 'W', code: 'A1' } });
      });
      const by = (fn, a) => (seen.fn || []).filter((x) => x.fn === fn && (!a || (x.body && x.body.action === a)));
      await t('session tools: quotes, retail prices, applications, storefront and Social Ads go with the manage bearer (the server decides each action)', () => {
        for (const [fn, a] of [['dealer-quotes-api', 'quote_save'], ['dealer-retail-api', 'retail_set'], ['dealer-applications-api', 'app_save'], ['dealer-storefront-api', 'sf_save'], ['dealer-ads-api', 'ads_save']]) {
          const x = by(fn, a)[0]; ok(x && x.auth === 'Bearer manage:' + TOK, fn + ' ' + (x && x.auth)); } });
      await t('session tools: publishing the storefront asks first and sends its own confirmation; a draft does not', () => {
        const sf = by('dealer-storefront-api', 'sf_save'); ok(sf.length === 2, sf.length); ok(!sf[0].body.manage_confirm, 'draft'); ok(sf[1].body.manage_confirm === 'publish', JSON.stringify(sf[1].body));
        ok(dialogs.some((m) => /PUBLISH the public storefront for Acme Medical Xenia/.test(m)), dialogs.join(' | ')); });
      await t('session tools: brochures are branded for the location (manage bearer + view-as token); an email asks first and carries its confirmation', () => {
        const b = by('brochure'); ok(b.length === 2 && b.every((x) => x.auth === 'Bearer manage:' + TOK && /^p{48}$/.test(x.preview)), JSON.stringify(b.map((x) => [x.auth.slice(0, 20), x.preview.slice(0, 4)])));
        ok(b[1].body.manage_confirm === 'email' && !b[0].body.manage_confirm, 'email confirmation'); ok(dialogs.some((m) => /Email this brochure to cust@example\.test on behalf of Acme Medical Xenia/.test(m)), dialogs.join(' | ')); });
      await ctx.close(); }
    // no session at all
    { const { ctx, page, seen } = await open(browser, 1280, 900, { host: 'https://hcpsonlineordering.netlify.app', tools: tools(), submit: () => ({ status: 200, body: { ok: true } }) });
      await page.waitForFunction(() => document.getElementById('previewbar'));
      const txt = await page.evaluate(() => document.getElementById('previewbar').innerText);
      await stageOrder(page); await page.evaluate(() => { submitOrder(); }); await page.waitForTimeout(400);
      await t('View as Dealer without a session: banner says read-only, nothing can be ordered, no confirmation shown', async () => {
        ok(/View as Dealer/.test(txt) && /read-only/.test(txt), txt); ok(!(seen.submits || []).length); ok(!(await page.$('#obModal')), 'modal'); });
      await ctx.close(); }
    // an invalid / ended session falls back to View as Dealer
    { const st = { info: { ok: false, code: 'ended', message: 'This Manage Dealer session has ended. Open it again from Dealer 360.' } };
      const { ctx, page } = await open(browser, 1280, 900, { host: 'https://hcpsonlineordering.netlify.app', hash: '#manage=' + TOK, manageAuth: manageAuth(st), tools: tools() });
      await page.waitForFunction(() => document.getElementById('previewbar'));
      const x = await page.evaluate(() => ({ t: document.getElementById('previewbar').innerText, m: typeof MANAGE !== 'undefined' && MANAGE }));
      await t('a session the server refuses falls back to read-only View as Dealer', () => { ok(!x.m && /View as Dealer/.test(x.t), JSON.stringify(x)); });
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(`manage dealer (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
