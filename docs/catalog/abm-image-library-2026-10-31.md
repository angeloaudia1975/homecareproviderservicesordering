# ABM Respiratory Care — owner image library reconciliation (2026-10-31)

Source: owner-supplied `New folder.zip` (25 files, 23 distinct). The original files stay with the owner; each imported photo was
resized to ≤900 px and stored once by its bytes under `public/assets/products/abm-respiratory-care/gallery/`, and its
original file name + SHA-256 is recorded in `content-overrides/abm-respiratory-care.json` (`_images`). No prices in this file.

| File | Size | SHA-256 (16) | Matched to | Result | Why |
|---|---|---|---|---|---|
| Aerogen Mesh Nebulizer.jpg | 63×67 | `2eebf239a0eeb5f1` | — | Not used | 63×67 px — far too small; the Aerogen Solo is a component inside the BiWaze Clear circuits, not a catalog part. Needs a larger official photo if wanted as a detail view. |
| Aerogen power cable.jpg | 450×450 | `16bd59b53fdd0037` | BK389 (candidate) | Held | Two different cables were supplied under the same name (this grey one and the beige one below). Which one is ABM part BK389 is not verifiable from the files. |
| aerogen power cable.webp | 634×634 | `b176a4090d0293a7` | BK389 (candidate) | Held | See above — second, different cable. |
| BC21083-Carrying-Bag.jpg | 2471×2074 | `f1b5870fcbd7cc58` | BC21083 | Assigned — primary | Exact part number in the file name. Earlier abmrc.com crops kept as alternates. |
| BC21274-Air-Inlet-Filter.png | 1132×1086 | `e89b24676c6bf0c0` | BC21274 | Assigned — primary | Exact part number in the file name. |
| BC22496-Adapter.jpg | 1024×1024 | `66cabff608679baa` | BC22496 | Assigned — primary | Exact part number in the file name. |
| System Adapter.webp | 575×575 | `ce378a1d764e1204` | BC22496 | Duplicate | Same photo as BC22496-Adapter.jpg at a smaller size (575 px) — not imported. |
| BK371.jpg | 800×600 | `f850ef8ee6c94bfc` | BK371 | Assigned — primary | Exact part number in the file name (Nonin Xpod with sensor). |
| BV Filter.jpg | 151×145 | `1ec0f3fa84c19ba2` | BK281 or BC22480 (candidate) | Held | 151×145 px (low resolution) and the picture alone does not prove whether it is the dual-lumen B/V filter (BK281) or the standard 22 mm filter trap (BC22480). |
| BiWaze Cart -BC22506.jpg | 1024×1024 | `b30a9e7f2ef8a622` | BC22506 | Assigned — primary | Exact part number in the file name. The earlier photo of the cart with a BiWaze Cough mounted is kept as an alternate. |
| BiWaze Cough.webp | 600×493 | `0ec30f446268f2ba` | BC20113 | Duplicate | Already the BiWaze Cough System primary photo. |
| Biwaze Cougha.webp | 600×493 | `0ec30f446268f2ba` | BC20113 | Duplicate | Byte-identical to BiWaze Cough.webp. |
| Biwaze Clear.webp | 600×493 | `a18835f94c260768` | BK367 | Duplicate | Already the BiWaze Clear System primary photo. |
| BiWaze-Clear-_Mounthpiece.png | 1024×1024 | `1febb0d51eeef20b` | BK280 | Duplicate | Same picture as the current BK280 photo (already at full catalog size). |
| BiWaze-Clear_Mask.png | 1024×1024 | `6f29dda2af001fba` | BK289 / BK287 / BK285 | Duplicate | Same picture as the current adult face-mask circuit photo. Not used for the child circuit BK291 — the mask size in the photo is not stated. |
| BiWaze-Clear_Trach.png | 1024×1024 | `43bcc09997de583d` | BK293 | Duplicate | Same picture as the current BK293 photo. |
| dual lumen circuit.jfif | 447×447 | `57b3fa322322e039` | BK293 | Duplicate | Same picture as BiWaze-Clear_Trach.png at 447 px. It is a BiWaze CLEAR circuit (handset) — not used for the BiWaze Cough dual-lumen circuits. |
| BiWaze-User-Manual_1.jpg | 1024×1024 | `a9453dc145b2f982` | BC21084 | Duplicate | Same cover as the current BiWaze Cough User Manual photo. It is the Cough manual — not used for the Clear manual BK381. |
| BiWaze standard circuit.png | 1024×1024 | `d17aeb26038a79ce` | BC21087, BC21092, BC21090 (primary); BC21088/89/273 (2nd photo) | Assigned — family photo | Single-path tube, adapter and B/V filter of the BiWaze Cough standard circuit. The patient interface is not in the photo; each page's note says so. |
| cough standard circuit.jfif | 447×447 | `986bb4f736c41b03` | BiWaze Cough standard circuits | Duplicate | Same picture as BiWaze standard circuit.png at 447 px. |
| standard circuit.jfif | 447×447 | `f136ca3d01039199` | — | Not used | A different circuit (green fittings, clear corrugated tube) whose maker and part number cannot be confirmed as ABM — not assigned to any ABM circuit. |
| BiWaze-Power-Cord.jpg | 1024×1024 | `0bc55e2232337d25` | BC20116 | Assigned — primary | USA plug (NEMA 5-15) visible. Not used for the Switzerland (BC2396) or Australia (BC23966) cords. |
| BiWaze Trach Adapter.jpg | 1024×1024 | `a289948e08b4cf28` | — | Held (component) | A trach adapter on its own — a part of the trach circuits, not a catalog part. Not used as a circuit photo; similarly named circuits are not assumed to use the same adapter. |
| Trach Adapter.jpg | 1024×1024 | `a289948e08b4cf28` | — | Duplicate | Byte-identical to BiWaze Trach Adapter.jpg. |
| BiWaze-Mouthpiece.jpg | 1024×1024 | `1f3731a96ee2a439` | — | Held (component) | A mouthpiece on its own — part of the mouthpiece circuits, not a catalog part. Not used as a circuit photo. |

## Image exception register (owner decisions 2026-10-31 15:39 CT)

ABM is approved with these exceptions. Every SKU below stays orderable: its card shows the standard placeholder (no broken
image, no borrowed photo). A held file is assigned only after it is identified from an official ABM source — never guessed.
Status is kept current here; sourcing continues from official ABM material only.

| SKU | Item | Status | What closes it |
|---|---|---|---|
| BK389 | Aerogen® Power Cable | Open — held candidates | Two different "Aerogen power cable" photos in the library (grey, beige). Not assigned until ABM confirms which is BK389. |
| BK281 | Dual Lumen B/V Filter | Open — held candidate | "BV Filter.jpg" is low resolution and could be BK281 or BC22480. Not assigned until identified. |
| BC22480 | Standard Filter Trap | Open — held candidate | As BK281. |
| BK291 | BiWaze Clear Dual Lumen – Child Face Mask | Open | Official photo of the child mask circuit. |
| BK373 / BK372 / BK374 | Nonin Sensor – Small / Medium / Large | Open | Official photo of the Nonin sensor (one photo may serve all three sizes if ABM's own photo shows the sensor family). |
| BK381 | BiWaze Clear User Manual | Open | Cover of the current BiWaze Clear user manual (the item is the document). |
| BC21095 | Battery | Open | Official battery photo. |
| BC23400 / BC23406 / BC23412 / BC23418 / BC23387 / BC23394 | BiWaze Cough Dual Lumen Circuits (child, adult S/M/L face mask, mouthpiece, trach) | Open | Official photos of the Cough dual-lumen circuit; the standard (single-lumen) circuit photo is not used on them. |
| BC2396 / BC23966 | Switzerland / Australia Power Cord | Open | Official photo of each country cord (the USA cord photo is not reused). |
| BK536 / BC21275 | BiWaze Clear / Cough Extended Warranty | Not applicable | A service, not a physical product — placeholder by design. |

Other decisions recorded with this register:
- **BK388** keeps the ABM price-list name and description ("BiWaze Clear Home Care QRG"). Its photo is page 1 of the guide printed
  "BK388 Rev 5.0 SEP-2025", which ABM titles "Hospital and Long-Term Care" — the title difference is on the open questions
  list for ABM; the price-list wording stands until it is reconciled.
- **BC21275** has no purchase restriction (none is printed on ABM's list). **BK536** keeps the printed rule (only with a
  BK367, at most 2 per system).
- **Extended warranties** keep the documented maximum ("maximum 2 years extended"); clarification of the terms is on the
  open questions list for ABM.

## Update 2026-11-02 — seven SKUs retired, second owner library ("New folder (2).zip")

**Retired (owner, 2026-11-02 — not purchased through the HCPS dealer platform):** BK388, BK381, BC23966, BC23891,
BC23575, BC21084, BC2396. Reversible retirement (content-overrides `_retired`): their SKU entries are switched off, so
the storefront, search, cart, order server and new hub actions (quote, price request, showroom, pricing export) drop them;
the catalog file, its private price record, history and existing quotes are untouched. 42 → 35 active SKUs, 34 → 27 cards.
They leave the exception register.

| File | Pixels | SHA-256 (16) | Decision | Reason |
|---|---|---|---|---|
| BC21087.webp | 1001×1001 | `e79d2f452c10ec27` | BC21087 — primary | Standard (single-lumen) Cough circuit with face mask and filter (same photo as "standard circuit.jfif" in the first library, now identified). Mask size is not distinguishable in the photo. The earlier family photo stays as a second view. |
| BC22480.jfif | 447×447 | `cba4b30f3360245c` | BC22480 | Inline disc filter = "Standard Filter Trap" (item C in ABM's BiWaze Clear Quick Reference Guide). |
| BK291.jpg | 670×670 | `8e1656e4e70661a4` | BK291 | BiWaze Clear dual-lumen circuit with face mask — a different photograph from the adult page's photo. |
| BK373.jpg | 879×900 | `91a2cfc349f9b6e2` | BK373, BK372, BK374 | Nonin sensors: the photo shows the small, medium and large sensors together, so it represents each size. |
| BK536.jfif | 503×397 | `5a9b340a2d4c3cd3` | BK536 | Warranty badge (1 year factory + 1 year extended) — a warranty representation, allowed by the owner for warranty records. |
| BC21275.webp | 1024×808 | `8bad36f231b4d6c8` | BC21275 | As BK536. |
| BK389.webp | 634×634 | `b176a4090d0293a7` | Held | The same photograph as the beige "aerogen power cable.webp" in the first library (perceptual match). Its label shows a supplier part number ("P/N 82-00…"), not BK389 — no new evidence. |
| BV Filter.jpg | 151×145 | `1ec0f3fa84c19ba2` | Held (identified as BK281) | Same file as before. Now identified: the coaxial dual-lumen B/V filter with oxygen port (item A in ABM's Quick Reference Guide) = BK281; BC22480 has its own, different photo. Below the 300 px minimum — needs a larger copy. |
| BC21095.webp | 1001×1001 | `4737fe4dbeea65b9` | Held | Shows the underside of the device with the battery compartment cover, not the battery. |

### Image exception register (current, 2026-11-02)

35 active SKUs, 26 with a verified photo. Without one (placeholder shown, ordering not blocked):

| SKU | Item | What closes it |
|---|---|---|
| BK389 | Aerogen® Power Cable | ABM confirms which cable (grey or beige) is BK389. |
| BK281 | Dual Lumen B/V Filter | A larger copy (≥300 px) of the identified B/V filter photo. |
| BC21095 | Battery | ABM's photo of the battery itself, or confirmation that the compartment photo is their image for it. |
| BC23400 / BC23406 / BC23412 / BC23418 / BC23387 / BC23394 | BiWaze Cough Dual Lumen Circuits (child, adult S/M/L face mask, mouthpiece, trach) | Official photos of the Cough dual-lumen circuit. |

Resolved: BK291, BK373 / BK372 / BK374, BC22480, BC21087 (exact photo), BK536 and BC21275 (warranty badge). Retired and
removed from the register: BK381, BC2396, BC23966 (and BK388, BC23891, BC23575, BC21084, which had photos).
