-- P0 SECURITY (2026-10-23, issue #2) — the PRIVATE home of the catalog files' commercial fields.
-- Run by Angelo in the Supabase SQL editor, after review and approval. Claude never runs it.
--
-- WHAT: one row per manufacturer line. `rows` is the commercial half of that line's static catalog
-- file (public/data/<slug>.json): one entry per catalog row, {k: "<code>#<occurrence>", order: [...
-- the row's original keys ...], f: { base_price, tiers, dealer_price, tier_prices, msrp, map,
-- price_note, unit_cost, shipping — whichever the row had }}. The public file keeps everything else.
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

create table if not exists public.catalog_file_commercial (
  manufacturer  text primary key check (manufacturer ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  rows          jsonb not null check (jsonb_typeof(rows) = 'array'),
  row_count     integer not null check (row_count >= 0),
  rows_sha256   text not null check (rows_sha256 ~ '^[0-9a-f]{64}$'),
  public_sha256 text not null check (public_sha256 ~ '^[0-9a-f]{64}$'),
  source_ref    text not null check (length(source_ref) between 1 and 80),
  updated_at    timestamptz not null default now(),
  constraint catalog_file_commercial_count check (jsonb_array_length(rows) = row_count)
);

comment on table public.catalog_file_commercial is
  'P0 2026-10-23: commercial fields of public/data/<slug>.json. PRIVATE: RLS on, no policies, service role only.';

create or replace function public.catalog_file_commercial_touch() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.catalog_file_commercial_touch() from public, anon, authenticated;

drop trigger if exists catalog_file_commercial_touch on public.catalog_file_commercial;
create trigger catalog_file_commercial_touch before insert or update on public.catalog_file_commercial
  for each row execute function public.catalog_file_commercial_touch();

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
  not has_function_privilege('anon', 'public.catalog_file_commercial_touch()', 'execute') as touch_not_public;
