-- HCPS Partner 360 — admin dealer-preview tokens
-- Short-lived, read-only capability tokens that let authorized HCPS staff open the
-- Partner 360 ordering portal "as" a dealer (impersonation/preview) WITHOUT that dealer's
-- login and WITHOUT assigning staff email to the dealer account.
--
-- Flow:
--   1) Staff clicks "View Dealer Partner 360 Portal" in Dealer 360 & CRM.
--   2) dealers-api (preview_link) verifies the staff JWT, inserts one row here, and returns
--      <ORDERING_BASE>/?preview=<token>.
--   3) The portal validates the token via dealer-auth (preview) and order-history-api
--      (Bearer preview:<token>), loading that dealer's context READ-ONLY until expiry.
--
-- Security: tokens are opaque, single-dealer-scoped, expire quickly (default 30 min), and grant
-- READ-ONLY access only. Writes (orders, cart, account changes) are blocked in the portal's
-- preview mode and none of the preview code paths perform writes. Rows are validated with the
-- service role only; never exposed to the browser.
-- Shared Supabase project (same database as the main site + ordering portal).

create table if not exists public.dealer_preview_tokens (
  token       text primary key,
  dealer_id   uuid not null references public.dealers(id) on delete cascade,
  created_by  text,                                   -- staff email that minted it (audit)
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz                             -- first time the portal consumed it (audit)
);

create index if not exists dealer_preview_tokens_dealer_idx  on public.dealer_preview_tokens(dealer_id);
create index if not exists dealer_preview_tokens_expires_idx on public.dealer_preview_tokens(expires_at);

-- RLS on, no policies: only the service role (used by the Netlify functions) can touch this table.
alter table public.dealer_preview_tokens enable row level security;

-- Optional housekeeping: purge expired tokens. Safe to run anytime; the functions also ignore
-- expired rows at read time, so this is only to keep the table small.
--   delete from public.dealer_preview_tokens where expires_at < now() - interval '1 day';
