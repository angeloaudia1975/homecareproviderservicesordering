-- HCPS Phase 2 — Contact/address importer support.
-- Adds a per-line account-number column and an import RPC that the Dealer Manager's
-- "Import contacts" tab calls. Idempotent; safe to run more than once.
-- Run AFTER dealer_master.sql (needs dealer_norm, dealer_aliases, dealers).

-- 1) Store the manufacturer account number on each line-access row.
alter table dealer_manufacturers add column if not exists account_ref text;

-- 2) import_dealer_contacts(rows, create): for each company row —
--      • resolve to a dealer via its normalized name (alias first, then business_name);
--      • if none and p_create, create the dealer (status 'prospect') + its alias;
--      • fill address / city / state / zip / contact / email / phone (never wipe with blanks);
--      • turn on line access for each provided line and record its account number.
--    Returns a summary {matched, created, updated, entitlements, unmatched[]}.
create or replace function import_dealer_contacts(p_rows jsonb, p_create boolean default true)
returns jsonb language plpgsql security definer as $$
declare
  r jsonb; ln jsonb; v_id uuid; v_norm text; nm text;
  matched int:=0; created int:=0; updated int:=0; ents int:=0;
  unmatched jsonb:='[]'::jsonb;
begin
  for r in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) as t(value) loop
    nm := btrim(coalesce(r->>'company',''));
    if nm = '' then continue; end if;
    v_norm := dealer_norm(nm);

    select dealer_id into v_id from dealer_aliases where alias_norm = v_norm;
    if v_id is null then
      select id into v_id from dealers where dealer_norm(business_name) = v_norm limit 1;
    end if;

    if v_id is null then
      if not p_create then
        unmatched := unmatched || to_jsonb(nm);
        continue;
      end if;
      insert into dealers(business_name, active, status)
        values (nm, true, 'prospect')
        on conflict (business_name) do update set business_name = excluded.business_name
        returning id into v_id;
      insert into dealer_aliases(alias_norm, raw_name, dealer_id)
        values (v_norm, nm, v_id) on conflict (alias_norm) do nothing;
      created := created + 1;
    else
      matched := matched + 1;
    end if;

    update dealers set
        address      = coalesce(nullif(r->>'address',''), address),
        city         = coalesce(nullif(r->>'city',''),    city),
        state        = coalesce(nullif(r->>'state',''),   state),
        zip          = coalesce(nullif(r->>'zip',''),     zip),
        contact_name = coalesce(nullif(r->>'contact',''), contact_name),
        email        = coalesce(nullif(r->>'email',''),   email),
        phone        = coalesce(nullif(r->>'phone',''),   phone),
        updated_at   = now()
      where id = v_id;
    updated := updated + 1;

    for ln in select value from jsonb_array_elements(coalesce(r->'lines','[]'::jsonb)) as t(value) loop
      insert into dealer_manufacturers(dealer_id, manufacturer, active, account_ref)
        values (v_id, ln->>'slug', true, nullif(ln->>'account',''))
      on conflict (dealer_id, manufacturer) do update
        set active = true,
            account_ref = coalesce(nullif(excluded.account_ref,''), dealer_manufacturers.account_ref);
      ents := ents + 1;
    end loop;
  end loop;

  return jsonb_build_object('matched',matched,'created',created,'updated',updated,'entitlements',ents,'unmatched',unmatched);
end $$;
