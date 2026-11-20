/* ORDERS & TRACKING — current Golden orders for a SIGNED-IN dealer (owner 2026-11-19, Williams Brothers: the list stopped at the
   imported August rows with no warning). REAL page (_shop-harness.js, a signed-in dealer; nothing leaves the page), at 1280 and
   390 px. dealer-reports-api golden_orders is answered here in the shape the HCPS server returns (that server is tested in the
   HCPS repo, test/golden-report-orders.test.js). Synthetic data modelled on the Washington case.
   - the two Washington orders (P1601 / SO261000205, Oct 1, PO 90835, invoiced $3,077; P1597 / SO260908718, Sep 30) are rows of
     the main list, once each, above the imported August rows, with their location; View / print shows items, status, ship
     date and the carrier link — and "Delivery not confirmed", never "Delivered";
   - a status line at the TOP says what loaded (count, newest date, period, locations);
   - Golden failing, a server error, a partial read and a login without a live connection each say so at the top, with the
     latest date the imported records cover; "Try again" loads the orders.
   node test/golden-orders-tracking.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 400)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };

const imported = Array.from({ length: 25 }, (_, i) => ({ id: 'imp' + i, date: `2026-0${8 - Math.floor(i / 4) > 0 ? 8 - Math.floor(i / 4) : 1}-01`, source: 'imported', status: 'reported', manufacturer: 'golden-technologies', manufacturerName: 'Golden Technologies', lines: [{ code: 'PR' + i, qty: 1 }], units: 1, cost: 100, total: 100 }));
const P1601 = { order_ref: 'P1601', source: 'linked', status: 'invoiced', placed_on: '2026-10-01', po_number: '90835', so_numbers: ['SO261000205'], ship_to: { city: 'Washington', state: 'IN' },
  items: [{ sku: 'PR510-MED', description: 'Cloud lift chair', qty: 2, unit_price: 1538.5, ext_price: 3077, price_source: 'golden_so', so_number: 'SO261000205' }],
  tracking: [{ so_number: 'SO261000205', carrier: 'UPS', tracking_number: '1Z999AA10123456784', ship_date: '2026-10-08' }],
  lifecycle: [{ type: 'submitted', at: '2026-10-01', label: '' }, { type: 'booked', at: '2026-10-01', so_number: 'SO261000205', label: '' }, { type: 'invoiced', at: '2026-10-09', label: '' }],
  totals: { subtotal: 3077, freight: 0, sh: 0, total: 3077, basis: 'golden_so_submitted_freight' }, location_id: 'w', location_name: 'Williams Brothers — Washington', booked_on: '2026-10-01' };
const P1597 = { order_ref: 'P1597', source: 'linked', status: 'acknowledged', placed_on: '2026-09-30', po_number: '90820', so_numbers: ['SO260908718'], ship_to: { city: 'Washington', state: 'IN' },
  items: [{ sku: 'PR118-MED', description: 'Comforter', qty: 1 }], tracking: [], lifecycle: [{ type: 'booked', at: '2026-09-30', label: '' }], location_id: 'w', location_name: 'Williams Brothers — Washington', booked_on: '2026-09-30' };
const LOCS = [{ id: 'w', name: 'Williams Brothers — Washington', city: 'Washington', state: 'IN' }, { id: 'p', name: 'Williams Brothers — Paoli', city: 'Paoli', state: 'IN' }];
const READY = { ok: true, enabled: true, available: true, orders: [P1601, P1597], prices_visible: true, locations: LOCS, since_day: '2025-10-15', newest_day: '2026-10-01', oldest_day: '2026-09-30', truncated: false, unread_locations: [] };

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      const { ctx, page } = await open(b, w, h, {});
      let answer = READY, calls = 0, proxyHistory = 0;
      await page.route('**/order-history-api', (r) => { const x = JSON.parse(r.request().postData() || '{}');
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(x.action === 'history' ? { ok: true, orders: imported } : { ok: true, ytd: {}, allTime: {}, byManufacturer: [], monthly: [], recent: [] }) }); });
      await page.route('**/dealer-reports-api', (r) => { const x = JSON.parse(r.request().postData() || '{}');
        if (x.action !== 'golden_orders') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
        calls++; const a = typeof answer === 'function' ? answer() : answer;
        return a === 503 ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"x"}' }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(a) }); });
      await page.route('**/golden-proxy', (r) => { const x = JSON.parse(r.request().postData() || '{}'); if (x.action === 'history') proxyHistory++;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x.action === 'order' ? { ok: true, enabled: true, available: false, reason: 'golden_unavailable' } : { ok: true, enabled: false, reason: 'switched_off' }) }); });
      /* the harness opens as staff preview; from here on the page behaves as the dealer's own sign-in (no preview token) */
      await page.evaluate(() => { window.__PREVIEW__ = null; });
      await page.waitForTimeout(1200);
      const openOrders = async () => { await page.evaluate(() => { if (window.P360 && P360.invalidateHistory) P360.invalidateHistory(); showP360('orders'); }); await page.waitForSelector('#ordGoldenStatus', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(900); };
      const st = () => page.evaluate(() => { const e = document.getElementById('ordGoldenStatus'); return { hidden: e.hidden, text: e.innerText.replace(/\s+/g, ' '), warn: e.classList.contains('warn'), y: e.getBoundingClientRect().top, ty: document.querySelector('#view-orders .tbl').getBoundingClientRect().top }; });

      await openOrders();
      const s1 = await st();
      const main = await page.evaluate(() => [...document.querySelectorAll('#ordBody tr')].map((r) => r.innerText.replace(/\s+/g, ' ')));
      await t(`${label}: both Washington Golden orders are rows of the main list — once each, newest first, above the imported August rows, with their location`, () => {
        ok(main.filter((x) => /SO261000205/.test(x)).length === 1 && main.filter((x) => /SO260908718/.test(x)).length === 1, main.slice(0, 4).join(' | '));
        ok(/SO261000205/.test(main[0]) && /SO260908718/.test(main[1]) && /PO 90835/.test(main[0]) && /\$3,077\.00/.test(main[0]) && /Invoiced/.test(main[0]), main[0] + ' || ' + main[1]);
        ok(/Location: Williams Brothers — Washington/.test(main[0]), 'location: ' + main[0]);
        ok(main.length === 27, 'rows ' + main.length); ok(proxyHistory === 0 && calls === 1, 'a signed-in dealer reads through the location-scoped server read ' + JSON.stringify({ proxyHistory, calls }));
      });
      await t(`${label}: the status line at the top says what loaded — count, newest date, period, locations`, () => {
        ok(!s1.hidden && !s1.warn && s1.y < s1.ty, JSON.stringify(s1));
        ok(/2 current orders loaded live from Golden, newest Oct 1, 2026/.test(s1.text) && /Covers Oct 15, 2025 to today for 2 locations/.test(s1.text), s1.text);
      });
      await page.evaluate(() => { const r = [...document.querySelectorAll('#ordBody tr[data-ghorder]')].find((x) => x.getAttribute('data-ghorder') === 'P1601'); r.querySelector('a.btn').click(); });
      await page.waitForFunction(() => /PR510-MED/.test((document.getElementById('modal') || {}).innerText || ''), null, { timeout: 10000 });
      const md = await page.evaluate(() => { const m = document.getElementById('modal'); return { text: m.innerText.replace(/\s+/g, ' '), html: m.innerHTML }; });
      await page.evaluate(() => ghCloseOrder());
      await t(`${label}: View / print — items, Invoiced, ship date, the carrier's own tracking link, location; delivery never claimed`, () => {
        ok(/Golden order — SO261000205/.test(md.text) && /90835/.test(md.text) && /2 × PR510-MED/.test(md.text) && /Invoiced/.test(md.text), md.text.slice(0, 500));
        ok(/ups\.com\/track\?tracknum=1Z999AA10123456784/.test(md.html) && /Oct 8, 2026/.test(md.text), 'tracking: ' + md.text.slice(0, 600));
        ok(/Williams Brothers — Washington/.test(md.text) && /Delivery not confirmed/.test(md.text) && !/Delivered/.test(md.text), md.text.slice(0, 600));
      });

      answer = { ok: true, enabled: true, available: false, reason: 'golden_unavailable', retry: true, locations: LOCS };
      await openOrders(); const s2 = await st();
      const rowsFail = await page.evaluate(() => document.querySelectorAll('#ordBody tr[data-ghorder]').length);
      await t(`${label}: Golden failing → a warning at the top naming the latest date the imported rows cover; never a silent list`, () => {
        ok(s2.warn && !s2.hidden && s2.y < s2.ty && /Current Golden orders could not be loaded right now/.test(s2.text) && /cover through Aug 1, 2026/.test(s2.text), JSON.stringify(s2)); ok(rowsFail === 0, "stale Golden rows " + rowsFail);
      });
      answer = READY;
      const th = await page.evaluate(() => document.querySelector('#ordGoldenStatus [data-ghretry2]').getBoundingClientRect().height);
      await page.click('#ordGoldenStatus [data-ghretry2]'); await page.waitForFunction(() => document.querySelectorAll('#ordBody tr[data-ghorder]').length === 2, null, { timeout: 10000 });
      await t(`${label}: "Try again" (≥ 44px) loads the current orders`, async () => { ok(th >= 44, 'height ' + th); ok(/2 current orders/.test((await st()).text)); });

      answer = 503; await openOrders(); const s3 = await st();
      await t(`${label}: a server error says so at the top too`, () => ok(s3.warn && /could not be loaded/.test(s3.text), JSON.stringify(s3)));
      answer = Object.assign({}, READY, { orders: [P1601], truncated: true, oldest_day: '2026-10-01', unread_locations: ['Williams Brothers — Paoli'] });
      await openOrders(); const s4 = await st();
      await t(`${label}: a partial read says what loaded, the oldest date covered and which location could not be read`, () =>
        ok(/1 current order loaded/.test(s4.text) && /Covers Oct 1, 2026 to today/.test(s4.text) && /Older Golden orders were not read this time/.test(s4.text) && /could not be read for: Williams Brothers — Paoli/.test(s4.text), s4.text));
      answer = { ok: true, enabled: true, available: false, reason: 'not_linked', retry: false, locations: LOCS };
      await openOrders(); const s5 = await st();
      await t(`${label}: no live Golden connection, but imported Golden rows → said at the top with their latest date`, () =>
        ok(s5.warn && /not connected for this login \(not linked\)/.test(s5.text) && /through Aug 1, 2026/.test(s5.text), s5.text));
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      await t(`${label}: no sideways scroll`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(`\ngolden orders & tracking (signed-in): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
