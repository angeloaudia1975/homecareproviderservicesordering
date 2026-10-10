-- Server-computed freight stored on each order (2026-10-09, Strongback accessory S&H).
-- The order total a dealer saw = the total emailed = the total stored. Run BEFORE pushing the code
-- that writes these columns (orders-api create). Additive and idempotent; existing orders are untouched.
alter table public.orders add column if not exists freight_fee numeric(10,2);
alter table public.orders add column if not exists estimated_total numeric(10,2);
comment on column public.orders.freight_fee is 'Freight the server computed with the storefront''s freight rule when the order was placed (null = not computed, e.g. Golden).';
comment on column public.orders.estimated_total is 'subtotal + freight_fee, as recorded by the server.';
