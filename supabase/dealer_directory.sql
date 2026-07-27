-- HCPS Phase 2 — dealer directory (assignable rep owner + HCPS account #).
-- Keyed by the canonical dealer name used in monthly_sales, so it works before
-- dealer logins exist. Admin-only (service_role); the admin page writes via the
-- secure /assign function. Idempotent — safe to run once.
create table if not exists dealer_directory (
  dealer_name   text primary key,     -- matches monthly_sales.customer_name
  rep_name      text,                  -- assigned HCPS rep (owner)
  hcps_account  text,                  -- HCPS account number
  status        text,                  -- optional: active | prospect | lapsed
  notes         text,
  updated_at    timestamptz default now()
);
alter table dealer_directory enable row level security;
-- No public policy → only the service_role key (used by the Netlify functions) can read/write.
