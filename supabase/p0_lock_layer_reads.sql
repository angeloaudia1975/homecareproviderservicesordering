-- P0 SECURITY (2026-10-23, issue #2) — close custom_products and product_overrides to the public key.
-- Run by Angelo ONLY AFTER the storefront that reads these layers through catalog-layers is live and
-- verified (the deployed public/index.html must no longer read either table with the public key —
-- until then this would take added products, saved edits and their prices off the shop).
--
-- Today both tables carry a permissive SELECT policy for every role (USING (true)): anyone holding the
-- public key (it ships in the page) reads every added product's price and every saved edit's patch.
-- After this file: RLS stays on, every SELECT/ALL policy granted to public / anon / authenticated on
-- these two tables is dropped, and anon / authenticated hold no privilege at all. The service role
-- (admin site and storefront functions) is unaffected: it bypasses RLS and keeps its grants.
-- RULE 19: no new object; no view; outside check afterwards: scripts/p0-public-probe.js.
-- pg-safeupdate: no UPDATE or DELETE statement.
-- Preview first (read-only): supabase/p0_lock_preflight.sql. Rollback: p0_lock_layer_reads_rollback.sql.

begin;

do $$
declare p record;
begin
  for p in
    select tablename, policyname, cmd, roles
      from pg_policies
     where schemaname = 'public'
       and tablename in ('custom_products', 'product_overrides')
       and cmd in ('SELECT', 'ALL')
       and roles && array['public', 'anon', 'authenticated']::name[]
  loop
    raise notice 'dropping policy % on % (cmd %, roles %)', p.policyname, p.tablename, p.cmd, p.roles;
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.custom_products   enable row level security;
alter table public.product_overrides enable row level security;
revoke all on table public.custom_products   from public, anon, authenticated;
revoke all on table public.product_overrides from public, anon, authenticated;
grant select, insert, update, delete on table public.custom_products   to service_role;
grant select, insert, update, delete on table public.product_overrides to service_role;

commit;

-- Checks (every column must read true).
select
  (select count(*) = 0 from pg_policies where schemaname = 'public'
      and tablename in ('custom_products', 'product_overrides')
      and roles && array['public', 'anon', 'authenticated']::name[]) as no_public_policies,
  not has_table_privilege('anon', 'public.custom_products', 'select')            as anon_no_custom,
  not has_table_privilege('anon', 'public.product_overrides', 'select')          as anon_no_overrides,
  not has_table_privilege('authenticated', 'public.custom_products', 'select')   as auth_no_custom,
  not has_table_privilege('authenticated', 'public.product_overrides', 'select') as auth_no_overrides,
  has_table_privilege('service_role', 'public.custom_products', 'select')        as service_custom,
  has_table_privilege('service_role', 'public.product_overrides', 'select')      as service_overrides,
  (select relrowsecurity from pg_class where oid = 'public.custom_products'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.product_overrides'::regclass) as rls_on;
