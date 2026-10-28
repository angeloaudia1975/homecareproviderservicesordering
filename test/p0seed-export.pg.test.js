/* P0 seed — the --export-sql path (2026-10-25): the verified initial seed as ONE idempotent, fail-closed SQL
   transaction for the Supabase SQL editor, so the remaining records can be written without a service key.
   Runs the REAL plan (git history at P0_SEED_REF, default 4b1bad3) through scripts/p0-seed-catalog-commercial.js
   into a private temp folder (never the repository — the file holds prices), installs the committed
   supabase/p0_catalog_file_commercial.sql in a scratch Postgres database shaped like Supabase, then proves:
   fresh install → exactly the plan; a second run changes nothing; records already stored exactly (the five
   seeded on 2026-10-25) are kept untouched; a stored record that differs, an extra line, a second version,
   RLS off, a policy or an anon grant → refused with nothing written. No price is printed.
   Needs: sudo -n -u postgres psql (unix socket) and the git history of this repository. */
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const REF = process.env.P0_SEED_REF || '4b1bad3';
const DB = process.env.PG_DB || 'p0_seed_export_test';
const psql = (sql, db) => execFileSync('sudo', ['-n', '-u', 'postgres', 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db || DB],
  { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const tryPsql = sql => { try { return { ok: true, out: psql(sql) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message) }; } };
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + String(e && e.message).split('\n').slice(0, 4).join('\n     ')); } }
const ok = (c, m) => { if (!c) throw new Error(m); };

/* The real export, into a private temp folder. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0seed-'));
fs.chmodSync(dir, 0o700);
const OUT = path.join(dir, 'seed.sql');
const cli = execFileSync('node', [path.join(ROOT, 'scripts', 'p0-seed-catalog-commercial.js'), '--ref', REF, '--export-sql', OUT], { encoding: 'utf8' });
const SEED = fs.readFileSync(OUT, 'utf8');
const m = /(\d+) line\(s\), (\d+) row\(s\)/.exec(cli); const LINES = +m[1], ROWS = +m[2];
const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} };

const reset = () => {
  psql(`drop database if exists ${DB}; create database ${DB};`, 'postgres');
  psql(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`);
  psql(fs.readFileSync(path.join(ROOT, 'supabase', 'p0_catalog_file_commercial.sql'), 'utf8'));
};
const state = () => psql(`select count(*) || '|' || coalesce(sum(row_count),0) from public.catalog_file_commercial;`).trim();
const stamps = () => psql(`select string_agg(manufacturer || '@' || updated_at, ',' order by manufacturer) from public.catalog_file_commercial;`).trim();
/* The records as the SEED holds them, copied into the target directly (models records written earlier). */
const preload = slugs => psql(SEED.split('\ndo $p0$')[0] + `
  insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
  select manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref from _p0_seed
   where manufacturer in (${slugs.map(s => `'${s}'`).join(',')});
  commit;`);
const FIVE = ['bemis', 'dalton', 'airavant-bongorx', 'corsicana', 'climbing-steps'];

/* Access4U left the initial seed (UPDATED in scripts/p0-lines.js): its Fall 2026 version goes in through --add-version. */
/* Expected = the 10 seeded lines / 1,120 rows minus every line later moved to --add-version (UPDATED), counted from REF. */
const UPD = Object.keys(require('../scripts/p0-lines.js').UPDATED);
const updRows = UPD.reduce((n, s) => n + JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${REF}:public/data/${s}.json`], { encoding: 'utf8', maxBuffer: 1 << 26 })).length, 0);
const EXP = `${10 - UPD.length}|${1120 - updRows}`;
t('the export plans exactly the runbook: 10 lines / 1,120 rows minus the version-added lines, Complete Medical excluded', () => {
  ok(`${LINES}|${ROWS}` === EXP, `${LINES} / ${ROWS}`);
  ok(!/complete-medical/.test(SEED.split('\ndo $p0$')[0].replace(/\$p0j[0-9a-f]+\$[\s\S]*?\$p0j[0-9a-f]+\$/g, '')), 'retired line in the plan');
});
t('the file is private: mode 0600, outside the repository, no UPDATE / DELETE statement', () => {
  ok((fs.statSync(OUT).mode & 0o777) === 0o600, 'mode');
  ok(path.relative(ROOT, OUT).startsWith('..'), 'inside repo');
  const code = SEED.replace(/\$p0j[0-9a-f]+\$[\s\S]*?\$p0j[0-9a-f]+\$/g, '');
  ok(!/\b(update|delete|truncate|drop)\s/i.test(code.replace(/on commit drop/g, '')), 'mutating statement found');
});
t('the CLI refuses a path inside a git repository and never overwrites', () => {
  const r1 = (() => { try { execFileSync('node', [path.join(ROOT, 'scripts', 'p0-seed-catalog-commercial.js'), '--ref', REF, '--export-sql', path.join(ROOT, 'x.sql')], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } })();
  ok(r1 === 2 && !fs.existsSync(path.join(ROOT, 'x.sql')), 'inside repo accepted');
  const r2 = (() => { try { execFileSync('node', [path.join(ROOT, 'scripts', 'p0-seed-catalog-commercial.js'), '--ref', REF, '--export-sql', OUT], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } })();
  ok(r2 !== 0, 'overwrite accepted');
  ok(!/"base_price"|"dealer_price"/.test(cli), 'CLI output carries prices');
});

reset();
t('fresh table → exactly the plan (seed minus version-added lines), summary shows RLS on and anon denied', () => {
  const out = psql(SEED); ok(state() === EXP, state());
  const last = out.trim().split('\n'); ok(last.length === 10 - UPD.length && last.every(l => l.endsWith('|' + EXP + '|t|t')), last.slice(-1)[0]);
});
t('a second run is a no-op (idempotent; nothing rewritten)', () => {
  const before = stamps(); psql(SEED); ok(state() === EXP && stamps() === before, 'changed');
});

reset();
t('the five records already stored are kept untouched; the other five are added', () => {
  preload(FIVE); ok(state() === '5|58', 'preload ' + state());
  const before = stamps().split(',');
  psql(SEED); ok(state() === EXP, state());
  const after = stamps().split(',');
  ok(before.every(b => after.indexOf(b) >= 0), 'an existing record was rewritten');
});

reset();
t('a stored record that differs (one price changed) → refused, nothing written', () => {
  preload(['bemis']);
  psql(`alter table public.catalog_file_commercial disable trigger user;
        update public.catalog_file_commercial set rows = jsonb_set(rows, '{0,f}', (rows->0->'f') || '{"zz":1}') where manufacturer = 'bemis';
        alter table public.catalog_file_commercial enable trigger user;`);
  const r = tryPsql(SEED); ok(!r.ok && /differs from the verified plan/.test(r.out), r.out.slice(0, 200)); ok(state() === '1|9', state());
});
reset();
t('a stored record with the right rows but another fingerprint → refused', () => {
  preload(['corsicana']);
  psql(`alter table public.catalog_file_commercial disable trigger user;
        update public.catalog_file_commercial set public_sha256 = repeat('0', 64) where manufacturer = 'corsicana';
        alter table public.catalog_file_commercial enable trigger user;`);
  const r = tryPsql(SEED); ok(!r.ok && /differs/.test(r.out), r.out.slice(0, 200)); ok(state() === '1|14', state());
});
reset();
t('a stored record for a line or version outside the plan (e.g. a retired line) → refused', () => {
  preload(['bemis']);
  psql(`insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
        values ('complete-medical-supplies', encode(sha256(''::bytea), 'hex'), '[]', 0, repeat('a', 64), repeat('b', 64), 'x');`);
  const r = tryPsql(SEED); ok(!r.ok && /not in the verified plan/.test(r.out), r.out.slice(0, 200)); ok(state() === '2|9', state());
});
reset();
t('RLS off → refused, nothing written', () => {
  psql('alter table public.catalog_file_commercial disable row level security;');
  const r = tryPsql(SEED); ok(!r.ok && /RLS is off/.test(r.out), r.out.slice(0, 200)); ok(state() === '0|0', state());
});
reset();
t('a policy on the table → refused', () => {
  psql('create policy leak on public.catalog_file_commercial for select to anon using (true);');
  const r = tryPsql(SEED); ok(!r.ok && /has a policy/.test(r.out), r.out.slice(0, 200)); ok(state() === '0|0', state());
});
reset();
t('anon given SELECT → refused', () => {
  psql('grant select on public.catalog_file_commercial to anon;');
  const r = tryPsql(SEED); ok(!r.ok && /anon or authenticated can read/.test(r.out), r.out.slice(0, 200)); ok(state() === '0|0', state());
});
reset();
t('guard trigger disabled → refused', () => {
  psql('alter table public.catalog_file_commercial disable trigger user;');
  const r = tryPsql(SEED); ok(!r.ok && /guard trigger/.test(r.out), r.out.slice(0, 200)); ok(state() === '0|0', state());
});
t('the stored records (read back from jsonb) restore the priced files of the ref byte for byte', () => {
  reset(); psql(SEED);
  const CC = require(path.join(ROOT, 'netlify', 'functions', '_catalog_commercial.js'));
  const { applyScrubs } = require(path.join(ROOT, 'scripts', 'p0-scrubs.js'));
  const got = JSON.parse(psql(`select json_agg(json_build_object('m', manufacturer, 'rows', rows)) from public.catalog_file_commercial;`));
  got.forEach(g => {
    const pub = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', g.m + '.json'), 'utf8'));
    const full = applyScrubs(g.m, JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${REF}:public/data/${g.m}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 })));
    /* jsonb reorders keys inside nested objects; restore puts them back in the files' one convention
       (_catalog_commercial.js nestedOrder), so the priced file comes back BYTE FOR BYTE. */
    ok(JSON.stringify(CC.restoreCatalogFile(pub, g.rows)) === JSON.stringify(full), g.m + ' does not restore byte for byte');
  });
});

psql(`drop database if exists ${DB};`, 'postgres');
cleanup();
console.log(`\np0 seed export (PostgreSQL): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
