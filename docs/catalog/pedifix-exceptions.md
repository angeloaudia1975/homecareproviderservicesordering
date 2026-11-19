# PediFix — open exceptions and source notes (2026-11-03)

Content batch for the owner's 2026-11-03 22:21 instruction. Sources used, and only these:

- **pedifix.com** product pages (the manufacturer's Shopify product data, read 2026-11-03).
- **The PediFix OTC Wholesale Catalog** stored by HCPS as `pedifix-catalog-2025.pdf`. Its pages are images, so
  every value taken from it was read against the page image, not only the OCR text.
- **The HCPS 2025 PediFix price list (July 2025)**, used for product lines only. No price from it is written anywhere
  in content, and no price was changed.

Nothing here changes a SKU, price, unit, packaging rule or on/off status. Which SKUs are switched on or off lives in
the shared catalog overrides and is decided separately (see "Reactivation candidates" below).

## Source discrepancies — need PediFix or owner confirmation

| # | Item | What the sources say | What dealers see now |
|---|------|----------------------|----------------------|
| PF-1 | The catalog file itself | The file named `pedifix-catalog-2025.pdf` is the **2021–2022 OTC Wholesale Catalog** (cover; © 2021). | Display contents and sizes are cited as that edition, with PediFix's own note that display contents change. A current catalog should be requested. |
| PF-2 | D09-TTU Tea Tree Ultimates Assortment Display | The HCPS list says "Kit (3 + 3 + 3)", and the 2021–22 catalog lists 3 × P3070, 3 × P3078 and 3 × P3370. pedifix.com lists 3 × P3070, 3 × P3078 and **4** × P3370. | The three products are listed **without counts** until PediFix confirms the current mix. |
| PF-3 | D37 Two-Story Counter-Top Spinner | The HCPS catalog name says "D17 + **D28**". The PediFix catalog says D17 (top) + **D27** (bottom). | The copy follows PediFix (D27). The name is not changed, because it is catalog identity. |
| PF-4 | D77 2-Sided Floor Spinner | The HCPS size is 60"H x 18"W x 18"D. The PediFix catalog gives **72" H with header, on a 16" x 19" base with wheels**. | The spec shows the PediFix figure, labelled as such. The name is unchanged. |
| PF-5 | D27 4-Sided Counter-Top Spinner | The HCPS size is 22"H. The PediFix catalog gives a fully loaded **22" D x 22" W x 21" H, plus a 6" header**. | The spec shows the PediFix figure. |
| PF-6 | D17-DEX "Dexterity" 2-Sided Spinner | *Corrected 2026-11-19:* the catalog **does** list it — catalog page 56 (Dexterity™ Hand Therapy): "#D17-DEX — Dexterity® 2-Sided counter top spinner display, 22" H x 13.5" W x 12" D", with 12 products (2–4 pieces each, assorted sizes as applicable), a 16" x 7" double-sided header, 25 product guides / referral brochures & holder and out-of-stock tags. Not on pedifix.com. The earlier note ("not in the catalog") was wrong. | Description, contents and size from catalog page 56, and the display photo cropped from that page. **Current assortment unconfirmed** (2021–22 edition). |
| PF-7 | P244 PressureOFF System 9 WIDE (6 SKUs) | No P244 page on pedifix.com or in the catalogs found. (1) The July 2025 PediFix price list (the verified commercial source) lists all six P244 SKUs, XLL and XLR included, with UPCs. (2) pedifix.com sells "System 9 Wide" today as **#2404 in Medium and Large only**. (3) A 2022 PediFix PressureOFF brochure (©2022, form L0105-REV322) gives XL sizing (shoe 13–15) but does not tie an XL to #2404. (4) Only a distributor (McKesson) lists a 2404-XLL. (5) PediFix catalogs "Volume 18R" and "19M" on stores.pedifix.com do not list P244. | All six SKUs were already on sale before this work. **This PR does not activate anything:** the family groups the existing SKUs and their status is unchanged. The description stays blank. **Owner decision (2026-11-03):** never activate an unsupported XL just because an older catalog shows it. Ask PediFix whether P244 is current (or replaced by #2404) and whether an XL Wide is made; until then, Angelo decides whether P244-XLL / P244-XLR stay on sale. |
| PF-8 | P3036 trimmer replacement blades | The catalog (page 58, "6/pk #P3036") says blade refills are 6 per pack, **bagged, not packaged for retail display**. pedifix.com says they are available by special order. | The copy is from those two sources. There is **no photo**: neither source pictures the blades, and the trimmer photo would be the wrong item. |
| PF-9 | P3071-PACKET-100 FungaSoap packets (3 ml) | Not on pedifix.com. Re-checked 2026-11-19 against every catalog page: the catalog lists FungaSoap 6 oz (#P3071) and its displays (pages 14–15 and 54–55) but **no packet item**. | The copy is from the FungaSoap product page; pack size from the HCPS 2025 price list. **No photo; availability unconfirmed.** |
| PF-10 | P3070 FungaSoap 5.1 oz | pedifix.com lists FungaSoap in 6 oz, 13.5 oz and 2 oz only. 5.1 oz appears in the 2021–22 catalog (D09-TTU). | The copy is from the FungaSoap product page, without the ingredient list (the 5.1 oz formula is not confirmed). **Availability unconfirmed.** |
| PF-11 | M905RR JustForToenails "Plant Your Sugar Lips Here" | Not in pedifix.com's current colour list. Shown in the 2021–22 catalog as colour #520. | The colour swatch is cropped from the catalog, with copy from the JustForToenails page. **Availability unconfirmed.** |
| PF-12 | 5100-C-S/M/L GelStep Heel Pad, Soft Spur Spot, covered | No pedifix.com page; pedifix.com shows #5105 Center Spot and #5075 Posted. The catalog (page 22) lists 5100-C. | The copy and sizing are from the catalog. **Availability unconfirmed.** The uncovered 5100-S/M/L stay owner-retired. |
| PF-13 | P3012 and P3012-12 | Both rows carry the same UPC (092437171385) in the HCPS catalog. | Unchanged. Ask PediFix for the 12-pack UPC. |
| PF-14 | Darco 6210 | PediFix says "Ladies'"; HCPS says "Women's" (wording only). pedifix.com also lists a Youth size (6210-Y, not available), which is not in the HCPS list. | Unchanged. |

## Kit and pack quantities — the four flagged in the audit

All four are confirmed by PediFix sources, except D09-TTU (PF-2). No catalog-file change is needed: the unit text
already states the contents, and `case_qty` is part of the private commercial record's identity, so changing it
needs a new commercial record version.

- **P220-3 SockLess Terry-Comfort Insoles:** 3 pairs per pack (catalog page 20; pedifix.com "3 Pairs — One Size").
  The page also now carries PediFix's note that P220 contains natural rubber latex.
- **D09-MIX:** 4 × P3071 + 3 × P3078 + 4 × P3069. The catalog (page 15) and pedifix.com agree.
- **D09-DDMIX:** 5 × P3076 + 3 × P3620. The catalog and pedifix.com agree.
- **D09-TTU:** see PF-2.

## Reactivation candidates (owner, 2026-11-03) — 14 prepared, NOT applied; each needs Angelo's separate authorization

These SKUs are switched off in the shared catalog overrides, which production uses too. Switching one back on is
therefore a production change. It is done only after the owner approves, with Product Catalog → Restore.

| SKU | pedifix.com today | Packaging (HCPS catalog = PediFix) | Price record |
|-----|-------------------|------------------------------------|--------------|
| 8520 | Felt roll 1/8" — available | 1 roll, 6" x 2.5 yd | Matches the July 2025 list |
| 8521 | Felt roll 1/4" — available | 1 roll, 6" x 2.5 yd | Matches the July 2025 list |
| 8620 | Foam roll 1/8" — available | 1 roll, 6" x 2 yd | Matches the July 2025 list |
| P3012 | FungaFiles 24 files/pk — available | Each = 1 pack of 24 | Matches the July 2025 list |
| P3012-12 | "12 x 24 files/pk" — available | Pack of 12 (case 12) | Matches the July 2025 list; UPC question PF-13 |
| ~~P3095-115~~ | — | — | **NOT to be reactivated (owner, 2026-11-03 22:53):** it duplicates the existing 3095-115 (merged by the owner on 2026-10-11). |
| P3305 | Cracks & Calluses cream — available | Each, 4 oz | Matches the July 2025 list |
| P3355-STR | Nail cutter, straight blade — available | Each | Matches the July 2025 list |
| 6210-L-S / L-M / L-L / M-S / M-M / M-L / M-XL | Darco post-op shoe — all 7 available | Each | All match the July 2025 list |

Kept inactive as instructed: P3095-115 (duplicate), 8621 (unavailable on pedifix.com), P3305-PACKET-100, M905RFG, M905SUB, R3295, D28.
P3306 stays retired.

## Current PediFix documentation (searched 2026-11-03)

No current (2026) PediFix catalog or price list is public. On stores.pedifix.com there are only wholesale catalogs
"Volume 18R" and "Volume 19M": no year, no prices, and neither lists P244 or D09-TTU. The July 2025 price list stays the
commercial source. **No PediFix price is changed without Angelo's approval.** Ask PediFix for the current catalog and
price list along with the questions above.

## Source-note correction (2026-11-19)

The 47 pages whose PediFix bullets were restored on 2026-11-18 now say, in their features source note, where the item also
appears in the catalog HCPS holds as `pedifix-catalog-2025.pdf` (2021–2022 edition): 34 are listed on named catalog pages,
13 item numbers were not located there (pedifix.com stays their source). An earlier statement that the restored wording was
"not in the catalog" was wrong: the catalog carries the same products and much of the same wording.
Two earlier notes cited a PDF page index instead of the printed page: P3036 (blade refills) is on printed page **58** and
M905RR (JustForToenails) on page **59**, not "page 30". Corrected in the source notes; every other cited page was checked
against the page images and stands.

## Photos dealers see — live count (2026-11-19, staff View as Dealer)
The shop lists **488 PediFix part numbers; all 488 show a photo and none shows a placeholder** (every image URL answered
as an image). D17-DEX shows the display photo from catalog page 56. P3036 and P3071-PACKET-100 have no photo on their
product pages, but each carries a photo on the catalog layer, which the shop shows:
- **P3036** — PediFix's own package of "Pedi-Quick Safety Corn & Callus Trimmer Replacement Blades — 6 reversible
  replacement blades" (the right item). PF-8's "no photo" applies to the product page only.
- **P3071-PACKET-100** — the photo is the **6 oz FungaSoap bottle, not the 3 ml packets**. It is the wrong item and needs
  the owner's decision (remove it from the catalog layer, or keep it until PediFix supplies a packet photo). Not changed.

