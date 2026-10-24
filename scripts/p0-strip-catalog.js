#!/usr/bin/env node
/* P0 (2026-10-23, issue #2) — remove every commercial field from the public catalog files.
   node scripts/p0-strip-catalog.js           rewrite public/data/<slug>.json to their public half
   node scripts/p0-strip-catalog.js --check   only report; exit 1 if any public file still holds one
   The commercial half is NOT written anywhere by this script: it is read back from git by
   scripts/p0-seed-catalog-commercial.js and stored in the private table catalog_file_commercial.
   Content files (public/data/content) and manufacturers.json are checked, never rewritten. */
const fs = require('fs'), path = require('path');
const CC = require('../netlify/functions/_catalog_commercial.js');
const { applyScrubs } = require('./p0-scrubs.js');
const DATA = path.join(__dirname, '..', 'public', 'data');
const check = process.argv.includes('--check');
let dirty = 0;
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const file of walk(DATA).filter(f => f.endsWith('.json')).sort()) {
  const rel = path.relative(DATA, file), j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const found = CC.commercialKeysIn(j);
  const catalog = Array.isArray(j) && path.dirname(rel) === '.' && rel !== 'manufacturers.json';
  const pub = catalog ? applyScrubs(path.basename(rel, '.json'), CC.splitCatalogFile(j).public) : j;
  const changed = JSON.stringify(pub) !== JSON.stringify(j);
  if (!changed) { console.log(`clean     ${rel}`); continue; }
  if (check || !catalog) { dirty++; console.log(`COMMERCIAL ${rel}: ${found.length} field(s)${found.length ? ', e.g. ' + found.slice(0, 3).join(', ') : ' (priced text to scrub)'}`); continue; }
  fs.writeFileSync(file, JSON.stringify(pub, null, 2) + '\n');
  console.log(`stripped  ${rel}: ${found.length} commercial field(s) removed from ${j.length} row(s)`);
}
if (dirty) { console.log(`\n${dirty} file(s) still hold commercial fields.`); process.exit(1); }
