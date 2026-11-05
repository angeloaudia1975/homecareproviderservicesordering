'use strict';
/* Yuwell catalog foundation (C3-04, owner 2026-11-04). The public files carry identity and content only:
   no price, MSRP, MAP, tier or freight figure of any kind (P0), every SKU has a content page, nothing is
   invented beyond the owner's sources, and the line is never retired-listed. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const CAT = J('public/data/yuwell.json'), CON = J('public/data/content/yuwell.json'), MF = J('public/data/manufacturers.json');
const CODES = ['SP-3', 'YE660E', 'YE620B', 'YE680B', 'YE8800AR', 'YT-1', 'YHT101', 'YX103', 'YX306'];

t('the catalog holds exactly the 9 models on the owner\'s price list, each once, all for yuwell', () => {
  const codes = CAT.map(r => r.code); if (JSON.stringify([...codes].sort()) !== JSON.stringify([...CODES].sort())) throw new Error(codes.join());
  if (new Set(codes).size !== codes.length) throw new Error('duplicate code');
  for (const r of CAT) if (r.manufacturer !== 'yuwell') throw new Error('wrong line on ' + r.code);
});
t('no price of any kind in the public files (P0)', () => {
  const bad = /"(base_price|price|cost|msrp|map|tiers|dealer_price|price_note)"\s*:/;
  for (const r of CAT) for (const k of Object.keys(r)) if (/price|cost|^msrp$|^map$|tiers/.test(k)) throw new Error(r.code + ' has ' + k);
  const s = JSON.stringify(CON); if (bad.test(s)) throw new Error('content carries a price field');
  if (/\$\s?\d/.test(JSON.stringify(CAT) + s)) throw new Error('a dollar figure is in a public file');
});
t('every SKU has exactly one published content page, and no page names a SKU outside the catalog', () => {
  const seen = {};
  for (const p of Object.values(CON.pages)) { if (p.manufacturer !== 'yuwell') throw new Error(p.page_key); for (const s of p.skus) seen[s.sku] = (seen[s.sku] || 0) + 1; }
  for (const c of CODES) if (seen[c] !== 1) throw new Error(c + ' on ' + (seen[c] || 0) + ' pages');
  for (const c of Object.keys(seen)) if (!CODES.includes(c)) throw new Error('unknown SKU ' + c);
});
t('nothing unsourced: warranty blank, SPIRIT-3 weight and size withheld, every page names its sources', () => {
  for (const p of Object.values(CON.pages)) {
    if (p.warranty) throw new Error('warranty on ' + p.page_key);
    if (!p.field_provenance || !p.field_provenance.description || !p.field_provenance.specs) throw new Error('no provenance on ' + p.page_key);
  }
  const sp = Object.values(CON.pages).find(p => p.skus[0].sku === 'SP-3');
  for (const s of sp.specs) if (/weight|size|dimension/i.test(s.label)) throw new Error('withheld spec published: ' + s.label);
});
t('no broken image: an empty image is the placeholder, and the logo file exists', () => {
  for (const r of CAT) if (r.image) throw new Error('image set without a file: ' + r.code);
  const m = MF.find(x => x.slug === 'yuwell'); if (!m) throw new Error('not listed');
  if (!fs.existsSync(path.join(ROOT, 'public', m.logo))) throw new Error('logo missing: ' + m.logo);
});
t('freight is not invented: actual freight confirmed by HCPS, no fee or threshold', () => {
  const f = MF.find(x => x.slug === 'yuwell').freight;
  if (!f.elseActual || (f.groups || []).length) throw new Error(JSON.stringify(f));
  for (const k of ['flatFee', 'freeAt', 'fee', 'threshold']) if (k in f) throw new Error('freight figure ' + k);
});
t('yuwell is a live identifier, never one of the retired lines', () => {
  const R = require(path.join(ROOT, 'netlify', 'functions', '_retired_lines.js')); if (R.isRetiredLine('yuwell')) throw new Error('retired');
});
console.log(`\nyuwell catalog: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
