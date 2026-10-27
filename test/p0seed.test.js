/* P0 review (2026-10-23) — building the private commercial records (scripts/p0-seed-lib.js) and choosing
   which lines get one (scripts/p0-lines.js). Pure planning: no database, no price printed.
     · initial seed: a record per CURRENT line only; a retired line (not in manufacturers.json, e.g.
       Complete Medical Supplies) is never seeded — with its file still in the tree AND after it is deleted;
     · re-seed of an edited public file: commercial rows follow their row by fingerprint (a reordered
       duplicate part number keeps ITS price), an edited / new row must be supplied, nothing is guessed;
     · the seed CLI (dry run) on this tree and on a copy of the tree without the retired file.
   Usage: node test/p0seed.test.js */
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CC = require(path.join(ROOT, 'netlify', 'functions', '_catalog_commercial.js'));
const L = require(process.env.SEED_LIB || path.join(ROOT, 'scripts', 'p0-seed-lib.js'));
const LINES = require(path.join(ROOT, 'scripts', 'p0-lines.js'));
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const copy = v => JSON.parse(JSON.stringify(v));

const FULL = [
  { manufacturer: 'L', code: 'A1', name: 'Alpha', base_price: 10, tiers: [{ min_qty: 2, price: 9 }] },
  { manufacturer: 'L', code: 'SR3', name: 'Ramp 3ft', family: 'solo', base_price: 50 },
  { manufacturer: 'L', code: 'SR3', name: 'Ramp 3ft', family: 'kit', base_price: 70 },
];
const S = CC.splitCatalogFile(FULL);
const STORED = L.planInitial('L', FULL, S.public, 'test').record;
const restorePrices = (pub, rec) => CC.restoreCatalogFile(pub, rec.rows).map(r => [r.code, r.family || null, r.base_price]);

t('initial: a record whose identity is the public file\'s, valid, restoring the original', () => {
  const p = L.planInitial('L', FULL, S.public, 'test');
  ok(p.ok, p.problems.join('; ')); ok(CC.validOverlayRecord(p.record), 'valid'); eq(p.record.identity_sha256, CC.catalogIdentity(S.public));
  eq(CC.restoreCatalogFile(S.public, p.record.rows), FULL);
});
t('initial: refused when the public file in the tree differs from the split (even one field)', () => {
  const pub = copy(S.public); pub[2].name = 'Ramp 3 ft';
  ok(!L.planInitial('L', FULL, pub, 'test').ok, 'accepted');
});
t('re-seed: swapped duplicate-code rows keep THEIR prices (matched by fingerprint, never by position)', () => {
  const next = [S.public[0], S.public[2], S.public[1]];
  const p = L.planReseed('L', [STORED], STORED.identity_sha256, next, null, 'r');
  ok(p.ok, p.problems.join('; ')); eq(p.report.carried, 3);
  eq(restorePrices(next, p.record), [['A1', null, 10], ['SR3', 'kit', 70], ['SR3', 'solo', 50]]);
  ok(p.record.identity_sha256 !== STORED.identity_sha256, 'a new version');
});
t('re-seed: an edited row with no supplied fields is refused — nothing is guessed', () => {
  const next = copy(S.public); next[0].name = 'Alpha II';
  const p = L.planReseed('L', [STORED], STORED.identity_sha256, next, null, 'r');
  ok(!p.ok && p.report.unresolved.includes('A1#0'), JSON.stringify(p.report));
});
t('re-seed: an edited / new row takes exactly the supplied commercial fields', () => {
  const next = copy(S.public).concat([{ manufacturer: 'L', code: 'N1', name: 'New' }]); next[0].name = 'Alpha II';
  const p = L.planReseed('L', [STORED], STORED.identity_sha256, next, { 'A1#0': { base_price: 11 }, 'N1#0': { base_price: 5, msrp: 10 } }, 'r');
  ok(p.ok, p.problems.join('; ')); eq(p.report.supplied, 2); eq(p.report.carried, 2);
  eq(CC.restoreCatalogFile(next, p.record.rows).map(r => r.base_price), [11, 50, 70, 5]);
});
t('re-seed: a supplied entry naming a non-commercial field, or matching no row, is refused', () => {
  const next = copy(S.public); next[0].name = 'Alpha II';
  ok(!L.planReseed('L', [STORED], STORED.identity_sha256, next, { 'A1#0': { base_price: 1, name: 'x' } }, 'r').ok, 'non-commercial field accepted');
  ok(!L.planReseed('L', [STORED], STORED.identity_sha256, next, { 'A1#0': { base_price: 1 }, 'ZZ#0': { base_price: 1 } }, 'r').ok, 'stray entry accepted');
});
t('re-seed: refused without the stored base version, or with a public file that still carries prices', () => {
  ok(!L.planReseed('L', [STORED], 'f'.repeat(64), S.public, null, 'r').ok, 'unknown base');
  ok(!L.planReseed('L', [], STORED.identity_sha256, S.public, null, 'r').ok, 'no record');
  ok(!L.planReseed('L', [STORED], STORED.identity_sha256, FULL, null, 'r').ok, 'priced file');
});
t('re-seed: a removed row is reported as dropped; an unchanged file is the same version', () => {
  const p = L.planReseed('L', [STORED], STORED.identity_sha256, S.public.slice(0, 2), null, 'r'); ok(p.ok); eq(p.report.dropped, 1);
  const same = L.planReseed('L', [STORED], STORED.identity_sha256, S.public, null, 'r'); eq(same.record.identity_sha256, STORED.identity_sha256); ok(same.report.already_stored);
});

/* ---- retired lines (ordering#4 retires Complete Medical Supplies) ---- */
t('current lines = this tree\'s manufacturers.json; every retired line is outside it', () => {
  const cur = LINES.currentLines(ROOT);
  ok(cur.length > 0, 'no lines'); LINES.RETIRED.forEach(r => ok(!cur.includes(r), r + ' is listed as current'));
});
function runSeed(root) {
  return execFileSync('node', [path.join(root, 'scripts', 'p0-seed-catalog-commercial.js'), '--ref', process.env.P0_BASE_REF || '4b1bad3'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE: '' }) });
}
let gitOk = true; try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', (process.env.P0_BASE_REF || '4b1bad3') + '^{commit}']); } catch (e) { gitOk = false; }
if (!gitOk) t('the base commit is readable', () => { throw new Error('git ref unavailable — fetch it or set P0_BASE_REF'); });
else {
  const lines = out => Object.fromEntries(out.split('\n').filter(l => /^(ok|BAD|skip|retired|updated)\s/.test(l)).map(l => { const [st, slug] = l.trim().split(/\s+/); return [slug, st]; }));
  t('seed dry run on THIS tree: every current line ok, retired lines reported and never seeded', () => {
    const r = lines(runSeed(ROOT));
    LINES.currentLines(ROOT).forEach(s => ok(r[s] === 'ok' || r[s] === 'skip' || (r[s] === 'updated' && !!LINES.UPDATED[s]), s + ' ' + r[s]));
    LINES.RETIRED.forEach(s => ok(r[s] === 'retired' || r[s] === undefined, s + ' would be seeded: ' + r[s]));
    ok(!Object.values(r).includes('BAD'), 'a BAD line');
  });
  t('seed dry run on a tree WITHOUT the retired files (ordering#4 merged first): same lines ok, nothing BAD', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p0seed-'));
    try {
      execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', '-q', tmp, 'HEAD']);
      for (const f of ['scripts', 'netlify/functions', 'public/data']) fs.cpSync(path.join(ROOT, f), path.join(tmp, f), { recursive: true });
      LINES.RETIRED.forEach(s => { try { fs.rmSync(path.join(tmp, 'public', 'data', s + '.json')); } catch (e) {} });
      const a = lines(runSeed(ROOT)), b = lines(runSeed(tmp));
      LINES.currentLines(ROOT).forEach(s => eq(b[s], a[s], s));
      ok(!Object.values(b).includes('BAD'), 'a BAD line');
    } finally { try { execFileSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', tmp]); } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); } }
  });
}
console.log(`\np0 seed planning: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
