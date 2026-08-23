-- ============================================================================
-- Partner 360 · product-content enrichment layer + approval gate
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================
create extension if not exists pgcrypto;

create table if not exists public.product_content (
  id                    uuid primary key default gen_random_uuid(),
  manufacturer          text not null,               -- e.g. 'ovation-medical'
  page_key              text not null,               -- product-page key (image basename), covers all its SKU sizes
  name                  text,
  tagline               text,
  description           text,
  features              jsonb  not null default '[]'::jsonb,
  clinical_applications jsonb  not null default '[]'::jsonb,
  options               jsonb  not null default '{}'::jsonb,
  billing_codes         jsonb  not null default '[]'::jsonb,
  image                 text,
  category              text,
  sku_count             int,
  skus                  jsonb  not null default '[]'::jsonb,
  source_pages          text,
  source_files          jsonb,
  confidence            numeric,
  msrp_rule             text,
  status                text not null default 'pending_review'
                          check (status in ('pending_review','approved','rejected')),
  reviewed_by           text,
  updated_at            timestamptz not null default now(),
  unique (manufacturer, page_key)
);

-- Row Level Security: this IS the server-side approved-only gate.
alter table public.product_content enable row level security;

drop policy if exists "product_content read approved" on public.product_content;
create policy "product_content read approved"
  on public.product_content
  for select
  to anon, authenticated
  using (status = 'approved');

-- No anon INSERT/UPDATE/DELETE policy is created on purpose.
-- All writes go through the Netlify function `product-content` using the
-- SUPABASE_SERVICE_ROLE key, which bypasses RLS. Never expose that key in the browser.

create index if not exists product_content_mfr_status_idx
  on public.product_content (manufacturer, status);
