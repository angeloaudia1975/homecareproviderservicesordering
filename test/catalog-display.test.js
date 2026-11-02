/* Shared catalog presentation (owner 2026-11-02, BongoRx release corrections), run VERBATIM from the shop page:
   1. a line's stated card order (manufacturers.json card_order, presentation only) orders its cards and its
      subcategory list; every other line keeps alphabetical subcategories; an exact part-number search still wins;
   2. "Related products" never lists another size/option of the SAME family (cards and related use one family key);
   3. the primary ordering controls are at least 44px tall at every width, tablets included.
   HTML can be swapped with CATALOG_DISPLAY_HTML (used by catalog-display.mutants.js). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { grabDecl } = require('./extract-picker.js');
const ROOT = path.join(__dirname, '..');
const html = process.env.CATALOG_DISPLAY_HTML ? fs.readFileSync(process.env.CATALOG_DISPLAY_HTML, 'utf8') : fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const MF = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'manufacturers.json'), 'utf8'));
const CONTENT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'content', 'airavant-bongorx.json'), 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + (e && e.message)); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };

const names = ['function groupKeyOf', 'function catOrder', 'function catRank', 'function compareCats', 'function groupDisplayName', 'function groupLeads',
  'const cvNorm', 'function cvLine', 'function cvQuery', 'function cvCat', 'function cvBrand', 'function cvBase', 'function cvInCat', 'function cvFamilies',
  'function cvTree', 'function cvCardOrder', 'function cvSubOrder', 'function cvLeads'];
const src = names.map(n => grabDecl(html, n)).join('\n');
const mfrBy = s => MF.find(m => m.slug === s) || { slug: s };
function world(products, f) {
  const inputs = { '#search': { value: f.q || '' }, '#catFilter': { value: '' }, '#brandFilter': { value: '' } };
  const ctx = { state: { products, manufacturers: MF, active: f.active }, CUI: { pmin: '', pmax: '', sort: f.sort || 'relevance' }, $: s => inputs[s] || null,
    unitPrice: p => Number(p.base_price) || 0, mfrInfo: mfrBy, console };
  vm.createContext(ctx); vm.runInContext(src + '\nthis.api={cvBase,cvTree,cvLeads,groupKeyOf};', ctx);
  return ctx.api;
}

/* BongoRx: the real page keys, part numbers and subcategories; synthetic prices only. */
const pages = CONTENT.pages;
const pageOf = code => Object.keys(pages).find(k => (pages[k].skus || []).some(s => (s.sku || s.code) === code));
const BCODES = ['BNG500', 'BNG501', 'BNG502', 'BNG503', 'BNG504', 'BNG505', 'BNG511', 'BNG512', 'BNG513', 'BNG514', 'BNG515', 'BNG530'];
const BONGO = BCODES.map((c, i) => ({ code: c, name: c, manufacturer: 'airavant-bongorx', _pageKey: pageOf(c), category: 'Bongo Rx EPAP Therapy',
  subcategory: pages[pageOf(c)].subcategory, base_price: 10 + i, _gname: pages[pageOf(c)].name }));
const ORDER = ['bongo-rx-four-size-starter-kit', 'bongo-rx-annual-replenishment-pack', 'bongo-rx-single-replenishment-unit', 'bongo-rx-replacement-headgear'];

t('BongoRx card_order names exactly its four published pages, Starter Kit first (presentation only)', () => {
  const m = mfrBy('airavant-bongorx'); eq(m.card_order, ORDER);
  eq(ORDER.every(k => pages[k] && pages[k].status === 'published'), true, 'every listed page exists and is published');
  eq(BONGO.every(p => p._pageKey), true, 'every SKU is on a page');
});
t('no other manufacturer states a card order (frozen lines and everyone else unchanged)', () => {
  eq(MF.filter(m => m.card_order).map(m => m.slug), ['airavant-bongorx']);
});
t('default sort: Starter Kit → Annual Replenishment Pack → Single Replenishment Unit → Replacement Headgear', () => {
  const W = world(BONGO.slice().reverse(), { active: 'airavant-bongorx' });
  eq(W.cvLeads(W.cvBase()).map(L => W.groupKeyOf(L)), ORDER);
});
t('subcategory list follows the same order', () => {
  const W = world(BONGO, { active: 'airavant-bongorx' });
  eq(W.cvTree(W.cvBase())[0].subs.map(s => s.sc), ORDER.map(k => pages[k].subcategory));
});
t('a page the card order does not list sorts after the listed ones (cards and subcategories)', () => {
  const extra = { code: 'X1', name: 'X1', manufacturer: 'airavant-bongorx', _pageKey: 'not-listed', category: 'Bongo Rx EPAP Therapy', subcategory: 'AAA Unlisted', base_price: 1 };
  const W = world(BONGO.concat([extra]), { active: 'airavant-bongorx' });
  eq(W.cvTree(W.cvBase())[0].subs.map(s => s.sc), ORDER.map(k => pages[k].subcategory).concat(['AAA Unlisted']));
  eq(W.groupKeyOf(W.cvLeads(W.cvBase()).slice(-1)[0]), 'not-listed');
});
t('an exact part-number search still puts that card first, on that SKU', () => {
  const W = world(BONGO, { active: 'airavant-bongorx', q: 'BNG530' }); const L = W.cvLeads(W.cvBase());
  eq([W.groupKeyOf(L[0]), L[0]._openCode], ['bongo-rx-replacement-headgear', 'BNG530']);
  /* another card that also matches the words (the kit mentions BNG515) sorts first by card order; the exact SKU still wins */
  const B3 = BONGO.map(p => p.code === 'BNG500' ? Object.assign({}, p, { description: 'Refills: BNG515' }) : p);
  const W3 = world(B3, { active: 'airavant-bongorx', q: 'BNG515' }); const L3 = W3.cvLeads(W3.cvBase());
  eq(L3.map(L => W3.groupKeyOf(L)), ['bongo-rx-single-replenishment-unit', 'bongo-rx-four-size-starter-kit']);
  const W2 = world(BONGO, { active: 'airavant-bongorx', q: 'bng503' }); const L2 = W2.cvLeads(W2.cvBase());
  eq([W2.groupKeyOf(L2[0]), L2[0]._openCode], ['bongo-rx-annual-replenishment-pack', 'BNG503']);
});
t('name and price sorts ignore the card order', () => {
  const W = world(BONGO, { active: 'airavant-bongorx', sort: 'name' });
  eq(W.cvLeads(W.cvBase()).map(L => L._gname), ['Bongo Rx Annual Replenishment Pack', 'Bongo Rx Four-Size Starter Kit', 'Bongo Rx Replacement Headgear', 'Bongo Rx Single Replenishment Unit']);
});
t('lines sharing a category: ordered cards first, then the rest as before; the sort is consistent (no cycle)', () => {
  const mix = [{ code: 'A', name: 'A', manufacturer: 'airavant-bongorx', _pageKey: ORDER[0], category: 'Shared', subcategory: 'Z', base_price: 1 },
    { code: 'C', name: 'C', manufacturer: 'airavant-bongorx', _pageKey: ORDER[3], category: 'Shared', subcategory: 'A', base_price: 1 },
    { code: 'B', name: 'B', manufacturer: 'bemis', _pageKey: 'b', category: 'Shared', subcategory: 'M', base_price: 1 },
    { code: 'D', name: 'D', manufacturer: 'bemis', _pageKey: 'd', category: 'Shared', subcategory: 'B', base_price: 1 }];
  const perms = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]];
  const outs = perms.map(pm => { const W = world(pm.map(i => mix[i]), {}); return W.cvLeads(W.cvBase()).map(L => L.code).join(''); });
  eq([...new Set(outs)], ['ACDB']);
});
t('a line without a card order keeps alphabetical subcategories', () => {
  const X = [['Z1', 'zp', 'Zeta'], ['A1', 'ap', 'Alpha'], ['M1', 'mp', 'Mid']].map(([c, k, sc]) => ({ code: c, name: c, manufacturer: 'bemis', _pageKey: k, category: 'Bath', subcategory: sc, base_price: 1 }));
  const W = world(X, { active: 'bemis' });
  eq(W.cvLeads(W.cvBase()).map(L => L.subcategory), ['Alpha', 'Mid', 'Zeta']);
  eq(W.cvTree(W.cvBase())[0].subs.map(s => s.sc), ['Alpha', 'Mid', 'Zeta']);
});

/* Related products: the block of the product page that picks them, run verbatim. */
const RA = '    const relSeen=new Set([gk]);', RB = '      .map(x=>Object.assign({},x,{_relName:groupDisplayName(x)}));';
const relSrc = (() => { const i = html.indexOf(RA), j = html.indexOf(RB, i); if (i < 0 || j < 0) throw new Error('related block not found'); return html.slice(i, j); })();
function related(products, p) {
  const ctx = { state: { products }, p, gk: null, console }; vm.createContext(ctx);
  vm.runInContext(grabDecl(html, 'function groupKeyOf') + '\ngk=groupKeyOf(p);\n' + relSrc + ';\nthis.out=related.map(x=>x.code);', ctx);
  return ctx.out;
}
t('related products on a configurable family never list its own other sizes (BongoRx pack)', () => {
  const p = BONGO.find(x => x.code === 'BNG503'); const r = related(BONGO, p);
  eq(r.filter(c => /^BNG50[1-5]$/.test(c)), [], 'no pack size listed as related');
  eq(r.length, 3, 'one card per OTHER family'); eq(new Set(r.map(c => pageOf(c))).size, 3, 'each other family once');
});
t('related products: two options of one page with no catalog group are one family (Bemis Round + Elongated pattern)', () => {
  const X = [{ code: 'R', _pageKey: 'seat', category: 'Bath', subcategory: 'Seats' }, { code: 'E', _pageKey: 'seat', category: 'Bath', subcategory: 'Seats' },
    { code: 'O', _pageKey: 'other', category: 'Bath', subcategory: 'Seats' }];
  eq(related(X, X[0]), ['O']);
});
t('related products: grouped SKUs on a page (Ovation pattern) are one family; a different page is still offered', () => {
  const X = [{ code: 'S', _pageKey: 'brace', group: 'Brace grp', category: 'Knee', subcategory: 'Braces' }, { code: 'M', _pageKey: 'brace', group: 'Brace grp', category: 'Knee', subcategory: 'Braces' },
    { code: 'W', _pageKey: 'wrap', group: 'Wrap grp', category: 'Knee', subcategory: 'Braces' }, { code: 'W2', _pageKey: 'wrap', group: 'Wrap grp', category: 'Knee', subcategory: 'Braces' },
    { code: 'Z', group: 'Loose grp', category: 'Knee', subcategory: 'Other' }, { code: 'Z2', group: 'Loose grp', category: 'Knee', subcategory: 'Other' }];
  eq(related(X, X[1]), ['W', 'Z']);
});
t('related products stay in the category, same subcategory first, at most four', () => {
  const X = [{ code: 'A', _pageKey: 'a', category: 'C', subcategory: 's1' }, { code: 'B', _pageKey: 'b', category: 'C', subcategory: 's2' },
    { code: 'C', _pageKey: 'c', category: 'C', subcategory: 's1' }, { code: 'D', _pageKey: 'd', category: 'Other', subcategory: 's1' },
    { code: 'E', _pageKey: 'e', category: 'C', subcategory: 's2' }, { code: 'F', _pageKey: 'f', category: 'C', subcategory: 's2' }, { code: 'G', _pageKey: 'g', category: 'C', subcategory: 's2' }];
  eq(related(X, X[0]), ['C', 'B', 'E', 'F']);
});

/* Touch targets (RULE 10). */
const css = html.slice(0, html.indexOf('\n<body'));
t('Choose options, Add to cart and the quantity box are at least 44px tall at every width', () => {
  ok(/\.cv2-act \.chooseBtn\{[^}]*min-height:44px/.test(css), 'chooseBtn');
  ok(/\n\.cv2-act \.buy \.addbtn,\.cv2-act \.buy \.qtyin\{min-height:44px;\}/.test(css), 'addbtn + qtyin outside any media query');
  ok(/\.cv2-pager button\{min-width:44px;min-height:44px;/.test(css), 'pager');
});
t('tablet and phone layouts: filter chips, sort select, ghost buttons and view toggles are at least 44px', () => {
  const i = css.indexOf('@media (max-width:1199px){'), j = css.indexOf('@media (max-width:767px){', i); const tab = css.slice(i, j);
  ok(/\.cv2-chip,\.cv2-sort select,\.cv2-ghost,\.cv2-active button\{min-height:44px;\}/.test(tab), 'chips / select / ghost / clear-filter');
  ok(/\.cv2-view button,\.cv2-chipnext\{width:44px;height:44px;\}/.test(tab), 'view toggles + chip arrow');
});

console.log(`\ncatalog display: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
