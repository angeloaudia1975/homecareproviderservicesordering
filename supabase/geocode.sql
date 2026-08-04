-- ============================================================================
-- HCPS — geocoding cache for the Territory Map. Run this ONE file in
-- Supabase → SQL Editor (paste, Run). Safe to re-run.
--
-- We cache coordinates by the address text (not by dealer row) so that:
--   • re-importing your contact list (which rewrites dealer_addresses) never
--     loses the coordinates — they're keyed to the address, not the row;
--   • duplicate addresses are geocoded only once.
-- The Map page's "Geocode addresses" button fills this table via the free
-- US Census geocoder (no API key, US addresses).
-- ============================================================================

create table if not exists geocache (
  q           text primary key,      -- normalized "address, city, state zip"
  lat         double precision,
  lng         double precision,
  ok          boolean not null default false,
  geocoded_at timestamptz not null default now()
);

-- Private: only the server (service role) reads/writes this; the anon key can't.
alter table geocache enable row level security;

do $$ begin raise notice '✅ geocache ready. Open Admin → Map and click "Geocode addresses".'; end $$;
