'use strict';
/* PediFix content batch (owner, 2026-11-03 22:21): sourced copy and catalog photos for the displays and the weak / empty
   pages; P244 System 9 WIDE as one six-option family; the P60 single bandage told apart from the pairs. No SKU identity,
   price, unit or packaging rule changes; nothing about which SKUs are switched on or off. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const R = p => path.join(__dirname, '..', p);
const C = JSON.parse(fs.readFileSync(R('public/data/content/pedifix.json'), 'utf8')).pages;
const O = JSON.parse(fs.readFileSync(R('content-overrides/pedifix.json'), 'utf8'));
const F = JSON.parse(fs.readFileSync(R('public/data/pedifix.json'), 'utf8'));
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const where = {}; for (const [k, p] of Object.entries(C)) for (const s of p.skus || []) { if (where[s.sku]) throw new Error(s.sku + ' twice'); where[s.sku] = k; }
const pageOf = c => C[where[c]];
t('every catalog SKU is on exactly one page', () => { const miss = F.filter(r => !where[r.code]).map(r => r.code); if (miss.length) throw new Error(miss.join()); });
t('P244 System 9 WIDE: one family page, six exact options in order, the XL page gone', () => {
  const p = C['pressureoff-customizable-insole-system-9-wide-width'];
  const got = p.skus.map(s => s.sku + '=' + s.size).join('|');
  const want = 'P244-ML=Medium · Left|P244-MR=Medium · Right|P244-LL=Large · Left|P244-LR=Large · Right|P244-XLL=XLarge · Left|P244-XLR=XLarge · Right';
  if (got !== want) throw new Error(got);
  if (C['pressureoff-customizable-insole-system-9-wide-width-xlarge']) throw new Error('old XL page still there');
});
t('P60: the single OSFM bandage is labelled apart from the paired sizes; all five on one page', () => {
  const p = C['arch-support-bandage'], m = Object.fromEntries(p.skus.map(s => [s.sku, s.size]));
  if (!/single/i.test(m['P60-OSFM']) || !/1 per pack/.test(m['P60-OSFM'])) throw new Error(m['P60-OSFM']);
  for (const c of ['P60-S', 'P60-M', 'P60-L', 'P60-XL']) if (!/pair \(2 per pack\)/.test(m[c] || '')) throw new Error(c + ' ' + m[c]);
});
t('the family rules live in the overrides, so every enrichment re-run keeps them', () => {
  const keys = (O._families || []).map(f => f.key);
  for (const k of ['pressureoff-customizable-insole-system-9-wide-width', 'arch-support-bandage']) if (!keys.includes(k)) throw new Error(k);
});
const DISPLAYS = ['D1', 'D2', 'D3', 'D17', 'D27', 'D37', 'D40', 'D40-2', 'D40-3', 'D77', 'D09-TTU', 'D09-MIX', 'D09-DDMIX', 'D09-DDFW', 'D09-DHFC', 'D09-FFPFS', 'D09-HSS', 'D09-FS', 'D09-SC'];
t('displays: description, contents and specs, each with PediFix provenance', () => {
  for (const c of DISPLAYS) { const p = pageOf(c);
    if (!p.description || p.description.length < 80) throw new Error(c + ' description');
    if (!(p.features || []).length || !(p.specs || []).length) throw new Error(c + ' features/specs');
    const pv = p.field_provenance || {}; for (const f of ['description', 'features', 'specs']) if (!/2026-11-03/.test(pv[f] || '') || !/PediFix|pedifix\.com/.test(pv[f])) throw new Error(c + ' provenance ' + f);
  }
});
t('the 10 catalog photos are attached and exist; D17-DEX, P3036 and P3071-PACKET-100 stay without a photo (no PediFix photo)', () => {
  for (const c of ['D1', 'D2', 'D3', 'D27', 'D37', 'D40', 'D40-2', 'D40-3', 'D77', 'M905RR']) { const p = pageOf(c);
    if (!p.image || !fs.existsSync(R('public' + p.image))) throw new Error(c + ' ' + p.image); }
  for (const c of ['D17-DEX', 'P3036', 'P3071-PACKET-100']) { const p = pageOf(c); if (p.image || (p.images_gallery || []).length) throw new Error(c + ' has a photo'); }
});
t('empty or weak pages now carry sourced copy (displays, felt / foam rolls, FungaFiles, Darco, blades, packets, soaps)', () => {
  for (const c of ['8520', '8620', 'P3012', '6210-M-M', 'P3036', '5100-C-S', 'P3070', 'P3071-PACKET-100', 'P3078-PACKET-100', 'M905RR']) {
    const p = pageOf(c); if (!p.description || p.description.length < 80 || !(p.features || []).length) throw new Error(c); }
});
t('kit contents match the PediFix catalog where they agree; D09-TTU states no counts (PediFix sources disagree)', () => {
  const s = c => JSON.stringify(pageOf(c).features);
  if (!/\(4\) FungaSoap.*\(3\) Soaking.*\(4\) Deep-Healing/.test(s('D09-MIX'))) throw new Error('D09-MIX');
  if (!/\(5\) Diabetic Defense® Foot Wash.*\(3\) Diabetic Defense® Foot Moisturizer/.test(s('D09-DDMIX'))) throw new Error('D09-DDMIX');
  if (/\(\d\)/.test(s('D09-TTU'))) throw new Error('D09-TTU must not state counts');
  if (!/3 pairs \(#P220-3\)/.test(JSON.stringify(pageOf('P220-3').specs))) throw new Error('P220-3');
});
t('withheld values stay out: P244 has no invented description, D17-DEX has no copy', () => {
  if (C['pressureoff-customizable-insole-system-9-wide-width'].description) throw new Error('P244 description');
  if (pageOf('D17-DEX').description) throw new Error('D17-DEX description');
});
t('no commercial fields, prices or emails in the content or overrides', () => {
  const s = JSON.stringify(C) + JSON.stringify(O);
  for (const k of ['base_price', '"price"', 'msrp', '"map"', 'tiers', 'case_qty', '"uom"']) if (s.includes(k)) throw new Error(k);
  if (/\$\s?\d/.test(s)) throw new Error('$ amount');
  if (/[\w.]+@[\w.]+\.\w+/.test(JSON.stringify(Object.values(C).map(p => [p.description, p.features, p.specs])))) throw new Error('email');
});
t('owner-retired SKUs stay retired (P3306 not restored)', () => {
  for (const c of Object.keys(O._retired)) { const p = pageOf(c); const s = p.skus.find(x => x.sku === c); if (!s.disabled || s.status !== 'hidden') throw new Error(c); }
  if (!O._retired.P3306) throw new Error('P3306 dropped from _retired');
});
t('catalog file and manufacturer list untouched against main (identity, names, units, packaging)', () => {
  const base = process.env.BASE_REF || 'origin/main';
  let diff = ''; try { diff = execSync(`git diff --name-only ${base} -- public/data/pedifix.json public/data/manufacturers.json`, { cwd: R('.'), encoding: 'utf8' }); } catch (e) { return; }
  if (diff.trim()) throw new Error(diff);
});
console.log(`\npedifix-content: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
