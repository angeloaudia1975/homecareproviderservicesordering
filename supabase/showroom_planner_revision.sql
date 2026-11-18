-- Keep the floor planner and the older zone editor independent within each location's layout.
create function public.merge_showroom_planner() returns trigger
language plpgsql set search_path = '' as $$
declare previous jsonb;
begin
  if tg_op = 'UPDATE' then previous := old.layout; end if;
  if new.layout ? 'floor_planner' then
    if new.layout->'floor_planner'->>'location' is distinct from new.dealer_id::text then
      raise exception 'Showroom location mismatch';
    end if;
    if (new.layout->'floor_planner'->>'revision')::bigint is distinct from
       (coalesce((previous->'floor_planner'->>'revision')::bigint, 0) + 1) then
      raise exception 'Showroom changed; reopen before saving';
    end if;
    if tg_op = 'UPDATE' then
      new.layout := coalesce(previous, '{}'::jsonb) || jsonb_build_object('floor_planner',new.layout->'floor_planner');
    end if;
  elsif previous ? 'floor_planner' then
    new.layout := coalesce(new.layout,'{}'::jsonb) || jsonb_build_object('floor_planner',previous->'floor_planner');
  end if;
  return new;
end $$;
-- A POST upsert runs BEFORE INSERT even on conflict. Check new rows after insertion,
-- and existing rows under their row lock in BEFORE UPDATE.
create trigger showroom_planner_insert after insert on public.showrooms
for each row execute function public.merge_showroom_planner();
create trigger showroom_planner_update before update on public.showrooms
for each row execute function public.merge_showroom_planner();
