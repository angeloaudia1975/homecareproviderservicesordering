-- PediFix pricing repair (P0 outage since 7 Nov): add the private record for the deployed pedifix.json (identity 03074e78…).
-- The deployed file differs from the stored 27 Oct record (158233…) ONLY in row P3020#0 (category moved). This copies the
-- 27 Oct record row for row and replaces that one row's fingerprint. Holds NO price; nothing else changes.
begin;
do $$
declare n int; ident text;
begin
  if exists (select 1 from public.catalog_file_commercial where manufacturer = 'pedifix'
               and identity_sha256 = '03074e782a068f5294035e532c78a1e2665d076edab35e53d941f1a6246dec5a') then
    raise notice 'already stored — nothing to do'; return;
  end if;
  select count(*) into n from public.catalog_file_commercial c, jsonb_array_elements(c.rows) x(e)
   where c.manufacturer = 'pedifix' and c.identity_sha256 = '158233406b5bbef820baf0fc05f9080f63e837ef6b33255a4b86b514bd1ecbe4'
     and x.e->>'k' = 'P3020#0';
  if n <> 1 then raise exception 'base record 158233… or its row P3020#0 not found (%), nothing written', n; end if;
  create temp table _p (k text, h text, ord jsonb, f jsonb, i bigint) on commit drop;
  insert into _p
  select x.e->>'k',
         case when x.e->>'k' = 'P3020#0' then 'c18c15173cc859c4c043c6b4ccd19d8fc5be3220aea30b0c5e402631be3ff415' else x.e->>'h' end,
         x.e->'order', coalesce(x.e->'f', '{}'::jsonb), x.i
    from public.catalog_file_commercial c, jsonb_array_elements(c.rows) with ordinality x(e, i)
   where c.manufacturer = 'pedifix' and c.identity_sha256 = '158233406b5bbef820baf0fc05f9080f63e837ef6b33255a4b86b514bd1ecbe4';
  select encode(sha256(convert_to(string_agg(h, E'\n' order by i), 'UTF8')), 'hex') into ident from _p;
  if ident <> '03074e782a068f5294035e532c78a1e2665d076edab35e53d941f1a6246dec5a' then
    raise exception 'the rows do not give the deployed identity (got %), nothing written', left(ident, 16);
  end if;
  insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
  select 'pedifix', ident,
         jsonb_agg(jsonb_build_object('k', k, 'h', h, 'order', ord, 'f', f) order by i), count(*),
         encode(sha256(convert_to(jsonb_agg(jsonb_build_object('k', k, 'h', h, 'f', f) order by i)::text, 'UTF8')), 'hex'),
         '7f1159abd86e47b2ec0d002de26e01efa4f991ff78482099d3defce042aad6a6', 'P3020 category fix, carried from 158233 (27 Oct)'
    from _p;
end $$;
select manufacturer, left(identity_sha256, 16) as version, row_count, source_ref
  from public.catalog_file_commercial where manufacturer = 'pedifix' order by updated_at;
commit;
