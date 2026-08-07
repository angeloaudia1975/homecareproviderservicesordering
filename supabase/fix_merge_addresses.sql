-- ============================================================================
-- HCPS FIX — merging dealers was DELETING the merged-away dealer's extra
-- locations (dealer_addresses) and contacts (dealer_contacts), because those
-- tables cascade-delete with the loser row and the old merge_dealers() never
-- moved them to the survivor. This redefines merge_dealers() to FOLD every
-- address and contact up to the survivor first, so a merge never loses a
-- location or an email again.  Run this ONCE in Supabase → SQL Editor.
--
-- NOTE: this fixes FUTURE merges. Locations/contacts already lost to past
-- merges are restored by re-importing your master CSV (Dealer Manager →
-- Import contacts), which re-attaches each location to the merged survivor
-- via its alias. Then run Map → Geocode addresses. (See the message that
-- accompanied this file.)
-- ============================================================================

create or replace function merge_dealers(p_survivor uuid, p_losers uuid[]) returns void
language plpgsql security definer as $$
declare sname text; v_acct text;
begin
  select business_name into sname from dealers where id = p_survivor;
  if sname is null then raise exception 'survivor % not found', p_survivor; end if;
  p_losers := array(select unnest(p_losers) except select p_survivor);
  if array_length(p_losers,1) is null then return; end if;

  select coalesce(s.hcps_account,
           (select l.hcps_account from dealers l where l.id = any(p_losers) and l.hcps_account is not null limit 1))
    into v_acct from dealers s where s.id = p_survivor;

  update monthly_sales set dealer_id = p_survivor, customer_name = sname
    where dealer_id = any(p_losers)
       or (dealer_id is null and customer_name in (select business_name from dealers where id = any(p_losers)));

  update dealer_aliases set dealer_id = p_survivor where dealer_id = any(p_losers);
  insert into dealer_aliases(alias_norm, raw_name, dealer_id)
    select dealer_norm(business_name), business_name, p_survivor from dealers where id = any(p_losers)
    on conflict (alias_norm) do update set dealer_id = excluded.dealer_id;

  insert into dealer_manufacturers(dealer_id, manufacturer, active)
    select p_survivor, manufacturer, active from dealer_manufacturers where dealer_id = any(p_losers)
    on conflict (dealer_id, manufacturer) do nothing;

  -- >>> THE FIX: keep every location and every contact when folding losers in <<<
  insert into dealer_addresses(dealer_id, addr_key, address, city, state, zip, label, pri)
    select p_survivor, addr_key, address, city, state, zip, label, pri
      from dealer_addresses where dealer_id = any(p_losers)
    on conflict (dealer_id, addr_key) do nothing;
  insert into dealer_contacts(dealer_id, email, name, title, role, phone)
    select p_survivor, email, name, title, role, phone
      from dealer_contacts where dealer_id = any(p_losers)
    on conflict (dealer_id, email) do nothing;

  update dealers set hcps_account = null where id = any(p_losers);
  update dealers s set
      contact_name = coalesce(s.contact_name, l.contact_name),
      email        = coalesce(s.email,        l.email),
      phone        = coalesce(s.phone,        l.phone),
      address      = coalesce(s.address,      l.address),
      city         = coalesce(s.city,         l.city),
      state        = coalesce(s.state,        l.state),
      zip          = coalesce(s.zip,          l.zip),
      hcps_account = v_acct,
      status       = null,
      updated_at   = now()
    from (select * from dealers where id = any(p_losers) order by business_name limit 1) l
   where s.id = p_survivor;

  update dealer_directory set dealer_name = sname
    where dealer_name in (select business_name from dealers where id = any(p_losers))
      and not exists (select 1 from dealer_directory d2 where d2.dealer_name = sname);
  delete from dealer_directory
    where dealer_name in (select business_name from dealers where id = any(p_losers));

  delete from dealer_manufacturers where dealer_id = any(p_losers);
  delete from dealers where id = any(p_losers);
end $$;

do $$ begin raise notice 'merge_dealers() now keeps all addresses + contacts. Re-import your master CSV to restore ones lost to earlier merges, then geocode.'; end $$;
