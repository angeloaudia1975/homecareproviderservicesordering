-- HCPS Phase 2 — Featured Products store for the "Featured for you" strip.
-- Admin stars products to feature; the ordering portal reads this table to build
-- each dealer's Featured strip (filtered to the lines the dealer is entitled to).
-- Idempotent. Run once in Supabase.

create table if not exists featured_products (
  manufacturer text not null,          -- line slug, e.g. "golden-technologies"
  code         text not null,          -- product code within that line
  name         text,                   -- cached display name (optional)
  note         text,                   -- short promo note shown under the tile
  rank         int  not null default 0,-- lower = shown first
  active       boolean not null default true,
  updated_at   timestamptz default now(),
  primary key (manufacturer, code)
);
create index if not exists featured_products_rank_idx on featured_products(active, rank);
alter table featured_products enable row level security;

-- The ordering portal reads this with the anon key (no sensitive data — just which
-- products are promoted). Writes happen server-side via the featured-api service role.
drop policy if exists "featured_products public read" on featured_products;
create policy "featured_products public read" on featured_products for select using (true);
