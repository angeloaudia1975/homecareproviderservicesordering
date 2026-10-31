/* Option 2 catalog layout (owner-approved 2026-10-31): the shared catalog view's own logic, run VERBATIM from the shop
   page against a synthetic catalog. Every SKU stays on exactly one card; a search keeps a matched family whole and opens
   it on the matched SKU; category counts are the cards a dealer will see; sorting and the price range work on the
   dealer's price; the card markup keeps "Choose options" for families and quantity + Add to cart for single SKUs, never a
   description scrollbox, and never prints a price the pricing functions did not produce. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { grabDecl } = require('./extract-picker.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + (e && e.message)); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };

const names = ['function groupKeyOf', 'function catOrder', 'function catRank', 'function compareCats', 'function groupDisplayName', 'function groupLeads',
  'const cvNorm', 'function cvLine', 'function cvQuery', 'function cvCat', 'function cvBrand', 'function cvBase', 'function cvInCat', 'function cvFamilies', 'function cvTree', 'function cvLeads'];
const src = names.map(n => grabDecl(html, n)).join('\n');
function world(products, f) {
  const inputs = { '#search': { value: f.q || '' }, '#catFilter': { value: f.cat || '' }, '#brandFilter': { value: f.brand || '' } };
  const ctx = { state: { products, manufacturers: [{ slug: 'x', name: 'Acme Medical' }], active: 'x' },
    CUI: { pmin: f.pmin || '', pmax: f.pmax || '', sort: f.sort || 'relevance' }, $: s => inputs[s] || null,
    unitPrice: p => Number(p.base_price) || 0, console };
  vm.createContext(ctx); vm.runInContext(src + '\nthis.api={cvBase,cvInCat,cvFamilies,cvTree,cvLeads,groupKeyOf};', ctx);
  return ctx.api;
}
const P = (code, page, cat, sub, price, extra) => Object.assign({ code, name: 'Item ' + code, _pageKey: page, category: cat, subcategory: sub, base_price: price, manufacturer: 'x' }, extra || {});
const CAT = [
  P('A1', 'ramp', 'Ramps', 'Assist', 300), P('A2', 'ramp', 'Ramps', 'Assist', 320), P('A3', 'ramp', 'Ramps', 'Assist', 340),
  P('T1', 'thr', 'Ramps', 'Threshold', 90), P('T2', 'thr', 'Ramps', 'Threshold', 95),
  P('CK', 'acc', 'Accessories', 'Kits', 19), P('DLOOP', 'acc', 'Accessories', 'Kits', 20),
  P('S1', null, 'Stairs', '', 700), P('Q1', null, '', '', null, { brand: 'Other brand' }),
];

t('every SKU is on exactly one card; cards = families', () => {
  const W = world(CAT, {}); const leads = W.cvLeads(W.cvBase());
  const seen = {}; leads.forEach(L => (L._variants || [L]).forEach(v => { seen[v.code] = (seen[v.code] || 0) + 1; }));
  eq(Object.keys(seen).sort(), CAT.map(p => p.code).sort()); ok(Object.values(seen).every(n => n === 1), 'a SKU on two cards');
  eq(leads.length, 5, 'cards'); eq(W.cvFamilies(CAT), 5);
});
t('a SKU search keeps its family whole and opens on that SKU', () => {
  const W = world(CAT, { q: 'a2' }); const leads = W.cvLeads(W.cvBase());
  eq(leads.length, 1); eq(leads[0]._variants.map(v => v.code), ['A1', 'A2', 'A3']); eq(leads[0]._openCode, 'A2');
  const W2 = world(CAT, { q: 'dloop' }); const l2 = W2.cvLeads(W2.cvBase()); eq(l2[0]._openCode, 'DLOOP'); eq(l2[0]._variants.length, 2);
  const W3 = world(CAT, { q: 'nothing-like-this' }); eq(W3.cvLeads(W3.cvBase()).length, 0);
  const W5 = world(CAT.concat([P('A20', 'x20', 'Zeta', '', 5)]), { q: 'a2' }); eq(W5.cvLeads(W5.cvBase())[0]._openCode, 'A2', 'exact part number first');
  const W6 = world(CAT.concat([P('AA2', 'aaa', 'Aardvark', '', 5)]), { q: 'a2' }); eq(W6.cvLeads(W6.cvBase())[0].code === 'A1' || W6.cvLeads(W6.cvBase())[0]._openCode === 'A2', true, 'exact before a longer code that sorts first');
  const W4 = world(CAT, { q: 'acme' }); eq(W4.cvLeads(W4.cvBase()).length, 5, 'the manufacturer name finds the line');
});
t('category counts are cards; subcategory and uncategorised filters', () => {
  const W = world(CAT, {}); const tree = W.cvTree(W.cvBase());
  eq(tree.map(x => [x.c, x.n]), [['Accessories', 1], ['Other', 1], ['Ramps', 2], ['Stairs', 1]]);
  eq(tree.find(x => x.c === 'Ramps').subs.map(s => [s.sc, s.n]), [['Assist', 1], ['Threshold', 1]]);
  ok(W.cvInCat(CAT[3], 'sub:Threshold') && !W.cvInCat(CAT[0], 'sub:Threshold'), 'sub filter');
  ok(W.cvInCat(CAT[8], 'Other') && !W.cvInCat(CAT[7], 'Other'), 'Other = no category');
});
t('sorting: price low→high / high→low on the dealer price, name A–Z / Z–A; unpriced last', () => {
  const c = s => { const W = world(CAT, { sort: s }); return W.cvLeads(W.cvBase()).map(L => L.code); };
  eq(c('price'), ['CK', 'T1', 'A1', 'S1', 'Q1']); eq(c('price_desc'), ['S1', 'A1', 'T1', 'CK', 'Q1']);
  eq(c('name'), ['A1', 'CK', 'Q1', 'S1', 'T1']); eq(c('name_desc'), ['T1', 'S1', 'Q1', 'CK', 'A1']);
});
t('price range filters SKUs on the dealer price; unpriced items drop out of a price filter', () => {
  const W = world(CAT, { pmin: '90', pmax: '320' }); eq(W.cvBase().map(p => p.code), ['A1', 'A2', 'T1', 'T2']);
  const W2 = world(CAT, { pmin: '650' }); eq(W2.cvBase().map(p => p.code), ['S1']);
});
t('brand filter', () => { const W = world(CAT, { brand: 'Other brand' }); eq(W.cvBase().map(p => p.code), ['Q1']); });

const card = grabDecl(html, 'function cardHtml');
const rend = grabDecl(html, 'function renderProducts');
t('card markup: families choose options, single SKUs add to cart, prices only from the pricing functions', () => {
  ok(/class="chooseBtn" type="button" data-open=/.test(card), 'Choose options button');
  ok(/class="addbtn" data-code=/.test(card) && /class="qtyin"/.test(card), 'qty + Add to cart');
  ok(/priceHtml\(p\)/.test(card) && /money\(p\._priceMin\)/.test(card), 'priced by priceHtml / groupLeads');
  ok(!/base_price/.test(card), 'card never prints base_price itself');
  ok(/loading="lazy"/.test(card) && /width="400" height="400"/.test(card), 'lazy image with reserved size');
  ok(/onerror=/.test(card) && /No image/.test(card), 'no broken image');
});
t('no description scrollbox; three-across desktop grid; drawer below 1200px', () => {
  const css = html.slice(html.indexOf('<style id="catalog-v2">'), html.indexOf('</style>', html.indexOf('<style id="catalog-v2">')));
  ok(/\.cv2-card \.pdesc\{[^}]*overflow:hidden[^}]*-webkit-line-clamp:3/.test(css), 'clamped description');
  ok(/\.cv2-grid\{display:grid;grid-template-columns:repeat\(3,/.test(css), 'three across');
  ok(/@media \(max-width:1199px\)[\s\S]*\.cv2-side\{position:fixed/.test(css), 'drawer');
});
t('renderProducts keeps the fail-closed pricing message and never builds prices itself', () => {
  ok(/_cs\.source==='unavailable'/.test(rend) && /Pricing could not be loaded/.test(rend), 'unavailable message');
  ok(!/base_price/.test(rend), 'no price field read in the layout');
});
console.log(`catalog v2: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
