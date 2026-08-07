-- ============================================================================
-- HCPS ordering portal — per-product contract pricing
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
--
-- A row here sets a specific negotiated unit price for one product (identified by
-- its manufacturer slug + product code, matching the JSON catalog the portal serves)
-- for one dealer. When present, it overrides the catalog list/tier price for that
-- dealer only. Prices set on a master/HQ account also apply to its branches; a
-- branch's own row overrides the master's (resolved in dealer-auth.js `me`).
--
-- Read/written server-side with the service_role key (Dealer Manager writes,
-- dealer-auth returns each dealer ONLY their own prices). No public RLS policy,
-- so the table is not readable by anon or by a logged-in dealer directly.
-- ============================================================================

create table if not exists dealer_contract_prices (
  dealer_id    uuid not null references dealers(id) on delete cascade,
  manufacturer text not null,                     -- catalog manufacturer slug (e.g. 'access4u')
  code         text not null,                     -- product code as it appears in the catalog JSON
  name         text,                              -- product name at time of set (reference only)
  price        numeric(10,2) not null check (price >= 0),
  note         text,                              -- optional, e.g. '2026 contract'
  active       boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (dealer_id, manufacturer, code)
);

create index if not exists dcp_dealer_idx on dealer_contract_prices(dealer_id);

alter table dealer_contract_prices enable row level security;
-- No public / dealer-facing policy on purpose: only service_role (the admin API and
-- the dealer-auth function) can read or write. Dealers receive their own prices only
-- through the authenticated `me` response, never by querying this table directly.
