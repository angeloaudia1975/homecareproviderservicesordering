-- ============================================================================
-- HCPS — staff accounts & roles for the admin portal. Run this ONE file in
-- Supabase → SQL Editor (paste, Run). Safe to re-run.
--
-- Roles:  president  (full access, sees all money + every rep's notes/routes)
--         rep        (own accounts only; can plan/save routes if can_travel)
--         relations  (own accounts only; no travel/route tools)
-- rep_name matches dealers.rep so each person's book scopes automatically.
--
-- No seeding needed: the FIRST person to sign in on Admin → Staff (while this
-- table is empty) is auto-created as President. After that, only the President
-- can add teammates.
-- ============================================================================

create table if not exists staff_users (
  email      text primary key,           -- lowercased login email
  name       text,
  role       text not null default 'rep',    -- president | rep | relations
  rep_name   text,                            -- matches dealers.rep for scoping
  can_travel boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table staff_users enable row level security;   -- server (service role) only

do $$ begin raise notice '✅ staff_users ready. Open Admin → Staff and sign in to become President.'; end $$;
