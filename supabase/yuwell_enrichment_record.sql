-- P0 repair: add the commercial record for yuwell public file a457a4338f9815bc (9 rows), carried by
-- part number from an already-stored record of the same line. Holds NO price: commercial fields are copied inside the database.
begin;
create temp table _rb_new (k text primary key, h text not null, ord jsonb not null, i int not null) on commit drop;
insert into _rb_new (k, h, ord, i)
  select x->>'k', x->>'h', x->'order', (x->>'i')::int from jsonb_array_elements('[{"k":"SP-3#0","h":"0d1a68e15ccac30a9fd4c93d71a7fcd3e117cec53d037b9219a2884ebe64e7d2","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":1},{"k":"YE660E#0","h":"098fcc39e89d76b69200720dc6987bf8c0583fb5af81350f910f073992f16758","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":2},{"k":"YE620B#0","h":"3d7477014c48660f1270d4d5ab2b79562670a074bc1f5f025176c3cb04101071","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":3},{"k":"YE680B#0","h":"b84935e9ea64033e4aba439951f831fbce803c93c16fb3daaa3a2d852a029dc8","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":4},{"k":"YE8800AR#0","h":"f881c29f8988905a6cc43bc5d0acfefc809229171e4618373c5348bad67e54ae","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":5},{"k":"YT-1#0","h":"760d211daacdba66cdd64d214c0b5107c8398f7596d298c8c48c95e93b2fc77a","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":6},{"k":"YHT101#0","h":"5812bb5a415bb256bb6e621350b6d1e3be38b9fa6fe1356559abda1e02a7b5fd","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":7},{"k":"YX103#0","h":"87e9bf10165ace34224a4cd66b2db5d91c5afac159c82f1af2eed181fafc7434","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":8},{"k":"YX306#0","h":"eca475804c8250d603af05ae151df336d7be1fdb329ad755e64e1d515de844a2","order":["manufacturer","code","name","category","subcategory","brand","description","hcpc","uom","image","family","upc","msrp_auto"],"i":9}]'::jsonb) as t(x);
do $$
declare base text; n_new int; n_carried int; missing text; ident text;
begin
  if exists (select 1 from public.catalog_file_commercial where manufacturer = 'yuwell' and identity_sha256 = 'a457a4338f9815bc28c4710552572e8867b2ecc2143e39651664f0421a80b63f') then
    raise notice 'already stored — nothing to do'; return;
  end if;
  select encode(sha256(convert_to(string_agg(h, E'\n' order by i), 'UTF8')), 'hex') into ident from _rb_new;
  if ident <> 'a457a4338f9815bc28c4710552572e8867b2ecc2143e39651664f0421a80b63f' then raise exception 'the embedded rows do not give identity %', 'a457a4338f9815bc28c4710552572e8867b2ecc2143e39651664f0421a80b63f'; end if;
  select b into base from unnest(array['6f20b076a3524a085a6e95cfa996e1a1258e700c235654cd7e2c06d86e777dad']::text[]) with ordinality as u(b, o)
   where exists (select 1 from public.catalog_file_commercial c where c.manufacturer = 'yuwell' and c.identity_sha256 = u.b)
   order by o limit 1;
  if base is null then raise exception 'none of the base versions is stored for % — nothing written', 'yuwell'; end if;
  insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
  select 'yuwell', 'a457a4338f9815bc28c4710552572e8867b2ecc2143e39651664f0421a80b63f',
         jsonb_agg(jsonb_build_object('k', n.k, 'h', n.h, 'order', n.ord, 'f', coalesce(b.e->'f', '{}'::jsonb)) order by n.i),
         count(*),
         encode(sha256(convert_to(jsonb_agg(jsonb_build_object('k', n.k, 'h', n.h, 'f', coalesce(b.e->'f', '{}'::jsonb)) order by n.i)::text, 'UTF8')), 'hex'),
         '8280feee08accc5b5f1668c1242e0c55c1ef7e69262c86bb9f72ec822e341618', 'reseed-by-code 2026-11-14 from yuwell'
    from _rb_new n
    left join (select x.e from public.catalog_file_commercial c, jsonb_array_elements(c.rows) as x(e)
                where c.manufacturer = 'yuwell' and c.identity_sha256 = base) b on b.e->>'k' = n.k;
  select count(*) into n_new from _rb_new;
  select count(*) into n_carried from _rb_new n where exists (select 1 from public.catalog_file_commercial c, jsonb_array_elements(c.rows) x(e)
    where c.manufacturer = 'yuwell' and c.identity_sha256 = base and x.e->>'k' = n.k);
  select string_agg(k, ', ' order by i) into missing from _rb_new n where not exists (select 1 from public.catalog_file_commercial c, jsonb_array_elements(c.rows) x(e)
    where c.manufacturer = 'yuwell' and c.identity_sha256 = base and x.e->>'k' = n.k);
  raise notice 'base % · % of % rows carried · without a base row: %', left(base, 16), n_carried, n_new, coalesce(missing, 'none');
end $$;
select manufacturer, left(identity_sha256, 16) as version, row_count,
       (select count(*) from jsonb_array_elements(rows) x(e) where x.e->'f' = '{}'::jsonb) as rows_without_commercial_fields,
       (select string_agg(x.e->>'k', ', ') from jsonb_array_elements(rows) x(e) where x.e->'f' = '{}'::jsonb) as those_rows
  from public.catalog_file_commercial where manufacturer = 'yuwell' order by updated_at;
commit;
