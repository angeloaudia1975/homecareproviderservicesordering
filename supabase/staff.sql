-- ============================================================================
-- HCPS — staff accounts & roles for the admin portal. Run this ONE file in
-- Supabase → SQL Editor (paste, Run). Safe to re-run.
--
-- Roles:  president  (full access, sees all money + every rep's notes/routes)
--         rep        (own accounts only; can plan/save routes if can_travel)
--         relations  (every dealer, no management powers — Phase 0K policy; see
--                     netlify/functions/_scope.js in the Sales admin repo)
-- A dealer's owner is dealers.rep_email (the person's sign-in email), Phase 0C/0D;
-- rep_name is kept for display.
--
-- No seeding needed: on an EMPTY table, only the address named in the
-- STAFF_BOOTSTRAP_EMAIL environment variable can sign in and become President
-- (Phase 0B). After that, only the President can add teammates.
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
