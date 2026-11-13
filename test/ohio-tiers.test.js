'use strict';
/* OHIO MEDICAL / GCE 5+ PRICING (owner 2026-11-12). "Price Each" = the regular dealer unit price; "Price 5+" = the unit
   price when FIVE OR MORE of the SAME SKU are on the order. Different models never combine to qualify (3 × RS-00608-X-S +
   2 × RS-00608-X-D pay Price Each). The storefront's own pricing functions are run here (the order server runs the same
   text — test/pricing-parity.test.js keeps the copies identical). Synthetic prices only: real ones never enter the
   repository (it is public). */
const fs = require('fs'), path = require('path');
const H = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
function grab(n) { const i = H.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0, j = H.indexOf('{', i); for (;; j++) { if (H[j] === '{') d++; else if (H[j] === '}') { d--; if (!d) break; } } return H.slice(i, j + 1); }
const SRC = ['tierUntilLabel', 'tierLadder', 'tierSummary', 'tierQty', 'familyQty', 'contractPrice', 'lineRatePrice', 'unitPrice', 'nextTierGain'].map(grab).join('\n');
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };

const FILE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'ohio-medical.json'), 'utf8'));
// A product exactly as the storefront builds it: the public row + a commercial overlay (synthetic prices).
const prod = (code, each, five) => Object.assign({}, FILE.find(r => r.code === code), { manufacturer: 'ohio-medical', base_price: each, tiers: [{ minQty: 1, price: each }, { minQty: 5, price: five }] });
function engine(cartLines, auth) {
  const CART = new Map(cartLines.map(([p, qty]) => [p.code, { p, qty }]));
  return new Function('CART', 'AUTH', 'money', SRC + ';return {unitPrice,tierLadder,tierSummary};')(CART, auth || null, v => '$' + Number(v).toFixed(2));
}
const XS = prod('RS-00608-X-S', 100, 90), XD = prod('RS-00608-X-D', 120, 110), ACC = prod('RS-00512', 10, 9);

t('no Ohio row carries a catalog group / family (a group would pool different SKUs into one quantity)', () => {
  eq(FILE.length, 26);
  for (const r of FILE) if (r.group || r.family || r.pool || r.tier_family) throw new Error(r.code + ' carries ' + JSON.stringify({ group: r.group, family: r.family }));
});
t('one SKU: quantities 1 and 4 pay Price Each, 5 and 6 pay Price 5+', () => {
  for (const [q, want] of [[1, 100], [4, 100], [5, 90], [6, 90]]) eq(engine([[XS, q]]).unitPrice(XS, q), want, 'qty ' + q);
});
t('mixed SKUs never combine: 3 × RS-00608-X-S + 2 × RS-00608-X-D both pay Price Each', () => {
  const E = engine([[XS, 3], [XD, 2]]);
  eq([E.unitPrice(XS, 3), E.unitPrice(XD, 2)], [100, 120]);
});
t('mixed SKUs: 5 of one model reaches 5+ for that model only', () => {
  const E = engine([[XS, 5], [XD, 4], [ACC, 7]]);
  eq([E.unitPrice(XS, 5), E.unitPrice(XD, 4), E.unitPrice(ACC, 7)], [90, 120, 9]);
});
t('quantity changes move the price both ways (4 → 5 → 6 → 4)', () => {
  eq([4, 5, 6, 4].map(q => engine([[XS, q]]).unitPrice(XS, q)), [100, 90, 90, 100]);
});
t('the card ladder shows the two Ohio breaks', () => {
  eq(engine([]).tierLadder(XS).map(r => [r.qty, r.price]), [[1, 100], [5, 90]]);
});
t('a pack SKU is priced per package (the quantity is packages, never pieces)', () => {
  const r = FILE.find(x => x.code === 'RS-00512');
  if (!/pack of 10/i.test(r.name)) throw new Error('RS-00512 name should state the pack: ' + r.name);
  eq([1, 5].map(q => engine([[ACC, q]]).unitPrice(ACC, q)), [10, 9]);
});
// The order server's copy of these functions is held to the page by the admin repo's test/pricing-parity.test.js.

console.log(`\n${pass} passed, ${fail} failed`); if (fail) process.exit(1);
