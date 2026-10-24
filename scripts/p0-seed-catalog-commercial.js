#!/usr/bin/env node
/* P0 (2026-10-23, issue #2; review fixes) — fill the PRIVATE table catalog_file_commercial
   (supabase/p0_catalog_file_commercial.sql must be installed first). Prints counts and SHA-256
   fingerprints only — never a price. Every write needs --apply and SUPABASE_URL + SUPABASE_SERVICE_ROLE in
   the environment (never in a file); every write is read back and checked.

   1. INITIAL SEED (once, before the storefront that strips the files is deployed):
        node scripts/p0-seed-catalog-commercial.js --ref <last priced commit> [--apply]
      Reads every priced file from git history, splits it, REFUSES unless the public half equals the file in
      this working tree exactly, and stores one record per line keyed by the public file's identity.

   2. RE-SEED for a later edit of a static catalog file (legacy line, public file changed in git):
        node scripts/p0-seed-catalog-commercial.js --reseed <slug> --base <deployed git ref>
             [--supply <private JSON outside this repository>] [--apply]
      Builds the NEXT version's record from the stored record of the version deployed at --base: each row of
      the edited file takes the commercial fields of the stored row with the SAME fingerprint (wherever it
      moved); a new or edited row must be named in --supply ({"<code>#<occurrence>": {<commercial fields>}})
      or the plan is refused. The new record is ADDED beside the old one, so both the deployed storefront and
      the one about to be deployed price correctly — deploy only after this succeeds.

   3. PRUNE after the new storefront is live and verified:
        node scripts/p0-seed-catalog-commercial.js --prune <slug> --live <storefront base URL> [--apply]
      Reads the LIVE public file, requires its version to be stored, and deletes every other version of
      that line (a DELETE with a WHERE on manufacturer and identity). */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const CC = require('../netlify/functions/_catalog_commercial.js');
const { applyScrubs } = require('./p0-scrubs.js');
const L = require('./p0-seed-lib.js');
const LINES = require('./p0-lines.js');
const ROOT = path.join(__dirname, '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const apply = process.argv.includes('--apply');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const short = h => String(h || '').slice(0, 16);
const gitShow = (ref, p) => { try { return execFileSync('git', ['-C', ROOT, 'show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };
const readTree = slug => { const p = path.join(ROOT, 'public', 'data', slug + '.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const die = (m, code) => { console.error(m); process.exit(code == null ? 1 : code); };

function db() {
  const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE;
  if (!U || !K) die('SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set (environment only)', 2);
  const H = { apikey: K, Authorization: `Bearer ${K}`, 'content-type': 'application/json' };
  const req = async (method, p, body, prefer) => {
    const r = await fetch(`${U}/rest/v1/${p}`, { method, headers: Object.assign({}, H, prefer ? { Prefer: prefer } : {}), body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); if (!r.ok) throw new Error(`${method} ${p.split('?')[0]}: HTTP ${r.status}`);
    return t ? JSON.parse(t) : null;
  };
  return {
    versions: slug => req('GET', `catalog_file_commercial?manufacturer=eq.${encodeURIComponent(slug)}&select=manufacturer,identity_sha256,rows,row_count,rows_sha256,source_ref,updated_at`),
    all: () => req('GET', 'catalog_file_commercial?select=manufacturer,identity_sha256,rows,rows_sha256'),
    upsert: recs => req('POST', 'catalog_file_commercial?on_conflict=manufacturer,identity_sha256', recs, 'resolution=merge-duplicates,return=minimal'),
    pruneOthers: (slug, keep) => req('DELETE', `catalog_file_commercial?manufacturer=eq.${encodeURIComponent(slug)}&identity_sha256=neq.${keep}`, null, 'return=representation'),
  };
}
async function writeAndVerify(D, recs) {
  await D.upsert(recs.map(r => ({ manufacturer: r.manufacturer, identity_sha256: r.identity_sha256, rows: r.rows, row_count: r.row_count,
    rows_sha256: r.rows_sha256, public_sha256: r.public_sha256, source_ref: r.source_ref })));
  const got = await D.all(); let bad = 0;
  for (const r of recs) {
    const g = (got || []).find(x => x.manufacturer === r.manufacturer && x.identity_sha256 === r.identity_sha256);
    const ok = g && sha(JSON.stringify(g.rows)) === r.rows_sha256 && g.rows_sha256 === r.rows_sha256 && CC.validOverlayRecord(g);
    if (!ok) bad++; console.log(`${ok ? 'stored  ' : 'MISMATCH'} ${r.manufacturer.padEnd(28)} identity ${short(r.identity_sha256)}`);
  }
  if (bad) die(`${bad} record(s) did not read back identically`);
}

(async () => {
  const ref = arg('--ref'), reseed = arg('--reseed'), prune = arg('--prune');
  if ([ref, reseed, prune].filter(Boolean).length !== 1)
    die('usage: --ref <git ref> | --reseed <slug> --base <git ref> [--supply <file>] | --prune <slug> --live <url>   [--apply]', 2);

  if (ref) {
    /* Only CURRENT lines (listed in this tree's manufacturers.json) are seeded; a file at the ref for a line
       that is no longer listed (retired, e.g. Complete Medical Supplies) is reported and never seeded. */
    const current = new Set(LINES.currentLines(ROOT));
    execFileSync('git', ['-C', ROOT, 'ls-tree', '--name-only', `${ref}:public/data`], { encoding: 'utf8' }).split('\n')
      .filter(n => /\.json$/.test(n) && n !== 'manufacturers.json').map(n => n.replace(/\.json$/, ''))
      .filter(s => !current.has(s)).sort().forEach(s => console.log(`retired  ${s.padEnd(28)} (not in manufacturers.json — no commercial record is seeded)`));
    const plans = []; let bad = 0;
    for (const slug of [...current].sort()) {
      const txt = gitShow(ref, `public/data/${slug}.json`), cur = readTree(slug);
      if (txt == null || cur == null) { console.log(`skip     ${slug.padEnd(28)} (${txt == null ? 'not in ' + ref : 'not in this tree'})`); continue; }
      const p = L.planInitial(slug, applyScrubs(slug, JSON.parse(txt)), cur, ref);
      if (!p.ok) bad++; plans.push(p);
      console.log(`${p.ok ? 'ok      ' : 'BAD     '} ${slug.padEnd(28)} rows ${String(p.record.row_count).padStart(4)}  identity ${short(p.record.identity_sha256)}  overlay ${short(p.record.rows_sha256)}  public ${short(p.record.public_sha256)}${p.ok ? '' : '  (' + p.problems.join('; ') + ')'}`);
    }
    if (bad) die(`\n${bad} line(s) refused — nothing written.`);
    if (!apply) { console.log(`\nDry run: ${plans.length} line(s) ready. Re-run with --apply to write.`); return; }
    await writeAndVerify(db(), plans.map(p => p.record));
    console.log(`\n${plans.length} line(s) stored and verified.`); return;
  }

  if (reseed) {
    const base = arg('--base'), supplyPath = arg('--supply');
    if (!base) die('--reseed needs --base <git ref of the storefront currently deployed>', 2);
    const baseTxt = gitShow(base, `public/data/${reseed}.json`), next = readTree(reseed);
    if (baseTxt == null || next == null) die(`${reseed}.json missing at ${base} or in this tree`);
    let supplied = null;
    if (supplyPath) {
      const abs = path.resolve(supplyPath);
      if (!path.relative(ROOT, abs).startsWith('..')) die('--supply must be OUTSIDE this repository (it holds prices; the repository is public)', 2);
      supplied = JSON.parse(fs.readFileSync(abs, 'utf8'));
    }
    const D = db(), stored = await D.versions(reseed);
    const p = L.planReseed(reseed, stored, CC.catalogIdentity(JSON.parse(baseTxt)), next, supplied, `reseed ${base} -> tree`);
    console.log(`base ${short(CC.catalogIdentity(JSON.parse(baseTxt)))} -> next ${short(p.record.identity_sha256)}: ${p.report.carried} carried by fingerprint, ${p.report.supplied} supplied, ${p.report.unresolved.length} unresolved, ${p.report.dropped} old row(s) no longer in the file${p.report.already_stored ? ' (this version is already stored)' : ''}`);
    if (!p.ok) die('REFUSED — nothing written:\n  ' + p.problems.join('\n  '));
    if (!apply) { console.log('Dry run: ready. Re-run with --apply, THEN deploy the storefront, THEN --prune.'); return; }
    await writeAndVerify(D, [p.record]);
    console.log('Next version stored beside the deployed one. Deploy the storefront now; prune after verification.'); return;
  }

  if (prune) {
    const live = arg('--live'); if (!live) die('--prune needs --live <storefront base URL>', 2);
    const r = await fetch(`${live.replace(/\/$/, '')}/data/${prune}.json`, { headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) die(`live file: HTTP ${r.status}`);
    const liveId = CC.catalogIdentity(await r.json());
    const D = db(), stored = await D.versions(prune);
    if (!(stored || []).some(x => x.identity_sha256 === liveId)) die(`REFUSED: the live file's version ${short(liveId)} is not stored — nothing deleted`);
    const others = (stored || []).filter(x => x.identity_sha256 !== liveId);
    others.forEach(x => console.log(`would delete ${prune} version ${short(x.identity_sha256)} (seeded from ${x.source_ref} at ${x.updated_at})`));
    if (!others.length) { console.log('Nothing to prune.'); return; }
    if (!apply) { console.log('Dry run. Re-run with --apply to delete.'); return; }
    const gone = await D.pruneOthers(prune, liveId);
    console.log(`deleted ${(gone || []).length} version(s); kept ${short(liveId)}`);
  }
})().catch(e => die(String((e && e.message) || e)));
