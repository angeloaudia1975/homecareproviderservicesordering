-- ============================================================================
-- Partner 360 · Product Content Enrichment & Review — multi-source extension
-- Adds per-field provenance, a per-image gallery (approve/primary/dup), and
-- sizing/spec tables to the existing product_content table.
-- Run AFTER product_content.sql. Idempotent — safe to re-run.
--
-- Connect 360 location: Online Ordering → Product Management →
--                       Product Content Enrichment & Review
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-source raw captures. One row per (product page, source). The review
--    tool reads these three rows (HCPS / website / pdf) and merges them into
--    the resolved product_content row above.
-- ---------------------------------------------------------------------------
create table if not exists public.product_content_sources (
  id            uuid primary key default gen_random_uuid(),
  manufacturer  text not null,
  page_key      text not null,
  source        text not null
                  check (source in ('hcps','website','pdf')),   -- provenance label
  source_label  text,                        -- 'Current HCPS Data' / 'Manufacturer Website' / 'Manufacturer PDF'
  source_url     text,                        -- website URL or PDF file name
  captured_at   timestamptz not null default now(),

  -- raw field captures from THIS source (any may be null/empty)
  name          text,
  tagline       text,
  description   text,
  features              jsonb not null default '[]'::jsonb,
  clinical_applications jsonb not null default '[]'::jsonb,
  options               jsonb not null default '{}'::jsonb,
  billing_codes         jsonb not null default '[]'::jsonb,
  images        jsonb not null default '[]'::jsonb,   -- [{url,role,w,h,hash,caption}]
  sizing_rows   jsonb not null default '[]'::jsonb,   -- [{sku,product,color,size,fit,height,...}]
  raw           jsonb,                                -- anything else the importer captured
  unique (manufacturer, page_key, source)
);

alter table public.product_content_sources enable row level security;
-- Source captures are internal review data — no public read policy.
-- Only the Netlify function (service role) touches this table.
create index if not exists pcs_mfr_page_idx
  on public.product_content_sources (manufacturer, page_key);

-- ---------------------------------------------------------------------------
-- 2. Extend the resolved product_content row with provenance + merged gallery
--    + sizing. These are what actually publish to Partner 360 once approved.
-- ---------------------------------------------------------------------------
alter table public.product_content
  add column if not exists field_provenance jsonb not null default '{}'::jsonb,
  --  e.g. {"description":"website","features":"pdf","billing_codes":"pdf","name":"hcps"}
  --  records which source each published field's "best version" came from.
  add column if not exists images_gallery   jsonb not null default '[]'::jsonb,
  --  [{url, source, role:'angle|front|side|primary', approved:bool,
  --    primary:bool, duplicate:bool, hash, w, h, caption}]
  add column if not exists sizing_table     jsonb not null default '[]'::jsonb,
  --  [{sku, product, color, size, fit, height}]  — the reviewed sizing/spec chart
  add column if not exists sizing_note       text,
  --  e.g. 'For left or right foot. Available in Black & White.'
  add column if not exists enrichment_flags jsonb not null default '{}'::jsonb;
  --  {"new":6,"conflict":1,"missing":2,"duplicate":1} — the review summary counts

-- Backfill primary image onto the legacy `image` column when one is chosen,
-- so the portal's existing Product Detail read keeps working unchanged.
-- (Handled by the Netlify function on approve; nothing to migrate here.)

-- ---------------------------------------------------------------------------
-- 3. Convenience view: the review queue. One row per product page with a
--    rolled-up count of how many sources have been captured.
-- ---------------------------------------------------------------------------
create or replace view public.product_content_review_queue as
select
  c.manufacturer,
  c.page_key,
  c.name,
  c.status,
  c.enrichment_flags,
  c.updated_at,
  coalesce(s.source_count, 0)          as sources_captured,
  coalesce(s.sources, '[]'::jsonb)     as sources
from public.product_content c
left join (
  select manufacturer, page_key,
         count(*)               as source_count,
         jsonb_agg(source)      as sources
  from public.product_content_sources
  group by manufacturer, page_key
) s using (manufacturer, page_key);

-- The view inherits RLS from product_content (approved-only for the public);
-- the review tool reads it through the service-role function, which sees all.
