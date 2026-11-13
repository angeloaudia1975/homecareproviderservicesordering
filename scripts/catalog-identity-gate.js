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
     outage); only a definite answer that a record is missing fails. CATALOG_GATE=warn turns every failure into a warning. */
'use strict';
const fs = require('fs');
const path = require('path');
const CC = require('../netlify/functions/_catalog_commercial.js');

const KNOWN_BROKEN = {};   // 2026-11-13: PediFix repaired (supabase/pedifix_p3020_record.sql run by the owner); keep empty

function plan(root, stored) {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'public/data/manufacturers.json'), 'utf8'));
  const have = new Set((stored || []).map(r => r.manufacturer + ':' + r.identity_sha256));
  const out = { checked: [], missing: [], known: [] };
  for (const m of Array.isArray(list) ? list : []) {
    const slug = m && m.slug; if (!slug || /golden/.test(slug)) continue;
    const f = path.join(root, 'public/data', slug + '.json'); if (!fs.existsSync(f)) continue;
    const id = CC.catalogIdentity(JSON.parse(fs.readFileSync(f, 'utf8')));
    out.checked.push(slug);
    if (have.has(slug + ':' + id)) continue;
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
    const r = await fetch(`${url}/rest/v1/catalog_file_commercial?select=manufacturer,identity_sha256`, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) throw new Error('catalog_file_commercial read ' + r.status);
    stored = await r.json();
  } catch (e) {
    console.log('catalog-identity-gate: could not read the stored records — ' + e.message);
    return 0;
  }
  const p = plan(root, stored);
  console.log(`catalog-identity-gate: ${p.checked.length} line(s) checked`);
  for (const k of p.known) console.log('  KNOWN (owner SQL pending): ' + k);
  for (const k of p.missing) console.log('  MISSING commercial record: ' + k);
  if (p.missing.length && mode !== 'warn') { console.log('catalog-identity-gate: FAIL — seed the record (scripts/p0-reseed-by-code.js or --add-version) BEFORE deploying this file'); return 1; }
  return 0;
}
if (require.main === module) main().then(c => process.exit(c), e => { console.log('catalog-identity-gate: ' + e.message); process.exit(1); });
module.exports = { plan, KNOWN_BROKEN };
