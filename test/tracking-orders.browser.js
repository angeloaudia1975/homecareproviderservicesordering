/* SHIPMENT TRACKING on My Orders (owner 2026-11-15) — the REAL storefront page in Chromium (_shop-harness.js; nothing
   reaches HCPS). Order history answers come from the admin repo's own _shipments.js (forDealer + progress), so the page is
   tested against the exact server shapes: a partial shipment with a backorder, two shipments completing an order, a
   scheduled-only shipment, a shipment without recorded contents; at 390 / 768 / 1280 px with no horizontal scroll.
   PLAYWRIGHT_MODULE=… ADMIN_DIR=../homecareproviderservices node test/tracking-orders.browser.js */
const { chromium, open, path } = require('./_shop-harness.js');
const S = require(path.join(process.env.ADMIN_DIR || path.join(__dirname, '..', '..', 'homecareproviderservices'), 'netlify', 'functions', '_shipments.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const mk = (id, lines, rows, status) => ({ id, date: '2026-11-0' + id.slice(-1), source: 'portal', status: status || 'shipped', manufacturer: 'pedifix', manufacturerName: 'PediFix', lines, units: lines.reduce((a, l) => a + l.qty, 0), cost: 10, total: 10,
  shipments: rows.map(S.forDealer), ship_progress: S.progress(lines, rows) });
const O = (n) => '1111111' + n + '-1111-4111-8111-11111111111' + n;
const ORDERS = [
  mk(O(1), [{ code: 'P15', name: 'Corn protectors', qty: 4 }, { code: 'P26-S', name: 'Toe spacer', qty: 2 }],
    [{ carrier: 'ups', tracking_number: '1Z999AA10123456784', ship_date: '2026-11-10', ship_date_source: 'carrier', note: '[items P15x4][backordered P26-Sx2] box 1', updated_at: '2026-11-11T15:00:00Z' }]),
  mk(O(2), [{ code: 'P83', name: 'Toe cushions', qty: 3 }],
    [{ carrier: 'fedex', tracking_number: '771234567890', ship_date: '2026-11-08', ship_date_source: 'carrier', note: '[items P83x1]', updated_at: '2026-11-08T15:00:00Z' },
     { carrier: 'usps', tracking_number: '9400111899223856928499', ship_date: '2026-11-12', ship_date_source: 'carrier', note: '[items P83x2]', updated_at: '2026-11-12T15:00:00Z' }]),
  mk(O(3), [{ code: 'P16', name: 'Pads', qty: 1 }], [{ est_ship_date: '2026-11-20', est_ship_source: 'manufacturer', note: '[items P16x1]', updated_at: '2026-11-13T15:00:00Z' }], 'processing'),
  mk(O(4), [{ code: 'P48', name: 'Cushion', qty: 1 }], [{ tracking_number: 'PRO12345', ship_date: '2026-11-09', ship_date_source: 'staff', updated_at: '2026-11-09T15:00:00Z' }]),
];
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const { ctx, page } = await open(browser, w, h, {});
      await page.route(/\/functions\/order-history-api/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, count: ORDERS.length, orders: ORDERS }) }));
      await page.evaluate(async () => { HISTORY = null; showView('orders'); await loadOrders(); });
      await page.waitForFunction(() => /Partially shipped/.test((document.querySelector('#view-orders') || {}).innerText || ''), null, { timeout: 20000 });
      const r = await page.evaluate(() => { const v = document.querySelector('#view-orders'); return { text: v.innerText.replace(/\s+/g, ' '), html: v.innerHTML, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
      await t(`${label}: partial shipment — "Partially shipped — 4 of 6 units", backordered P26-S ×2 with its as-of date, contents of the box`, () => {
        ok(/Partially shipped — 4 of 6 units/.test(r.text), r.text.slice(0, 400)); ok(/Backordered: P26-S ×2/.test(r.text) && /as of Nov 11, 2026/.test(r.text), 'backorder'); ok(/Contains P15 ×4/.test(r.text), 'contents'); });
      await t(`${label}: two shipments complete an order — "2 shipments", "Shipped in full — 3 of 3 units", each with its own tracking link`, () => {
        ok(/2 shipments/.test(r.text) && /Shipped in full — 3 of 3 units/.test(r.text), 'complete'); ok(r.html.includes('fedex.com') && r.html.includes('usps.com'), 'carrier links'); });
      await t(`${label}: an estimate is never "shipped" — "Scheduled to ship" with the manufacturer's estimated date`, () => ok(/Scheduled to ship/.test(r.text) && /Estimated ship Nov 20, 2026 \(manufacturer\)/.test(r.text), 'scheduled'));
      await t(`${label}: a shipment without recorded contents says so; carrier not confirmed is shown, never guessed`, () => ok(/Shipped — contents not listed/.test(r.text) && /PRO12345/.test(r.text) && /carrier not confirmed/.test(r.text), 'unknown'));
      await t(`${label}: no raw [items …] tags reach the dealer; no horizontal scroll`, () => { ok(!/\[items|\[backordered/.test(r.text), 'raw tags'); ok(r.sw <= r.cw + 1, 'scroll ' + r.sw + '>' + r.cw); });
      if (label === 'iphone') await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'tracking-iphone.png'), fullPage: false });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\ntracking orders: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
