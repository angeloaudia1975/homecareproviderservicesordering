-- ============================================================================
-- HCPS Consolidated Ordering Platform — Supabase schema (Phase 1 foundation)
-- Run in the Supabase SQL editor. Safe to re-run (uses IF NOT EXISTS / creates).
-- No inventory / stock / shipment tracking by design — order capture + analytics.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Manufacturers (tabs across the top of the portal)
-- ---------------------------------------------------------------------------
create table if not exists manufacturers (
  slug        text primary key,
  name        text not null,
  accent      text default '#1681c2',
  dark        text default '#10263f',
  logo        text,
  sort        int  default 0,
  active      boolean default true
);

-- ---------------------------------------------------------------------------
-- Products (one row per orderable item, grouped by manufacturer + category)
-- base_price is the default/list dealer price; per-dealer overrides live in
-- dealer_pricing. price_tiers holds optional quantity-break pricing.
-- ---------------------------------------------------------------------------
create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  manufacturer text not null references manufacturers(slug) on delete cascade,
  code         text not null,                 -- item / SKU code
  name         text not null,
  category     text,
  subcategory  text,
  brand        text,
  description  text,
  hcpc         text,                          -- HCPC / billing code (optional)
  uom          text,                          -- unit of measure / pack
  base_price   numeric(10,2),
  price_note   text,                          -- free-text tier note from catalog
  image        text,                          -- /assets/... path or URL
  active       boolean default true,
  sort         int default 0,
  created_at   timestamptz default now(),
  unique (manufacturer, code)
);
create index if not exists products_mfr_idx on products(manufacturer);
create index if not exists products_cat_idx on products(manufacturer, category);

-- Optional base quantity-break tiers (applies to all dealers unless overridden)
create table if not exists price_tiers (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  min_qty     int  not null default 1,
  price       numeric(10,2) not null
);
create index if not exists price_tiers_product_idx on price_tiers(product_id);

-- ---------------------------------------------------------------------------
-- Dealers — each dealer has an HCPS account number and (optionally) a login.
-- auth_user_id links to Supabase Auth so a dealer sees their own pricing/orders.
-- ---------------------------------------------------------------------------
create table if not exists dealers (
  id             uuid primary key default gen_random_uuid(),
  hcps_account   text unique not null,        -- HCPS-assigned account number
  business_name  text not null,
  contact_name   text,
  email          text,
  phone          text,
  address        text,
  city           text,
  state          text,
  zip            text,
  auth_user_id   uuid unique,                 -- = auth.users.id after invite
  active         boolean default true,
  created_at     timestamptz default now()
);

-- Per-dealer custom pricing (account-specific price and/or tiers).
-- If a row exists for (dealer, product), it overrides base_price/price_tiers.
create table if not exists dealer_pricing (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references dealers(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  min_qty     int  not null default 1,
  price       numeric(10,2) not null,
  unique (dealer_id, product_id, min_qty)
);
create index if not exists dealer_pricing_dealer_idx on dealer_pricing(dealer_id);

-- ---------------------------------------------------------------------------
-- Orders + line items (order capture; HCPS reviews then places with manufacturer)
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid references dealers(id),
  hcps_account  text,                          -- denormalized for reporting
  manufacturer  text references manufacturers(slug),
  status        text default 'submitted',      -- submitted | reviewed | placed | cancelled
  po_number     text,
  notes         text,
  ship_name     text, ship_address text, ship_city text, ship_state text, ship_zip text,
  contact_name  text, contact_email text, contact_phone text,
  subtotal      numeric(12,2) default 0,
  submitted_at  timestamptz default now()
);
create index if not exists orders_dealer_idx on orders(dealer_id);
create index if not exists orders_acct_idx on orders(hcps_account);

create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  uuid references products(id),
  code        text,
  name        text,
  qty         int not null,
  unit_price  numeric(10,2),
  line_total  numeric(12,2)
);
create index if not exists order_items_order_idx on order_items(order_id);

-- ---------------------------------------------------------------------------
-- Monthly sales reports (uploaded per manufacturer, cross-referenced by account)
-- One row per line of an imported report. period = first day of the month.
-- ---------------------------------------------------------------------------
create table if not exists monthly_sales (
  id            uuid primary key default gen_random_uuid(),
  manufacturer  text references manufacturers(slug),
  period        date not null,                 -- e.g. 2026-06-01
  hcps_account  text,                          -- matched to dealers.hcps_account
  dealer_id     uuid references dealers(id),
  product_code  text,
  product_name  text,
  qty           numeric(12,2),
  amount        numeric(12,2),
  source_file   text,
  imported_at   timestamptz default now()
);
create index if not exists monthly_sales_period_idx on monthly_sales(manufacturer, period);
create index if not exists monthly_sales_acct_idx on monthly_sales(hcps_account);

-- ---------------------------------------------------------------------------
-- Analytics helper view: sales by dealer + manufacturer + month
-- ---------------------------------------------------------------------------
create or replace view v_sales_by_account as
select manufacturer, period, hcps_account,
       sum(qty) as units, sum(amount) as revenue, count(*) as lines
from monthly_sales
group by manufacturer, period, hcps_account;

-- ---------------------------------------------------------------------------
-- Row-Level Security
--   * anon/public: read manufacturers + active products (browse catalog)
--   * authenticated dealer: read their own dealer row, dealer_pricing, orders
--   * admin work (imports, pricing edits, reading all orders) uses the
--     service_role key from a Netlify function and bypasses RLS.
-- ---------------------------------------------------------------------------
alter table manufacturers  enable row level security;
alter table products       enable row level security;
alter table price_tiers    enable row level security;
alter table dealers        enable row level security;
alter table dealer_pricing enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table monthly_sales  enable row level security;

-- Public catalog reads
create policy pub_mfr  on manufacturers for select using (active);
create policy pub_prod on products      for select using (active);
create policy pub_tier on price_tiers   for select using (true);

-- Dealer can read their own dealer record
create policy dealer_self on dealers for select
  using (auth_user_id = auth.uid());

-- Dealer can read their own custom pricing
create policy dealer_price on dealer_pricing for select
  using (dealer_id in (select id from dealers where auth_user_id = auth.uid()));

-- Dealer can read/insert their own orders
create policy dealer_orders_sel on orders for select
  using (dealer_id in (select id from dealers where auth_user_id = auth.uid()));
create policy dealer_orders_ins on orders for insert
  with check (dealer_id in (select id from dealers where auth_user_id = auth.uid()));
create policy dealer_items_sel on order_items for select
  using (order_id in (select id from orders where dealer_id in
        (select id from dealers where auth_user_id = auth.uid())));
create policy dealer_items_ins on order_items for insert with check (true);

-- monthly_sales has NO public/dealer policy → only service_role (admin) can read/write.
