// Showroom Designer upgrade (owner package v2, 2026-11-05): executes the shipped code from public/index.html.
//   - the host's 24-type registry equals docs/showroom/showroom_equipment_manifest.json (ids, order, sizes, assets)
//   - every icon and floor-plan sprite exists, and each type has its own sprite
//   - whole-foot size checks, the image box derived from an item's own size + angle, the legacy read map
//   - the browser-store backend: per-dealer default sizes (validated, never touching items), the catalog placeholder
//     category fix, new equipment_type kept through every update, old records never rewritten
//   node test/showroom-designer.test.js        (SHOWROOM_SRC=file to run against another copy, for mutation runs)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const H = fs.readFileSync(process.env.SHOWROOM_SRC || path.join(ROOT, 'public', 'index.html'), 'utf8');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'showroom', 'showroom_equipment_manifest.json'), 'utf8'));
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok  ', n); } catch (e) { fail++; console.log('FAIL', n, '\n    ', e && e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const block = (start, from) => { const i = H.indexOf(start, from || 0); if (i < 0) throw new Error('missing ' + start); let d = 0, j = H.indexOf('{', i); for (; j < H.length; j++) { if (H[j] === '{') d++; else if (H[j] === '}' && --d === 0) break; } return H.slice(i, j + 1); };
const HOST = (() => { const a = H.indexOf('Partner 360 Stage 5 — Showroom Studio host adapter'); const s = H.lastIndexOf('<script', a); const b = H.indexOf('<script id="sd-engine">', a); return H.slice(H.indexOf('>', s) + 1, H.lastIndexOf('</script>', b)); })();
const ENGINE_AT = H.indexOf('<script id="sd-engine">');

/* The whole host script, run with a fake browser: its localStorage backend is reached through window.fetch. */
function host(storeInit, dealer) {
  const ls = new Map(); if (storeInit) ls.set('hcps_sd_dealer', JSON.stringify(storeInit));
  const window = { fetch: async () => { throw new Error('network'); } };
  const AUTH = { dealer: { id: dealer === undefined ? 'dealer-A' : dealer } };
  const ctx = { window, AUTH, console, JSON, Object, Array, Number, String, Math, Date, Promise, isNaN, decodeURIComponent, encodeURIComponent,
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)) }, document: { getElementById: () => null, body: { classList: { add() {}, remove() {} } } } };
  vm.createContext(ctx); vm.runInContext(HOST, ctx);
  const call = async (url, opts) => (await window.fetch('/.netlify/functions/dealer-showroom-design' + url, opts)).json();
  return { window, call, auth: AUTH, raw: () => JSON.parse(ls.get('hcps_sd_dealer') || 'null') };
}
/* Engine helpers lifted exactly as they ship, with the registry the host publishes. */
function engine(win, grid) {
  const ctx = { window: win, console, JSON, Number, String, Math, Object, Array, MAX_DIM: 150, gridWidth: grid ? grid[0] : 0, gridHeight: grid ? grid[1] : 0 };
  vm.createContext(ctx);
  const names = ['function sdCategoryForModel(', 'function sdEquipList(', 'function sdEquipById(', 'function sdEquipForItem(', 'function sdEquipDefaultSize(', 'function sdCheckSize(', 'function sdNaturalDimsForItem(', 'function sdImageSrc('];
  vm.runInContext('var _sdTypeDefaults=null;\n' + names.map(n => block(n, ENGINE_AT)).join('\n'), ctx);
  return ctx;
}

(async () => {
  const h = host();
  const REG = h.window.__sdEquipment;
  await t('the registry is the owner manifest: 24 types, same ids, order, labels and starting sizes', () => {
    eq(REG.length, 24); eq(MAN.length, 24);
    eq(REG.map(e => [e.id, e.label, e.w, e.h]), MAN.map(m => [m.id, m.label, m.width_cells, m.height_cells]));
    eq(REG.map(e => [e.icon, e.plan]), MAN.map(m => [m.icon_path, m.floorplan_path]));
  });
  await t('every type has its own icon and its own floor-plan sprite, and every file is installed', () => {
    eq(new Set(REG.map(e => e.id)).size, 24, 'ids'); eq(new Set(REG.map(e => e.plan)).size, 24, 'sprites shared'); eq(new Set(REG.map(e => e.icon)).size, 24, 'icons shared');
    for (const e of REG) for (const f of [e.icon, e.plan]) ok(fs.existsSync(path.join(ROOT, 'public', f)) && fs.statSync(path.join(ROOT, 'public', f)).size > 1000, 'missing ' + f);
  });
  await t('only Lift Chairs, Power Chairs, Scooters and Beds take a catalog product, mapped to the catalog families', () => {
    eq(REG.filter(e => e.catalog).map(e => [e.id, e.catalog]), [['lift_chairs', 'lift_chair'], ['power_chairs', 'power_chair'], ['scooters', 'scooter'], ['beds', 'bed']]);
  });
  await t('the old quick-add presets are no longer offered', async () => { eq((await h.call('?action=presets')).presets, []); });
  await t('labels: every type id reads as its owner label (summaries, details)', () => { for (const e of REG) eq(h.window.__sdCategoryLabels[e.id], e.label); });

  const E = engine(h.window, [30, 20]);
  await t('size check: whole feet 1–150 that fit the floor; everything else refused with a reason', () => {
    eq(E.sdCheckSize('4', '6'), { ok: true, w: 4, h: 6 });
    for (const [w, d, re] of [['', '3', /Enter a width/], ['abc', '3', /Enter a width/], ['0', '3', /at least 1/], ['-1', '3', /at least 1/], ['2.5', '3', /whole feet/i], ['151', '3', /at most 150/], ['31', '3', /bigger than your floor/], ['3', '21', /bigger than your floor/]]) {
      const r = E.sdCheckSize(w, d); ok(!r.ok && re.test(r.reason), w + 'x' + d + ' ' + JSON.stringify(r)); }
    eq(E.sdCheckSize('30', '20').ok, true, 'exactly the floor size fits');
    eq(E.sdCheckSize('2', '25', true), { ok: true, w: 2, h: 25 }, 'shape checked before turning (rotate first, fit after)');
  });
  await t("an image's un-rotated box comes from the item's OWN size and angle (any edited size stays aligned)", () => {
    eq(E.sdNaturalDimsForItem({ width_cells: 4, height_cells: 7, rotation_deg: 0 }), { w: 4, h: 7 });
    eq(E.sdNaturalDimsForItem({ width_cells: 7, height_cells: 4, rotation_deg: 90 }), { w: 4, h: 7 });
    eq(E.sdNaturalDimsForItem({ width_cells: 4, height_cells: 7, rotation_deg: 180 }), { w: 4, h: 7 });
    eq(E.sdNaturalDimsForItem({ width_cells: 7, height_cells: 4, rotation_deg: 270 }), { w: 4, h: 7 });
    eq(E.sdNaturalDimsForItem({ width_cells: 3, height_cells: 3 }), { w: 3, h: 3 });
  });
  await t('which type an item is: new items by equipment_type; old records READ through the legacy map', () => {
    const id = it => (E.sdEquipForItem(it) || {}).id || null;
    eq(id({ item_type: 'custom', equipment_type: 'round_table', custom_category: 'whatever' }), 'round_table');
    eq(id({ item_type: 'golden', equipment_type: 'scooters', model: 'X' }), 'scooters');
    eq(id({ item_type: 'golden', pending_category: 'lift_chair' }), 'lift_chairs');
    eq(id({ item_type: 'golden', category: 'bed' }), 'beds', 'old placeholder saved with category only');
    eq(id({ item_type: 'golden', pending_category: 'ramp' }), null, 'old ramp placeholder keeps its plain block');
    eq(id({ item_type: 'custom', custom_name: 'Display Shelving', custom_category: 'accessory' }), 'display_shelving');
    eq(id({ item_type: 'custom', custom_name: 'Checkout Counter', custom_category: 'accessory' }), 'checkout_counter');
    eq(id({ item_type: 'custom', custom_name: 'Reception Desk', custom_category: 'accessory' }), null);
    eq(id({ item_type: 'custom', custom_name: 'Waiting Seating', custom_category: 'seating' }), null);
    eq(id({ item_type: 'custom', custom_name: 'Pride LC-525', custom_category: 'lift_chair' }), null, 'a recorded competitor product without a type');
    eq(id({ item_type: 'custom', custom_category: 'commodes' }), 'commodes');
  });
  await t("a dealer's saved default is the starting size; without one, the manifest size", () => {
    const lc = E.sdEquipById('lift_chairs');
    eq(E.sdEquipDefaultSize(lc), { w: 5, h: 5, rot: 0, mine: false });
    E._sdTypeDefaults = { lift_chairs: { width_cells: 4, height_cells: 6 } };
    eq(vm.runInContext('_sdTypeDefaults={lift_chairs:{width_cells:6,height_cells:4,rotation_deg:90}}; sdEquipDefaultSize(sdEquipById("lift_chairs"))', E), { w: 6, h: 4, rot: 90, mine: true }, 'a default keeps its angle');
  });

  /* ---------- the browser-store backend ---------- */
  const OLD = { seq: 2, designs: { d1: { id: 'd1', name: 'Old', grid_width: 10, grid_height: 10, floor_cells: [], itemSeq: 2, snapshots: {}, snapSeq: 0,
    items: { a: { id: 'a', item_type: 'golden', category: 'lift_chair', width_cells: 3, height_cells: 4, cell_x: 0, cell_y: 0, rotation_deg: 0, turn_rate_weeks: 4 },
             b: { id: 'b', item_type: 'golden', model: 'M1', pending_category: 'ramp', width_cells: 3, height_cells: 4, cell_x: 4, cell_y: 0, dealer_cost: 100, sales_price: 250, rotation_deg: 0, turn_rate_weeks: 4 } } } } };
  await t('opening an old floorplan rewrites nothing (the read is a read)', async () => {
    const b = host(JSON.parse(JSON.stringify(OLD))); const before = JSON.stringify(b.raw());
    const r = await b.call('?design_id=d1'); eq(r.items.length, 2); await b.call('?action=designs'); await b.call('?action=type_defaults');
    eq(JSON.stringify(b.raw()), before);
  });
  await t('a new catalog placeholder is stored with pending_category (it used to read "Uncategorized")', async () => {
    const b = host(JSON.parse(JSON.stringify(OLD)));
    const r = await b.call('?action=items', { method: 'POST', body: JSON.stringify({ design_id: 'd1', item_type: 'golden', category: 'scooter', equipment_type: 'scooters', width_cells: 3, height_cells: 5, cell_x: 0, cell_y: 5, rotation_deg: 90 }) });
    eq([r.item.pending_category, r.item.equipment_type, r.item.rotation_deg, r.item.width_cells, r.item.height_cells], ['scooter', 'scooters', 90, 3, 5]);
  });
  await t('equipment_type and a custom size survive assign, resize, move, rotate and a turn-rate update', async () => {
    const b = host(JSON.parse(JSON.stringify(OLD)));
    const it = (await b.call('?action=items', { method: 'POST', body: JSON.stringify({ design_id: 'd1', item_type: 'golden', category: 'lift_chair', equipment_type: 'lift_chairs', width_cells: 4, height_cells: 4, cell_x: 0, cell_y: 5 }) })).item;
    const up = async extra => (await b.call('?action=items', { method: 'POST', body: JSON.stringify(Object.assign({ id: it.id, design_id: 'd1' }, extra)) })).item;
    let x = await up({ item_type: 'golden', model: 'SKU1', width_cells: 4, height_cells: 4, cell_x: 0, cell_y: 5 });           // assign (engine never sends equipment_type)
    eq([x.equipment_type, x.width_cells, x.height_cells, x.model], ['lift_chairs', 4, 4, 'SKU1']);
    x = await up({ item_type: 'golden', model: 'SKU1', width_cells: 4, height_cells: 6, rotation_deg: 90 }); eq([x.width_cells, x.height_cells, x.rotation_deg, x.equipment_type], [4, 6, 90, 'lift_chairs']);
    x = await up({ item_type: 'custom', custom_name: 'Pride LC', custom_category: 'lift_chair', width_cells: 4, height_cells: 6 }); eq([x.item_type, x.equipment_type, x.width_cells], ['custom', 'lift_chairs', 4]);
    x = await up({ turn_rate_weeks: 2 }); eq([x.turn_rate_weeks, x.width_cells, x.height_cells, x.rotation_deg], [2, 4, 6, 90]);
  });
  await t('dealer defaults: saved, validated, reset — and never change a placed item', async () => {
    const b = host(JSON.parse(JSON.stringify(OLD))); const items = () => JSON.stringify(b.raw().designs.d1.items);
    const before = items();
    eq((await b.call('?action=type_defaults', { method: 'POST', body: JSON.stringify({ type: 'lift_chairs', width_cells: 4, height_cells: 6 }) })).defaults, { lift_chairs: { width_cells: 4, height_cells: 6, rotation_deg: 0 } });
    for (const bad of [{ type: 'lift_chairs', width_cells: 0, height_cells: 6 }, { type: 'lift_chairs', width_cells: 2.5, height_cells: 6 }, { type: 'lift_chairs', width_cells: 151, height_cells: 6 }, { type: 'lift_chairs', width_cells: 'x', height_cells: 6 }, { type: 'reception_desk', width_cells: 4, height_cells: 4 }, { type: 'lift_chairs', width_cells: 4, height_cells: 6, rotation_deg: 45 }]) {
      const r = await b.call('?action=type_defaults', { method: 'POST', body: JSON.stringify(bad) }); ok(r.ok === false, 'accepted ' + JSON.stringify(bad)); }
    eq((await b.call('?action=type_defaults')).defaults, { lift_chairs: { width_cells: 4, height_cells: 6, rotation_deg: 0 } }, 'bad writes changed the defaults');
    eq((await b.call('?action=type_defaults', { method: 'POST', body: JSON.stringify({ type: 'lift_chairs', reset: true }) })).defaults, {});
    eq(items(), before, 'placed items changed');
  });
  await t("defaults belong to the signed-in dealer: another dealer on the same browser never sees or changes them", async () => {
    const b = host(JSON.parse(JSON.stringify(OLD)), 'dealer-A');
    await b.call('?action=type_defaults', { method: 'POST', body: JSON.stringify({ type: 'beds', width_cells: 4, height_cells: 9, rotation_deg: 90 }) });
    b.auth.dealer = { id: 'dealer-B' };
    eq((await b.call('?action=type_defaults')).defaults, {}, 'dealer B sees A\'s defaults');
    await b.call('?action=type_defaults', { method: 'POST', body: JSON.stringify({ type: 'beds', reset: true }) });
    b.auth.dealer = { id: 'dealer-A' };
    eq((await b.call('?action=type_defaults')).defaults, { beds: { width_cells: 4, height_cells: 9, rotation_deg: 90 } }, 'B reset A\'s default');
    b.auth.dealer = null;
    const r = await b.call('?action=type_defaults', { method: 'POST', body: JSON.stringify({ type: 'beds', width_cells: 2, height_cells: 2 }) }); ok(r.ok === false, 'saved while signed out');
    eq((await b.call('?action=type_defaults')).defaults, {}, 'signed out sees defaults');
  });
  await t('snapshot + restore keep each item\'s own size, angle and type', async () => {
    const b = host(JSON.parse(JSON.stringify(OLD)));
    await b.call('?action=items', { method: 'POST', body: JSON.stringify({ design_id: 'd1', item_type: 'custom', custom_name: 'Round Table', custom_category: 'round_table', equipment_type: 'round_table', width_cells: 3, height_cells: 5, rotation_deg: 90, cell_x: 6, cell_y: 5 }) });
    const snap = (await b.call('?action=snapshot', { method: 'POST', body: JSON.stringify({ design_id: 'd1' }) })).snapshot;
    const id = Object.keys(b.raw().designs.d1.items).pop();
    await b.call('?action=items', { method: 'POST', body: JSON.stringify({ id, design_id: 'd1', width_cells: 1, height_cells: 1, rotation_deg: 0 }) });
    const r = await b.call('?action=restore', { method: 'POST', body: JSON.stringify({ design_id: 'd1', snapshot_id: snap.id }) });
    const x = r.items.find(i => i.id === id); eq([x.width_cells, x.height_cells, x.rotation_deg, x.equipment_type], [3, 5, 90, 'round_table']);
    eq(r.items.find(i => i.id === 'b').sales_price, 250, 'priced old item');
  });
  await t('snapshot summary for an old priced item is unchanged ($150 profit, 12 sq ft, 4-week turn)', async () => {
    const b = host(JSON.parse(JSON.stringify(OLD)));
    const s = (await b.call('?action=snapshot', { method: 'POST', body: JSON.stringify({ design_id: 'd1' }) })).snapshot.summary_json;
    // the store's snapshot summary has always used MONTHLY profit per sq ft (162.375 / 12); unchanged by this upgrade
    eq([Math.round(s.estimated_monthly_profit * 100) / 100, Math.round(s.estimated_monthly_revenue * 100) / 100, s.total_showroom_cost, s.profit_per_sqft.overall], [162.38, 270.63, 100, 13.53125]);
    ok(s.by_category.lift_chair && s.by_category.lift_chair.count === 1, 'old placeholder (category only) counted under its family: ' + JSON.stringify(s.by_category));
  });
  await t('Golden stays out of the showroom catalog feed (B2 rule) and the showroom never calls the network', () => {
    ok(/!\(typeof isGoldenSlug==='function'&&isGoldenSlug\(m\.slug\)\)/.test(HOST), 'Golden skip');
    ok(/indexOf\('dealer-showroom-design'\)>=0\) return handle\(/.test(HOST), 'showroom calls answered in the browser');
  });
  await t('navigation, page heading and engine tab say Showroom Designer', () => {
    ok(/\['showroom','Showroom Designer',\(\)=>showShowroomStudio\(\)/.test(H), 'nav'); ok(/<h1 class="section-title">Showroom <span>Designer<\/span><\/h1>/.test(H), 'h1'); ok(/'📐 Showroom Designer'/.test(H), 'engine tab');
  });
  console.log(`showroom designer: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
