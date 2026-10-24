-- P0 SECURITY (2026-10-23, issue #2) — the PRIVATE home of the catalog files' commercial fields.
-- Run by Angelo in the Supabase SQL editor, after review and approval. Claude never runs it.
--
-- WHAT: one row per manufacturer line AND public-file version. `rows` is the commercial half of that
-- version of the line's static catalog file (public/data/<slug>.json): one entry per catalog row,
-- {k: "<code>#<occurrence>", h: <sha256 of that public row's non-commercial fields, canonical JSON>,
-- order: [... the row's original keys ...], f: { base_price, tiers, dealer_price, tier_prices, msrp,
-- map, price_note, unit_cost, shipping — whichever the row had }}. The public file keeps everything else.
--
-- VERSION INTEGRITY (P0 review, 2026-10-23): `identity_sha256` is the identity of the public file the
-- record belongs to = sha256 of its rows' `h` values joined by a newline, in file order. Consumers
-- (catalog-layers, the admin server) compute the identity of the public file they actually hold and use
-- ONLY the record with that identity; every row is checked again against its own `h` as it is restored.
-- Primary key (manufacturer, identity_sha256): the next version of a line is seeded BEFORE the storefront
-- that publishes it is deployed, the old one is pruned after verification — no window in which a public
-- file is priced from another version's record. The guard trigger below refuses a record whose entries
-- lack a fingerprint, key, order or fields, whose keys repeat, or whose identity is not its fingerprints'.
-- Filled by scripts/p0-seed-catalog-commercial.js --apply (service role, run by Angelo), never by a
-- committed SQL file — this repository is public, so no price may ever be written into it.
--
-- WHO READS IT: only the service role — the storefront's catalog-layers function (after it has
-- checked the dealer's entitlement) and the admin site's server functions.
--
-- RULE 19 (database objects are not private by default):
--   · RLS: ON, with NO policies — anon and authenticated match nothing even if a grant reappears.
--   · Grants: revoke all from public, anon, authenticated; the service role keeps select / insert /
--     update / delete (it bypasses RLS). No view is created.
--   · Outside check after the run: scripts/p0-public-probe.js (public key → 401 / 42501 expected).
-- pg-safeupdate: this file contains no UPDATE or DELETE statement.
-- Rollback: supabase/p0_catalog_file_commercial_rollback.sql (refuses while any row exists).

begin;

-- An earlier draft of this table (keyed by manufacturer only, no fingerprints) must never be kept by the
-- "if not exists" below: refuse, so it is dropped (it can only exist empty, before the seed) and recreated.
do $$
begin
  if to_regclass('public.catalog_file_commercial') is not null and not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'catalog_file_commercial' and column_name = 'identity_sha256') then
    raise exception 'catalog_file_commercial exists in an earlier draft shape (no identity_sha256) — run p0_catalog_file_commercial_rollback.sql first';
  end if;
end $$;

create table if not exists public.catalog_file_commercial (
  manufacturer    text not null check (manufacturer ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  identity_sha256 text not null check (identity_sha256 ~ '^[0-9a-f]{64}$'),
  rows            jsonb not null check (jsonb_typeof(rows) = 'array'),
  row_count     integer not null check (row_count >= 0),
  rows_sha256   text not null check (rows_sha256 ~ '^[0-9a-f]{64}$'),
  public_sha256 text not null check (public_sha256 ~ '^[0-9a-f]{64}$'),
  source_ref    text not null check (length(source_ref) between 1 and 80),
  updated_at    timestamptz not null default now(),
  constraint catalog_file_commercial_pkey primary key (manufacturer, identity_sha256),
  constraint catalog_file_commercial_count check (jsonb_array_length(rows) = row_count)
);

comment on table public.catalog_file_commercial is
  'P0 2026-10-23: commercial fields of public/data/<slug>.json, one row per line and public-file version (identity_sha256). PRIVATE: RLS on, no policies, service role only.';

-- Guard (every insert / update, whoever writes): the record is internally sound and its identity is
-- exactly its rows' fingerprints. sha256() is built into PostgreSQL 11+ (no extension needed).
create or replace function public.catalog_file_commercial_guard() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
declare
  bad   integer;
  keys  integer;
  ident text;
begin
  if new.rows is null or jsonb_typeof(new.rows) <> 'array' then
    raise exception 'catalog_file_commercial: rows must be a list (one entry per catalog row)';
  end if;
  select count(*) into bad
    from jsonb_array_elements(new.rows) as x(e)
   where jsonb_typeof(e) is distinct from 'object'
      or jsonb_typeof(e->'k') is distinct from 'string'
      or jsonb_typeof(e->'h') is distinct from 'string'
      or coalesce(e->>'h', '') !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(e->'order') is distinct from 'array'
      or jsonb_typeof(e->'f') is distinct from 'object';
  if bad > 0 then
    raise exception 'catalog_file_commercial: % commercial row(s) without a key, identity fingerprint (h), key order or fields', bad;
  end if;
  select count(distinct e->>'k') into keys from jsonb_array_elements(new.rows) as x(e);
  if keys <> jsonb_array_length(new.rows) then
    raise exception 'catalog_file_commercial: the commercial rows are not one per catalog row (repeated key)';
  end if;
  select encode(sha256(convert_to(coalesce(string_agg(e->>'h', E'\n' order by i), ''), 'UTF8')), 'hex') into ident
    from jsonb_array_elements(new.rows) with ordinality as x(e, i);
  if ident is distinct from new.identity_sha256 then
    raise exception 'catalog_file_commercial: identity_sha256 is not the identity of these rows'' fingerprints';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.catalog_file_commercial_guard() from public, anon, authenticated;

drop trigger if exists catalog_file_commercial_guard on public.catalog_file_commercial;
create trigger catalog_file_commercial_guard before insert or update on public.catalog_file_commercial
  for each row execute function public.catalog_file_commercial_guard();

alter table public.catalog_file_commercial enable row level security;
revoke all on table public.catalog_file_commercial from public, anon, authenticated;
grant select, insert, update, delete on table public.catalog_file_commercial to service_role;

commit;

-- Install checks (the SQL editor shows only this last result): every column must read true.
select
  (select relrowsecurity from pg_class where oid = 'public.catalog_file_commercial'::regclass) as rls_on,
  (select count(*) = 0 from pg_policies where schemaname = 'public' and tablename = 'catalog_file_commercial') as no_policies,
  not has_table_privilege('anon', 'public.catalog_file_commercial', 'select,insert,update,delete') as anon_none,
  not has_table_privilege('authenticated', 'public.catalog_file_commercial', 'select,insert,update,delete') as authenticated_none,
  has_table_privilege('service_role', 'public.catalog_file_commercial', 'select') and
  has_table_privilege('service_role', 'public.catalog_file_commercial', 'insert') as service_role_rw,
  not has_function_privilege('anon', 'public.catalog_file_commercial_guard()', 'execute') as guard_not_public,
  exists (select 1 from pg_trigger where tgrelid = 'public.catalog_file_commercial'::regclass
            and tgname = 'catalog_file_commercial_guard' and tgenabled = 'O') as guard_on,
  (select array_agg(a.attname order by a.attnum)::text = '{manufacturer,identity_sha256}'
     from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.catalog_file_commercial'::regclass and c.contype = 'p') as keyed_by_version;
