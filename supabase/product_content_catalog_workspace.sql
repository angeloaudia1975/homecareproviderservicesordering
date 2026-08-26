-- ============================================================================
-- Partner 360 · Product Content → CATALOG MANAGEMENT WORKSPACE  (Phase 1: schema)
-- Turns the Enrichment & Review tool into a full catalog manager: SKU-level
-- control, a real product lifecycle (Active/Discontinued/Hidden/Published),
-- category/subcategory/family editing, spec + warranty fields, and a
-- change-history / undo log.
--
-- Run AFTER: product_content.sql · product_content_variants.sql ·
--            product_content_multisource.sql · product_content_docs.sql
-- Idempotent — safe to re-run.
--
-- ⚠ DEPLOY THE MATCHING product-content.js UPDATE AT THE SAME TIME.
--   This migration changes the PUBLIC visibility gate from  status='approved'
--   to  status IN ('published','active','discontinued')  and migrates every
--   existing 'approved' row to 'published', so nothing currently live goes dark
--   — but the Netlify function's public read filter must change in lockstep.
-- ============================================================================

-- 1) New catalog columns -----------------------------------------------------
alter table public.product_content
  add column if not exists subcategory  text,
  add column if not exists family       text,   -- display family / product line (grouping label)
  add column if not exists specs        jsonb not null default '[]'::jsonb, -- [{label,value}] or table rows
  add column if not exists warranty     text,
  add column if not exists published_at timestamptz,
  add column if not exists disabled     boolean not null default false;     -- whole-product suppress

-- 2) Expanded status lifecycle ----------------------------------------------
--    Review states : pending_review · approved · rejected
--    Catalog states: published · active · discontinued · hidden
--    Public (RLS)  : published · active · discontinued  (hidden + pre-publish = private)
alter table public.product_content drop constraint if exists product_content_status_check;
alter table public.product_content
  add constraint product_content_status_check
  check (status in ('pending_review','approved','rejected',
                    'published','active','discontinued','hidden'));

-- Keep the live catalog live: everything currently 'approved' (today's public
-- gate) becomes 'published', so the new Approve → Publish step is real without
-- any product going dark. Runs once; a no-op on re-run (no 'approved' rows left).
update public.product_content
   set status = 'published',
       published_at = coalesce(published_at, now())
 where status = 'approved';

-- 3) Public visibility gate (RLS) -------------------------------------------
drop policy if exists "product_content read approved" on public.product_content;
drop policy if exists "product_content read public"   on public.product_content;
create policy "product_content read public"
  on public.product_content
  for select
  to anon, authenticated
  using (status in ('published','active','discontinued')
         and coalesce(disabled, false) = false);

create index if not exists product_content_status_idx2
  on public.product_content (manufacturer, status);

-- 4) Change history / undo log ----------------------------------------------
create table if not exists public.product_content_history (
  id            bigint generated always as identity primary key,
  manufacturer  text not null,
  page_key      text,                 -- null for multi-row / bulk operations
  action        text not null,        -- set_status|set_meta|set_sku|move_skus|split|merge|create|save_sizing|save_content|bulk
  actor         text,
  summary       text,                 -- human-readable ("Split 4 SKUs into 'Posterior Night Splint'")
  before        jsonb,                -- snapshot(s) captured before the change — used by Undo
  after         jsonb,                -- snapshot(s) after the change
  undone        boolean not null default false,
  at            timestamptz not null default now()
);
alter table public.product_content_history enable row level security;
-- Internal only — written & read through the service-role Netlify function.
-- No anon/authenticated policy on purpose.
create index if not exists pch_mfr_at_idx
  on public.product_content_history (manufacturer, at desc);

-- 5) SKU object shape (documentation only; `skus` stays jsonb, normalized by the API)
--    Each SKU is an object:
--      { sku, name, size, hcpcs, group, status, disabled, image, images[], source }
--        status   : active | discontinued | hidden      (per-SKU lifecycle)
--        disabled : true  → suppressed from Partner 360 regardless of status
--        group    : catalog group used to route the SKU to a variant/model
--        source   : provenance label (hcps | website | pdf | manual)
--    The Netlify function normalizes legacy string SKUs (e.g. "61002") into
--    objects on first write, so no data migration is required here.

-- Verify (optional):
-- select status, count(*) from public.product_content group by status order by 1;
-- select column_name from information_schema.columns
--   where table_name='product_content' order by 1;
