/* One code sold in two families on one line (Access4U SR3 / PRK: Stock Orders "RS" and Modular System "RR", at two
   prices) stays two cart lines (2026-10-27). Runs the storefront's own cartKey / addToCart / applyServerPrices /
   reorder text (sliced from public/index.html) in a sandbox and checks:
   - adding RS then RR keeps both lines, each with its own product (no silent re-pricing of the first pick);
   - the server's price check (family echoed) updates the right line; the contract price key stays slug::code;
   - a code without a family keeps the old key (slug::code) — every other line is unchanged;
   - reorder never guesses between two families at different prices. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
function slice(a, b) { const i = SRC.indexOf(a), j = SRC.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('anchor: ' + (i < 0 ? a : b)); return SRC.slice(i, j); }
const CARTK = slice('const cartKey=p=>', 'function cartCount(){');
const APPLY = slice('function applyServerPrices(res){', 'function priceNoteHtml(p){');
const REORDER = slice('async function reorder(orderId){', '\n}\n') + '\n}\n';
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + (e && e.message)); } }
function world() {
  const ctx = { console, Map, Set, Number, Math, String, Object, Array, JSON, Promise,
    CART: new Map(), PRICE_NOTES: new Map(), AUTH: { prices: {} }, toasts: [],
    toast(m) { ctx.toasts.push(m); }, updateCart() {}, track() {}, openCart() {},
    state: { manufacturers: [{ slug: 'access4u', hasData: true }], products: [] }, DASH: { orders: [] },
    selectManufacturer: async () => {} };
  vm.createContext(ctx);
  vm.runInContext(CARTK + '\n' + APPLY + '\n' + REORDER + '\nthis.cartKey=cartKey; this.addToCart=addToCart; this.applyServerPrices=applyServerPrices; this.reorder=reorder;', ctx);
  return ctx;
}
const RS = () => ({ manufacturer: 'access4u', code: 'SR3', family: 'RS', base_price: 10 });
const RR = () => ({ manufacturer: 'access4u', code: 'SR3', family: 'RR', base_price: 20 });
(async () => {
  await t('two families of one code stay two lines, each with its own product', () => {
    const w = world(); w.addToCart(RS(), 1); w.addToCart(RR(), 2);
    ok(w.CART.size === 2, 'merged into ' + w.CART.size + ' line(s)');
    const rs = w.CART.get('access4u::SR3::RS'), rr = w.CART.get('access4u::SR3::RR');
    ok(rs && rs.p.family === 'RS' && rs.qty === 1 && rr && rr.p.family === 'RR' && rr.qty === 2, JSON.stringify([...w.CART.keys()]));
  });
  await t('a code without a family keeps the old key — other lines unchanged', () => {
    const w = world(); w.addToCart({ manufacturer: 'pedifix', code: 'P15', base_price: 1 }, 1); w.addToCart({ manufacturer: 'pedifix', code: 'P15', base_price: 1 }, 2);
    ok(w.CART.size === 1 && w.CART.get('pedifix::P15').qty === 3, JSON.stringify([...w.CART.entries()]));
  });
  await t('the server price check updates the right family line; the contract price key stays slug::code', () => {
    const w = world(); w.addToCart(RS(), 1); w.addToCart(RR(), 1);
    const n = w.applyServerPrices({ orders: [{ manufacturer_slug: 'access4u', items: [
      { code: 'SR3', family: 'RS', available: true, unit: 11, client_unit: 10, changed: true, contract: 9, commercial: { base_price: 11 } },
      { code: 'SR3', family: 'RR', available: false }] }] });
    ok(n === 2, 'changes ' + n);
    ok(w.CART.get('access4u::SR3::RS').p.base_price === 11 && !w.CART.get('access4u::SR3::RS').p._unavailable, 'RS not updated');
    ok(w.CART.get('access4u::SR3::RR').p._unavailable === true && w.CART.get('access4u::SR3::RR').p.base_price === 20, 'RR wrong');
    ok(w.AUTH.prices['access4u::SR3'] === 9 && !('access4u::SR3::RS' in w.AUTH.prices), JSON.stringify(w.AUTH.prices));
    ok(w.PRICE_NOTES.get('access4u::SR3::RS').now === 11 && w.PRICE_NOTES.get('access4u::SR3::RR').gone, 'notes');
  });
  await t('reorder never guesses between two families at different prices', async () => {
    const w = world(); w.state.products = [RS(), RR(), { manufacturer: 'access4u', code: 'GATE36', base_price: 5 }];
    w.DASH.orders = [{ id: 'o1', manufacturer: 'access4u', items: [{ code: 'SR3', qty: 1 }, { code: 'GATE36', qty: 2 }] }];
    await w.reorder('o1');
    ok(!w.CART.has('access4u::SR3::RS') && !w.CART.has('access4u::SR3::RR') && w.CART.get('access4u::GATE36').qty === 2, JSON.stringify([...w.CART.keys()]));
    ok(/1 no longer in catalog/.test(w.toasts.join()), w.toasts.join());
  });
  await t('reorder of a code in two families at the SAME price still works', async () => {
    const w = world(); const b = RR(); b.base_price = 10; w.state.products = [RS(), b];
    w.DASH.orders = [{ id: 'o1', manufacturer: 'access4u', items: [{ code: 'SR3', qty: 1 }] }];
    await w.reorder('o1'); ok(w.CART.size === 1, JSON.stringify([...w.CART.keys()]));
  });
  console.log(`\ncart family: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
