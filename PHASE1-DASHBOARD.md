# Phase 1 — Dealer Business Hub: consolidated order history + dashboard shell

This slice adds the **data spine** and the **dashboard front door** for the Dealer Business Platform.
No existing function was modified; nothing writes new data.

## What was built (2 files)

1. **`order-history-api.js`** → goes in the **marketing** repo:
   `homecareproviderservices/netlify/functions/order-history-api.js`
   (that's where the live dealer functions run — `dealer-auth`, `orders-api`, `events-api`, `analytics` — and where `CONFIG.*_ENDPOINT` in the portal already points).
   Dealer-scoped, JWT-gated. Two actions:
   - `{action:"summary"}` → `{ dealer, ytd, allTime, byManufacturer[], monthly[], recent[] }` (dashboard)
   - `{action:"history", limit?, year?}` → `{ dealer, orders[] }` (My Orders)
   It **consolidates two sources** already on the one HCPS Supabase:
   - `monthly_sales` (imported sales, 2025→) → source `"imported"`
   - `orders` + `order_items` (portal orders saved by `orders-api`; future Golden) → source `"portal"` / `"golden"`

2. **`dashboard.html`** → goes in the **ordering** repo:
   `homecareproviderservicesordering/public/dashboard.html`
   The Dealer Business Hub shell: sticky top bar, the 8-area nav (Dashboard + My Orders live this phase; the other areas are visible but marked "coming in a later phase"), YTD/all-time KPIs, a consolidated **Recent orders** list tagged by source, a monthly-purchases chart, a by-manufacturer breakdown, and a full **My Orders** table. It reuses the portal's exact auth (`hcps_session` in localStorage → `dealer-auth {action:"me"}`), so any dealer already signed into the portal lands straight in.

## Env vars — nothing new
`order-history-api` uses the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` the other functions already use. CORS is enabled in the function, so the ordering site (`hcpsonlineordering.netlify.app`) can call it cross-origin exactly like it calls `dealer-auth` today. The dashboard embeds the same public Supabase URL + anon key already in the portal's `CONFIG` (safe to embed).

## Two schema assumptions to confirm
1. **`monthly_sales.dealer_id`** exists and is populated (the admin/CRM analytics selects it, so it should). History is scoped by `dealer_id`. If some 2025 rows have a null `dealer_id`, they won't attribute — a one-time backfill (match `customer_name` → `dealers.business_name` / aliases) closes that gap.
2. **Golden detection** is currently inferred from `orders.env` containing "golden". When the Golden federation sync lands, tag its rows so they surface as Golden (a dedicated `source` column on `orders`, or the `env` convention — either works; adjust the one line in `consolidate()`).

## Wiring the dashboard in (portal `index.html`)
Add a link for approved dealers in the portal header, e.g.:
`<a href="/dashboard.html">My Business Hub</a>` (show it when `AUTH.status==='approved'`).
Optionally make `/dashboard.html` the post-login landing for returning dealers.

## Deploy
- Commit `order-history-api.js` to the **marketing** repo → deploys with that site's functions.
- Commit `dashboard.html` to the **ordering** repo → deploys with the portal.
- No migration, no env changes.

## Verify
Sign in as a dealer that has `monthly_sales` rows (and/or saved portal orders) → the dashboard shows YTD + all-time purchases, the monthly chart, the manufacturer breakdown, and a consolidated recent-orders list; **My Orders** lists every record with its source. A dealer with no history sees a clean empty state.

## Next (Phase 2)
Retail-revenue & margin (MSRP/MAP, 2×-cost fallback) on Reports, Excel/PDF export, and the productivity tools — all read from this same consolidated view, so they're additive.
