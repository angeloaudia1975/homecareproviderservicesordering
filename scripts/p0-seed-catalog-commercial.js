#!/usr/bin/env node
/* P0 (2026-10-23, issue #2) — load the commercial half of every catalog file into the PRIVATE table
   catalog_file_commercial (supabase/p0_catalog_file_commercial.sql must be installed first).

     node scripts/p0-seed-catalog-commercial.js --ref <git ref>            dry run (default)
     node scripts/p0-seed-catalog-commercial.js --ref <git ref> --apply    write (run by Angelo)

   --ref is the last commit whose public/data files still carried prices (the commit this branch
   started from). The script reads those files from git, splits each one, REFUSES unless the public
   half equals the file in this working tree exactly (so the overlay and the deployed public file can
   never be out of step), and prints, per line, the row count and SHA-256 fingerprints — never a price.
   --apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE in the environment (never in a file), upserts
   one row per line, then reads every row back and checks its fingerprint. Nothing else is written. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const CC = require('../netlify/functions/_catalog_commercial.js');
const { applyScrubs } = require('./p0-scrubs.js');
const ROOT = path.join(__dirname, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ref = arg('--ref'), apply = process.argv.includes('--apply');
if (!ref) { console.error('usage: --ref <git ref of the last priced catalog files> [--apply]'); process.exit(2); }
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const git = p => { try { return execFileSync('git', ['-C', ROOT, 'show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };

const slugs = new Set(JSON.parse(git('public/data/manufacturers.json') || '[]').map(m => m.slug));
execFileSync('git', ['-C', ROOT, 'ls-tree', '--name-only', `${ref}:public/data`], { encoding: 'utf8' }).split('\n')
  .filter(n => /\.json$/.test(n) && n !== 'manufacturers.json').forEach(n => slugs.add(n.replace(/\.json$/, '')));

const plan = [];
let bad = 0;
for (const slug of [...slugs].sort()) {
  const txt = git(`public/data/${slug}.json`);
  const full = txt == null ? [] : JSON.parse(txt);
  const s = CC.splitCatalogFile(full);
  const curPath = path.join(ROOT, 'public', 'data', slug + '.json');
  const cur = fs.existsSync(curPath) ? JSON.parse(fs.readFileSync(curPath, 'utf8')) : [];
  const pub = applyScrubs(slug, JSON.parse(JSON.stringify(s.public)));
  const same = JSON.stringify(cur) === JSON.stringify(pub);
  const back = JSON.stringify(CC.restoreCatalogFile(cur, s.overlay)) === JSON.stringify(applyScrubs(slug, JSON.parse(JSON.stringify(full))));
  if (!same || !back) bad++;
  const rows = JSON.stringify(s.overlay);
  plan.push({ manufacturer: slug, rows: s.overlay, row_count: s.overlay.length, rows_sha256: sha(rows),
              public_sha256: sha(JSON.stringify(pub)), source_ref: ref });
  console.log(`${(same && back) ? 'ok  ' : 'BAD '} ${slug.padEnd(28)} rows ${String(s.overlay.length).padStart(4)}  overlay ${sha(rows).slice(0, 16)}  public ${sha(JSON.stringify(pub)).slice(0, 16)}${same ? '' : '  (public file in this tree differs from the split)'}${back ? '' : '  (restore does not give back the original)'}`);
}
if (bad) { console.error(`\n${bad} line(s) refused — nothing written.`); process.exit(1); }
if (!apply) { console.log(`\nDry run: ${plan.length} line(s) ready. Re-run with --apply (SUPABASE_URL, SUPABASE_SERVICE_ROLE set) to write.`); process.exit(0); }

(async () => {
  const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE;
  if (!U || !K) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set for --apply'); process.exit(2); }
  const H = { apikey: K, Authorization: `Bearer ${K}`, 'content-type': 'application/json' };
  const body = plan.map(p => ({ manufacturer: p.manufacturer, rows: p.rows, row_count: p.row_count, rows_sha256: p.rows_sha256, public_sha256: p.public_sha256, source_ref: p.source_ref }));
  const w = await fetch(`${U}/rest/v1/catalog_file_commercial?on_conflict=manufacturer`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
  if (!w.ok) { console.error('write refused: HTTP ' + w.status); process.exit(1); }
  const r = await fetch(`${U}/rest/v1/catalog_file_commercial?select=manufacturer,rows,rows_sha256`, { headers: H });
  if (!r.ok) { console.error('read-back failed: HTTP ' + r.status); process.exit(1); }
  const got = Object.fromEntries((await r.json()).map(x => [x.manufacturer, x]));
  let mism = 0;
  for (const p of plan) { const g = got[p.manufacturer]; const ok = g && sha(JSON.stringify(g.rows)) === p.rows_sha256 && g.rows_sha256 === p.rows_sha256;
    if (!ok) mism++; console.log(`${ok ? 'stored' : 'MISMATCH'} ${p.manufacturer}`); }
  if (mism) { console.error(`${mism} line(s) did not read back identically`); process.exit(1); }
  console.log(`\n${plan.length} line(s) stored and verified.`);
})();
