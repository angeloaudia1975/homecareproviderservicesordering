# HCPS Consolidated Ordering Platform

A standalone dealer ordering portal for HomeCare Provider Services — one site for all
manufacturer partners (except Golden, which keeps its own portal). Order capture +
sales analytics only; no inventory, stock, or shipment tracking.

## Status
- **Phase 1 (this build):** HCPS-branded portal front end. Manufacturer tabs, category
  browsing, product cards, cart, and an order form. Data comes from `public/data/*.json`.
  Complete Medical Supplies is loaded with the full catalog — 467 products across 17
  categories with quantity-tier pricing (plus `tiers`, `upc`, and `msrp` carried in the
  JSON for the Phase-2 `price_tiers` import). Other manufacturers show a "soon" tab until
  their product data is loaded. Product images live in
  `public/assets/products/complete-medical-supplies/`; the portal retries a lowercased
  filename on load error, so image paths resolve whether the files are upper- or
  lowercase in the repo.
- **Phase 2 (next):** Supabase back end — products/pricing in the database, dealer logins
  (Supabase Auth), per-dealer custom pricing (Row-Level Security), and order submission
  writing to the DB. Set `CONFIG.DATA_SOURCE="supabase"` in `index.html` and fill the keys.
- **Phase 3:** Admin (product/price/dealer management + monthly sales-report upload) and
  analytics cross-referenced by HCPS account number.

## Run locally
Any static server pointed at `public/` (e.g. `npx serve public`). It's a static site.

## Deploy
New Netlify site from this repo. Build settings: publish directory `public`
(see `netlify.toml`). Link it from the main HCPS site's "Online Ordering".

## Order emails (Resend)
Submitted carts are emailed to HCPS by the Netlify function
`netlify/functions/submit-order.js` (endpoint `/.netlify/functions/submit-order`,
already wired as `CONFIG.ORDER_ENDPOINT` in `index.html`). It formats the cart into
a branded HTML + plain-text order email and sends it via Resend on the
`homecareproviderservices.us` domain — the same provider/domain the main site's
contact form uses. No npm dependencies (uses the runtime's native `fetch`).

Set these in Netlify → Site settings → Environment variables:
- `RESEND_API_KEY` **(required)** — the Resend key for `homecareproviderservices.us`.
- `ORDER_TO` *(optional)* — recipient(s), comma-separated. Default `orders@homecareproviderservices.us`.
- `ORDER_FROM` *(optional)* — From header. Default `HCPS Ordering Portal <orders@homecareproviderservices.us>`.

Replies to the order email go to the dealer (the function sets `reply_to` to the
dealer's email from the form). The order currently emails HCPS only; a dealer
confirmation copy can be added later. Test after deploy by submitting a cart; the
function returns `{ ok:true, id }` and the email lands in `orders@`.

## Supabase (Phase 2 setup)
1. Create a new Supabase project (separate from Golden's).
2. In the SQL editor, run `supabase/schema.sql`.
3. Load products: import each `public/data/<manufacturer>.json` into the `products` table
   (script provided in Phase 2), or manage them in the DB.
4. In Netlify env vars set `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public) and
   `SUPABASE_SERVICE_ROLE` (server-only, for the admin/import function).
5. In `index.html` set `CONFIG.DATA_SOURCE="supabase"` and the URL + anon key.

## Data model (see supabase/schema.sql)
manufacturers · products · price_tiers · dealers (HCPS account #) · dealer_pricing
· orders · order_items · monthly_sales · v_sales_by_account (analytics view)

## Product JSON shape (per manufacturer, in public/data/<slug>.json)
```
{ "manufacturer","code","name","category","subcategory","brand",
  "description","hcpc","uom","base_price","price_note","image" }
```
