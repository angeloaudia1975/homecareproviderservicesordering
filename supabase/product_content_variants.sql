-- ============================================================================
-- Partner 360 · Product Content — VARIANT-AWARE schema (parent → model variant)
-- Lets one parent product (e.g., Gen 2 Walking Boot) resolve into multiple model
-- variants, each with its own manufacturer page, image gallery, and specs, while
-- SKUs route to the correct model by their catalog `group`.
--
-- Standard rule (HCPS): any product whose SKUs span multiple MODELS / configurations
-- / image galleries under one parent MUST be modeled as one variant row per model,
-- routed to SKUs by catalog group. Never let one gallery serve multiple models.
--
-- Run once. Idempotent (IF NOT EXISTS). Safe on existing data (new cols are NULL).
-- ============================================================================

alter table public.product_content
  add column if not exists parent_key    text,   -- parent product's page_key (NULL = standalone/parent)
  add column if not exists variant_label text,    -- e.g. 'Tall Pneumatic'
  add column if not exists variant_group text,    -- catalog `group` this model maps to (SKU routing key)
  add column if not exists variant_order int,     -- display order within the family
  add column if not exists is_parent     boolean default false;  -- true for the family header row

alter table public.product_content_sources
  add column if not exists parent_key    text,
  add column if not exists variant_label text,
  add column if not exists variant_group text;

-- Fast lookups for the review screen (group children under a parent) and SKU routing.
create index if not exists product_content_parent_idx  on public.product_content (manufacturer, parent_key);
create index if not exists product_content_vgroup_idx  on public.product_content (manufacturer, variant_group);

-- Mark the existing Gen 2 record as the family PARENT (shared fallback; no SKU routes to it
-- directly once the model variants are approved).
update public.product_content
   set is_parent = true, variant_label = 'All models (parent)'
 where manufacturer = 'ovation-medical' and page_key = 'gen2-walking-boot';
