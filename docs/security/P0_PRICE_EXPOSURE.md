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
   entry `{k: "<code>#<occurrence>", h: <row identity fingerprint>, order: [original key order], f: {commercial fields}}`. `restoreCatalogFile`
   puts them back byte-for-byte; it drops any commercial key still on a public row (overlay is the only source),
   refuses a missing / extra / duplicate row (`catalog_file_mismatch`), and never lets the overlay write a
   non-commercial field. The same text lives in `index.html` (inside the engine the server copies) and
   `dashboard.html` (tested equal).
   **Version integrity (review release blocker, fixed).** `h` = SHA-256 of the row's non-commercial fields
   (canonical JSON, keys sorted; pure-JS SHA-256 so browser, server engine and tools agree — tested against
   node:crypto). A line's **identity** = SHA-256 of its rows' `h` in file order. `restoreCatalogFile` refuses any
   row whose fingerprint differs from its entry's `h` and any entry without one — so swapped duplicate part numbers
   (Access4U SR3/PRK, GCE RS-005xx, Ovation 720MXL), an edited name / family / group / image with the same codes
   and row count, or a public file newer or older than the record **fail closed**; nothing is ever matched by
   position across versions. The real files hold no two same-code rows with identical public content (tested), so
   every duplicate is distinguishable.
2. **Private store.** `catalog_file_commercial` — one row per line **and public-file version**, primary key
   `(manufacturer, identity_sha256)`, RLS on, no policies, service role only — `supabase/p0_catalog_file_commercial.sql`.
   A guard trigger refuses any record whose entries lack a key / fingerprint / key order / fields, whose keys repeat,
   or whose `identity_sha256` is not the SHA-256 of its fingerprints (the database computes it with `sha256()`).
   Filled by `scripts/p0-seed-catalog-commercial.js` with the service role (Angelo): it reads the priced files from
   **git history**, refuses unless the public half equals the file in the tree, prints only counts and SHA-256
   fingerprints, and seeds **current lines only** (listed in `public/data/manufacturers.json`; a retired line such as
   Complete Medical Supplies is reported and never seeded — `scripts/p0-lines.js`). No price is ever written into the
   repository (it is public).
3. **One authorised endpoint for the browser.** `netlify/functions/catalog-layers.js` (GET, `?manufacturer=`):
   approved dealer → only its active `dealer_manufacturers` lines; staff **preview token** → only the previewed
   dealer's lines (a preview token wins over a staff JWT sent with it, so a preview never widens); HCPS
   president / admin / owner signed in as staff → any line (verification); other staff roles 403; anonymous /
   forged / pending 401. Requires `identity=<the public file's identity>` (400 otherwise) and answers only the stored
   version with that identity (503 `catalog_version_not_seeded` otherwise, never the nearest version), after checking
   the record internally. Answers `{identity_sha256, file_overlay, custom_products, product_overrides}` with the exact
   columns the shop always read; the browser refuses an answer for another identity. Every read strict → 503 `pricing_unavailable`. `private, no-store`, `Vary`, no CORS.
4. **Storefront fails closed.** `mergeCatalogEdits` first calls catalog-layers and restores the file; on any failure
   (no session, 401/403/503, network, incomplete answer, mismatch) the line lists **nothing** and the page says
   "Pricing could not be loaded" — a product a saved edit had hidden can never reappear, and there is no public price
   left to fall back to. The rest of the merge (layers, content, colour inheritance, MSRP rule, master record) is
   byte-for-byte the code it was.
5. **Server = same rule.** `_pricing.js lineProducts` computes the identity of the public file it just read and uses
   only the stored version with that identity (`commercialFor`): versions stored but none for this file → refused
   (`catalog_version_not_seeded`); a malformed record → refused; a stripped file with no record → refused; an
   unstripped file with no record at all (before the strip, and test fixtures) → used as it is. The engine's catalog-layers
   read is answered in-process with this line's rows only. `catalog-api catalogFile()` returns the restored file
   strictly. `orders-api` refuses (403 `not_entitled`) to price or record a line the dealer does not carry.
6. **Trade-off (stated).** A second store for the file's commercial half is introduced rather than migrating every
   legacy line into `product_skus` now: it changes no price, no authority flag and no frozen line, and its restored
   output is identical to today (proved). The cost: until a line moves into `product_skus`, any edit to its static
   file needs a re-seed of its next version **before** the storefront that publishes it is deployed (§5.2).
   The long-term home stays `product_skus` (RULE 17); this table can be dropped line by line as lines migrate.

## 3. Tests (local; nothing against production)

Ordering repo — `node test/<file>` (pg: `PGHOST=127.0.0.1 PGUSER=postgres`):

| Suite | Result |
|-------|--------|
| `p0layers.test.js` — anonymous / forged / anon-key / pending / non-entitled / inactive line / entitled exact / preview scope / preview beats staff JWT / expired preview / staff roles / every unreadable table / missing & malformed record / slug / method / headers; **review:** identity required (400), public file newer or older than every record (503 `catalog_version_not_seeded`), two versions side by side each answered exactly, legacy record without fingerprints, record identity ≠ its fingerprints | 31/31 |
| `p0shop.test.js` — real engine + Business Hub (both pages); **review:** the shop sends its file's identity; fails closed on an answer for another version / without identity / swapped rows / edited row / entry without fingerprint; Business Hub lists names only on a version or fingerprint mismatch | 33/33 |
| `p0commercial.test.js` — split/restore rules on page AND module; drift (page = module = dashboard, the whole shared block); pure-JS SHA-256 = node:crypto on 2,008 strings; **review:** swapped duplicate-code variants, same codes/count with family / name / image / group changed, removed field, missing / malformed / foreign fingerprint all refused; key order irrelevant; prices not part of identity; `validOverlayRecord` / `recordForFile`; every real file round-trips, is fully fingerprinted, its tree identity = its record's, swapped real duplicates refused, no two same-code rows publicly identical | 74/74 |
| `p0seed.test.js` (new) — initial plan; **re-seed by fingerprint** (swapped duplicates keep their own prices), edited/new rows must be supplied, non-commercial supplied field / stray entry / unknown base / priced file refused, dropped rows reported; current lines = manufacturers.json; seed dry run on this tree AND on a copy without the retired Complete Medical file | 11/11 |
| `p0static.test.js` | 6/6 |
| `p0parity.test.js` — frozen-line parity (§4), now through the real `pickVersion` of catalog-layers | 22/22 |
| `p0sql.pg.test.js` — PostgreSQL 16, Supabase-like roles/grants; **review:** DB identity = JS identity (incl. multi-byte), guard refuses missing / malformed fingerprint, missing key, non-object fields, repeated key, wrong identity (insert AND update), two versions coexist, same version twice = one row, an earlier draft table shape refused; plus everything before | 31/31 |
| `p0.mutants.js` — 2 controls survive; **50** real mutants killed (incl. 18 new: nearest-version fallback, identity not required/sent/checked, positional match, missing fingerprint accepted, commercial fields in identity, values ignored in identity, SHA constant, module record check, split without fingerprint, re-seed by position / guessing / non-commercial supplied field / any version as base, dashboard version check) | pass |
| existing suites (authority, colortiers, feed, feedauth, redirects, shopcontent, shopcontract, shopdisc, shopimages, shoppicker, shopprices + mutants) | all pass; `shopprices.mutants.js` 1 stale anchor fails identically on main (not touched) |

Admin repo (branch merged with `catalog/retire-complete-medical` = admin#37, so these are INTEGRATION results):

| Suite | Result |
|-------|--------|
| `p0-server.test.js` — before + **review:** versions side by side, swapped duplicates in the deployed file, legacy record shape, in-process version refusal; entitlement: staff login / preview token / anonymous = `unauthorized` with no commercial field; approved dealer with no active line → 403; two carried lines in one cart priced, adding a non-carried line refuses the whole request with no price echoed | 20/20 |
| `p0-orderpath.test.js` (new) — Climbing Steps, Strongback, Ovation, Bemis (real files from git), layers AND record mode (synthetic record with the Strongback models pool and the A1005 4-pack), 3–4 carts each incl. a contract price: price_check, create answer, stored order (subtotal, freight_fee, estimated_total), stored lines, dealer confirmation email, My Orders (order-history-api) — today = P0 identical; edited / swapped / newer / older public file → price_check and create 503, nothing stored or sent | 24/24 |
| `p0-server.mutants.js` — control survives, 15 killed | pass |
| `pricing-parity` 6, `pricing` 23 (incl. #37's retired-line + fail-closed list), mutants pricing / packunit / msrpauto / freight / bemisfreight / freightterms / orderhistory / shopcart / pooling | all pass / all killed |
| full admin suite (148 files) | identical to the base (`0fb66c9`) except the new suites: only the pre-existing `mi1c-api` / `mi1c-parser` (PDF not present) and `resources-render` (documents.json) fail, as on main; pg suites skip without the database password |

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

SQL files and their SHA-256 (as committed, LF line endings):

| File | SHA-256 |
|------|---------|
| `supabase/p0_catalog_file_commercial.sql` (changed in the review batch: version key, identity column, guard trigger, earlier-draft refusal) | `84e79e2fadbf6ebbe79b453acc822e4d1dc29cf374a29f1eb907cff6136588f7` |
| `supabase/p0_catalog_file_commercial_rollback.sql` (also drops the guard function) | `666c8d4237ec9afc7f7ee35c4a2a0ba99c995c9b8a8cc1c6f1b1ce2a9f201c72` |
| `supabase/p0_lock_preflight.sql` (read-only; now shows identity and seed ref per version) | `ce859b29122fc473c962dcfb5da3ebbf0c1b2752056bed7de2e57422f42a3ec9` |
| `supabase/p0_lock_layer_reads.sql` (unchanged) | `e3f8c02c02b58dfe6561808f31b91ef67d1152a2cdc94c6eca1fd66b923a7a70` |
| `supabase/p0_lock_layer_reads_rollback.sql` (unchanged) | `ff6454f1960975ec1d084934e97008f805131b92370c98042a9e4bf3f178bb0b` |

**0. Before anything (owner gates).**
- **Old deploys — VERIFIED audit (2026-10-24 ~04:40 UTC, read-only GETs from outside, no sign-in; §5.1 has the
  table).** Storefront `hcpsonlineordering`: Visitor access = *Production public / Deploy Preview **private***. Every
  deploy preview, PR deploy-ID link and **every superseded production deploy permalink** answers **401** (pages,
  `/data/*.json` and functions alike); only the CURRENT production deploy is public — it is the live site. So once
  the P0 storefront deploy is published, the price-bearing deploy before it becomes 401 automatically: **no storefront
  setting needs changing, and the dealer storefront stays fully available.** The one way to re-expose it is
  **"Publish deploy" on an old deploy** (a rollback) — do not roll the storefront back to a pre-P0 deploy; roll forward.
  Admin `homecareproviderservices`: Visitor access = *Production public / Deploy Preview **public***. Every old
  production deploy permalink and every deploy preview answers publicly and **runs that deploy's OLD functions with
  today's production environment variables** (e.g. `orders-api` answers 405 on deploys from before #37 — before the
  Complete Medical guard and before the P0 version check). **Owner action before the P0 release: set the admin
  site's Deploy Preview visibility to Private** (Project configuration → General → Visitor access → Edit visibility).
  Production (`www.homecareproviderservices.org`, `homecareproviderservices.netlify.app`, the Academy, Connect 360) is
  unaffected; deploy previews then need a Netlify team sign-in to view. Re-run §5.1 afterwards: every old admin
  permalink must answer 401.
- Decide on the dealers the review found **approved but with no active `dealer_manufacturers` line**: after the
  release they can browse but price and order nothing (403). Confirm that is intended, or assign their lines first.
- Merge order with PR ordering#4 / admin#37 (retire Complete Medical): either order works (tested both ways, §7);
  the seed below never creates a record for a line not in `manufacturers.json`.

1. **Private table.** Run `supabase/p0_catalog_file_commercial.sql` (check the SHA-256 above first; every install
   check true: `rls_on, no_policies, anon_none, authenticated_none, service_role_rw, guard_not_public, guard_on,
   keyed_by_version`). Outside probe: `node scripts/p0-public-probe.js` → `catalog_file_commercial` 401 / 42501.
2. **Verified seed (fingerprints).** `node scripts/p0-seed-catalog-commercial.js --ref 4b1bad3` (dry run, no
   credentials needed) must list every current line `ok` with these identities (first 16 hex), `complete-medical-supplies`
   as `retired`, and nothing `BAD`:

   | Line | Rows | Identity | Overlay sha | Public sha |
   |------|-----:|----------|-------------|------------|
   | access4u | 230 | 94ff90fb294547d6 | 05299824d28c1ad4 | 10beeb78a823ed77 |
   | airavant-bongorx | 12 | 7d6ba36b36250281 | ab0770f3a5a5aa7f | 1d6cd6760afc6cd8 |
   | bemis | 9 | 8d5e7c6b2820e484 | 9d5a9273a7c2a146 | 1503db115d20177e |
   | climbing-steps | 23 | 9fa2f4efd65b9cf6 | 264594f0b8eae686 | 2d698810999d68a5 |
   | corsicana | 14 | 39ad04aeb2f3ddc8 | dcd4b43fd1113643 | 5ecd09285f787501 |
   | dalton | 0 | e3b0c44298fc1c14 | 4f53cda18c2baa0c | 4f53cda18c2baa0c |
   | gce | 29 | dfefdfe2f7300cd0 | e5d81b77dcf7a730 | f091444b85f9fe87 |
   | ovation-medical | 276 | f64260f79b8e67a6 | 5535599e92d407fe | abad4a1398262895 |
   | pedifix | 515 | 9dcce7e74b9acf28 | 87dbaef284b34ccc | 5d5f5149d8d2a503 |
   | strongback-mobility | 12 | 53cec7cb661da4b5 | fde63ce9467f4ce6 | 2afbf68c089dac7f |

   Then the same command with `--apply` and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` in the environment (never in a
   file); it reads every record back and checks it. `supabase/p0_lock_preflight.sql` then lists 10 versions with
   these identities.
3. **Admin deploy** (homecareproviderservices#36). The live storefront still serves priced files; the server's
   identity of a priced file equals the stripped one (prices are not part of identity), so it prices from the
   record either way (tested). Re-run `mc_verify` (no save) for the four frozen lines → Gold Standard fingerprints
   unchanged.
4. **Storefront deploy** (this branch: code + stripped files together).
5. **End-to-end verification BEFORE the lock** (each must pass; any failure → rollback §5.3 step 1):
   - a real authenticated TEST-sandbox dealer: its lines show prices, cart, checkout `price_check`, one test order
     (then cancelled in admin) — browser = server = stored = both emails, My Orders shows the stored total;
   - staff preview of that dealer: prices only the previewed dealer's lines; a line it does not carry → 403;
   - a non-entitled dealer probe: catalog-layers 403 for a line it does not carry; `orders-api price_check` /
     `create` 403 `not_entitled` with no commercial field;
   - anonymous probe: `node scripts/p0-public-probe.js` — every `/data/*.json` (incl. the retired URL) clean or
     404, `catalog_file_commercial` denied, catalog-layers 401;
   - no service key in the client: the deployed `index.html` / `dashboard.html` / JS carry only the publishable key
     (search the served pages for `service_role` / `sb_secret_`);
   - no checkout bypass: `submit-order` without a dealer sign-in records nothing; a tampered unit price is
     re-priced by the server (409 `prices_changed`).
6. **Legacy-table lockdown**: run `supabase/p0_lock_layer_reads.sql` (checks all true); probe again →
   `custom_products` / `product_overrides` denied to the public key; the storefront still prices.
7. **Old immutable deploys**: re-run the §5.1 audit — the storefront deploy published just before step 4 (main@6223f69,
   `6adbdc184cdbafce5de2a220`) must now answer 401 for `/data/bemis.json`; every old admin permalink 401 (after the
   admin Deploy Preview visibility is Private). Never "Publish deploy" a pre-P0 storefront deploy.
8. **Final verification**: `mc_verify` on Climbing Steps, Strongback, Ovation, Bemis → Gold Standard fingerprints
   unchanged (Bemis: its current Gold Standard after the Assurance correction; decisions #908–#911 and their dry-run
   plan are not touched by this release — no product_content, decision or approval row is written).
   After the release: `node scripts/p0-seed-catalog-commercial.js --prune <slug> --live <storefront URL>` is not
   needed (one version per line).

### 5.1 Historical-deploy audit (re-run before and after the release)
Outside, no sign-in, GET only. 200 = public, 401 = protected by Visitor access, 404 = no such deploy / file.

| Site | URL kind (example) | Result 2026-10-24 |
|---|---|---|
| storefront | production `hcpsonlineordering.netlify.app/data/bemis.json` | 200 — prices served (P0 not yet deployed) |
| storefront | current production permalink `6adbdc18…--hcpsonlineordering.netlify.app` (main@6223f69) | 200 (= live site) |
| storefront | older production permalinks main@4b1bad3, 68126df, edc7fbf, 4bd73fb — pages, `/data/*.json`, functions | **401** |
| storefront | deploy previews 3, 4 and their deploy-ID links | **401** |
| storefront | branch subdomain `main--…` | 200 (follows production) |
| admin | current + older production permalinks main@872f637, 546ba46, a5758a0, 6411112 | **200 — functions run (orders-api 405)** |
| admin | deploy previews 36, 38 (and a 2026-10-20 preview deploy-ID link) | **200** |

Commands: `curl -s -o /dev/null -w '%{http_code}' https://<deploy-id>--<site>.netlify.app/<path>`. Deploy IDs come from
the site's Deploys list (Production filter) and from the Netlify bot's PR comments.

### 5.2 Re-seeding after a legacy static catalog edit (from now on)
A public catalog file edited in git is a NEW version: until its record exists, that line fails closed
("Pricing could not be loaded", 503 on the server). Order, every time:
1. Edit the public file on a branch (no commercial key in it — `node scripts/p0-strip-catalog.js --check`).
2. `node scripts/p0-seed-catalog-commercial.js --reseed <slug> --base <deployed commit> [--supply <private JSON
   OUTSIDE the repository>]` — dry run: unchanged rows are carried **by fingerprint** (a reordered row keeps its own
   price); a new or edited row must be supplied (`{"<code>#<occurrence>": {base_price, tiers, …}}`) or the plan is
   refused. Then `--apply`: the next version is stored **beside** the deployed one (both storefronts price).
3. Deploy the storefront; verify the line (dealer + preview).
4. `--prune <slug> --live <storefront URL>` (dry run, then `--apply`): deletes every other version of that line
   (DELETE with a WHERE on manufacturer and identity), only if the live file's version is stored.
Price changes themselves still go through Manufacturer Center / Product Catalog (RULE 17); the frozen lines are
record-authoritative and are never re-seeded for a price.

### 5.3 Rollback (reverse order; never as a reaction to suspicion — investigate first, RULE 19)
1. Storefront misbehaves after step 4 → redeploy the previous storefront commit. **⚠ TEMPORARY EMERGENCY EXPOSURE:**
   this re-publishes every priced catalog file to the public internet for as long as it is live. Keep it as short
   as possible, record when it started and ended, and treat the prices as disclosed again. Deploy-permalink
   protection (step 0) keeps the old deploys themselves closed meanwhile.
2. Admin misbehaves after step 3 → redeploy the previous admin commit (it reads priced files only while they are
   published, so do storefront step 1 first if step 4 has run).
3. After step 6 a storefront rollback also needs `supabase/p0_lock_layer_reads_rollback.sql` — **⚠ also a
   TEMPORARY EMERGENCY EXPOSURE** (every added product and saved edit readable with the public key); re-run the lock
   as soon as the fixed storefront is back.
4. `supabase/p0_catalog_file_commercial_rollback.sql` only after both code rollbacks and emptying the table (it
   refuses otherwise).

## 6. Remaining / owner decisions

### 6.1 Recommendation: make both repositories private
Both repositories are public, so every price ever committed stays in git history, forks and clones; private repos
stop new readers (they do not recall existing copies). **Not changed here.** Before switching, verify:
- [ ] Netlify GitHub App: installed for both repos with access to private repos (Netlify → Site configuration →
      Build & deploy → Repository → "Manage repository"; GitHub → Settings → Applications → Netlify → repository access).
- [ ] Netlify continuous deployment still triggers on push to `main` after the switch (push a docs-only commit; deploy
      list shows "Published").
- [ ] Deploy previews for pull requests still build and post their status check (open a test PR).
- [ ] Build hooks (Netlify → Build hooks) still fire — they are URL-based, unaffected, but list who uses them.
- [ ] GitHub Actions (if any workflow is added): private repos use the account's Actions minutes.
- [ ] Anything that fetches raw files from GitHub (`raw.githubusercontent.com`, `api.github.com/repos/…/contents`) —
      none found in either repo's code; the admin reads the storefront through its deployed site (`ORDERING_BASE`).
- [ ] Collaborators / tokens that only had public read access get explicit access.
- [ ] The independent-review workflow reads PRs through the API: give it an authenticated token after the switch.

### 6.2 What still looks confidential in public files (checked 2026-10-23)
- **Storefront repo:** no commercial key and no priced literal in `public/` after this branch (static scan); the old
  admin page shells (`public/admin/analytics.html` …) contain UI only. `manufacturers.json` freight terms (Strongback
  $15 per accessory order, Bemis $500 prepaid / $40, PediFix $200 / $50 / $5, Corsicana UPS/LTL at $2,500, Climbing
  Steps free) are **standard dealer-facing shipping terms** shown at checkout — may stay public. Test fixtures on this
  branch now use synthetic prices (the SQL test used two real Bemis figures; replaced).
- **Admin repo (public) — NOT fixed here, owner decision:** `CLAUDE.md` records real company totals (all-time sales and
  commission totals, per-manufacturer commission figures, dealer names and order examples), real wholesale prices and
  breaks (Strongback models and accessory packs, Bemis case prices, an Ovation ladder, a Climbing Steps item) and
  negotiated arrangements (payment terms, less-than-case and dropship fees); test fixtures carry real prices
  (`test/pooling.test.js` Strongback ladder, `test/packunit.test.js`, `test/fixtures/bemis-copy.json`,
  `test/fixtures/mc-live-frozen.json`, `test/mc-guard.data.sql`) and `supabase/bemis_2026_price_import.sql` /
  `mc_phase1_backfill.sql` hold the Bemis price list. These are negotiated/confidential and should leave the public
  repo (make it private — §6.1 — and/or move them to a private store; history keeps them either way).

### 6.3 Other
- **Freight terms (#14)** — standard, may stay public (above); a negotiated term must not go into manufacturers.json.
- **product_content public columns (#13)** — narrow to what the storefront renders (P1, frozen-content gate).
- `campaign-api topProducts` sorts by MSRP from the public file — now unsorted for stripped lines (cosmetic).
- Long term: migrate remaining legacy lines into `product_skus` and retire `catalog_file_commercial` per line.
- A Business Hub price list for lines the dealer does not carry now shows names only — intended; confirm.

## 7. Review findings — status (independent reviews of ordering#3 @ 2d58741 and admin#36 @ a9e170d, 2026-10-23)

| # | Finding | Status | Where (commit · test) |
|---|---------|--------|------------------------|
| 1 | **RELEASE BLOCKER** — overlay matched by `code#occurrence` only; `public_sha256` never checked; reorder / edit could attach the wrong price | **RESOLVED** | per-row fingerprints + line identity + version-keyed table, checked in catalog-layers, the browser restore, `_pricing.commercialFor` and the DB guard · `p0commercial` (swapped duplicates, same-count edits, missing fingerprint), `p0layers` (newer / older file, versions side by side), `p0shop`, `p0sql`, admin `p0-server` + `p0-orderpath` (refusals on the real frozen files), mutants (storefront 18 new, admin 6 new) |
| 1a | How a legacy static catalog update re-seeds atomically, before/with deployment | **RESOLVED** | versions stored side by side; `--reseed` (by fingerprint, explicit supply) before deploy, `--prune` after (§5.2) · `p0seed.test.js` + seed mutants |
| 2 | Browse ≠ buy: no wholesale price or order permission for a line not carried; same user across manufacturers; staff preview vs dealer | **RESOLVED** (tests added; behaviour was already in a9e170d) | `p0-server`: staff / preview / anonymous unauthorized with no commercial field, dealer with no active line 403, two carried lines priced, a non-carried line refuses the whole cart without echoing prices; `p0layers` preview scope |
| 2a | Approved dealers without an active line (one found live) | **OPEN — owner** | §5 step 0: confirm intended before release |
| 3 | Whole order path on the four frozen lines (price_check, create, saved totals, email, My Orders, contract prices, case packs, pooled breaks, freight) | **RESOLVED** | admin `p0-orderpath.test.js` 24/24 (layers + record mode); storefront `p0parity` 22/22 fingerprints unchanged (§4); Bemis #908–#911 / its dry run untouched (no content/decision write in this release) |
| 3a | Live Gold Standard fingerprints (`mc_verify`) | **OPEN — production step** | §5 steps 3 and 8 (needs the deployed code) |
| 4 | Runbook: order private table → seed → admin → storefront → lockdown → old permalinks → final verification; rollback marked as emergency exposure; protect permalinks ahead | **RESOLVED** | §5, §5.3 |
| 4a | Make both repos private (checklist, do not change visibility) | **OPEN — owner** | §6.1 |
| 4b | Confidential data left in public files | **REPORTED** | §6.2 — storefront clean; admin repo holds real prices / totals in CLAUDE.md, fixtures, SQL |
| 5 | SQL changed → migration, rollback, preflight + checksums; local Postgres tests; WHERE on every UPDATE/DELETE; RULE 19 | **RESOLVED** | §5 table · `p0sql.pg.test.js` 31/31 (no UPDATE/DELETE in the files; the seed's prune DELETE carries a WHERE) |
| 6 | Retired lines (ordering#4 / admin#37): seed, row counts, scans, parity, runbook skip Complete Medical; both merge orders | **RESOLVED** | `scripts/p0-lines.js` (current = manufacturers.json; `RETIRED` only for the probe) · `p0seed` dry run on this tree and on a tree without the file; integration worktree #3+#4 (all suites green) |
| 7 | Integration heads: admin #36+#37, storefront #3+#4 | **RESOLVED (local)** | admin branch merged with `catalog/retire-complete-medical` (ec6f712) — retire guard + entitlement + identity all active, full suite as main; storefront #3+#4 merged in a scratch worktree (CMS file deleted in the conflict) — all suites + admin cross-repo pricing/checkout tests green (§3) |
| 8 | Production evidence (table absent, legacy public SELECT still on) | **OPEN — production** | §5 steps 1–8 are Angelo's; nothing run against production here |
