-- P0 rollback of supabase/p0_lock_layer_reads.sql. Run by Angelo only.
-- THIS REOPENS THE EXPOSURE: every added product's price and every saved edit becomes readable with
-- the public key again. It exists for one case only — a storefront still reading these tables with the
-- public key had to be restored. Do not run it because a problem is merely suspected (RULE 19).
-- It restores exactly what existed before: a SELECT policy USING (true) for every role, and SELECT for
-- anon / authenticated. Nothing else (no write grant) is given back.
begin;
create policy custom_products_read   on public.custom_products   for select to public using (true);
create policy product_overrides_read on public.product_overrides for select to public using (true);
grant select on table public.custom_products   to anon, authenticated;
grant select on table public.product_overrides to anon, authenticated;
commit;
select has_table_privilege('anon', 'public.custom_products', 'select')
   and has_table_privilege('anon', 'public.product_overrides', 'select') as reopened;
