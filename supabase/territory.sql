-- ============================================================================
-- HCPS — territory assignments: which manufacturer lines you represent in which
-- state. Run this ONE file in Supabase → SQL Editor (paste, Run). Safe to re-run.
--
-- Drives the map/route filters, the "opportunity" flags on each account (assigned
-- lines a dealer doesn't buy yet), and the target list. Managed from Admin → Territory.
-- ============================================================================

create table if not exists territory_lines (
  state        text not null,          -- 2-letter state code, e.g. TN
  manufacturer text not null,          -- manufacturer slug
  primary key (state, manufacturer)
);

alter table territory_lines enable row level security;   -- server (service role) only

do $$ begin raise notice '✅ territory_lines ready. Open Admin → Territory to assign your lines by state.'; end $$;
