/* Portal improvements (owner 2026-11-18) — pure checks on the shop's own code, extracted VERBATIM from public/index.html:
   Suggested retail (2 × the dealer cost of one order unit when there is neither an MSRP nor a MAP; a pack per its unit with
   a known count; the four Gold-Standard lines untouched), markup over dealer cost, the order view's "not yet supplied" list,
   and the brochure's sales contact (escaped; the shared validator is the admin site's file byte for byte).
     node test/portal-improvements.test.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
let fail = 0, pass = 0;
function t(n, f) { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }
const eq = (a, b, w) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((w || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const ok = (c, w) => { if (!c) throw new Error(w); };
function grab(name) { const i = H.indexOf('function ' + name + '('); if (i < 0) throw new Error('missing ' + name); let j = H.indexOf('{', i), d = 0;
  for (let k = j; k < H.length; k++) { if (H[k] === '{') d++; else if (H[k] === '}') { d--; if (!d) return H.slice(i, k + 1); } } throw new Error('unbalanced ' + name); }
const line = (a) => { const i = H.indexOf(a); return H.slice(i, H.indexOf('\n', i)); };
const env = new Function(line('const SR_FROZEN=') + '\n' + ['packOf', 'srFrozen', 'msrpWord', 'suggestedRetail', 'qMarkupUnit', 'orderMissingList'].map(grab).join('\n') +
  '\nreturn {packOf,srFrozen,msrpWord,suggestedRetail,qMarkupUnit,orderMissingList};')();
t('Suggested retail = 2 × dealer cost of one order unit, only with neither MSRP nor MAP', () => {
  eq(env.suggestedRetail({ manufacturer: 'dalton', base_price: 100 }), { amount: 200, unit: null, n: 1 });
  eq(env.suggestedRetail({ manufacturer: 'dalton', base_price: 100, msrp: 250 }), null, 'manufacturer MSRP wins');
  eq(env.suggestedRetail({ manufacturer: 'dalton', base_price: 100, map: 180 }), null, 'a MAP means advertising rules apply');
  eq(env.suggestedRetail({ manufacturer: 'dalton', base_price: 0 }), null, 'no cost → none');
});
t('a case-priced product: per its order unit with a known piece count; unknown count → none', () => {
  eq(env.suggestedRetail({ manufacturer: 'dalton', base_price: 120, uom: 'Case', case_qty: 2 }), { amount: 240, unit: 'Case', n: 2 });
  eq(env.suggestedRetail({ manufacturer: 'dalton', base_price: 120, case_qty: 4 }), { amount: 240, unit: '4-pack', n: 4 });
});
t('the four Gold-Standard lines and Golden keep exactly what they show', () => {
  for (const m of ['climbing-steps', 'strongback-mobility', 'ovation-medical', 'bemis']) { eq(env.suggestedRetail({ manufacturer: m, base_price: 10 }), null, m); eq(env.msrpWord({ manufacturer: m, _msrp_suggested: true }), 'MSRP', m); }
  eq(env.suggestedRetail({ manufacturer: 'golden-technologies', _golden: true, base_price: 10 }), null);
  eq(env.msrpWord({ manufacturer: 'pedifix', _msrp_suggested: true }), 'Suggested retail'); eq(env.msrpWord({ manufacturer: 'pedifix' }), 'MSRP');
});
t('markup over dealer cost: $2,000 at 40% = $2,800; no cost → none', () => {
  eq(env.qMarkupUnit({ cost: 2000 }, 40), 2800); eq(env.qMarkupUnit({ cost: 19.99 }, 35), 26.99); eq(env.qMarkupUnit({ cost: null }, 40), null);
});
t('order view: what the manufacturer has not supplied yet', () => {
  eq(env.orderMissingList({ source: 'portal', status: 'placed' }), ['Manufacturer sales order (SO) number', 'Ship date', 'Carrier and tracking number']);
  eq(env.orderMissingList({ source: 'portal', status: 'shipped', shipments: [{ ship_date: '2026-11-10', tracking_number: '1Z999', carrier: 'UPS' }] }), ['Manufacturer sales order (SO) number', 'Estimated arrival date']);
  eq(env.orderMissingList({ source: 'portal', status: 'placed', ship_progress: { backordered: [{ code: 'A', qty: 1 }] }, shipments: [{ ship_date: '2026-11-10', tracking_number: 'X1', carrier: 'FedEx', est_delivery_date: '2026-11-14' }] }),
    ['Manufacturer sales order (SO) number', 'Estimated ship date for the backordered items']);
  eq(env.orderMissingList({ source: 'portal', status: 'cancelled' }), []); eq(env.orderMissingList({ source: 'imported', status: 'delivered' }), []);
  eq(env.orderMissingList({ source: 'golden', status: 'placed' }), ['Ship date', 'Carrier and tracking number'], 'Golden SOs come from Golden');
});
t('brochure: the chosen sales contact is printed escaped on a dealer brochure; the validator is the admin copy', () => {
  const { renderBrochure } = require(path.join(ROOT, 'netlify', 'functions', 'brochure.js'));
  const h = renderBrochure({ name: 'Bench', code: 'TB-1' }, { dealer: { business_name: 'Acme', phone: '555' }, sales_contact: { name: 'Jo <i>', title: 'Sales', phone: '502-555-0101', email: 'jo@acme.test' } });
  ok(/Your sales contact: <b>Jo &lt;i&gt;<\/b>, Sales/.test(h) && h.includes('jo@acme.test'), 'printed');
  ok(!renderBrochure({ name: 'Bench' }, { sales_contact: { name: 'Jo', phone: '1' } }).includes('sales contact'), 'not on an unbranded handout');
  const adm = path.join(ROOT, '..', 'homecareproviderservices', 'netlify', 'functions', '_sales_contact.js');
  if (fs.existsSync(adm)) eq(fs.readFileSync(path.join(ROOT, 'netlify', 'functions', '_sales_contact.js'), 'utf8'), fs.readFileSync(adm, 'utf8'), 'same file in both repos');
});
t('category names are black on a light background in the storefront menu (every theme)', () => {
  const S = fs.readFileSync(path.join(ROOT, 'public', 'store.html'), 'utf8');
  ok(/nav\.mainnav \.catdrop a,nav\.mainnav \.catdrop a:visited\{[^}]*color:#111;background:#fff/.test(S), 'menu links black on white, winning over the header link colour');
});
console.log(`\nportal improvements: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
