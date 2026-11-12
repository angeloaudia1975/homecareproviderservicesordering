-- Ohio Medical / GCE pricing review (owner 2026-11-12) — READ ONLY. Saved prices on the catalog edit layer, contract prices,
-- line discounts, account-number status (counts only — no account numbers) and order history for the line.
select
  (select jsonb_agg(jsonb_build_object('mfr', manufacturer, 'code', code, 'base_price', patch->'base_price', 'tiers', patch->'tiers',
            'msrp', patch->'msrp', 'map', patch->'map', 'active', patch->'active', 'image', patch->>'image')
          order by manufacturer, code)
     from public.product_overrides where manufacturer in ('ohio-medical', 'gce')) as saved_edits,
  (select count(*) from public.dealer_contract_prices where manufacturer in ('ohio-medical', 'gce')) as contract_prices,
  (select count(*) from public.dealer_line_discounts where manufacturer in ('ohio-medical', 'gce')) as line_discounts,
  (select jsonb_build_object(
            'active', count(*) filter (where active is not false),
            'with_account_no', count(*) filter (where active is not false and coalesce(trim(account_ref), '') <> ''),
            'verified', count(*) filter (where active is not false and verified_at is not null),
            'verified_and_matching', count(*) filter (where active is not false and verified_at is not null and verified_ref = account_ref))
     from public.dealer_manufacturers where manufacturer in ('ohio-medical', 'gce')) as accounts,
  (select jsonb_agg(jsonb_build_object('mfr', manufacturer, 'status', status, 'orders', n, 'first', f, 'last', l))
     from (select manufacturer, status, count(*) n, min(updated_at)::date f, max(updated_at)::date l
             from public.orders where manufacturer in ('ohio-medical', 'gce') group by 1, 2) s) as orders;
