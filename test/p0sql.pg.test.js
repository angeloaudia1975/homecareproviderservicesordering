/* P0 (2026-10-23, issue #2) — the committed SQL files, run in a real local Postgres.
   Builds a scratch database shaped like the Supabase project (roles anon / authenticated /
   service_role, Supabase's default grants to all three on new public tables, the two legacy layer
   tables with today's USING (true) SELECT policies), then runs the committed files verbatim and
   proves what each role can do — as that role (SET ROLE), not by reading the catalog.
   Needs: sudo -n -u postgres psql (unix socket). PG_DB overrides the scratch database name. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SQL = path.join(__dirname, '..', 'supabase');
const DB = process.env.PG_DB || 'p0_price_exposure_test';
const psql = (sql, db, opts) => execFileSync('sudo', ['-n', '-u', 'postgres', 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db || DB],
  { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...(opts || {}) });
const tryPsql = (sql) => { try { return { ok: true, out: psql(sql) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message) }; } };
const file = f => fs.readFileSync(path.join(SQL, f), 'utf8');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + String(e && e.message).split('\n').slice(0, 4).join('\n     ')); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const as = (role, sql) => tryPsql(`set role ${role};\n${sql}`);

psql(`drop database if exists ${DB}; create database ${DB};`, 'postgres');
psql(`
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase gives every role ALL on new public tables by default — RULE 19 exists because of this.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table public.custom_products (manufacturer text, code text, name text, base_price numeric, msrp numeric, map numeric,
  tiers jsonb, price_note text, image text, description text, category text, active boolean default true, msrp_auto boolean,
  updated_at timestamptz default now(), primary key (manufacturer, code));
create table public.product_overrides (manufacturer text, code text, patch jsonb, updated_at timestamptz default now(), primary key (manufacturer, code));
alter table public.custom_products enable row level security;
alter table public.product_overrides enable row level security;
create policy custom_products_read on public.custom_products for select to public using (true);
create policy product_overrides_read on public.product_overrides for select to public using (true);
insert into public.custom_products (manufacturer, code, name, base_price) values ('bemis', '444DISPLAY', 'Display', 634.86);
insert into public.product_overrides (manufacturer, code, patch) values ('bemis', '7Y1', '{"base_price": 109.98}');
`);

t('before: the public key (anon) reads every added product price and every saved edit — the exposure', () => {
  const a = as('anon', 'select base_price from public.custom_products; select patch->>\'base_price\' from public.product_overrides;');
  ok(a.ok && /634\.86/.test(a.out) && /109\.98/.test(a.out), 'expected the pre-fix exposure to reproduce: ' + a.out);
});

const CF = file('p0_catalog_file_commercial.sql');
t('p0_catalog_file_commercial.sql installs and every install check reads true', () => {
  const out = psql(CF).trim().split('\n').pop();
  ok(/^t(\|t)+$/.test(out), 'checks: ' + out);
});
t('it is idempotent (a second run changes nothing and still checks true)', () => {
  ok(/^t(\|t)+$/.test(psql(CF).trim().split('\n').pop()), 'second run');
});
const ROW = `insert into public.catalog_file_commercial (manufacturer, rows, row_count, rows_sha256, public_sha256, source_ref)
  values ('bemis', '[{"k":"7Y1#0","order":["code","base_price"],"f":{"base_price":109.98}}]', 1, repeat('a',64), repeat('b',64), '4b1bad3')
  on conflict (manufacturer) do update set rows = excluded.rows, row_count = excluded.row_count;`;
t('service_role writes and reads the commercial table (upsert, as the seed script does)', () => {
  const r = as('service_role', ROW + ' select row_count from public.catalog_file_commercial;');
  ok(r.ok && /^1$/m.test(r.out), r.out);
});
for (const role of ['anon', 'authenticated']) {
  t(`${role} cannot read the commercial table (permission denied, not an empty answer)`, () => {
    const r = as(role, 'select * from public.catalog_file_commercial;'); ok(!r.ok && /permission denied/.test(r.out), r.out);
  });
  t(`${role} cannot write the commercial table`, () => {
    const r = as(role, ROW); ok(!r.ok && /permission denied/.test(r.out), r.out);
  });
}
t('Supabase\'s default grants were really revoked (a GRANT re-added for anon still meets RLS with no policy)', () => {
  psql('grant select on public.catalog_file_commercial to anon;');
  const r = as('anon', 'select count(*) from public.catalog_file_commercial;');
  psql('revoke all on public.catalog_file_commercial from anon;');
  ok(r.ok && /^0$/m.test(r.out), 'RLS with no policy must answer nothing: ' + r.out);
});
t('constraints refuse a malformed record (count mismatch, bad slug, bad fingerprint)', () => {
  for (const bad of [
    `insert into public.catalog_file_commercial values ('x', '[]', 1, repeat('a',64), repeat('b',64), 'r');`,
    `insert into public.catalog_file_commercial values ('Bad Slug', '[]', 0, repeat('a',64), repeat('b',64), 'r');`,
    `insert into public.catalog_file_commercial values ('y', '{}', 0, repeat('a',64), repeat('b',64), 'r');`,
    `insert into public.catalog_file_commercial values ('z', '[]', 0, 'short', repeat('b',64), 'r');`]) {
    const r = as('service_role', bad); ok(!r.ok && /violates check constraint|cannot get array length/.test(r.out), 'accepted: ' + bad);
  }
});
t('its rollback refuses while a row exists, and runs once the table is empty', () => {
  const RB = file('p0_catalog_file_commercial_rollback.sql');
  const a = tryPsql(RB); ok(!a.ok && /still holds rows/.test(a.out), 'refused: ' + a.out);
  ok(/^1$/m.test(psql('select count(*) from public.catalog_file_commercial;')), 'nothing removed by the refusal');
  psql('delete from public.catalog_file_commercial where true;');
  ok(/^t$/m.test(psql(RB).trim().split('\n').pop()), 'rollback ran');
  psql(CF); psql(`set role service_role; ${ROW}`);
});

const LOCK = file('p0_lock_layer_reads.sql');
t('p0_lock_layer_reads.sql runs and every check reads true', () => {
  const out = psql(LOCK).trim().split('\n').pop(); ok(/^t(\|t)+$/.test(out), 'checks: ' + out);
});
for (const role of ['anon', 'authenticated']) {
  for (const tb of ['custom_products', 'product_overrides']) {
    t(`after the lock: ${role} cannot read ${tb}`, () => {
      const r = as(role, `select * from public.${tb};`); ok(!r.ok && /permission denied/.test(r.out), r.out);
    });
    t(`after the lock: ${role} cannot write ${tb}`, () => {
      const r = as(role, `insert into public.${tb} (manufacturer, code) values ('x','y');`); ok(!r.ok && /permission denied/.test(r.out), r.out);
    });
  }
}
t('after the lock: the service role still reads and writes both tables (admin site, catalog-layers)', () => {
  const r = as('service_role', `select base_price from public.custom_products; select patch from public.product_overrides;
    insert into public.product_overrides (manufacturer, code, patch) values ('bemis','NEW','{}');`);
  ok(r.ok && /634\.86/.test(r.out), r.out);
});
t('a second policy for every role (any name) is dropped too; owner-only policies are left alone', () => {
  psql(`create policy extra_read on public.custom_products for select to anon using (true);
        create policy staff_only on public.custom_products for select to service_role using (true);`);
  psql(LOCK);
  const left = psql(`select string_agg(policyname, ',' order by policyname) from pg_policies where tablename='custom_products';`).trim();
  ok(left === 'staff_only', 'policies left: ' + left);
  psql('drop policy staff_only on public.custom_products;');
});
t('the lock is idempotent', () => { ok(/^t(\|t)+$/.test(psql(LOCK).trim().split('\n').pop()), 'second run'); });
t('its rollback restores exactly the old public read (and nothing more)', () => {
  const out = psql(file('p0_lock_layer_reads_rollback.sql')).trim().split('\n').pop(); ok(out === 't', out);
  ok(as('anon', 'select base_price from public.custom_products;').ok, 'anon reads again');
  const w = as('anon', `insert into public.custom_products (manufacturer, code) values ('x','z');`);
  ok(!w.ok && /permission denied/.test(w.out), 'no write grant given back: ' + w.out);
  psql(LOCK);
});
t('the read-only preflight runs and shows no public grant after the lock', () => {
  const out = psql(file('p0_lock_preflight.sql'));
  ok(!/\|anon\||\|authenticated\|/.test(out.split('\n').filter(l => l.startsWith('grant')).join('\n')), out);
  ok(/rows\|catalog_file_commercial\|bemis/.test(out), out);
});
t('no committed SQL file carries an UPDATE or DELETE (pg-safeupdate) — the rollback refuses instead', () => {
  for (const f of fs.readdirSync(SQL).filter(f => /^p0_/.test(f))) {
    const s = file(f).replace(/--.*$/gm, '');
    ok(!/\b(update|delete)\s+(from\s+)?public\./i.test(s), f + ' has an UPDATE/DELETE');
  }
});
t('no committed SQL file carries a price or a project URL', () => {
  for (const f of fs.readdirSync(SQL).filter(f => /^p0_/.test(f))) {
    const s = file(f); ok(!/supabase\.co/.test(s), f + ' names the project'); ok(!/\b\d+\.\d{2}\b/.test(s.replace(/--.*$/gm, '')), f + ' has a money-looking number');
  }
});
psql(`drop database if exists ${DB};`, 'postgres');
console.log(`\np0 SQL (PostgreSQL): ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
