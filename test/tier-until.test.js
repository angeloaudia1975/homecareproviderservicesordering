'use strict';
/* TIME-LIMITED QUANTITY BREAKS (owner 2026-11-04, Yuwell SP-3: 1–3 regular, 4+ special through Dec 31, 2026;
   from Jan 1, 2027 00:00 Central the regular price at every quantity). The storefront's own pricing functions are
   run with the clock on both sides of the boundary. Synthetic prices only — real ones never enter the repository. */
const fs = require('fs'), path = require('path');
const H = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
function grab(n) { const i = H.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0, j = H.indexOf('{', i); for (;; j++) { if (H[j] === '{') d++; else if (H[j] === '}') { d--; if (!d) break; } } return H.slice(i, j + 1); }
const SRC = ['liveTiers', 'tierUntilLabel', 'tierLadder', 'tierSummary', 'tierQty', 'familyQty', 'contractPrice', 'lineRatePrice', 'unitPrice', 'nextTierGain'].map(grab).join('\n');
const realNow = Date.now;
const at = (iso, f) => { Date.now = () => Date.parse(iso); try { return f(new Function('CART', 'AUTH', 'money', SRC + ';return {unitPrice,tierSummary,tierLadder,nextTierGain,liveTiers};')(new Map(), null, v => '$' + Number(v).toFixed(2))); } finally { Date.now = realNow; } };
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const END = '2027-01-01T06:00:00Z';                     // midnight, Jan 1 2027, Central (CST = UTC-6)
const P = () => ({ manufacturer: 'yuwell', code: 'SP-3', base_price: 100, tiers: [{ min_qty: 4, price: 90, until: END }] });

t('before the end: 1–3 pay the regular price, 4+ the special', () => at('2026-12-31T23:59:59-06:00', E => {
  eq([1, 2, 3, 4, 5, 10].map(q => E.unitPrice(P(), q)), [100, 100, 100, 90, 90, 90]);
}));
t('at midnight Central on Jan 1, 2027 and after: the regular price at every quantity', () => {
  for (const iso of ['2027-01-01T00:00:00-06:00', '2027-01-01T06:00:00Z', '2027-01-01T00:00:01-06:00', '2027-03-01T12:00:00Z'])
    at(iso, E => eq([1, 3, 4, 10, 50].map(q => E.unitPrice(P(), q)), [100, 100, 100, 100, 100], iso));
});
t('one millisecond before the end the special still applies', () => at('2027-01-01T05:59:59.999Z', E => eq(E.unitPrice(P(), 4), 90)));
t('the ladder, card summary and next-break nudge drop the special with the price', () => {
  at('2026-12-15T12:00:00Z', E => {
    eq(E.tierLadder(P()).map(r => [r.qty, r.price]), [[1, 100], [4, 90]]);
    if (!/4\+ \$90\.00 \(through Dec 31, 2026\)/.test(E.tierSummary(P()))) throw new Error(E.tierSummary(P()));
    eq(E.nextTierGain(P(), 1).at, 4);
  });
  at('2027-01-01T06:00:00Z', E => { eq(E.tierLadder(P()), []); eq(E.tierSummary(P()), ''); eq(E.nextTierGain(P(), 1), null); });
});
t('fail closed: an unreadable end date ends the break; a break without an end never ends', () => at('2026-12-01T00:00:00Z', E => {
  eq(E.unitPrice({ base_price: 100, tiers: [{ min_qty: 4, price: 90, until: 'soon' }] }, 5), 100);
  eq(E.unitPrice({ base_price: 100, tiers: [{ min_qty: 4, price: 90 }] }, 5), 90);
  eq(E.unitPrice({ base_price: 100, tiers: [{ min_qty: 4, price: 90, until: '' }] }, 5), 90);
}));
t('lines without time-limited breaks are untouched (liveTiers returns the same array)', () => at('2030-01-01T00:00:00Z', E => {
  const p = { tiers: [{ min_qty: 2, price: 9 }, { min_qty: 5, price: 8, pool: 'x' }] }; if (E.liveTiers(p) !== p.tiers) throw new Error('copied');
}));
t('every frozen / live line file carries no `until` today (nothing else changes behaviour)', () => {
  const dir = path.join(__dirname, '..', 'public', 'data');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) if (/"until"\s*:/.test(fs.readFileSync(path.join(dir, f), 'utf8'))) throw new Error(f);
});
console.log(`\ntier until: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
