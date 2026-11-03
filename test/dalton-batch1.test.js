/* Dalton Medical incremental update, Batch 1 (owner 2026-11-02): TB-5006-2's disputed weight capacity is removed from
   everything a dealer sees; COM-DA650PB and TB-5006KDHD-2 keep their identity and get no borrowed photo or feature; no
   other Dalton page and no catalog row changes. Compares against git (BASE_REF, default origin/main). */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.BASE_REF || 'origin/main';  // catalog file must still equal main
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
t('TB-5006-2: model, source, photos and the other verified facts stay (re-read from Dalton 2026-11-03)', () => {
  const p = C[TB], p0 = C0[TB];
  eq(p.skus.map(s => s.sku), ['TB-5006-2']); eq(p.source_url, p0.source_url); ok(p.images_gallery.length >= 1, 'photos');
  eq([p.category, p.status], [p0.category, p0.status]);
  ok(/18\.5.*22\.5/.test((p.specs.find(s => /seat-height/i.test(s.label)) || {}).value || ''), 'seat-height range kept');
  ok(/300 lb.*250 lb/.test(p.field_provenance.name), 'the reason is recorded');
});
t('the correction lives in content-overrides (a re-run of the enrichment keeps it)', () => {
  const o = O[TB]; ok(o, 'override present');
  for (const k of ['name', 'skus', 'features', 'specs', 'field_provenance']) eq(o[k], C[TB][k], k);
});
/* Superseded 2026-11-03: the owner retired COM-DA650PB and TB-5006KDHD-2 in the Dalton review; they stay retired
   (hidden, not orderable) and never borrow another model's photo or words. */
t('COM-DA650PB and TB-5006KDHD-2: retired by the owner, nothing borrowed from COM-650HD-2 / TB-5006-2', () => {
  for (const code of ['COM-DA650PB', 'TB-5006KDHD-2']) {
    const k = pageOf(code); ok(k, code + ' page');
    const s = C[k].skus.find(x => x.sku === code); eq([s.status, s.disabled], ['hidden', true], code + ' retired');
    ok(O._retired && O._retired[code], code + ' retirement recorded');
    eq(F.find(r => r.code === code).image, '', code + ' no borrowed catalog photo');
    ok(!/COM-650HD-2|TB-5006-2\b|f1e8417052fbee43640f/.test(JSON.stringify(C[k])), code + ' borrows from another model');
  }
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
