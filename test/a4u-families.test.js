/* Access4U parent families in the private preview (owner, 2026-10-31; tracker #42): every approved Access4U SKU is on
   exactly one product page, each family page offers one choice per axis and every combination is exactly one SKU, the
   pages a dealer sees match the owner's family list, and each family card has a photo file that exists (or none). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/access4u.json'), 'utf8'));
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/content/access4u.json'), 'utf8')).pages;
const ov = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-overrides/access4u.json'), 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const N = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
t('every catalog SKU (125) is on exactly one page; no page lists a SKU the catalog does not have', () => {
  const seen = {};
  for (const [k, p] of Object.entries(pages)) for (const s of p.skus) { ok(!seen[N(s.sku)], s.sku + ' twice'); seen[N(s.sku)] = k; }
  ok(cat.length === 125, 'catalog ' + cat.length);
  for (const r of cat) ok(seen[N(r.code)], r.code + ' on no page');
  ok(Object.keys(seen).length === cat.length, 'extra SKUs on pages');
});
t('14 product-family cards (owner, 2026-10-31): accessories are one family', () => {
  const want = ['assist-ramp-with-handrails', 'assist-ramp-no-rail', 'ground-platforms', 'platforms', 'modular-ramp-accessories', 'portable-folding-ramps',
    'modular-ramp-sections', 'starter-ramps', 'rest-ramp-section', 'stairs', 'adjustable-threshold-ramps', 'supported-threshold-ramps',
    'basic-threshold-ramps', 'composite-rubber-threshold-ramps'];
  for (const k of want) ok(pages[k], 'missing family ' + k);
  ok(Object.keys(pages).length === 14, 'pages ' + Object.keys(pages).length);
});
t('within each family every combination of choices is exactly one SKU, and every SKU names all of the family axes', () => {
  for (const r of ov._families) {
    const p = pages[r.key]; const names = (r.axes || []).map(a => a.name);
    const combos = new Set();
    for (const s of p.skus) {
      for (const a of names) ok(s.axes && s.axes[a], r.key + ' ' + s.sku + ' has no ' + a);
      const c = JSON.stringify(s.axes || {}); ok(!combos.has(c), r.key + ' duplicate choice ' + c); combos.add(c);
    }
  }
});
t('families hold exactly the SKUs of their price-list family (nothing borrowed from another family)', () => {
  const fam = { 'assist-ramp-with-handrails': /^AST\d/, 'assist-ramp-no-rail': /^ASTNR/, 'stairs': /^STP/, 'basic-threshold-ramps': /^TR\d/,
    'adjustable-threshold-ramps': /^ATR/, 'supported-threshold-ramps': /^STR/, 'composite-rubber-threshold-ramps': /^TRR/, 'modular-ramp-sections': /^RS\d/,
    'platforms': /^PS\d/, 'ground-platforms': /^GP/, 'portable-folding-ramps': /^PFR/, 'starter-ramps': /^SR\d/, 'modular-ramp-accessories': /^(PRK\d+|DLOOP|GATE36|VPLK|CK)$/, 'rest-ramp-section': /^RRS/ };
  for (const [k, re] of Object.entries(fam)) { const p = pages[k]; for (const s of p.skus) ok(re.test(s.sku), k + ' holds ' + s.sku);
    ok(p.skus.length === cat.filter(r => re.test(r.code)).length, k + ' count'); }
});
t('known unavailable combination: a 7 ft modular section exists only 36" wide', () => {
  const p = pages['modular-ramp-sections'];
  ok(p.skus.some(s => s.axes.Length === '7 ft' && s.axes.Width === '36" wide'), '7x36');
  ok(!p.skus.some(s => s.axes.Length === '7 ft' && s.axes.Width === '48" wide'), '7x48 must not exist');
});
t('every photo a page or option names exists in the preview assets; options without an exact photo carry none (CK, VPLK, DLOOP)', () => {
  for (const p of Object.values(pages)) for (const u of [p.image, p.card_image].concat((p.images_gallery || []).map(g => g.url), p.skus.map(s => s.image)).filter(Boolean))
    ok(fs.existsSync(path.join(ROOT, 'public', u)), p.page_key + ' ' + u);
  const acc = pages['modular-ramp-accessories'];
  for (const c of ['CK', 'VPLK', 'DLOOP']) ok(!acc.skus.find(s => s.sku === c).image, c + ' must not carry another product\'s photo');
  ok(acc.skus.find(s => s.sku === 'GATE36').image, 'gate keeps its own photo');
  ok((pages['assist-ramp-no-rail'].images_gallery || []).every(g => /owner-supplied/.test(g.source || '')), 'no-rail gallery = owner photos only');
});
console.log(`access4u families: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
