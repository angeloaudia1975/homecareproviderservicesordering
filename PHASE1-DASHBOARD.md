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

---

# Phase 2 — Reports, retail-margin math & exports  (shipped)

All added to **`dashboard.html`** (no backend change — the Phase 1 API already returns per-line data).

**Reports view** (nav item now live): year selector (each year + all-time), KPIs (spend, retail-revenue opportunity, margin opportunity, blended margin), a monthly-purchases chart, manufacturer performance bars, and a top-products table.

**Retail-margin math** — computed client-side, because MSRP/MAP live in the catalog JSON the portal already serves. `loadPricing()` builds a `(manufacturer|code) → {msrp, map, cost, category}` map from `/data/manufacturers.json` + each line's `/data/<slug>.json`. Per purchased line: **retail = MSRP × qty** when MSRP is on file, else **2× dealer cost** (flagged `est`); **margin = retail − spend**. As real MSRP/MAP get loaded per SKU, the estimates resolve to exact figures automatically.

**Exports** (client-side, no dependencies — CSV opens directly in Excel; PDF via the browser's print, with a print stylesheet that hides the chrome):
- **Order history → Excel** (My Orders): date, source, manufacturer, item #, product, qty, unit, line total, status.
- **Report → Excel**: manufacturer performance + top products with the MSRP-source note.
- **Pricing file → Excel** (in Reports): **SKU, manufacturer, description, dealer cost, MAP, MSRP, category** — for billing/ERP/inventory/POS.

**Note on MAP:** most catalog records carry MSRP but not MAP; the pricing export includes a MAP column that populates as MAP values are added to the catalog.

---

# Phase 3 — Productivity tools: favorites, quotes, pricing requests, branding  (shipped)

**New function `dealer-tools-api.js`** → **marketing** repo (`netlify/functions/`). One JWT-gated function, four actions:
`favorites_list` · `favorites_toggle {manufacturer,code}` · `branding_get` / `branding_set {logo_url}` · `pricing_request {manufacturer,code,product,current_price,quantity,competitor_note}` (stores + emails HCPS via Resend).

**Dashboard additions** (`dashboard.html`):
- **Quotes** (nav item now live): branded customer MSRP quote generator — pick any HCPS product, MSRP pulls from the catalog (2×-cost estimate where none on file), customer name + validity, dealer **logo branding**, live preview, print/PDF.
- **Favorites**: a dashboard quick-reorder card + a Favorites view (reorder / remove / request volume pricing). Hearts also live in the quote builder.
- **Volume-pricing request**: a modal (product, current price, anticipated quantity, competitive context) → `pricing_request` (stored + emailed to HCPS, reply-to the dealer).
- **Dealer branding**: logo shown in the top bar and on quotes; set via a logo URL, with an automatic **monogram fallback** from the business name. Persists via `branding_set` (and localStorage).
- **Order confirmations**: already handled by `orders-api` `create` (transactional Resend email on every saved order) — no new work.

**Resilience:** favorites and branding use the API as the source of truth with a **localStorage fallback**, so they work even before the DB migrations below are applied (per-device until then).

### Migrations (run once in Supabase)
```sql
-- favorites
create table if not exists favorites (
  dealer_id uuid not null,
  manufacturer text not null,
  code text not null,
  created_at timestamptz default now(),
  primary key (dealer_id, manufacturer, code)
);
-- volume-pricing requests
create table if not exists pricing_requests (
  id bigint generated always as identity primary key,
  dealer_id uuid not null,
  manufacturer text, code text, product text,
  current_price numeric, quantity int, competitor_note text,
  status text default 'new',
  created_at timestamptz default now()
);
-- dealer logo for portal + quote branding
alter table dealers add column if not exists logo_url text;
```
Optional env: `PRICING_REQUEST_TO` (defaults to `ORDER_TO` / orders@homecareproviderservices.us); `RESEND_API_KEY` already set.

### Auto-populating the dealer logo
`branding_get` also reads `dealers.website`; a later enhancement can derive a logo from the stored website (favicon/logo service) so the field pre-fills — today it falls back to the business-name monogram until a logo URL is set or uploaded.

---

# Phase 4 — Showroom, literature requests & shipment tracking  (shipped)

**`dealer-tools-api.js`** gained: `showroom_get` / `showroom_save {layout}`, `literature_request {manufacturer, items[], ship_to, note}` (store + email HCPS), and `tracking_request {order_ref, manufacturer, po, summary}` (store + email the manufacturer contact if on file, else HCPS).

**`orders-api.js`** — added an isolated, best-effort `sendTrackingRequests()` after the confirmation email in `create`, so **every order placed auto-fires** a tracking request to each manufacturer (their contact if on file, else HCPS), asking them to send tracking to the dealer and back to HCPS. Wrapped in try/catch — it never affects the saved order or the confirmation.

**Dashboard** (`dashboard.html`):
- **Showroom** (nav live): the HCPS Showroom Development Platform — a 12-zone floor builder, history-aware (the product picker stars items you've purchased; "Recommended fills" pulls from your purchases + favorites not yet on the floor). Live retail value + est. margin + lines represented per layout; save (persisted) + print planogram.
- **Resources** (nav live): the Manufacturer Literature Request Center (line, materials + quantities, ship-to, note → submitted through HCPS) plus dealer-support links.
- **My Orders**: a per-order **Request tracking** action (portal/Golden orders not yet delivered) → `tracking_request`. Also fixed the cache guard so My Orders always renders even after Reports has loaded the history.

### Migrations (run once in Supabase)
```sql
create table if not exists showrooms (
  dealer_id uuid primary key,
  layout jsonb,
  updated_at timestamptz default now()
);
create table if not exists literature_requests (
  id bigint generated always as identity primary key,
  dealer_id uuid not null, manufacturer text, items jsonb,
  ship_to text, note text, status text default 'new',
  created_at timestamptz default now()
);
create table if not exists tracking_requests (
  id bigint generated always as identity primary key,
  dealer_id uuid, order_ref text, manufacturer text, po text,
  summary text, status text default 'requested',
  created_at timestamptz default now()
);
-- optional: a per-manufacturer shipping/tracking contact (else requests go to HCPS)
alter table manufacturers add column if not exists contact_email text;
```

That completes the blueprint's Phases 1–4. **Phase 5** (Account Setup Center — digital credit apps, resale certs, per-line terms — and the intelligence layer: reorder-due, declining categories, crossover, whitespace) is the remaining slice.

---

# Phase 5 — Account Setup Center + purchase-data intelligence  (shipped)

The final blueprint slice. Two things: a digital **Account Setup Center** (the paperwork a dealer needs to open lines with manufacturers) and an **intelligence layer** on the dashboard that turns the dealer's own purchase history into next-step recommendations. **No credit-card data is captured or stored anywhere** — payment stays between the dealer and the manufacturing partner.

## Account Setup Center  (nav item "Account & Pricing" now live)
A single **Account & Pricing** view (`#view-account`, `loadAccountView` → `account_get` → `renderAccount`) with:
- **Business profile** — name + HCPS account, read from the auth profile.
- **Resale certificate** — reference # + state, saved via `resale_cert_set`. Status badge (on file / pending). The dealer emails the actual certificate file to HCPS to complete — we store only the reference, not the document.
- **Manufacturer credit application** — one clean form (legal name, EIN/Tax ID, years in business, bank reference, trade references, requested terms, note) submitted per line via `credit_application`. On submit it's **stored + emailed to HCPS**, and the email automatically notes whether a resale certificate is already on file so HCPS can forward both to the manufacturer together. **There are no card fields.**
- **Terms by line** — a credit-vs-prepay matrix across the dealer's carried lines, from admin-set `dealer_terms` (defaults to "—" until HCPS sets a line's terms). Prepay lines simply route the dealer to pay the manufacturer directly.
- **Submitted applications** — a running list with status.
- **Branding + pricing export** — the dealer logo control and the SKU/cost/MAP/MSRP pricing-file export, surfaced here too.
- A persistent **`🔒 HCPS stores no credit-card data`** notice on the view.

## Intelligence layer  (dashboard "Grow your business" card, `#dashOpps`)
Computed entirely client-side from the consolidated history + catalog pricing (`loadDashExtras` → `renderOpportunities`):
- **Due for reorder** — `reorderDueList()`: any (manufacturer|item) purchased ≥ 2 times whose last order was > 45 days ago, ranked by spend (top 4).
- **Declining categories** — `decliningCats()`: catalog category where this-year spend is down > 40% vs last year (and last year ≥ $400), so a slipping category surfaces before it's lost (top 3).
- **Whitespace lines** — `whitespaceLines()`: HCPS lines the dealer doesn't carry yet — click a chip to open an account for that line.
- **Showroom revenue opportunity** — a prompt into the Phase 4 floor builder to fill open zones.

## `dealer-tools-api.js` — three new actions (no card fields)
`account_get` (returns `{resale, applications[], terms[]}`) · `resale_cert_set {reference, state}` (upsert) · `credit_application {manufacturer, legal_name, ein, years_in_business, bank_ref, trade_refs, requested_terms, note}` (store + email HCPS, with resale-cert-on-file status included). All JWT-gated and dealer-scoped like the rest of the function.

### Migrations (run once in Supabase)
```sql
-- resale certificate reference (NOT the document; no card data)
create table if not exists resale_certs (
  dealer_id uuid primary key,
  reference text,
  state text,
  status text default 'pending',
  updated_at timestamptz default now()
);
-- manufacturer credit applications (NO card / bank-account numbers stored)
create table if not exists credit_applications (
  id bigint generated always as identity primary key,
  dealer_id uuid not null,
  manufacturer text not null,
  legal_name text, ein text, years_in_business text,
  bank_ref text, trade_refs text, requested_terms text, note text,
  status text default 'submitted',
  created_at timestamptz default now()
);
-- per-line credit vs prepay terms (admin-set)
create table if not exists dealer_terms (
  dealer_id uuid not null,
  manufacturer text not null,
  terms text,
  primary key (dealer_id, manufacturer)
);
```
Optional env: `CREDIT_APP_TO` (defaults to `ORDER_TO` / orders@homecareproviderservices.us).

**Resilience:** the view renders with graceful fallbacks — if a table isn't present yet, that section shows an empty/"—" state instead of erroring, so the center is usable before the migrations are applied.

That completes the blueprint's **Phases 1–5**. The dealer platform now spans consolidated history, reports & margin math, exports, favorites, branded quotes, volume-pricing requests, dealer branding, the showroom builder, literature requests, shipment tracking, the Account Setup Center, and purchase-data intelligence.
