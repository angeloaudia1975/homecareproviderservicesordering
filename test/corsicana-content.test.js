'use strict';
/* Corsicana content batch (owner, 2026-11-03): every page carries sourced copy; disputed values stay out of dealer-facing
   copy; catalog identity, prices and units untouched; no commercial fields in content. */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const R = p => path.join(__dirname, '..', p);
const C = JSON.parse(fs.readFileSync(R('public/data/content/corsicana.json'), 'utf8')).pages;
const O = JSON.parse(fs.readFileSync(R('content-overrides/corsicana.json'), 'utf8'));
const F = JSON.parse(fs.readFileSync(R('public/data/corsicana.json'), 'utf8'));
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const pages = Object.entries(C), text = p => JSON.stringify([p.name, p.description, p.features, p.specs, p.warranty, p.sizing_note, (p.skus || []).map(s => [s.name, s.size])]);
t('14 pages, one per catalog SKU, all published and active', () => {
  if (pages.length !== 14 || F.length !== 14) throw new Error(pages.length + '/' + F.length);
  const skus = pages.flatMap(([, p]) => p.skus.map(s => s.sku)).sort().join(); const cat = F.map(r => r.code).sort().join();
  if (skus !== cat) throw new Error('sku set differs'); if (pages.some(([, p]) => p.status !== 'published' || p.skus.some(s => s.disabled))) throw new Error('not all live');
});
t('every page: description ≥ 80 chars, features, specs with a Model/Retail model row, provenance for description/features/specs', () => {
  for (const [k, p] of pages) {
    if (!p.description || p.description.length < 80) throw new Error(k + ' description');
    if (!/protector-ice/.test(k) && !(p.features || []).length) throw new Error(k + ' features');
    if (!(p.specs || []).some(s => /model/i.test(s.label))) throw new Error(k + ' model row');
    const pv = p.field_provenance || {}; for (const f of ['description', 'features', 'specs']) if (!/2026-11-03/.test(pv[f] || '')) throw new Error(k + ' provenance ' + f);
  }
});
t('disputed values stay out of dealer-facing copy (C-1 capacity, C-3 pillow count, C-4 firmness, C-5 memory foam on 6ESSENTIALS)', () => {
  for (const [k, p] of pages) {
    const s = text(p);
    if (/1,?500\s*lb|750\s*lb|weight (limit|capacity)|support up to/i.test(s)) throw new Error(k + ' capacity');
    if (/\b(2|two|1|one|\(1\))\s+pillows?\b/i.test(s)) throw new Error(k + ' pillow count');
    if (/essentials-(8|10)/.test(k) && /\b(medium|firm)\b/i.test(JSON.stringify([p.description, p.features, p.specs]))) throw new Error(k + ' firmness');
    if (/6-in-essentials/.test(k) && /memory foam/i.test(s)) throw new Error(k + ' memory foam');
  }
});
t('no commercial fields, prices or emails in the content or overrides', () => {
  const s = JSON.stringify(C) + JSON.stringify(O);
  for (const k of ['base_price', '"price"', 'msrp', '"map"', 'tiers', 'case_qty', '"uom"']) if (s.includes(k)) throw new Error(k);
  if (/\$\s?\d/.test(s)) throw new Error('$ amount'); if (/[\w.]+@[\w.]+\.\w+/.test(JSON.stringify(Object.values(C).map(p => [p.description, p.features, p.specs])))) throw new Error('email');
});
t('documents point only at the HCPS-hosted official spec cards', () => {
  for (const [k, p] of pages) for (const d of p.documents || []) if (!/^https:\/\/www\.homecareproviderservices\.org\/assets\/docs\/corsicana-healthcare-catalog\.pdf$/.test(d.url)) throw new Error(k + ' ' + d.url);
});
t('source links are corsicanamattress.com only', () => {
  for (const [k, p] of pages) if (p.source_url && !/^https:\/\/corsicanamattress\.com\//.test(p.source_url)) throw new Error(k + ' ' + p.source_url);
});
t('every referenced image exists locally', () => {
  for (const [k, p] of pages) for (const u of [p.image, ...(p.images_gallery || []).map(g => typeof g === 'string' ? g : g && (g.url || g.src)), ...p.skus.map(s => s.image)].filter(Boolean))
    if (!/^\/assets\//.test(u) || !fs.existsSync(R('public' + u))) throw new Error(k + ' ' + u);
});
t('catalog file untouched against main (identity, names, units)', () => {
  const base = process.env.BASE_REF || 'origin/main';
  let diff = ''; try { diff = execSync(`git diff --name-only ${base} -- public/data/corsicana.json`, { cwd: R('.'), encoding: 'utf8' }); } catch (e) { return; }
  /* manufacturers.json may change for other lines (e.g. a retirement); this line's own entry may not. */
  let mainMf = null; try { mainMf = JSON.parse(execSync(`git show ${base}:public/data/manufacturers.json`, { cwd: R('.'), encoding: 'utf8' })); } catch (e) { return; }
  const own = l => JSON.stringify((l || []).find(m => m.slug === 'corsicana'));
  if (own(mainMf) !== own(JSON.parse(fs.readFileSync(R('public/data/manufacturers.json'), 'utf8')))) throw new Error('the corsicana entry in manufacturers.json changed');
  if (diff.trim()) throw new Error(diff);
});
t('mattress protector: sold as one case of 10 (unit "Case", case_qty 10) — C-6 resolved, price per case unchanged', () => {
  const r = F.find(x => x.code === 'SB10MATPRON1-TL'); if (!r || r.uom !== 'Case' || r.case_qty !== 10) throw new Error(JSON.stringify(r && { uom: r.uom, case_qty: r.case_qty }));
  for (const k of ['base_price', 'tiers', 'msrp', 'map']) if (k in r) throw new Error('public file carries ' + k);
});
console.log(`\ncorsicana-content: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
