-- ============================================================================
-- Partner 360 · Product Content — documents & videos
-- Adds per-product Documents (instructions, studies, brochures, warranty, manuals)
-- and Videos (YouTube/Vimeo links) that publish to the Partner 360 product page.
-- Run once. Safe to re-run.
-- ============================================================================
alter table public.product_content add column if not exists documents jsonb not null default '[]'::jsonb;
--  documents: [{ title, url, type, hosted }]  type = instructions|study|brochure|warranty|manual|other
alter table public.product_content add column if not exists videos jsonb not null default '[]'::jsonb;
--  videos: [{ title, url }]  (YouTube/Vimeo/hosted mp4 links)
