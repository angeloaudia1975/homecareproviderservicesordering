/* Dalton Medical incremental update, Batch 1 (owner 2026-11-02): TB-5006-2's disputed weight capacity is removed from
   everything a dealer sees; COM-DA650PB and TB-5006KDHD-2 keep their identity and get no borrowed photo or feature; no
   other Dalton page and no catalog row changes. Compares against git (BASE_REF, default origin/main). */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.BASE_REF || 'origin/main';
const git = p => JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${BASE}:${p}`], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };

const C = read('public/data/content/dalton.json').pages, C0 = git('public/data/content/dalton.json').pages;
const O = read('content-overrides/dalton.json');
const F = read('public/data/dalton.json'), F0 = git('public/data/dalton.json');
const TB = 'transfer-bench-300-lbs-weight-capacity-2-case';
const pageOf = code => Object.keys(C).find(k => (C[k].skus || []).some(s => s.sku === code));
const CAP = /\b\d{2,4}\s?(lb|lbs|pound)s?\b|capacity/i;

t('TB-5006-2: no weight capacity in the dealer-facing title, SKU name, features or specs', () => {
  const p = C[TB]; eq(pageOf('TB-5006-2'), TB);
  ok(!CAP.test(p.name), 'title: ' + p.name);
  ok(p.skus.every(s => !CAP.test(s.name)), 'sku name');
  ok(!(p.features || []).some(f => CAP.test(f)), 'features');
  ok(!(p.specs || []).some(s => CAP.test(s.label) || CAP.test(String(s.value))), 'specs');
  ok(!CAP.test(p.description || ''), 'description');
});
t('TB-5006-2: model, source, photos, category and every other verified fact are unchanged', () => {
  const p = C[TB], p0 = C0[TB];
  eq(p.skus.map(s => s.sku), ['TB-5006-2']); eq(p.source_url, p0.source_url); eq(p.images_gallery, p0.images_gallery); eq(p.image, p0.image);
  eq([p.category, p.subcategory, p.status], [p0.category, p0.subcategory, p0.status]);
  eq(p.features, p0.features.filter(f => !CAP.test(f)), 'other features kept in order');
  eq(p.specs, p0.specs.filter(s => s.label !== 'Weight Capacity'), 'other specs kept in order');
  eq(p.specs.find(s => s.label === 'Seat-Height Range').value, '18.5"–22.5"');
  ok(/300 lb.*250 lb/.test(p.field_provenance.name), 'the reason is recorded');
});
t('the correction lives in content-overrides (a re-run of the enrichment keeps it)', () => {
  const o = O[TB]; ok(o, 'override present');
  for (const k of ['name', 'skus', 'features', 'specs', 'field_provenance']) eq(o[k], C[TB][k], k);
});
t('COM-DA650PB and TB-5006KDHD-2 keep their page, name and unit, with no borrowed photo or feature', () => {
  for (const code of ['COM-DA650PB', 'TB-5006KDHD-2']) {
    const k = pageOf(code); ok(k, code + ' page'); eq(C[k], C0[k], code + ' page unchanged');
    const row = F.find(r => r.code === code); eq(row.image, '', code + ' shows the No image placeholder');
    const s = JSON.stringify(C[k]); ok(!/COM-650HD-2|TB-5006-2\b|f1e8417052fbee43640f/.test(s), code + ' borrows from another model');
  }
});
t('no other Dalton page changed', () => {
  eq(Object.keys(C).sort(), Object.keys(C0).sort());
  eq(Object.keys(C).filter(k => k !== TB && JSON.stringify(C[k]) !== JSON.stringify(C0[k])), []);
});
t('the catalog file (prices, identity, unit, case quantity) is byte-for-byte unchanged', () => {
  eq(F, F0);
  const r = c => F.find(x => x.code === c);
  eq([r('TB-5006-2').uom, r('TB-5006-2').case_qty, r('TB-5006KDHD-2').uom, r('TB-5006KDHD-2').case_qty, r('COM-DA650PB').uom], ['Case', 2, 'Case', 2, 'Each']);
});
t('the exceptions list records all three questions', () => {
  const d = fs.readFileSync(path.join(ROOT, 'docs', 'catalog', 'dalton-exceptions.md'), 'utf8');
  for (const c of ['TB-5006-2', 'COM-DA650PB', 'TB-5006KDHD-2']) ok(d.includes('| ' + c + ' |'), c);
  ok(!/\$\s?\d/.test(d), 'no prices in a public file');
});
console.log(`\ndalton batch 1: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
