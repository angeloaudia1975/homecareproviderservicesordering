-- HCPS Partner 360 — curated related products & cross-manufacturer alternatives (cross-sell)
-- Powers two things on the ordering portal's product detail page:
--   • "Related products / accessories" — hand-curated (AI-assisted) items to cross-sell, replacing
--     the naive same-category guess when curated rows exist.
--   • "Also available from other HCPS manufacturers" — similar products from OTHER brands so a dealer
--     can compare options by need without knowing which manufacturer carries what.
--
-- Written by staff from the Catalog Review (product-content.js: save_related, President/admin only).
-- Read by the portal with the anon key, so it has a permissive SELECT policy. Denormalized
-- (related_name / related_image / related_category) so the portal renders the cross-brand strip
-- WITHOUT loading every other manufacturer's catalog. Shared Supabase project.

create table if not exists public.product_related (
  id                   uuid primary key default gen_random_uuid(),
  manufacturer         text not null,               -- product this relation is FOR
  code                 text not null,               -- ...its primary SKU code
  related_manufacturer text not null,
  related_code         text not null,
  related_name         text,
  related_image        text,
  related_category     text,
  kind                 text not null default 'accessory',   -- 'accessory' | 'alternative'
  sort                 int  default 0,
  created_by           text,
  created_at           timestamptz not null default now(),
  unique (manufacturer, code, related_manufacturer, related_code)
);
create index if not exists product_related_for_idx on public.product_related(manufacturer, code);

alter table public.product_related enable row level security;

-- Portal (anon) may READ; only the service role (Netlify functions) writes.
drop policy if exists product_related_read on public.product_related;
create policy product_related_read on public.product_related for select using (true);
