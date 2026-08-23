# Partner 360 — Product Content: Supabase write + approved-only gate

The product-content system now runs on Supabase with a real approval gate. Dealers see
**only `status = 'approved'`** content; everything else stays invisible until HCPS approves it.

## Architecture

```
Manufacturer PDF / website
        │  (ovation-importer.py — extract + MSRP = single-unit × 2)
        ▼
product_content  (Supabase table, status = 'pending_review')   ← seed SQL loads Ovation
        │
   Admin review screen  ──POST──►  Netlify fn `product-content`  ──service role──►  status = 'approved'
        │                                                              (bypasses RLS)
        ▼
Partner 360 Product Detail page  ──reads product_content WHERE status='approved'──►  dealers
                                     (RLS also enforces approved-only server-side)
```

## One-time setup (3 steps)

**1. Create the table + RLS** — Supabase → SQL editor → run:
- `supabase/product_content.sql`  (table + the approved-only RLS policy)
- `supabase/product_content_ovation_seed.sql`  (loads the 25 Ovation pages as drafts)

**2. Set Netlify environment variables** (Site settings → Environment):
- `SUPABASE_URL` — your project URL (already used elsewhere)
- `SUPABASE_SERVICE_ROLE` — the **service role** key (server-only secret; never in the browser)
- `CONTENT_ADMIN_TOKEN` — any long random string; HCPS staff enter this in the review screen

**3. Deploy** — commit + push. Netlify publishes:
- `netlify/functions/product-content.js` — the write/read API
- `public/admin/product-content-review.html` — the review screen
- `public/index.html` — reads approved content (gate on)

## Daily workflow

1. Open **`/admin/product-content-review.html`**, enter the admin token.
2. Review each page (edit inline if needed), click **Approve** (or **Approve all pending**).
   - Approving writes `status='approved'` to Supabase via the function.
3. Dealers immediately see the approved content on the product pages. Nothing else shows.

## Notes

- **Gate is enforced twice:** the browser requests `status=eq.approved`, and Supabase RLS only
  returns approved rows to the public key — so even a crafted request can't read drafts.
- **MSRP rule:** import applies `MSRP = single-unit price × 2` (fixed). Change per-manufacturer in the importer.
- **Offline preview:** opening the review screen without a token (or off-network) shows a local
  preview and an "Export approved content" download — handy for spot-checks; live approvals need the token.
- **Next manufacturers:** run `ovation-importer.py` adapted per line → push drafts via the function's
  `upsert` action (or a seed SQL) → review → approve.
- The static `public/data/content/<mfr>.json` remains a fallback the portal uses only if Supabase
  returns nothing; it respects the same approved-only gate (`CONFIG.CONTENT_APPROVED_ONLY`).
