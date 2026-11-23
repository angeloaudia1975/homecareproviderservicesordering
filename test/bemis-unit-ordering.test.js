'use strict';
/* Bemis unit ordering + loose-unit fee (owner 2026-11-23). Runs the REAL functions from public/index.html. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'manufacturers.json'), 'utf8'));
const bemisCfg = (Array.isArray(mf) ? mf : mf.manufacturers).find((m) => m.slug === 'bemis');
function grab(name) { const i = html.indexOf('function ' + name + '('); if (i < 0) throw new Error('missing ' + name); let d = 0, j = html.indexOf('{', i); for (let k = j; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (d === 0) return html.slice(i, k + 1); } } }
const ctx = vm.createContext({ mfrInfo: (s) => (s === 'bemis' ? bemisCfg : { slug: s }), Math, Number, String, Array, Object });
vm.runInContext(['unitOrderCfg', 'unitOrderProduct', 'looseUnitFeeFor'].map(grab).join('\n') + '\nthis.F={unitOrderCfg,unitOrderProduct,looseUnitFeeFor};', ctx);
const F = ctx.F;
let pass = 0, fail = 0; const t = (n, fn) => { try { fn(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); };
const cfg = F.unitOrderCfg('bemis');
/* the supplied eight-SKU table (Bemis PDF, effective 2025-10-10): unit price, master case, case cost, MSRP, MAP */
const TABLE = [['7YR05310TSS', 54.99, 2, 109.98, 109.99], ['7YE05310TSS', 54.99, 2, 109.98, 109.99], ['7YA05313GRY', 29.99, 4, 119.96, 59.99], ['7YA05313BLK', 29.99, 4, 119.96, 59.99],
  ['7YA06303TWA', 37.49, 2, 74.98, 74.99], ['7YA04505T', 39.99, 3, 119.97, 79.99], ['7YA0AS100', 49.99, 2, 99.98, 99.99], ['7YE82350TC', 54.99, 1, 54.99, 109.99]];
const prod = ([code, , n, cost, msrp]) => ({ code, name: code, manufacturer: 'bemis', base_price: cost, case_qty: n, uom: n > 1 ? 'Case' : 'Each', msrp, map: msrp, msrp_each: n > 1 ? true : undefined, tiers: [{ minQty: 1, price: cost }] });
t('config: bemis is unit-ordered, fee $10; other lines are not', () => { eq(cfg.looseUnitFee, 10); eq(F.unitOrderCfg('pedifix'), null); });
t('every SKU: unit dealer price = PDF; case size kept as packaging; MSRP/MAP stay separate fields', () => {
  for (const r of TABLE) { const u = F.unitOrderProduct(prod(r), cfg); eq(u.base_price, r[1], r[0]); eq(u.pack_qty, r[2], r[0]); eq(u.tiers[0].price, r[1], r[0] + ' tier'); eq(u.msrp, r[4], r[0] + ' msrp'); eq(u.map, r[4], r[0] + ' map'); eq(u.uom, 'Each'); eq(u.case_qty, null); eq(u._unitOrder, true); }
});
t('transform is idempotent and never mutates the master record', () => { const p = prod(TABLE[0]); const a = F.unitOrderProduct(p, cfg); const b = F.unitOrderProduct(a, cfg); eq(a, b); eq(p.base_price, 109.98); });
const line = (r, qty) => ({ p: F.unitOrderProduct(prod(r), cfg), qty });
const fee = (...ls) => F.looseUnitFeeFor('bemis', ls).fee;
t('case 2: qty 1 and 3 pay $10; 2 and 4 do not; 5 pays; 6 does not', () => { const r = TABLE[0]; eq([1, 2, 3, 4, 5, 6].map((q) => fee(line(r, q))), [10, 0, 10, 0, 10, 0]); });
t('case 4: 1,2,3 pay; 4 no; 5 pays; 8 no; 9 pays', () => { const r = TABLE[2]; eq([1, 2, 3, 4, 5, 8, 9].map((q) => fee(line(r, q))), [10, 10, 10, 0, 10, 0, 10]); });
t('case 3: 3 and 6 free; 4 pays', () => { const r = TABLE[5]; eq([3, 4, 6, 7].map((q) => fee(line(r, q))), [0, 10, 0, 10]); });
t('case 1 never pays (any quantity)', () => { const r = TABLE[7]; eq([1, 2, 3, 7, 100].map((q) => fee(line(r, q))), [0, 0, 0, 0, 0]); });
t('fee is per product line, not per unit; two products each pay', () => { eq(fee(line(TABLE[0], 3), line(TABLE[2], 5)), 20); eq(fee(line(TABLE[0], 3)), 10); });
t('splitting an identical product across lines cannot avoid or duplicate the fee', () => {
  eq(fee(line(TABLE[0], 1), line(TABLE[0], 1)), 0, '1+1 = full case'); eq(fee(line(TABLE[0], 1), line(TABLE[0], 2)), 10, '1+2 = 3 loose'); eq(fee(line(TABLE[0], 3), line(TABLE[0], 3)), 0, '3+3');
  eq(fee(line(TABLE[0], 1), line(TABLE[0], 1), line(TABLE[0], 1)), 10, 'three lines of 1 pay ONCE not three times');
});
t('the fee row names the product, quantity and case; empty/zero quantity charges nothing', () => { const r = F.looseUnitFeeFor('bemis', [line(TABLE[0], 3)]).rows[0]; eq([r.code, r.qty, r.pack_qty, r.fee], ['7YR05310TSS', 3, 2, 10]); eq(fee(line(TABLE[0], 0)), 0); eq(F.looseUnitFeeFor('bemis', []).fee, 0); });
t('another manufacturer never pays the fee', () => { eq(F.looseUnitFeeFor('pedifix', [line(TABLE[0], 3)]).fee, 0); });
t('order total example: 3 × unit 54.99 + $10 fee = 174.97', () => { const l = line(TABLE[0], 3); eq(Math.round((l.p.base_price * 3 + fee(l)) * 100) / 100, 174.97); });

/* review 2026-11-23 blockers: the REAL client item builder must flag unit lines; saved carts convert the product too; legacy reorder is inferred */
const ctx2 = vm.createContext({ groupCart: () => [['bemis', [{ p: F.unitOrderProduct(prod(TABLE[0]), cfg), qty: 3 }]], ['pedifix', [{ p: { code: 'P1', manufacturer: 'pedifix', base_price: 5 }, qty: 2 }]]], isGoldenSlug: () => false, checkoutUnit: (p) => p.base_price, CHECKOUT_PROMO: {}, Math, Number, String, Array, Object });
vm.runInContext(grab('hcpsCartOrders') + '\nthis.G=hcpsCartOrders;', ctx2);
t('price-check payload: a Bemis unit line carries unit_order:true; other lines do not', () => { const o = ctx2.G(); eq(o[0].items[0].unit_order, true); eq(o[1].items[0].unit_order, undefined); });
t('hydrateCart converts the saved PRODUCT as well as the quantity (source check)', () => { const i = html.indexOf('function hydrateCart('); const body = html.slice(i, i + 1600); if (!/it\.p=unitOrderProduct\(it\.p,unitOrderCfg\(it\.p\.manufacturer\)\)/.test(body)) throw new Error('product not converted'); });
t('reorder infers legacy case orders from the stored price and tells the dealer (source check)', () => { if (!/nearer to/.test(html) || !/your past order was/.test(html)) throw new Error('missing'); });
t('legacy cart conversion: a case-priced saved product becomes the unit product', () => { const old = prod(TABLE[0]); const u = F.unitOrderProduct(old, cfg); eq([u._unitOrder, u.pack_qty, u.base_price], [true, 2, 54.99]); });
console.log('\nbemis unit ordering: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
