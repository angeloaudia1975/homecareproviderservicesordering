-- P0 rollback of supabase/p0_catalog_file_commercial.sql. Run by Angelo only.
-- Refuses while the table holds any row: the storefront reads prices from it once the new code is
-- live, so emptying it would take every price off the shop. Roll the CODE back first (redeploy the
-- previous storefront commit, with its priced public files) — only then empty the table (service
-- role) and run this. Never run it as a reaction to a suspected problem: investigate first (RULE 19).
begin;
do $$
begin
  if to_regclass('public.catalog_file_commercial') is not null
     and exists (select 1 from public.catalog_file_commercial) then
    raise exception 'catalog_file_commercial still holds rows — roll the storefront code back and empty it first';
  end if;
end $$;
drop table if exists public.catalog_file_commercial;
drop function if exists public.catalog_file_commercial_guard();
drop function if exists public.catalog_file_commercial_touch();   -- the earlier draft's trigger function, if it was ever installed
commit;
select to_regclass('public.catalog_file_commercial') is null as table_gone;
