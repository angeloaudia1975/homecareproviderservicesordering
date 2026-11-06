# Claude implementation request — HCPS Partner 360 Showroom Designer

## Owner-approved outcome
Implement the FULL UI change in `angeloaudia1975/homecareproviderservicesordering`, keeping the current live ordering integration and existing floorplans stable. Upgrade the 360 Dealer Portal showroom to **Showroom Designer** (navigation label and page title), replacing its selectable equipment with the exact 24 entries in `showroom_equipment_manifest.json` in that order. Remove all former selection items from the picker, but NEVER delete existing placed items, snapshots, user data, or saved floorplans.

## Source code location verified
`public/index.html`, inline `<script id="sd-host">` owns `CATS`, `FP`, `PRESETS`, and localStorage `dealer-showroom-design` API shim. The later `<script id="sd-engine">` has `sdRenderGallery`, `sdLoadFootprints`, `sdLoadPresets`, `sdImageForItem`, `sdNaturalDimsForItem`, and on-canvas placement. `renderTabs()` contains `['showroom','Showroom',()=>showShowroomStudio(), ...]`.

## Work required
1. Update navbar to **Showroom Designer** and page header to **Showroom Designer**, including title/menus if applicable. Preserve IDs/routes.
2. Replace the current HCPS 9 generic categories plus four presets with the **24 exact items** from JSON. Keep existing product assignment, catalog/prices, per-item classification, gallery selection, floor placement, move/rotate/resize, snap/grid, cost and profit summaries, save/restore/snapshots. Do not turn the entire dealer platform into the Golden platform; this is only adapting its showroom visuals and equipment taxonomy.
3. Copy the 24 `icons/*.png` files to `public/assets/showroom/icons/` and 24 matching `floorplan/*.png` files to `public/assets/showroom/floorplan/`, or adapt paths consistently in the manifest. All icons are top-down, unlike the earlier isometric images. On gallery cards use `icons`, on placed canvas items use `floorplan`. The image must rotate together with its item and scale to the exact grid dimensions. Do not bake text/card borders into placement images.
4. Use distinct stable IDs for all 24 items. Do NOT use a single ambiguous `accessory` category for multiple items, or their placed images will all resolve to the same image. Add a stable category/type-to-asset registry for each item. Define how the four existing product-family choices (Lift Chairs, Power Chairs, Scooters, Beds) map to existing HCPS manufacturer catalog products, while preserving independent prefab records for showroom fixtures.
5. Make floor footprints default to `width_cells × height_cells` from JSON; 1 cell = 1 sq ft. **All 24 sizes must be editable by a dealer before placement and after placement**, including Golden-reference types. Allow 90° rotation and preserve individual overrides; see the full **REQUIRED OWNER ADDITION — editable item sizes** section below. The manifest values are starting sizes only, not immutable manufacturer dimensions.
6. Existing saved `custom_category`, `pending_category`, and `item_type` strings MUST be migrated/read without deleting or reclassifying old saved records. Old palette entries should stop appearing as NEW choices only. Do not run any destructive migration.
7. The Golden Flagship Liftchair and Golden Flagship Mobility are showroom DISPLAY fixtures, not ordinary product listings; retain exact names as requested. The rendered top-view assets are illustrative, not Golden's proprietary source assets. If the original Golden tool has a distinct flagship display icon, prefer matching that treatment over product-only shapes.
8. Do not touch Golden checkout/order processing, manufacturer access, MSRP/private dealer pricing guards, Golden price federation, order history, or 360 authentication.


## REQUIRED OWNER ADDITION — editable item sizes (2026-11-05)
**Every one of the 24 equipment types must support editing its width and depth, before placement AND after placement.** The manifest sizes are only suggested starting defaults. Do not lock any item to its source dimensions, including the Golden-reference items. The current implementation already has some per-item Resize functionality in `sd-engine`; reuse and improve that implementation rather than creating a second conflicting state system.

### Dealer experience
1. **Before placing:** Clicking any of the 24 picker cards offers editable numeric **Width (ft)** and **Depth (ft)** controls initially populated from that dealer's saved default for that item type, or from the manifest default. Display a calculated **Footprint (sq ft)** that updates live (`width × depth`). Provide **Rotate 90°**, **Place Item**, and an optional **Save as my default for future placements** action. Keep the click-to-place interaction understandable; do not silently place at an irreversible size.
2. **After placing:** Selecting a placed item must show the current Width, Depth, calculated sq ft and an obvious **Edit Size** action. Editable numeric width/depth and **Apply Size** must update that *one item only*, with a live visual preview where feasible. Keep **Rotate 90°** and the existing move/drag, assign product, snapshot and save workflows available.
3. **Individual size overrides:** One placed lift chair can be 4 × 4 ft while a second is 5 × 5 ft. The model/SKU assigned to the item must not reset the user's custom footprint. Resizing a product is independent of changing the default for its equipment type.
4. **Dealer-defined defaults:** Allow a dealer to save a new preferred width/depth by equipment type for future additions (and reset each item to the manifest factory default). Defaults must be scoped to the same authenticated dealer / design ownership rules as the existing showroom; saving a default must never resize existing placed items or modify another dealer's settings.
5. **Floor alignment:** One cell = 1 ft × 1 ft. Accept positive whole-foot increments in the current grid, and clearly label this limitation (fractional feet would require a separate grid-resolution change). Reject zero/negative, nonnumeric or out-of-range dimensions. Respect grid limits and use 1–150 ft inputs only where those values can fit the active plan.
6. **Collision/bounds behavior:** Before confirming a resize or rotation, validate occupied cells, edges, and any areas marked `Not floor`. Show a clear error and preserve the last valid position/size if the new footprint conflicts. Never move other items, remove objects, delete floor cells or overwrite data automatically. Recompute all occupancy/overlap visuals and sq-ft/profit calculations after an accepted resize.
7. **Images must resize gracefully:** The provided `floorplan/*.png` file canvases reflect *starting* dimensions. When a dealer changes the size, the canvas must be sized by stored `width_cells` and `height_cells` (not PNG intrinsic pixels). Scale the top-down image cleanly with CSS; do not stretch the image grotesquely, crop it, or lose the 90° orientation. Keep item footprint boundaries visible. Thumbnail images in the equipment picker do not need to change.
8. **Persistence:** Save per-instance width/depth and any per-dealer item-type default using existing data storage conventions. Verify all settings survive Save, reload, floorplan switch, snapshot, restore, rotate, move and reassignment. Old saved floorplans and items must keep their existing dimensions without forced rewriting. Avoid introducing unauthorized cross-dealer data exposure.
9. **Usability:** Ensure size controls are accessible by keyboard, readable on mobile and desktop, and correctly named for screen readers. Do not remove the existing Resize feature: make the new editor the consistent visible path to it.

### Acceptance tests required
- All 24 picker types have editable Width and Depth before placement; displayed footprint and grid occupancy agree.
- Place two instances of the same equipment type with different sizes; they remain independent after Save/reload.
- Resize a placed item successfully, rotate it, move it and verify visible image/outline align exactly with occupied cells.
- Attempt resizing over an occupied item, over `Not floor`, and off the plan; each is rejected with no data loss.
- Set a dealer default, add a new instance, reset the default, and ensure all previously placed instances remain unchanged.
- Reopen and restore an older saved layout/snapshot; original dimensions and price/profit behavior are intact.
- Changing a product/SKU assignment must preserve an edited item footprint.

**No implementation is complete until users can edit equipment width and depth and see the accurately resized result on the actual showroom floor plan.**

## Verification before deploy
- 24/24 visible, correct order/title/size, no removed generic card or duplicate.
- 24/24 thumbnails load; 24/24 item images render on 1-foot grid; no wrong missing/blank icons; correct top-down orientation.
- Each placement occupies width × height cells; 90° rotation exchanges them without overflow; collision/edge checks pass.
- Save/reload/move/delete/restore and snapshot work, including two existing saved designs from before the change.
- Assigned HCPS products still work and cost/revenue/profit numbers unchanged; Golden pricing remains isolated.
- Desktop/mobile view, nav label, page header, keyboard and aria labels.
- Run full CI; preview screenshot + diff; open focused PR, review it, merge only if all checks pass; deploy and verify Published.

## Asset quality notes
The rendered icons are extracted, transparent-background illustrations from approved top-view design sheets, not SVG source or images cut out of screenshots. `previews/all_24_top_view_cards.png` is a comparison preview. Two items (`golden_flagship_liftchair`, `golden_flagship_mobility`) and a few very pale bath safety items should be visually reviewed against the original Golden showroom before deployment. If the user supplies the exact Golden icon source files, prefer those.
