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
