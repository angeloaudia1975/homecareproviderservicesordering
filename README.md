# HCPS Consolidated Ordering Platform

A standalone dealer ordering portal for HomeCare Provider Services — one site for all
manufacturer partners (except Golden, which keeps its own portal). Order capture +
sales analytics only; no inventory, stock, or shipment tracking.

## Status
- **Phase 1 (this build):** HCPS-branded portal front end. Manufacturer tabs, category
  browsing, product cards, cart, and an order form. Data comes from `public/data/*.json`.
  Complete Medical Supplies is loaded with the full catalog — 473 products across 17
  categories with quantity-tier pricing (plus `tiers`, `upc`, and `msrp` carried in the
  JSON for the Phase-2 `price_tiers` import). Other manufacturers show a "soon" tab until
  their product data is loaded. Product images live in
  `public/assets/products/complete-medical-supplies/`; the portal retries a lowercased
  filename on load error, so image paths resolve whether the files are upper- or
  lowercase in the repo.
- **Phase 2 (next):** Supabase back end — products/pricing in the database, dealer logins
  (Supabase Auth), per-dealer custom pricing (Row-Level Security), and order submission
  writing to the DB. Set `CONFIG.DATA_SOURCE="supabase"` in `index.html` and fill the keys.
  **Per-dealer line access:** not every dealer can order every manufacturer (a dealer only
  represents certain lines in their state/territory). HCPS assigns each dealer their allowed
  lines via the `dealer_manufacturers` table; once logged in, a dealer sees and orders ONLY
  those lines — the portal filters the manufacturer tabs to them and RLS gates catalog reads
  (see the Phase-2 policy block in `supabase/schema.sql`).
- **Phase 3:** Admin (product/price/dealer management + monthly sales-report upload) and
  analytics cross-referenced by HCPS account number.

## Updating the catalog (adding products + images)
GitHub's web uploader accepts at most **100 files per drag-and-drop**. To stay under that,
catalog updates are delivered as **two separate things**, never one bundle:

1. **Data/code update** — just the changed text files (`public/data/<slug>.json`, and
   `public/index.html` only if the front end changed). Small; commit directly on GitHub.
2. **New images** — a separate package containing only the new image files, ready to drop
   into `public/assets/products/<slug>/`. If a single update brings **more than ~90 new
   images**, they're split into multiple ≤90-file batches (`images-batch-1.zip`,
   `images-batch-2.zip`, …) so each GitHub web upload stays under the 100-file cap.

Image references in the JSON point at `public/assets/products/<slug>/<file>`. The portal
retries a lowercased filename on load error, so casing mismatches self-heal — but the file
must exist in the folder or the card shows "No image". Add the image batches first (or
alongside) the JSON so products render with pictures.

Tip: the 100-file limit is only the **web** uploader. GitHub Desktop or `git` on the
command line have no such cap — a full folder can be committed at once that way.

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
dealer's email from the form). The order emails HCPS only. The function accepts a
grouped payload (`{ dealer, orders:[...] }`) and sends **one email per manufacturer**;
it returns `{ ok, sent, total, results:[...] }`.

## Multi-manufacturer cart, per-manufacturer PO, and freight
A single cart can hold items from several manufacturers. At checkout the cart **groups
by manufacturer**: each group has its own **required PO number** (one PO can never span
two manufacturers), its own notes, its own freight, and its own subtotal/total. Submitting
sends a **separate order email per manufacturer**, each with that manufacturer's PO.

Freight rules live per manufacturer in `manufacturers.json` under a `freight` object:

```
"freight": {
  "summary": "shown at the top of the manufacturer's cart block",
  "actualNote": "shown when a group ships at actual (unquoted) freight",
  "groups": [
    { "label": "Blue Jay", "brandKeywords": ["bluejay","blue jay"], "freeAt": 400 },
    { "label": "Drive & Compass", "brandKeywords": ["drive","devilbiss","compass"], "freeAt": 750 }
  ],
  "otherLabel": "Other brands",   // items matching no group
  "elseActual": true              // unmatched items ship at actual freight
}
```

Per group: items are matched by `brandKeywords` (substring match on the product's `brand`;
`"*"` matches everything). If the group subtotal reaches `freeAt` it's **free**; a
`flatUnder` value (e.g. Bemis `40`) is added as a flat fee below the threshold; otherwise
the group ships at **actual freight** (no fee added, shown with `actualNote`). The dealer
sees free-freight progress ("add $X to reach free"), and any flat fee is included in the
estimated total. Complete Medical uses brand-group thresholds (Blue Jay $400, Drive+Compass
$750, everything else actual); Bemis is free at $500 / $40 flat under. MSRP is shown on
product cards wherever a `msrp` value is present.

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
