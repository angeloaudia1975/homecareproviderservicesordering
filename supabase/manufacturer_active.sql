-- ============================================================================
-- HCPS — turn a whole manufacturer on/off on the ordering platform (no redeploy).
-- Run this ONE file in Supabase → SQL Editor (paste, Run). Safe to re-run.
-- Requires catalog.sql (manufacturer_meta) to have been run first.
--
-- Adds an "active" flag to manufacturer_meta. When set false, the ordering portal
-- hides that manufacturer everywhere — tabs, dealer-home cards, and the line count.
-- Managed from Admin → Catalog → "Manufacturers on the ordering platform".
-- ============================================================================

alter table manufacturer_meta add column if not exists active boolean not null default true;

do $$ begin raise notice '✅ manufacturer_meta.active added. Manage line visibility in Admin → Catalog.'; end $$;
