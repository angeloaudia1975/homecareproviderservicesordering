/* DALTON LIFTGATE (owner 2026-11-17) — the REAL storefront page in Chromium (_shop-harness.js: everything answered locally;
   nothing reaches HCPS, Supabase or Dalton), in a Manage Dealer session, at 390 / 1280 px:
   - a Dalton cart with a bed asks "Would you like liftgate service added for $45?" with explicit Yes / No buttons (≥ 44 px on
     phones); Place order is refused until it is answered and nothing is sent;
   - Yes adds $45 once to the Dalton total (two beds: still $45); the order goes out with service_choices {liftgate:true}
     and the total including $45; No sends {liftgate:false} and no fee;
   - a Dalton cart with no bed only offers "Add liftgate service — $45" (not required);
   - another line (Yuwell) shows no service box; no horizontal scroll.
   PLAYWRIGHT_MODULE=… node test/dalton-liftgate.browser.js */
const { chromium, open, path } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const TOK = 'b'.repeat(64);
const INFO = { ok: true, staff: { name: 'Angelo Audia', email: 'angelo@homecareproviderservices.us', role: 'president' }, dealer: { id: 'hq', name: 'Acme Medical HQ' },
  location: { id: 'hq', name: 'Acme Medical HQ', is_head_office: true },
  actions: [{ key: 'order_create', label: 'Place an order on the dealer\'s behalf' }], expires_at: new Date(Date.now() + 3600e3).toISOString() };
const manageAuth = () => (b) => (b.action === 'manage_end' ? { ok: true, ended: true } : INFO);
const tools = () => (b) => (b.action === 'account_center' ? { ok: true, company: { business_name: 'Acme Medical HQ' }, contacts: [], addresses: [], locations: [], pending: [] } : { ok: true });
async function stage(page, lines) {
  await page.evaluate((lines) => {
    CART.clear();
    for (const [slug, code, qty, price] of lines) { const p = { code, name: code, manufacturer: slug, base_price: price, tiers: [], category: 'Homecare Beds & Accessories' };
      CART.set(slug + '|' + code, { p, qty }); MFR[slug] = Object.assign({}, MFR[slug] || {}, { po: 'PO-' + slug }); delete MFR[slug].svc; }
    ['f_biz', 'f_contact', 'f_email'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = ['Acme Medical HQ', 'Sam', 'sam@acme.test'][i]; });
    window.serverPriceCheck = async () => ({ changed: false, orders: [] }); window.needsAccess = () => false; window.cartRuleProblems = () => [];
    updateCart(); openCart();
  }, lines);
  await page.waitForTimeout(250);
}
const box = page => page.evaluate(() => {
  const g = document.querySelector('.mgroup[data-slug="dalton"]'), y = document.querySelector('.mgroup[data-slug="yuwell"]');
  const b = g && g.querySelector('.svcbox');
  return { has: !!b, text: b ? b.innerText : '', needs: !!(b && b.classList.contains('needsvc')),
    btn: b ? [...b.querySelectorAll('button')].map(x => ({ t: x.textContent.trim(), h: x.getBoundingClientRect().height, p: x.getAttribute('aria-pressed') })) : [],
    tot: g ? (g.querySelector('.mgtot') || {}).innerText || '' : '', yuwellBox: !!(y && y.querySelector('.svcbox')),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
async function placeConfirmed(page) {
  await page.evaluate(() => { submitOrder(); });
  await page.waitForSelector('#obModal', { timeout: 10000 });
  await page.check('#obOk'); await page.click('#obGo'); await page.waitForTimeout(700);
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) {
      const { ctx, page, seen } = await open(browser, w, h, { host: 'https://hcpsonlineordering.netlify.app', hash: '#manage=' + TOK, manageAuth: manageAuth(), tools: tools(),
        submit: () => ({ status: 200, body: { ok: true, recorded: true, status: 'submitted', recorded_orders: [] } }) });
      await page.waitForFunction(() => document.getElementById('previewbar') && typeof deliveryServicesFor === 'function' && typeof mfrInfo === 'function' && (mfrInfo('dalton') || {}).services, null, { timeout: 25000 });

      await stage(page, [['dalton', 'BED1200i', 2, 700], ['yuwell', 'A1', 1, 10]]);
      let b = await box(page);
      await t(`${label}: a Dalton bed asks the liftgate question with explicit Yes / No; other lines show nothing`, () => {
        ok(b.has && /Would you like liftgate service added for \$45\?/.test(b.text), b.text); ok(b.needs, 'not marked as required');
        ok(b.btn.length === 2 && /Yes — add \$45\.00/.test(b.btn[0].t) && /No$/.test(b.btn[1].t), JSON.stringify(b.btn));
        ok(b.btn.every(x => x.p === 'false'), 'a choice is pre-selected: ' + JSON.stringify(b.btn));
        if (w < 641) ok(b.btn.every(x => x.h >= 44), 'touch targets ' + JSON.stringify(b.btn));
        ok(!b.yuwellBox, 'Yuwell shows a service box'); ok(b.sw <= b.cw + 1, 'horizontal scroll'); });
      await page.evaluate(() => { submitOrder(); }); await page.waitForTimeout(400);
      const tt = await toast(page);
      await t(`${label}: Place order is refused until the question is answered — nothing sent`, () => {
        ok(!(seen.submits || []).length, 'submitted'); ok(/Choose Yes or No for liftgate service/.test(tt), tt); });
      await page.click('.mgroup[data-slug="dalton"] .svcbox [data-svcv="yes"]'); await page.waitForTimeout(250);
      b = await box(page);
      await t(`${label}: Yes adds $45 ONCE to the Dalton total (two beds)`, () => {
        ok(b.btn[0].p === 'true' && b.btn[1].p === 'false' && !b.needs, JSON.stringify(b.btn));
        ok(/Liftgate service\s*\$45\.00/.test(b.tot) && /\$1,445\.00|\$1445\.00/.test(b.tot), b.tot); });
      if (label === 'iphone' || label === 'desktop') await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', `dalton-liftgate-${label}.png`) });
      await placeConfirmed(page);
      await t(`${label}: the order carries the Yes and the total including $45; the Yuwell order carries no choice`, () => {
        const s = (seen.submits || [])[0]; ok(s, 'no submit'); const d = s.body.orders.find(o => o.manufacturer_slug === 'dalton'), y = s.body.orders.find(o => o.manufacturer_slug === 'yuwell');
        ok(d && d.service_choices && d.service_choices.liftgate === true, JSON.stringify(d && d.service_choices)); ok(d.estimated_total === 1445, 'total ' + d.estimated_total);
        ok(y && JSON.stringify(y.service_choices) === '{}' && y.estimated_total === 10, JSON.stringify(y)); });

      await stage(page, [['dalton', 'BED1200i', 1, 700]]);
      await page.click('.mgroup[data-slug="dalton"] .svcbox [data-svcv="no"]'); await page.waitForTimeout(200);
      const n = (seen.submits || []).length; await placeConfirmed(page);
      await t(`${label}: No is sent as an explicit No with no fee`, () => {
        const s = (seen.submits || [])[n]; ok(s, 'no submit'); const d = s.body.orders[0];
        ok(d.service_choices.liftgate === false && d.estimated_total === 700, JSON.stringify(d)); });

      await stage(page, [['dalton', 'B-RAIL120i', 1, 90]]);
      b = await box(page);
      await t(`${label}: a Dalton cart without a bed only OFFERS liftgate — not required`, () => {
        ok(b.has && /Add liftgate service — \$45/.test(b.text) && !b.needs, b.text); });
      const m = (seen.submits || []).length; await placeConfirmed(page);
      await t(`${label}: … and it can be ordered without answering`, () => { const s = (seen.submits || [])[m]; ok(s && JSON.stringify(s.body.orders[0].service_choices) === '{}', JSON.stringify(s && s.body.orders[0])); });
      await ctx.close();
    }
  } catch (e) { fail++; console.log('FAIL harness\n     ' + String(e && e.stack).slice(0, 600)); }
  await browser.close();
  console.log(`dalton liftgate browser: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
