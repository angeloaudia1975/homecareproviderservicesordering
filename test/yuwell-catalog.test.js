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
t('nothing unsourced: every page names its sources; only the SPIRIT-3 states a warranty; the continuous-flow claim is never used', () => {
  for (const p of Object.values(CON.pages)) {
    if (!p.field_provenance || !p.field_provenance.description || !p.field_provenance.specs || !p.field_provenance.images) throw new Error('no provenance on ' + p.page_key);
    if (p.warranty && p.skus[0].sku !== 'SP-3') throw new Error('warranty without a source on ' + p.page_key);
  }
  const sp = Object.values(CON.pages).find(p => p.skus[0].sku === 'SP-3');
  if (!/3-year warranty on the compressor; 2-year warranty on the sieve beds/.test(sp.warranty || '')) throw new Error('SP-3 warranty');
  if (/equivalent continuous|3\.75\s*L/i.test(JSON.stringify(sp.description) + JSON.stringify(sp.features) + JSON.stringify(sp.specs))) throw new Error('continuous-flow equivalence claim published');
  if (!/not equivalent to continuous-flow/i.test(sp.description)) throw new Error('prescription / pulse-dose notice missing');
});
t('every product has its own official photo on disk (primary + gallery), and no broken image', () => {
  for (const r of CAT) {
    if (r.image !== '/assets/products/yuwell/' + r.code + '.jpg') throw new Error('primary path ' + r.code);
    if (!fs.existsSync(path.join(ROOT, 'public', r.image))) throw new Error('missing ' + r.image);
  }
  for (const p of Object.values(CON.pages)) {
    if (!p.images_gallery.length || !p.images_gallery[0].primary) throw new Error('gallery ' + p.page_key);
    for (const g of p.images_gallery) { if (!fs.existsSync(path.join(ROOT, 'public', g.url))) throw new Error('missing ' + g.url); if (!/Yuwell official product image/.test(g.source)) throw new Error('no source ' + g.url); }
  }
  const m = MF.find(x => x.slug === 'yuwell'); if (!m) throw new Error('not listed');
  if (!fs.existsSync(path.join(ROOT, 'public', m.logo))) throw new Error('logo missing: ' + m.logo);
});
t('freight follows the owner: an order with an SP-3 ships free, otherwise actual shipping; no fee or amount anywhere', () => {
  const f = MF.find(x => x.slug === 'yuwell').freight;
  if (f.mode !== 'qty_threshold' || JSON.stringify(f.qualifyingCodes) !== '["SP-3"]' || f.freeAtQty !== 1) throw new Error(JSON.stringify(f));
  for (const k of ['flatFee', 'freeAt', 'fee', 'threshold', 'groups']) if (k in f) throw new Error('freight figure ' + k);
});
t('yuwell is a live identifier, never one of the retired lines', () => {
  const R = require(path.join(ROOT, 'netlify', 'functions', '_retired_lines.js')); if (R.isRetiredLine('yuwell')) throw new Error('retired');
});
console.log(`\nyuwell catalog: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
