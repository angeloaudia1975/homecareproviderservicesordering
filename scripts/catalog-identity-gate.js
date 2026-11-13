#!/usr/bin/env node
/* Build gate (Netlify build command): every listed line's PUBLIC catalog file must have its private commercial record
   (catalog_file_commercial, keyed by the file's identity) BEFORE the file is deployed. Otherwise the storefront shows
   "Pricing could not be loaded" and the order server refuses the line — which is exactly what happened to PediFix on
   2026-11-07 (a category edit changed the file's identity; no record was seeded; dealers could not price PediFix for days).

   - Reads public/data/manufacturers.json; for each listed, non-Golden line with public/data/<slug>.json computes the
     identity (_catalog_commercial.catalogIdentity, the same function the storefront and server use).
   - Asks Supabase (service key from the build environment — never printed) which identities are stored.
   - Fails the build (exit 1) when a line's deployed-to-be file has no stored record, naming the line and the version only.
   - KNOWN_BROKEN: lines already broken in production and awaiting the owner's SQL — they warn instead of failing, so other
     fixes can still deploy; any NEW mismatch fails. Remove an entry once its record is stored.
   - When Supabase can't be reached or no key is set in the build environment it WARNS (never blocks a deploy on its own
     outage); only a definite answer that a record is missing fails. CATALOG_GATE=warn turns every failure into a warning.
   - PRICE LOSS (2026-11-13): for a line whose record IS stored, every part number that carried a commercial field in the
     line's newest OTHER stored version must still carry one in the new version — a part number that loses its price (a
     partial reseed, a renamed row) fails the build. A NEW part number without a price only warns (it is priced through
     Manufacturer Center). Only booleans are compared; no price value is read into the log.
   - RETIRED (2026-11-13): the owner's retired part numbers (RETIRED_REQUIRED) must still be on the storefront's
     RETIRED_SKUS list in public/index.html — a catalog refresh can never quietly re-open them. */
'use strict';
const fs = require('fs');
const path = require('path');
const CC = require('../netlify/functions/_catalog_commercial.js');

const KNOWN_BROKEN = {};
/* Owner decisions (2026-11-05): these part numbers stay retired. Removing one is an owner decision AND an edit here. */
const RETIRED_REQUIRED = { pedifix: ['8520', '8521', '8620', 'P3012', 'P3012-12', 'P3305', 'P3355-STR', '6210-L-S', '6210-L-M',
  '6210-L-L', '6210-M-S', '6210-M-M', '6210-M-L', '6210-M-XL', 'P3095-115'] };
const priced = f => !!f && CC.CATALOG_COMMERCIAL_KEYS.some(k => f[k] != null && f[k] !== '' && !(Array.isArray(f[k]) && !f[k].length));
const codeOf = k => String(k).replace(/#\d+$/, '');
/* Part numbers priced in the line's newest other version and not in this one. stored rows: {manufacturer, identity_sha256, updated_at, rows}. */
function priceLoss(slug, id, stored) {
  const mine = stored.filter(r => r.manufacturer === slug);
  const cur = mine.find(r => r.identity_sha256 === id);
  const prev = mine.filter(r => r.identity_sha256 !== id && Array.isArray(r.rows)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (!cur || !Array.isArray(cur.rows) || !prev) return { lost: [], newUnpriced: [] };
  const was = new Set(prev.rows.filter(e => priced(e.f)).map(e => codeOf(e.k)));
  const known = new Set(prev.rows.map(e => codeOf(e.k)));
  const now = new Set(cur.rows.filter(e => priced(e.f)).map(e => codeOf(e.k)));
  const curCodes = new Set(cur.rows.map(e => codeOf(e.k)));
  return { lost: [...was].filter(c => curCodes.has(c) && !now.has(c)).sort(),
           newUnpriced: [...curCodes].filter(c => !known.has(c) && !now.has(c)).sort() };
}
function retiredProblems(html) {
  const m = /const RETIRED_SKUS=Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(html || ''); const out = [];
  for (const [slug, codes] of Object.entries(RETIRED_REQUIRED)) {
    const line = m && new RegExp('\\b' + slug.replace(/-/g, '\\-') + ':Object\\.freeze\\(\\[([^\\]]*)\\]').exec(m[1]);
    const have = new Set(line ? (line[1].match(/"([^"]+)"/g) || []).map(x => x.slice(1, -1)) : []);
    for (const c of codes) if (!have.has(c)) out.push(slug + ' ' + c);
  }
  return out;
}   // 2026-11-13: PediFix repaired (supabase/pedifix_p3020_record.sql run by the owner); keep empty

function plan(root, stored) {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'public/data/manufacturers.json'), 'utf8'));
  const have = new Set((stored || []).map(r => r.manufacturer + ':' + r.identity_sha256));
  const out = { checked: [], missing: [], known: [], lost: [], newUnpriced: [] };
  for (const m of Array.isArray(list) ? list : []) {
    const slug = m && m.slug; if (!slug || /golden/.test(slug)) continue;
    const f = path.join(root, 'public/data', slug + '.json'); if (!fs.existsSync(f)) continue;
    const id = CC.catalogIdentity(JSON.parse(fs.readFileSync(f, 'utf8')));
    out.checked.push(slug);
    if (have.has(slug + ':' + id)) {
      const pl = priceLoss(slug, id, stored || []);
      if (pl.lost.length) out.lost.push(slug + ' ' + id.slice(0, 16) + ': ' + pl.lost.join(', '));
      if (pl.newUnpriced.length) out.newUnpriced.push(slug + ': ' + pl.newUnpriced.join(', '));
      continue;
    }
    if (KNOWN_BROKEN[slug] && id.startsWith(KNOWN_BROKEN[slug])) out.known.push(slug + ' ' + id.slice(0, 16));
    else out.missing.push(slug + ' ' + id.slice(0, 16));
  }
  return out;
}

async function main() {
  const root = path.join(__dirname, '..');
  const mode = String(process.env.CATALOG_GATE || 'enforce').toLowerCase();
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY;
  let stored;
  try {
    if (!url || !key) throw new Error('no Supabase URL / service key in the build environment');
    const r = await fetch(`${url}/rest/v1/catalog_file_commercial?select=manufacturer,identity_sha256,updated_at,rows`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) throw new Error('catalog_file_commercial read ' + r.status);
    stored = await r.json();
  } catch (e) {
    console.log('catalog-identity-gate: could not read the stored records — ' + e.message);
    return 0;
  }
  const p = plan(root, stored);
  const retired = retiredProblems(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'));
  console.log(`catalog-identity-gate: ${p.checked.length} line(s) checked`);
  for (const k of p.known) console.log('  KNOWN (owner SQL pending): ' + k);
  for (const k of p.missing) console.log('  MISSING commercial record: ' + k);
  for (const k of p.newUnpriced) console.log('  NEW part number(s) without a price (price them in Manufacturer Center): ' + k);
  for (const k of p.lost) console.log('  PRICE LOST vs the previous version: ' + k);
  for (const k of retired) console.log('  RETIRED part number re-opened (missing from RETIRED_SKUS): ' + k);
  const bad = p.missing.length || p.lost.length || retired.length;
  if (bad && mode !== 'warn') { console.log('catalog-identity-gate: FAIL — seed the record (scripts/p0-reseed-by-code.js or --add-version), keep every priced part number priced, and keep retired part numbers retired BEFORE deploying'); return 1; }
  return 0;
}
if (require.main === module) main().then(c => process.exit(c), e => { console.log('catalog-identity-gate: ' + e.message); process.exit(1); });
module.exports = { plan, KNOWN_BROKEN, priceLoss, retiredProblems, RETIRED_REQUIRED };
