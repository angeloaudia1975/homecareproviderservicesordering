-- P0 read-only preflight (no writes): what the public key can reach on the two legacy layer tables, and
-- whether the private commercial table is filled. Run before AND after p0_lock_layer_reads.sql.
select 'policy' as kind, tablename as object, policyname as name, cmd || ' ' || roles::text as detail
  from pg_policies where schemaname = 'public' and tablename in ('custom_products', 'product_overrides', 'catalog_file_commercial')
union all
select 'grant', table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('custom_products', 'product_overrides', 'catalog_file_commercial')
   and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
 group by table_name, grantee
union all
select 'rows', 'catalog_file_commercial', manufacturer, 'identity ' || left(identity_sha256, 16) || ', ' || row_count::text || ' rows, ' || left(rows_sha256, 16) || ', seeded from ' || source_ref || ' at ' || to_char(updated_at, 'YYYY-MM-DD HH24:MI')
  from public.catalog_file_commercial
order by 1, 2, 3;
