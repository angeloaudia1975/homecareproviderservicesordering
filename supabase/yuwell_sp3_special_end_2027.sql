-- ============================================================================
-- Yuwell — END the SPIRIT-3 (SP-3) 4+ unit special on Jan 1, 2027 (owner 2026-11-04: "after Jan 1st the price
-- moves up to the regular price regardless of quantity").  Run on/after Jan 1, 2027 in the Supabase SQL editor
-- of the ORDERING project. Contains NO prices: it only removes the SP-3 quantity break and its special note
-- from the private commercial record, so every SP-3 quantity prices at the regular dealer price again.
-- Refuses (writes nothing) unless the stored record is exactly version 1 (overlay 166d2f99…). Idempotent:
-- a second run finds overlay e31d7475… and does nothing. Shipping is unchanged (SP-3 orders still ship free).
-- ============================================================================
begin;
do $end$
declare v1 constant text := '166d2f99ccd7e24bf6498b1c39aeb896e0e9bbc9315bf8a79794092ed867b7eb';
        v2 constant text := 'e31d74757798400a9772863290638651e6db750f39fe05513f9891fd1602ddaf';
        id constant text := '6f20b076a3524a085a6e95cfa996e1a1258e700c235654cd7e2c06d86e777dad';
        cur text; n int;
begin
  select rows_sha256 into cur from public.catalog_file_commercial where manufacturer = 'yuwell' and identity_sha256 = id;
  if cur is null then raise exception 'no Yuwell version 6f20b076… is stored — nothing written'; end if;
  if cur = v2 then raise notice 'the SP-3 special was already removed — nothing to do'; return; end if;
  if cur <> v1 then raise exception 'the stored Yuwell record is not version 1 (overlay %) — nothing written', left(cur,16); end if;
  if (select rows->0->>'k' from public.catalog_file_commercial where manufacturer = 'yuwell' and identity_sha256 = id) <> 'SP-3#0'
    then raise exception 'row 0 is not SP-3 — nothing written'; end if;
  update public.catalog_file_commercial
     set rows = jsonb_set((rows #- '{0,f,tiers}') #- '{0,f,price_note}', '{0,order}',
                ((rows->0->'order') - 'tiers') - 'price_note'),
         rows_sha256 = v2,
         source_ref = 'SP-3 special ended 2027-01-01 (owner)',
         updated_at = now()
   where manufacturer = 'yuwell' and identity_sha256 = id and rows_sha256 = v1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'expected to update 1 record, updated % — rolled back', n; end if;
end $end$;
commit;
-- Verify: SP-3 has no quantity break and no special note any more
select left(rows_sha256,16) as overlay, rows->0->>'k' as sku, (rows->0->'f') ? 'tiers' as has_break, (rows->0->'f') ? 'price_note' as has_note
  from public.catalog_file_commercial where manufacturer = 'yuwell';
