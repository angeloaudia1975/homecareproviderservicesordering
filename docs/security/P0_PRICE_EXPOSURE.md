# P0 — dealer price exposure: audit, design, rollout (issue #2)

Branch `security/p0-dealer-price-exposure` in **homecareproviderservicesordering** (storefront) and
**homecareproviderservices** (admin + server pricing). Prepared 2026-10-23. Nothing here has been run
against production; every production step below is Angelo's, in the order given.

## 1. Audit — every public path that carried a commercial fact

Method: read both repositories end to end for every reader of the catalog files and the layer tables; read-only
GET probes of the live storefront and of Supabase REST with the **public** key (the key that ships in
`public/index.html`). No credentials other than the public key were used.

### 1.1 Exposure table

| # | Path | Who could read it | What it carried | Severity | Status on this branch |
|---|------|-------------------|-----------------|----------|-----------------------|
| 1 | `/data/<slug>.json` — 11 catalog files (incl. the retired `complete-medical-supplies.json`, not in `manufacturers.json` but still served) | anyone | `base_price`, `tiers`, MSRP, MAP, `price_note` (breaks in dollars), Access4U `dealer_price` / `tier_prices`, Corsicana per-item `shipping`, Bemis `unit_cost` — 1,593 rows | **P0** | **Fixed**: every commercial key removed from the published files; the commercial half moves to a private table |
| 2 | REST `custom_products` (policy `custom_products_read`, `USING (true)`) | anyone with the public key | 379 added products incl. `base_price`, `msrp`, `map`, `tiers`, `msrp_auto`, `price_note` | **P0** | Storefront no longer reads it; **lock SQL ready** (`supabase/p0_lock_layer_reads.sql`), run only after the new storefront is live |
| 3 | REST `product_overrides` (policy `product_overrides_read`, `USING (true)`) | anyone with the public key | 676 saved edits; patches carry `base_price` (296), `tiers` (361), `msrp` (247), `map` (44), `price_note` (273) | **P0** | same as #2 |
| 4 | `/admin/Analytics` (any case variant of the redirected `/admin/analytics`) | anyone | the old analytics deploy note: per-line **sales and commission totals** (Golden, Access4U, Ohio Medical, PediFix, Feb 2026 / YTD) | **P0 (financial)** | **Fixed**: file deleted from `public/` |
| 5 | Old Partner 360 admin pages at their extension-less "pretty URL" (`/admin/catalog`, `/admin/dealers`, `/admin/product-content-enrichment` …) — answered **200** although the `.html` paths were redirected | anyone | admin UI shells (their functions are passcode-gated); `product-content-enrichment.html` held a hard-coded Ovation price table | Medium | **Fixed**: extension-less paths force-redirected like the `.html` ones; the mock price table blanked |
| 6 | Business Hub price list (`loadPricing` in `index.html` and `dashboard.html`) | any signed-in dealer | fetched **every** manufacturer's file — cost, MAP, MSRP of lines the dealer does not carry — and offered a CSV export of it | Medium | **Fixed**: priced only for lines the dealer carries, via catalog-layers; other lines list names only |
| 7 | `orders-api price_check` / `create` (admin site) | any approved dealer | priced any manufacturer's line and returned `commercial` (base price, MSRP, MAP, breaks) for it; `create` accepted orders for lines the dealer does not carry | **P0 (authorization)** | **Fixed**: a dealer prices and orders only its active `dealer_manufacturers` lines (403 `not_entitled`, strict 503 on an unreadable list); Golden untouched |
| 8 | Text in a non-commercial field: one retired Complete Medical description ended "From $…/ea." | anyone | one dealer price | Low | **Fixed** (scrub recorded by SHA-256 in `scripts/p0-public-scrubs.json`, never the text) |
| 9 | Code comments in `index.html` quoting real prices as examples | anyone | ~8 historical prices | Low | **Fixed** (examples made generic) |
| 10 | **GitHub**: both repositories are **public**; every priced file is in git history, forks and clones | anyone | everything in #1, #4, #5 historically | **P0 residual** | Not fixable in code — **owner decision** (§5) |
| 11 | Netlify immutable deploy URLs (`<deploy-id>--hcpsonlineordering.netlify.app/data/…`) keep every past deploy's files | anyone who has or guesses a deploy id | old priced files | High residual | **Owner action** (§5): protect or delete old deploys after release |
| 12 | Third-party caches (search engines, archive.org) | anyone | old priced files | residual | Owner action: removal requests if wanted |
| 13 | REST / function `product_content` (and public `product-content` GET, `select=*`) | anyone | `msrp_rule` on Climbing Steps pages ("$8399" — retail MSRP), plus internal workflow fields (`field_provenance`, `enrichment_flags`, `reviewed_by`, `draft_window`) | Low (no wholesale) | Not changed (frozen content). Follow-up P1: narrow the public column list |
| 14 | `manufacturers.json` `freight` / REST `manufacturer_meta.freight_terms` | anyone | freight terms ($15 S&H, $500 prepaid / $40, $200/$50/$5 …) | Terms, not wholesale prices | Not changed (frozen freight; checkout shows them to every dealer). **Owner decision** whether terms are confidential |
| 15 | `catalog-feed` | approved dealer (own lines) / staff preview (that dealer's lines) / staff | master-record prices | — | Already correct (401 anon). Unchanged |
| — | `product_skus`, `price_imports`, `dealer_contract_prices`, `dealer_preview_tokens`, `orders`, `dealers`, `dealer_users`, `dealer_manufacturers`, `staff_users`, `monthly_sales`, `app_settings` | public key | — | — | 0 rows to anon (RLS) — correct |
| — | `reconcile_conflicts`, `mfr_*` | public key | — | — | 401 / 42501 — correct |
| — | `featured_products`, `product_links`, `product_media`, `product_related`, `product_images`, `portal_content`, `manufacturers` | public key | names, links, images, notes | — | no commercial field found (scanned for `$` amounts too) |
| — | Functions on the ordering site: `catalog-api`, `dealers-api`, `analytics`, `home-api`, `assign` (passcode, fail closed), `content-scrape` (admin token), `brochure` (never prints dealer cost), `sample-request` | — | — | — | 401 without credentials — unchanged |
| — | CDN | — | — | — | `/data/*` is already `Cache-Control: no-store`; the new function answers `private, no-store` and `Vary: Authorization, X-HCPS-Preview` |

### 1.2 Reader map — who reads the catalog files and the layer tables

| Reader | Repo | Reads | After this branch |
|--------|------|-------|-------------------|
| `index.html` `loadProducts` / `loadLine` → `mergeCatalogEdits` | ordering | `./data/<slug>.json` + anon `custom_products`, `product_overrides`, `product_links`, `product_media`, `product_content` | public file + **catalog-layers** (overlay + the two layer tables); links/media/content still public (no prices) |
| `index.html` / `dashboard.html` `loadPricing` (Business Hub) | ordering | every `/data/<slug>.json` | public file + catalog-layers for carried lines only |
| `catalog-feed.js` | ordering | `product_skus` (service role) | unchanged; its `caller()` is now shared with catalog-layers |
| `_pricing.js lineProducts` (server pricing, Manufacturer Center verify / preview / publish) | admin | `${ORDERING_BASE}/data/<slug>.json` via `remoteFiles`, layers via the engine's reads | public file **+ `catalog_file_commercial` row** (`fullCatalogFile`), and the engine's catalog-layers read answered in-process from the same tables |
| `catalog-api.js catalogFile()` (Product Catalog, audits, Price Check, reconcile, rename, stage …) | admin | `${ORDERING_BASE}/data/<slug>.json` | public file + private row (strict) |
| `featured-api`, `crm-api mfr_products`, `campaign-api topProducts`, `commissions-api` | admin | file names / images only | unchanged (no price used; campaign-api sorts by MSRP — now unsorted on stripped lines, cosmetic, follow-up) |
| `test/*` worlds that read the ordering repo's data files | admin | the real files | full file from the last priced commit (`test/p0-fullfile.js`), never committed prices |

## 2. Design

**Principle:** a commercial fact (dealer base price, breaks, Access4U dealer / tier prices, MAP, MSRP, price notes,
unit cost, per-item shipping) never sits in anything the site publishes or the public key can read. It reaches a
browser only from a server function that has checked who is asking and which lines they carry. Missing = no price,
never a stale public copy.

1. **Split the static file.** `netlify/functions/_catalog_commercial.js` (pure, copied verbatim to the admin repo,
   drift-tested) splits each catalog row into its public half (everything else, unchanged) and a commercial overlay
   entry `{k: "<code>#<occurrence>", order: [original key order], f: {commercial fields}}`. `restoreCatalogFile`
   puts them back byte-for-byte; it drops any commercial key still on a public row (overlay is the only source),
   refuses a missing / extra / duplicate row (`catalog_file_mismatch`), and never lets the overlay write a
   non-commercial field. The same text lives in `index.html` (inside the engine the server copies) and
   `dashboard.html` (tested equal).
2. **Private store.** `catalog_file_commercial` (one row per line, RLS on, no policies, service role only) —
   `supabase/p0_catalog_file_commercial.sql`. Filled by `scripts/p0-seed-catalog-commercial.js --ref <last priced
   commit> --apply` with the service role (Angelo), which reads the priced files from **git history**, refuses
   unless the public half equals the deployed file, and prints only counts and SHA-256 fingerprints. No price is
   ever written into the repository (it is public).
3. **One authorised endpoint for the browser.** `netlify/functions/catalog-layers.js` (GET, `?manufacturer=`):
   approved dealer → only its active `dealer_manufacturers` lines; staff **preview token** → only the previewed
   dealer's lines (a preview token wins over a staff JWT sent with it, so a preview never widens); HCPS
   president / admin / owner signed in as staff → any line (verification); other staff roles 403; anonymous /
   forged / pending 401. Answers `{file_overlay, custom_products, product_overrides}` with the exact columns the shop
   always read. Every read strict → 503 `pricing_unavailable`. `private, no-store`, `Vary`, no CORS.
4. **Storefront fails closed.** `mergeCatalogEdits` first calls catalog-layers and restores the file; on any failure
   (no session, 401/403/503, network, incomplete answer, mismatch) the line lists **nothing** and the page says
   "Pricing could not be loaded" — a product a saved edit had hidden can never reappear, and there is no public price
   left to fall back to. The rest of the merge (layers, content, colour inheritance, MSRP rule, master record) is
   byte-for-byte the code it was.
5. **Server = same rule.** `_pricing.js lineProducts` reads the private row and restores the full file
   (`fullCatalogFile`): a stripped file with no row → refused (`pricing_unavailable`), a mismatched row → refused,
   an unstripped file with no row (before the strip, and test fixtures) → used as it is. The engine's catalog-layers
   read is answered in-process with this line's rows only. `catalog-api catalogFile()` returns the restored file
   strictly. `orders-api` refuses (403 `not_entitled`) to price or record a line the dealer does not carry.
6. **Trade-off (stated).** A second store for the file's commercial half is introduced rather than migrating every
   legacy line into `product_skus` now: it changes no price, no authority flag and no frozen line, and its restored
   output is identical to today (proved). The cost: until a line moves into `product_skus`, any edit to its static
   file must be accompanied by a re-seed of its row (the seed refuses a mismatch; the shop fails closed meanwhile).
   The long-term home stays `product_skus` (RULE 17); this table can be dropped line by line as lines migrate.

## 3. Tests (local; nothing against production)

Ordering repo — `node test/<file>`:

| Suite | Result |
|-------|--------|
| `p0layers.test.js` — anonymous / forged / anon-key / pending / non-entitled / inactive line / entitled exact / preview scope / preview beats staff JWT / expired preview / staff roles / every unreadable table / missing & malformed record / slug / method / headers | 25/25 |
| `p0shop.test.js` — real engine: anonymous never asks, no public table read, token & preview headers, exact prices, stale public price ignored, fail closed on 7 failure kinds, page message; Business Hub (both pages): carried priced, non-carried names only, failure, signed out, preview | 25/25 |
| `p0commercial.test.js` — split/restore rules on page AND module copies, drift (page = module = dashboard), all 12 real files round-trip byte-identical from git, stripped tree = public half | 45/45 |
| `p0static.test.js` — every published file scanned (JSON keys at any depth + `$` amounts; HTML/JS priced literals), planted-price self-check, `/data/*` no-store, every old admin page force-redirected (both URL forms) | 6/6 |
| `p0parity.test.js` — **frozen-line parity** (§4) | 22/22 |
| `p0sql.pg.test.js` — local PostgreSQL 16 with Supabase-like roles & default grants: exposure reproduced, migration + idempotence, anon/authenticated denied (permission denied, read & write), service role read/write, re-granted SELECT still answers 0 rows (RLS), constraints, rollback refusal, lock + idempotence, rollback restores exactly the old read, preflight, no UPDATE/DELETE, no price / project URL in the files | 27/27 |
| `p0.mutants.js` — 2 controls survive, 32 real mutants killed | pass |
| existing suites (authority, colortiers, feed, feedauth, redirects, shopcontent, shopcontract, shopdisc, shopimages, shoppicker, shopprices + their mutants) | all pass, except `shopprices.mutants.js` 1 stale anchor — **fails identically on main** (not touched) |

Admin repo: `p0-server.test.js` 13/13 (stripped file + row = priced file item for item; no row → 503, nothing
stored; mismatch / unreadable → 503; private row beats a stale public price; layers scoped to the line; real Bemis
identical incl. contract price; not-entitled price_check / create refused with no commercial field and nothing stored;
unreadable line list 503; Golden untouched; Product Catalog restored; no row → 503) and `p0-server.mutants.js`
(control survives, 9 killed). `pricing-parity.test.js` 6/6 (engine byte-identical to the new page, module copy
identical, layer columns identical). All 60 pricing / Manufacturer Center suites and mutants that touch these paths
pass; versus main the only differences are the new tests and `packunit.mutants.js` (a stale anchor fixed: 1 survivor
on main → all killed).

## 4. Frozen-line parity evidence

`test/p0parity.test.js` runs the **base commit's** storefront engine on the base commit's priced files with the layer
rows as the public key read them (today), and **this branch's** engine on the stripped files with the same rows plus
the seeded overlay delivered by catalog-layers (new). Same dealer session, contract prices, cart and master-record
answer; compared per product on every field, unit price at 1/2/3/5/6/8/10/11/20/21/50, and freight on three carts —
in two modes: layers-priced and record-authoritative. It also proves the rendering code for cards, pack words, price
notes, the cart, freight, the master-record path and the tabs is unchanged text.

| Line | Mode | Products | Commercial fingerprint today = new | Full-object fingerprint today = new |
|------|------|---------:|-----------------------------------|-------------------------------------|
| Climbing Steps | layers | 21 | 0fce2b15ee7bf500 = 0fce2b15ee7bf500 | ef8fef7c37c7a188 = ef8fef7c37c7a188 |
| Strongback | layers | 14 | cc8c25eb70ea1f5f = cc8c25eb70ea1f5f | 7d58517282ebecec = 7d58517282ebecec |
| Ovation | layers | 303 | 8bf41ccc2b234ac8 = 8bf41ccc2b234ac8 | 77fe1e35de3b17a6 = 77fe1e35de3b17a6 |
| Bemis | layers | 9 | 8d6e75ed51853167 = 8d6e75ed51853167 | 930d7af98ae904d8 = 930d7af98ae904d8 |
| Climbing Steps | record | 21 | 030733030180d819 = 030733030180d819 | aa27948fb4ea7ed4 = aa27948fb4ea7ed4 |
| Strongback | record | 14 | 75edc8b9de162064 = 75edc8b9de162064 | 8e2d31ccf3fd630d = 8e2d31ccf3fd630d |
| Ovation | record | 303 | 546e10be3314e42d = 546e10be3314e42d | 26d3f8594f93ce76 = 26d3f8594f93ce76 |
| Bemis | record | 9 | 9c372eeaf727e608 = 9c372eeaf727e608 | 8719065a9a8470da = 8719065a9a8470da |

All other lines (Access4U, AirAvant, Corsicana, PediFix, GCE, Dalton) identical too. Server side: real Bemis priced by
`orders-api` from the priced file and from stripped file + row — identical orders. Emails are built from the server's
stored lines and are unchanged code. **Limits, stated:** the layer rows are the public-key reads taken 2026-10-23
(fixtures kept out of git; `scripts/p0-fetch-fixtures.js`); `product_skus` cannot be read with the public key, so the
record-authoritative mode uses a synthetic record (different on purpose) fed identically to both paths — the record
path itself is unchanged code. The Manufacturer Center Gold Standard fingerprints (`mc_verify`) must be re-run live
after deploy (step 8 below) — that is the production proof.

## 5. Rollout (each step Angelo's; stop on any failure)

1. **Review + independent review** of both draft PRs at their exact commits.
2. **Run** `supabase/p0_catalog_file_commercial.sql` (all install checks true). Then the public-key probe:
   `node scripts/p0-public-probe.js` → `catalog_file_commercial` 401 / 42501.
3. **Seed**: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE=… node scripts/p0-seed-catalog-commercial.js --ref 4b1bad3`
   (dry run, check 12 lines `ok`), then the same with `--apply` (reads every row back and checks its fingerprint).
   Preflight `supabase/p0_lock_preflight.sql` shows 12 rows.
4. **Deploy admin first** (`homecareproviderservices` branch): with the files still priced on the live storefront the
   server restores identical prices either way (row present → overlay wins; tests prove both). Re-run
   `mc_verify` (no save) for the four frozen lines → fingerprints unchanged.
5. **Deploy the storefront** (this branch: code + stripped files together). Check signed in as a TEST dealer: line
   prices, cart, checkout price check; signed out: `/data/*.json` carries no commercial key
   (`node scripts/p0-public-probe.js`).
6. **Lock**: run `supabase/p0_lock_layer_reads.sql` (checks all true); probe again → `custom_products` /
   `product_overrides` denied to the public key. Storefront still prices (it never reads them with the public key).
7. **Deploy hygiene**: in Netlify, enable protection for deploy permalinks / branch deploys or delete deploys made
   before step 5 (old immutable URLs still hold priced files).
8. **Verify** with Manufacturer Center: `mc_verify` on Climbing Steps, Strongback, Ovation, Bemis → Gold Standard
   fingerprints (270c15b4991d580a / d35dcdff0cf9816c / 46f8ed0f02c81067 / 3620a321933995db or their current Gold
   Standards) unchanged; a test order on the TEST sandbox dealer → email totals = stored totals.

**Rollback** (reverse order; never as a reaction to suspicion — investigate first, RULE 19):
- Storefront misbehaves after step 5 → redeploy the previous storefront commit (priced files return; reopens #1).
- Admin misbehaves after step 4 → redeploy the previous admin commit (it reads priced files only while they are
  published, so do the storefront rollback first if step 5 has run).
- After step 6 a storefront rollback needs `supabase/p0_lock_layer_reads_rollback.sql` too (reopens #2/#3).
- `supabase/p0_catalog_file_commercial_rollback.sql` only after both code rollbacks and emptying the table (it refuses
  otherwise).

## 6. Remaining / owner decisions

- **Public repositories (#10).** Every price ever committed is public in git history. Options: make both repos
  private (stops new readers; does not recall existing clones/forks); history rewrite is not useful once public.
  Treat the historical prices as disclosed.
- **Deploy permalinks (#11)** and caches (#12) — step 7.
- **Freight terms (#14)** — confidential or not? If yes, moving them behind catalog-layers touches the frozen freight
  path and needs its own parity release.
- **product_content public columns (#13)** — narrow to what the storefront renders (P1, frozen-content gate).
- `campaign-api topProducts` sorts by MSRP from the public file — now unsorted for stripped lines (cosmetic).
- Long term: migrate remaining legacy lines into `product_skus` and retire `catalog_file_commercial` per line.
- A Business Hub price list for lines the dealer does not carry now shows names only — intended; confirm.
