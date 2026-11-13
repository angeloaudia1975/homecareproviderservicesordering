/* C3-07 Stage 3 — Partner 360 Account Center, browser walkthrough of the REAL storefront page (see _shop-harness.js:
   everything answered locally; nothing reaches HCPS, Supabase or a manufacturer). The dealer-tools-api answers are
   canned here, shaped exactly as the server's account_center action answers (that action is tested against the real
   handler in the admin repo's test/account-center.test.js). Checks at 390 / 768 / 1280 px: the page renders every
   section, green / amber / red statuses, other locations for a head office, no horizontal scroll, no broken image,
   44 px touch targets on phones; a change sends a REQUEST with exactly the edited fields; the default ship-to saves and
   reaches checkout; the logo upload sends a real image; an account-number claim; a refused load shows a retry, never a
   blank page; the old credit form no longer sends anything.
   PLAYWRIGHT_MODULE=… node test/account-center.browser.js */
const { chromium, open, path, fs } = require('./_shop-harness.js');
const SHOTS = process.env.SHOTS || '/tmp/account-center-shots'; fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }

const CENTER = { ok: true,
  company: { business_name: 'TEST — Landing Sandbox', hcps_account: 'H-1', contact_name: 'Ann', email: 'ann@acme.test', phone: '555-111-2222', website: 'https://acme.test', logo_url: null, default_ship_key: null, head_office: true },
  contacts: [{ id: 'c0000000-0000-0000-0000-000000000001', name: 'Bob', title: 'Buyer', email: 'bob@acme.test', phone: '555-000-1111' }],
  addresses: [{ key: 'main', label: 'Business address', address: '1 Main St', city: 'Dayton', state: 'OH', zip: '45402' },
    { key: 'bill', label: 'Billing', address: '1 Main St', city: 'Dayton', state: 'OH', zip: '45402' },
    { key: 'ship-wh', label: 'Warehouse', address: '50 Dock Rd', city: 'Dayton', state: 'OH', zip: '45404' }],
  locations: [
    { id: 'hq', name: 'TEST — Landing Sandbox', city: 'Dayton', state: 'OH', is_self: true, accounts: [
      { slug: 'golden-technologies', name: 'Golden Technologies', status: 'verified', label: 'Golden account on file', account_ref: null },
      { slug: 'yuwell', name: 'Yuwell', status: 'verified', label: 'Verified by HCPS', account_ref: 'Y-100', ordering: true, facts: { on_file: { source: 'location' }, verified: null, authorized: true, application: null, restriction: null } },
      { slug: 'dalton', name: 'Dalton Medical', status: 'pending', label: 'Ordering set up — account number not on file', account_ref: null, ordering: true, facts: { on_file: null, verified: null, authorized: true, application: null, restriction: 'held_until_account' } },
      { slug: 'bemis', name: 'Bemis', status: 'pending', label: 'x', account_ref: null, ordering: true, facts: { on_file: { source: 'head_office' }, verified: { at: '2026-11-01' }, authorized: false, application: { status: 'under_review' }, restriction: 'not_authorized' } },
      { slug: 'access4u', name: 'Access4U', status: 'pending', label: 'On file — HCPS verification pending', account_ref: 'A-9', ordering: true },
      { slug: 'dalton', name: 'Dalton', status: 'none', label: 'No account on file', account_ref: null, ordering: false }] },
    { id: 'br', name: 'Acme Branch', city: 'Xenia', state: 'OH', is_self: false, accounts: [
      { slug: 'yuwell', name: 'Yuwell', status: 'none', label: 'No account on file', account_ref: null }] }],
  pending: [], scope: 'company' };

function tools(state) {
  return b => {
    if (b.action === 'account_center') return state.fail ? { status: 503, body: { ok: false, error: 'Your account details could not be loaded just now — please try again.' } } : JSON.parse(JSON.stringify(state.center));
    if (b.action === 'account_get') return { ok: true, resale: null, applications: [{ manufacturer: 'Yuwell', requested_terms: 'Net 30', status: 'submitted', created_at: '2026-10-01T00:00:00Z' }], terms: [] };
    if (b.action === 'account_change_request') return { ok: true, message: 'Sent to HCPS for approval — your account updates once approved.' };
    if (b.action === 'default_ship_set') { state.center.company.default_ship_key = b.key; return { ok: true, default_ship_key: b.key }; }
    if (b.action === 'logo_upload') { state.center.company.logo_url = 'https://deploy-preview-99--hcpsonlineordering.netlify.app/assets/logos/yuwell.jpg'; return { ok: true, logo_url: state.center.company.logo_url }; }
    if (b.action === 'account_claim') return { ok: true, saved: true };
    if (b.action === 'credit_application') return { status: 410, body: { ok: false } };
    if (b.action === 'branding_get') return { ok: true, logo_url: null };
    return { ok: true };
  };
}
async function openCenter(page) {
  await page.evaluate(() => { window.__PREVIEW__ = null; });
  await page.evaluate(() => showP360('account'));
  await page.waitForFunction(() => { const v = document.querySelector('#view-account'); return v && /Account Center/.test(v.innerText) && !/Loading your account/.test(v.innerText); }, null, { timeout: 30000 });
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const state = { center: JSON.parse(JSON.stringify(CENTER)) };
      const { ctx, page, seen } = await open(browser, w, h, { tools: tools(state) });
      await openCenter(page);
      const r = await page.evaluate(() => {
        const v = document.querySelector('#view-account'); const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
        return { text: v.textContent, chips: [...v.querySelectorAll('.acchip')].map(x => x.className.replace('acchip ', '') + ':' + x.textContent),
          rows: [...v.querySelectorAll('.acrow')].map(x => x.className), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          /* overflow that body{overflow-x:clip} hides from scrollWidth still widens a phone's layout viewport */
          wide: [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); if (!(b.right > innerWidth + 1 && b.width > 0)) return false;
            let p = e.parentElement; while (p && p !== document.body) { if (/auto|hidden|scroll|clip/.test(getComputedStyle(p).overflowX)) return false; p = p.parentElement; } return true; }).slice(0, 3).map(e => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 30)),
          broken: [...v.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && vis(i)).length,
          small: [...v.querySelectorAll('a.btn,button,label.btn')].filter(vis).map(b => b.getBoundingClientRect().height).filter(x => x < 44).length,
          credit: !!v.querySelector('#caEin,#caBank'),
          /* owner 2026-11-06: the three account-management cards sit in the LEFT column directly under Addresses */
          order: (() => { const cols = v.querySelectorAll('.grid2 > div'); const left = cols[0] ? [...cols[0].querySelectorAll(':scope > .card h3')].map(h => h.textContent.trim()) : []; return left; })() };
      });
      await t(`${label}: three separate account facts (owner 2026-11-13) — on file / verified / authorized, application apart`, () => {
        ok(/✓ Account # on file/.test(r.text) && /– Not yet verified/.test(r.text) && /✓ Authorized to order/.test(r.text), 'Yuwell facts');
        ok(/Account # on file \(head office\)/.test(r.text) && /✓ Verified by HCPS 2026-11-01/.test(r.text) && /– Not set up to order/.test(r.text), 'Bemis facts');
        ok(/Application: under review/.test(r.text), 'application shown apart');
        /* owner 2026-11-13 (Germantown): no number → no "Not yet verified"; approved-with-no-number reads as an opening order, never "Authorized to order" */
        const dal = r.text.slice(r.text.indexOf('Dalton Medical'), r.text.indexOf('Bemis'));
        ok(/– No account # on file/.test(dal) && !/Not yet verified/.test(dal) && !/Authorized to order/.test(dal) && /Opening order only — held until the account is open/.test(dal) && /You can place an opening order now/.test(dal), 'Dalton: ' + dal.slice(0, 300));
      });
      await t(`${label}: every section renders (company, contacts, addresses, logo, manufacturer accounts, terms, applications)`, () => {
        ['Company', 'Contacts', 'Addresses', 'Your logo', 'Your manufacturer accounts', 'Manufacturer account applications', 'Pricing export', 'Resale / tax-exemption certificate', 'Acme Branch'].forEach(s => ok(r.text.toLowerCase().includes(s.toLowerCase()), 'missing ' + s));
        ok(!/Your terms by line/i.test(r.text), 'the terms card is removed'); });
      await t(`${label}: Resale certificate, Manufacturer account applications and Pricing export sit directly under Addresses (left column)`, () => {
        ok(r.order.join('|') === 'Company|Contacts|Addresses|Resale / tax-exemption certificate|Manufacturer account applications|Pricing export', r.order.join('|')); });
      await t(`${label}: statuses green / amber / red with their meaning`, () => {
        ok(r.chips.includes('ok:Verified') && r.chips.includes('warn:Pending') && r.chips.includes('none:No account'), r.chips.join('|'));
        ok(/Ordering access is set separately by HCPS/.test(r.text), 'separate from ordering'); });
      await t(`${label}: no horizontal scroll, nothing broken${w < 641 ? ', 44 px touch targets' : ''}`, () => {
        ok(r.sw <= r.cw + 1, r.sw + '>' + r.cw); ok(!r.wide.length, 'wider than the screen: ' + r.wide.join(', ')); ok(!r.broken, 'broken'); if (w < 641) ok(!r.small, r.small + ' small targets'); });
      await t(`${label}: the old credit form (EIN / bank) is gone`, () => ok(!r.credit));
      if (label !== 'tablet') await page.screenshot({ path: path.join(SHOTS, `account-${label}.png`), fullPage: true });

      // company change: only the edited field is sent, as a request
      await page.evaluate(() => acCompanyOpen()); await page.fill('#acPh', '555-999-0000'); await page.click('#acSave');
      await page.waitForFunction(() => !document.querySelector('#modal.on'), null, { timeout: 10000 });
      const req = (seen.toolCalls || []).filter(b => b.action === 'account_change_request').pop();
      await t(`${label}: a company change sends a REQUEST with exactly the edited field`, () => ok(JSON.stringify(req.changes) === JSON.stringify({ company: { phone: '555-999-0000' } }), JSON.stringify(req)));
      // ship-to request + validation message from the server is shown, not swallowed
      await page.evaluate(() => acAddrOpen()); await page.fill('#acAl', 'Store 2'); await page.fill('#acA1', '7 Oak Ave'); await page.fill('#acCi', 'Kettering'); await page.fill('#acSt', 'OH'); await page.fill('#acZp', '45429');
      await page.click('#acSave'); await page.waitForFunction(() => !document.querySelector('#modal.on'), null, { timeout: 10000 });
      const sreq = (seen.toolCalls || []).filter(b => b.action === 'account_change_request').pop();
      await t(`${label}: a new ship-to is a request (no key → a new address)`, () => ok(sreq.changes.ship_to && sreq.changes.ship_to[0].label === 'Store 2' && !sreq.changes.ship_to[0].key, JSON.stringify(sreq)));
      // default ship-to → saved and used first at checkout
      await page.evaluate(() => acDefaultShip('ship-wh'));
      await page.waitForFunction(() => /Default ship-to/.test(document.querySelector('#view-account').innerText), null, { timeout: 10000 });
      const ship = await page.evaluate(() => { AUTH.dealer.addresses = [{ key: 'bill', label: 'Billing', address: '1 Main St', city: 'Dayton', state: 'OH', zip: '45402' }, { key: 'ship-wh', label: 'Warehouse', address: '50 Dock Rd', city: 'Dayton', state: 'OH', zip: '45404' }];
        return shipAddrList()[0]; });
      await t(`${label}: default ship-to saved and comes first at checkout`, () => ok(ship && ship.address === '50 Dock Rd', JSON.stringify(ship)));
      // claim
      await page.evaluate(() => acClaimOpen('dalton', 'Dalton')); await page.fill('#acRef', 'D-555'); await page.click('#acSave');
      await page.waitForFunction(() => !document.querySelector('#modal.on'), null, { timeout: 10000 });
      const cl = (seen.toolCalls || []).filter(b => b.action === 'account_claim').pop();
      await t(`${label}: "I have an account" sends the number for HCPS to verify`, () => ok(cl && cl.manufacturer === 'dalton' && cl.account_ref === 'D-555', JSON.stringify(cl)));
      // logo upload with a real JPEG file
      const jpg = path.join(__dirname, '..', 'public', 'assets', 'logos', 'yuwell.jpg');
      await page.setInputFiles('#view-account input[type=file]', jpg);
      await page.waitForFunction(() => (window.__lastToolsLogo = 1) && /Your logo/.test(document.querySelector('#view-account').textContent) && document.querySelector('#view-account img[alt="Your logo"]'), null, { timeout: 15000 });
      const up = (seen.toolCalls || []).filter(b => b.action === 'logo_upload').pop();
      await t(`${label}: logo upload sends the image itself (JPEG data) and shows it`, () => ok(up && /^data:image\/jpeg;base64,\/9j\//.test(up.data), String(up && up.data).slice(0, 40)));
      await t(`${label}: nothing tried to send a credit application`, () => ok(!(seen.toolCalls || []).some(b => b.action === 'credit_application')));
      await ctx.close();
    }
    // load refused → retry, never a blank page
    { const state = { center: CENTER, fail: true }; const { ctx, page } = await open(browser, 390, 844, { tools: tools(state) });
      await openCenter(page);
      const txt = await page.evaluate(() => document.querySelector('#view-account').innerText);
      await t('a refused load shows the reason and Try again (never a blank or partial account)', () => ok(/could not be loaded/.test(txt) && /Try again/.test(txt) && !/Your manufacturer accounts/.test(txt), txt.slice(0, 200)));
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(`\naccount center (browser): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
