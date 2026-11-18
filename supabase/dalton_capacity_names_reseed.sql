-- Dalton R11 (owner decision 2026-11-18): disputed weight capacities removed from four product NAMES in the public catalog
-- file (public/data/dalton.json). A name is part of each row's identity fingerprint, so the new file version needs its own
-- private commercial record BEFORE it is deployed. This copies the stored record of the CURRENT version row for row and
-- replaces ONLY the four rows' fingerprints. No price or commercial field is typed, read out or changed.
--   A-WA1200BR, COM-300F-4, TB-5006-2, A-RHB1037  (TB-5006KDHD-2 is NOT touched)
--   current version 04d3bd510304a571…  →  new version c14a4bd6b5cc07c8…   (339 rows)
-- Safe to run twice: the second run changes nothing.
begin;
do $$
declare
  base_rows jsonb; new_rows jsonb; ident text; changed int;
  fp jsonb := '{"A-WA1200BR#0":["1b75fd1aa62ae89b8a683174f4601fd2ed3fa7d55d5801853e5febe012c674e2","bf2ed7900d1a43b97cdb272d6a29495576fd3b7f87709f35c768c1ca347c5d60"],
                "COM-300F-4#0":["ffb0187cd662d6a8a39adbafdd227350c7feee42d8ff3b2a75aae866ec4a7021","05913204534d8d65695cb6ca8cd2bdb7e0c666cf67e5df067de16adcd4348f33"],
                "TB-5006-2#0":["9453215709a2739e50cdfca8e5f7b63035c4c0637d5c740012881fe1a923f52f","94484b869f67be6074bc59b3ff093f4a6ed5bc343dee051157151a1d984adc33"],
                "A-RHB1037#0":["195b24568c5b6ddc846bfe7973070d18d81df2f41f51ad36e6350ef5879697db","f2826ed028e95f01dc4101ddcc4c6756202c81691f21d41fd0396cc249f6f26b"]}'::jsonb;
begin
  if exists (select 1 from public.catalog_file_commercial where manufacturer = 'dalton'
             and identity_sha256 = 'c14a4bd6b5cc07c85bb8b8af302465ac379e78b6e487661e95fa1ae9db379538') then
    raise notice 'already stored — nothing to do'; return;
  end if;
  select rows into base_rows from public.catalog_file_commercial
   where manufacturer = 'dalton' and identity_sha256 = '04d3bd510304a5717a29b074d6b6b14ef66fc5023f54d24e6a8e401ba5dde201';
  if base_rows is null then raise exception 'the current Dalton record (04d3bd51…) is not stored — nothing written'; end if;
  select count(*) into changed from jsonb_array_elements(base_rows) e where fp ? (e->>'k') and e->>'h' = fp->(e->>'k')->>0;
  if changed <> 4 then raise exception 'expected the 4 rows with their current fingerprints, found % — nothing written', changed; end if;
  select jsonb_agg(case when fp ? (e->>'k') then jsonb_set(e, '{h}', fp->(e->>'k')->1) else e end order by o)
    into new_rows from jsonb_array_elements(base_rows) with ordinality t(e, o);
  select encode(sha256(convert_to(string_agg(e->>'h', E'\n' order by o), 'UTF8')), 'hex')
    into ident from jsonb_array_elements(new_rows) with ordinality t(e, o);
  if ident <> 'c14a4bd6b5cc07c85bb8b8af302465ac379e78b6e487661e95fa1ae9db379538' then
    raise exception 'the new rows do not give the expected identity (got %) — nothing written', ident;
  end if;
  insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
  select 'dalton', ident, new_rows, jsonb_array_length(new_rows),
         encode(sha256(convert_to((select jsonb_agg(jsonb_build_object('k', e->'k', 'h', e->'h', 'f', e->'f') order by o)
                                   from jsonb_array_elements(new_rows) with ordinality t(e, o))::text, 'UTF8')), 'hex'),
         '34aa4760d8aec7de78e1ff0154ac8e07c560c313b5f10fb2725e1550c62fb21c', 'R11 Dalton capacity names 2026-11-18';
end $$;
-- verification (expect two Dalton versions; the new one 339 rows, same rows without commercial fields as the current one)
select left(identity_sha256, 16) as version, row_count,
       (select count(*) from jsonb_array_elements(rows) x(e) where x.e->'f' = '{}'::jsonb) as rows_without_commercial_fields,
       source_ref
  from public.catalog_file_commercial where manufacturer = 'dalton'
   and identity_sha256 in ('04d3bd510304a5717a29b074d6b6b14ef66fc5023f54d24e6a8e401ba5dde201', 'c14a4bd6b5cc07c85bb8b8af302465ac379e78b6e487661e95fa1ae9db379538')
 order by updated_at;
commit;
