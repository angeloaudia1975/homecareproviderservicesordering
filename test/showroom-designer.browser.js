/* Showroom Designer upgrade (owner package v2, 2026-11-05) — browser walkthrough of the REAL storefront page through
   _shop-harness.js (nothing reaches HCPS / Golden / Supabase; the showroom itself lives in the dealer's browser store).
   Covers the owner's acceptance list: the 24 types (order, names, sizes, icons, sprites), Width/Depth before placing,
   per-item sizes that stay independent through save/reload, Edit Size / rotate / move with the image matching the
   occupied squares, rejected resizes (other item, Not floor, off the plan) losing nothing, dealer defaults that never
   resize placed items, product (re)assignment keeping a custom size, snapshot restore, and two floorplans saved BEFORE
   the upgrade opening with their sizes, images and profit figures intact. Phone / tablet / desktop layouts.
   PLAYWRIGHT_MODULE=… node test/showroom-designer.browser.js            (SHOTS=dir for screenshots) */
const { chromium, open, path, fs } = require('./_shop-harness.js');
const SHOTS = process.env.SHOTS || '/tmp/showroom-designer-shots'; fs.mkdirSync(SHOTS, { recursive: true });
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'showroom', 'showroom_equipment_manifest.json'), 'utf8'));
const OPTS = process.env.SHOWROOM_SRC ? { html: () => fs.readFileSync(process.env.SHOWROOM_SRC, 'utf8') } : {};   // mutation runs
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }

const KEY = 'hcps_sd_dealer';   // the store key the live page uses today (see the report: per-dealer keys need a separate migration)
/* Two floorplans exactly as the pre-upgrade code saved them (no equipment_type; a catalog placeholder stored with
   `category` only; old quick-add presets; a priced catalog item; a rotated item; a snapshot). */
const cells = (w, h, holes) => { const a = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!(holes || []).some(c => c[0] === x && c[1] === y)) a.push({ x, y }); return a; };
const LEGACY_ITEMS = {
  it1_1: { id: 'it1_1', cell_x: 0, cell_y: 0, item_type: 'golden', width_cells: 3, height_cells: 4, dealer_cost: null, category: 'lift_chair', sales_price: null, turn_rate_weeks: 4, rotation_deg: 0 },
  it1_2: { id: 'it1_2', cell_x: 5, cell_y: 0, item_type: 'custom', width_cells: 1, height_cells: 3, dealer_cost: null, custom_name: 'Display Shelving', custom_category: 'accessory', sales_price: null, turn_rate_weeks: 4, rotation_deg: 90 },
  it1_3: { id: 'it1_3', cell_x: 8, cell_y: 0, item_type: 'custom', width_cells: 5, height_cells: 2, dealer_cost: null, custom_name: 'Reception Desk', custom_category: 'accessory', sales_price: null, turn_rate_weeks: 4, rotation_deg: 0 },
  it1_4: { id: 'it1_4', cell_x: 0, cell_y: 6, item_type: 'golden', model: 'A4U-LEGACY-1', width_cells: 3, height_cells: 4, dealer_cost: 100, sales_price: 250, turn_rate_weeks: 4, rotation_deg: 0, pending_category: 'ramp' }
};
const LEGACY = { seq: 3, designs: {
  d1: { id: 'd1', name: 'Main Showroom (before upgrade)', grid_width: 20, grid_height: 15, floor_cells: cells(20, 15, [[19, 14]]), items: LEGACY_ITEMS, itemSeq: 4,
    snapshots: { sn1_1: { id: 'sn1_1', snapshot_date: '2026-10-01T12:00:00.000Z', snapshot_type: 'manual', summary_json: {}, layout_json: { showroom: { id: 'd1', name: 'Main Showroom (before upgrade)', grid_width: 20, grid_height: 15, floor_cells: cells(20, 15, [[19, 14]]) }, items: Object.values(LEGACY_ITEMS) } } },
    snapSeq: 1, updated_at: '2026-10-01T12:00:00.000Z' },
  d2: { id: 'd2', name: 'Annex (before upgrade)', grid_width: 12, grid_height: 10, floor_cells: cells(12, 10), items: { it2_1: { id: 'it2_1', cell_x: 1, cell_y: 1, item_type: 'custom', width_cells: 4, height_cells: 2, custom_name: 'Waiting Seating', custom_category: 'seating', dealer_cost: 40, sales_price: 90, turn_rate_weeks: 2, rotation_deg: 0 } }, itemSeq: 1, snapshots: {}, snapSeq: 0, updated_at: '2026-10-02T12:00:00.000Z' }
} };

const store = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const items = async (page, d) => Object.values(((await store(page)).designs[d] || {}).items || {});
async function openDesigner(page) {
  await page.evaluate(() => showShowroomStudio());
  await page.waitForFunction(() => { const s = document.getElementById('sec-showroom'); return s && getComputedStyle(s).display !== 'none' && getComputedStyle(document.getElementById('sd-loading')).display === 'none'; }, null, { timeout: 30000 });
  await page.waitForTimeout(400);
}
async function openPlan(page, id) {
  await page.waitForSelector('#sd-picker-list', { state: 'attached' });
  await page.evaluate(id => { const b = [...document.querySelectorAll('#sd-picker-list button')].find(x => (x.getAttribute('onclick') || '').includes(id) && /open/i.test(x.textContent)); (b || [...document.querySelectorAll('#sd-picker-list [onclick*="' + id + '"]')][0]).click(); }, id);
  await page.waitForFunction(() => document.querySelectorAll('#sd-grid .sd-cell').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(500);
}
async function clickCell(page, x, y) {
  await page.evaluate(([x, y]) => { const g = document.getElementById('sd-grid'); const w = parseInt(getComputedStyle(g).gridTemplateColumns.split(' ').length, 10); g.children[y * w + x].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }, [x, y]);
}
async function place(page, design, id, w, h, x, y, rotateFirst) {
  const before = (await items(page, design)).length;
  await page.evaluate(id => sdOpenEquip(id), id);
  await page.waitForSelector('#sd-equip-form #sd-equip-w', { state: 'visible' });
  await page.fill('#sd-equip-w', String(w)); await page.fill('#sd-equip-h', String(h));
  if (rotateFirst) await page.click('#sd-equip-form button:has-text("Rotate 90°")');
  await page.click('#sd-equip-place');
  await clickCell(page, x, y);
  await page.waitForFunction(([k, d, n]) => Object.keys((JSON.parse(localStorage.getItem(k)).designs[d] || {}).items || {}).length > n, [KEY, design, before], { timeout: 10000 });
  await page.waitForTimeout(150);
  const all = await items(page, design); return all[all.length - 1];
}
/* What is drawn for one item: the block's box in grid squares, the image's un-rotated box and its angle. */
const drawn = (page, itemId) => page.evaluate(id => {
  const el = document.querySelector('#sd-grid .sd-item-block[data-id="' + id + '"]'); if (!el) return null;
  const img = el.querySelector('img'); const cs = el.style;
  return { w: parseInt(cs.width, 10) / 20, h: parseInt(cs.height, 10) / 20, x: parseInt(cs.left, 10) / 20, y: parseInt(cs.top, 10) / 20,
    img: img ? { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, w: parseInt(img.style.width, 10) / 20, h: parseInt(img.style.height, 10) / 20, rot: (/rotate\((\d+)deg\)/.exec(img.style.transform) || [])[1] || null, fit: getComputedStyle(img).objectFit } : null };
}, itemId);
async function modalErr(page) { return page.evaluate(() => { const e = document.getElementById('sd-resize-err'); return e && e.style.display !== 'none' ? e.textContent : ''; }); }

(async () => {
  const browser = await chromium.launch();
  try {
    /* ================= desktop: the full acceptance walkthrough ================= */
    const { ctx, page } = await open(browser, 1280, 900, OPTS);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const sdCalls = []; page.on('request', r => { if (/dealer-showroom-design/.test(r.url())) sdCalls.push(r.url()); });
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, LEGACY]);
    await openDesigner(page);

    await t('navigation tab and page heading read "Showroom Designer"', async () => {
      const r = await page.evaluate(() => ({ tab: (document.querySelector('#tabs .navtab.active') || {}).textContent || '', h1: document.querySelector('#sec-showroom h1').textContent, legacyTab: (document.getElementById('sd-tab') || {}).textContent || '' }));
      ok(/^\s*Showroom Designer\s*$/.test(r.tab), 'tab "' + r.tab + '"'); eq(r.h1.trim(), 'Showroom Designer'); ok(!r.legacyTab || /Showroom Designer/.test(r.legacyTab), r.legacyTab);
    });
    await t('both floorplans saved before the upgrade are listed', async () => {
      const txt = await page.evaluate(() => document.getElementById('sd-picker-list').innerText);
      ok(/Main Showroom \(before upgrade\)/.test(txt) && /Annex \(before upgrade\)/.test(txt), txt);
    });
    await openPlan(page, 'd1');
    const legacyProfit = await page.evaluate(() => document.getElementById('sd-profit-panel').innerText);
    await t('old floorplan 1 opens unchanged: every item at its saved size and spot, nothing rewritten', async () => {
      const its = await items(page, 'd1'); eq(its.length, 4);
      for (const it of Object.values(LEGACY_ITEMS)) { const s = its.find(x => x.id === it.id); eq([s.cell_x, s.cell_y, s.width_cells, s.height_cells, s.rotation_deg], [it.cell_x, it.cell_y, it.width_cells, it.height_cells, it.rotation_deg], it.id);
        const d = await drawn(page, it.id); eq([d.x, d.y, d.w, d.h], [it.cell_x, it.cell_y, it.width_cells, it.height_cells], it.id + ' drawn'); ok(!s.equipment_type, it.id + ' was rewritten'); }
    });
    await t('old records read through the legacy map: lift chair placeholder + Display Shelving get their new sprites, Reception Desk stays a plain block', async () => {
      const a = await drawn(page, 'it1_1'), b = await drawn(page, 'it1_2'), c = await drawn(page, 'it1_3');
      ok(a.img && /floorplan\/lift_chairs\.png$/.test(a.img.src) && a.img.loaded, JSON.stringify(a.img));
      ok(b.img && /floorplan\/display_shelving\.png$/.test(b.img.src) && b.img.loaded && b.img.rot === '90' && b.img.w === 3 && b.img.h === 1, JSON.stringify(b.img));
      ok(!c.img, 'reception desk got an image');
      const lbl = await page.evaluate(() => document.querySelector('#sd-grid .sd-item-block[data-id="it1_1"]').title); ok(/Lift Chairs/.test(lbl), 'old placeholder category: ' + lbl);
    });
    await t('old floorplan 1 profit figures are intact (priced item: $150 profit on 12 sq ft, 4-week turn)', async () => {
      ok(/\$12\.50/.test(legacyProfit) && /\$162\.38/.test(legacyProfit) && /\$270\.63/.test(legacyProfit) && /\$100\.00/.test(legacyProfit), legacyProfit.replace(/\s+/g, ' '));
    });

    await t('the picker is exactly the 24 owner types, in order, with manifest sizes, and nothing superseded', async () => {
      const cards = await page.evaluate(() => [...document.querySelectorAll('#sd-gallery-grid .sd-gallery-card')].map(c => ({ n: c.querySelector('.sd-gallery-name').textContent, d: c.querySelector('.sd-gallery-dims').textContent.replace(/\s*★/, '').trim() })));
      eq(cards.map(c => c.n), MANIFEST.map(m => m.label), 'names/order');
      eq(cards.map(c => c.d), MANIFEST.map(m => m.width_cells + ' × ' + m.height_cells + ' ft'), 'sizes');
      const txt = await page.evaluate(() => document.getElementById('sd-gallery').innerText + document.getElementById('sd-custom-form').innerText);
      for (const old of ['Accessories', 'Reception Desk', 'Waiting Seating', 'Beds & Support Surfaces', 'Seating & Positioning', 'Mobility & Walking', 'Ramps & Access', 'Bath Safety']) ok(!txt.includes(old), 'still offered: ' + old);
    });
    await t('24/24 picker icons load (top-view icon set)', async () => {
      await page.waitForFunction(() => [...document.querySelectorAll('#sd-gallery-grid img')].every(i => i.complete), null, { timeout: 15000 });
      const r = await page.evaluate(() => [...document.querySelectorAll('#sd-gallery-grid .sd-gallery-card')].map(c => { const i = c.querySelector('img'); return i ? { src: i.getAttribute('src'), ok: i.naturalWidth > 0 } : null; }));
      eq(r.length, 24); ok(r.every(x => x && x.ok), JSON.stringify(r.filter(x => !x || !x.ok)));
      eq(r.map(x => x.src), MANIFEST.map(m => m.icon_path));
    });
    await page.screenshot({ path: path.join(SHOTS, 'desktop-picker.png') });

    /* --- all 24 on a fresh floorplan: every type edited before placing, every image on its squares --- */
    await page.evaluate(() => sdNewFloorplan()); await page.waitForSelector('#sd-width', { state: 'visible' });
    await page.fill('#sd-width', '40'); await page.fill('#sd-height', '36'); await page.evaluate(() => sdGenerate()); await page.waitForTimeout(500);
    await page.evaluate(() => sdSave()); await page.waitForTimeout(600);
    const D3 = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hcps_sd_dealer')).designs).sort().pop());
    await t('size panel: Width/Depth prefilled from the manifest for every type, footprint shown, keyboard reachable and labelled', async () => {
      for (const m of MANIFEST) {
        await page.evaluate(id => sdOpenEquip(id), m.id); await page.waitForSelector('#sd-equip-form #sd-equip-w', { state: 'visible' });
        const r = await page.evaluate(() => ({ w: document.getElementById('sd-equip-w').value, h: document.getElementById('sd-equip-h').value, sq: document.getElementById('sd-equip-sqft').textContent,
          lw: (document.querySelector('label[for="sd-equip-w"]') || {}).textContent, lh: (document.querySelector('label[for="sd-equip-h"]') || {}).textContent, focus: document.activeElement && document.activeElement.id,
          img: (document.getElementById('sd-equip-img') || {}).getAttribute && document.getElementById('sd-equip-img').getAttribute('src') }));
        eq([+r.w, +r.h, +r.sq], [m.width_cells, m.height_cells, m.width_cells * m.height_cells], m.id); eq([r.lw, r.lh], ['Width (ft)', 'Depth (ft)']); eq(r.focus, 'sd-equip-w', m.id + ' focus'); eq(r.img, m.floorplan_path);
        await page.fill('#sd-equip-w', String(m.width_cells + 2)); await page.dispatchEvent('#sd-equip-w', 'input');
        eq(+(await page.textContent('#sd-equip-sqft')), (m.width_cells + 2) * m.height_cells, m.id + ' live footprint');
      }
      await page.evaluate(() => sdCloseForms());
    });
    await t('size panel rejects 0, negative, fractional, text, over 150 and bigger-than-floor, and places nothing', async () => {
      await page.evaluate(() => sdOpenEquip('beds')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      for (const [w, h, re] of [['0', '5', /at least 1/], ['-2', '5', /at least 1/], ['2.5', '5', /whole feet/i], ['', '5', /Enter a width/], ['151', '5', /at most 150/], ['41', '5', /bigger than your floor/]]) {
        await page.fill('#sd-equip-w', w); await page.fill('#sd-equip-h', h); await page.click('#sd-equip-place');
        const r = await page.evaluate(() => ({ err: document.getElementById('sd-equip-err').textContent, armed: getComputedStyle(document.getElementById('sd-placement-banner')).display !== 'none' }));
        ok(re.test(r.err) && !r.armed, w + ': ' + JSON.stringify(r));
      }
      eq((await items(page, D3)).length, 0); await page.evaluate(() => sdCloseForms());
    });
    // pack the 24 types (each edited: +1 ft width) row by row
    const placed = {}; let cx = 0, cy = 0, rowH = 0;
    await t('all 24 types place at a dealer-edited size; each occupies exactly width × depth squares with its own sprite on them', async () => {
      for (const m of MANIFEST) {
        const w = m.width_cells + 1, h = m.height_cells;
        if (cx + w > 40) { cx = 0; cy += rowH + 1; rowH = 0; }
        const it = await place(page, D3, m.id, w, h, cx, cy);
        placed[m.id] = it.id; eq([it.equipment_type, it.width_cells, it.height_cells, it.cell_x, it.cell_y], [m.id, w, h, cx, cy], m.id);
        const d = await drawn(page, it.id);
        eq([d.x, d.y, d.w, d.h], [cx, cy, w, h], m.id + ' block');
        ok(d.img && d.img.src === m.floorplan_path && d.img.w === w && d.img.h === h && d.img.rot === '0' && d.img.fit === 'contain', m.id + ' image ' + JSON.stringify(d.img));
        cx += w + 1; rowH = Math.max(rowH, h);
      }
      await page.waitForFunction(() => [...document.querySelectorAll('#sd-grid .sd-item-img')].every(i => i.complete), null, { timeout: 15000 });
      const broken = await page.evaluate(() => [...document.querySelectorAll('#sd-grid .sd-item-img')].filter(i => i.naturalWidth === 0).map(i => i.getAttribute('src')));
      eq(broken, [], 'sprites that did not load');
      const kinds = await items(page, D3);
      for (const m of MANIFEST) { const it = kinds.find(x => x.id === placed[m.id]); if (['lift_chairs', 'power_chairs', 'scooters', 'beds'].includes(m.id)) ok(it.item_type === 'golden' && !it.model && it.pending_category, m.id + ' placeholder ' + JSON.stringify(it)); else ok(it.item_type === 'custom' && it.custom_category === m.id && it.custom_name === m.label, m.id + ' fixture'); }
    });
    await page.evaluate(() => sdFitToScreen()); await page.waitForTimeout(300);
    const floor = await page.$('#sd-viewport'); if (floor) await floor.screenshot({ path: path.join(SHOTS, 'desktop-all-24-on-floor.png') });
    await page.screenshot({ path: path.join(SHOTS, 'desktop-all-24-page.png'), fullPage: true });
    await t('catalog placeholders read their family (not "Uncategorized") and their assign list opens for that family', async () => {
      const ttl = await page.evaluate(id => document.querySelector('#sd-grid .sd-item-block[data-id="' + id + '"]').title, placed.lift_chairs); ok(/Lift Chairs/.test(ttl), ttl);
      const panel = await page.evaluate(() => document.getElementById('sd-profit-panel').innerText); ok(!/Uncategorized/.test(panel), panel.replace(/\s+/g, ' '));
    });
    /* --- second floorplan for the sizing acceptance tests (room to work) --- */
    await page.evaluate(() => sdNewFloorplan()); await page.waitForSelector('#sd-width', { state: 'visible' });
    await page.fill('#sd-width', '30'); await page.fill('#sd-height', '20'); await page.evaluate(() => sdGenerate()); await page.waitForTimeout(400);
    await page.evaluate(() => sdSave()); await page.waitForTimeout(600);
    const D4 = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hcps_sd_dealer')).designs).sort().pop());
    let lcA, lcB, blocker;
    await t('two lift chairs, 4 × 4 and 5 × 5, are placed independently', async () => {
      lcA = await place(page, D4, 'lift_chairs', 4, 4, 1, 1); lcB = await place(page, D4, 'lift_chairs', 5, 5, 8, 1);
      eq([lcA.width_cells, lcA.height_cells, lcB.width_cells, lcB.height_cells], [4, 4, 5, 5]);
      blocker = await place(page, D4, 'square_table', 4, 4, 1, 8);
    });
    await t('a type rotated in the size panel before placing lands rotated (footprint swapped, image turned 90°)', async () => {
      const it = await place(page, D4, 'scooters', 3, 5, 20, 1, true);
      eq([it.width_cells, it.height_cells, it.rotation_deg], [5, 3, 90]);
      const d = await drawn(page, it.id); ok(d.img.rot === '90' && d.img.w === 3 && d.img.h === 5 && d.w === 5 && d.h === 3, JSON.stringify(d));
    });
    // mark one square as Not floor next to lcA (floor mode click), then back to items
    await page.evaluate(() => sdSetMode('floor')); await clickCell(page, 6, 2); await page.evaluate(() => { document.dispatchEvent(new MouseEvent('mouseup')); sdSetMode('items'); });
    await t('Edit Size on a placed item: current size shown, live outline on the floor, Apply Size resizes that one item and its image', async () => {
      await page.evaluate(id => document.querySelector('#sd-grid .sd-item-block[data-id="' + id + '"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })), lcA.id);
      await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup')));
      await page.waitForSelector('#sd-item-modal #sd-resize-w', { state: 'visible' });
      const cur = await page.textContent('#sd-resize-cur'); ok(/4 × 4 ft · 16 sq ft/.test(cur), cur);
      await page.fill('#sd-resize-w', '5'); await page.dispatchEvent('#sd-resize-w', 'input');
      const pv = await page.evaluate(() => ({ okc: document.querySelectorAll('.sd-cell-preview-ok').length, bad: document.querySelectorAll('.sd-cell-preview-bad').length, sq: document.getElementById('sd-resize-sqft').textContent }));
      ok(pv.okc === 20 && pv.bad === 0 && pv.sq === '20', JSON.stringify(pv));
      await page.click('#sd-item-modal button:has-text("Apply Size")'); await page.waitForTimeout(300);
      const s = (await items(page, D4)).find(x => x.id === lcA.id); eq([s.width_cells, s.height_cells], [5, 4]);
      const d = await drawn(page, lcA.id); ok(d.w === 5 && d.h === 4 && d.img.w === 5 && d.img.h === 4, JSON.stringify(d));
      const other = (await items(page, D4)).find(x => x.id === lcB.id); eq([other.width_cells, other.height_cells], [5, 5], 'the other lift chair changed');
    });
    for (const [label, w, h, re] of [['over another placed item', 5, 8, /overlaps another placed item/], ['over a Not-floor square', 6, 4, /isn't marked as floor/], ['off the edge of the plan', 5, 25, /bigger than your floor|past the edge/]]) {
      await t(`Edit Size ${label} is rejected with a clear message and nothing changes`, async () => {
        const before = JSON.stringify(await items(page, D4));
        await page.fill('#sd-resize-w', String(w)); await page.fill('#sd-resize-h', String(h)); await page.dispatchEvent('#sd-resize-w', 'input');
        await page.click('#sd-item-modal button:has-text("Apply Size")'); await page.waitForTimeout(250);
        ok(re.test(await modalErr(page)), await modalErr(page)); eq(JSON.stringify(await items(page, D4)), before, 'data changed');
      });
    }
    await t('rotate a resized item: footprint swaps, image turns 90° and still fills exactly the occupied squares', async () => {
      await page.fill('#sd-resize-w', '5'); await page.fill('#sd-resize-h', '4');
      await page.click('#sd-item-modal button:has-text("Rotate 90°")'); await page.waitForTimeout(300);
      const s = (await items(page, D4)).find(x => x.id === lcA.id); eq([s.width_cells, s.height_cells, s.rotation_deg], [4, 5, 90]);
      const d = await drawn(page, lcA.id); ok(d.w === 4 && d.h === 5 && d.img.rot === '90' && d.img.w === 5 && d.img.h === 4, JSON.stringify(d));
    });
    await t('move the resized, rotated item: size and angle travel with it', async () => {
      await page.evaluate(id => sdArmMove(id), lcA.id); await clickCell(page, 1, 13); await page.waitForTimeout(300);
      const s = (await items(page, D4)).find(x => x.id === lcA.id); eq([s.cell_x, s.cell_y, s.width_cells, s.height_cells, s.rotation_deg], [1, 13, 4, 5, 90]);
    });
    await t('assigning a product keeps the edited footprint and the type image', async () => {
      await page.evaluate(id => sdAssignProduct(id, 'TEST-LIFT-1'), lcA.id); await page.waitForTimeout(300);
      const s = (await items(page, D4)).find(x => x.id === lcA.id); eq([s.model, s.width_cells, s.height_cells, s.rotation_deg, s.equipment_type], ['TEST-LIFT-1', 4, 5, 90, 'lift_chairs']);
      const d = await drawn(page, lcA.id); ok(/lift_chairs\.png$/.test(d.img.src), d.img.src);
    });
    await t('recording a different (custom) product keeps the edited footprint and the type image', async () => {
      await page.evaluate(() => sdCloseItemModal());
      await page.evaluate(id => document.querySelector('#sd-grid .sd-item-block[data-id="' + id + '"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })), lcB.id); await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup')));
      await page.waitForSelector('#sd-item-modal .sd-assign-custom-btn', { state: 'visible' });
      const assign = await page.evaluate(() => ({ size: !!document.querySelector('#sd-item-modal #sd-resize-w'), rot: /Rotate 90°/.test(document.getElementById('sd-item-modal').innerText) }));
      ok(assign.size && assign.rot, 'needs-a-product panel has Edit Size + Rotate ' + JSON.stringify(assign));
      await page.click('#sd-item-modal .sd-assign-custom-btn');
      await page.fill('#sd-cp-mfr', 'Pride'); await page.fill('#sd-cp-model', 'LC-525'); await page.evaluate(id => sdSaveCustomProduct(id), lcB.id); await page.waitForTimeout(300);
      const s = (await items(page, D4)).find(x => x.id === lcB.id); eq([s.item_type, s.custom_model, s.width_cells, s.height_cells, s.equipment_type], ['custom', 'LC-525', 5, 5, 'lift_chairs']);
      ok(/lift_chairs\.png$/.test((await drawn(page, lcB.id)).img.src));
    });
    await t('dealer default: save 4 × 6 for Lift Chairs → picker shows it, a new chair starts at 4 × 6, placed chairs unchanged', async () => {
      const before = (await items(page, D4)).map(x => [x.id, x.width_cells, x.height_cells]);
      await page.evaluate(() => sdOpenEquip('lift_chairs')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      await page.fill('#sd-equip-w', '4'); await page.fill('#sd-equip-h', '6'); await page.click('#sd-equip-form button:has-text("Save as my default")'); await page.waitForTimeout(300);
      const card = await page.evaluate(() => document.querySelector('#sd-gallery-grid .sd-gallery-card').innerText); ok(/4 × 6 ft/.test(card) && /★/.test(card), card);
      eq((await items(page, D4)).map(x => [x.id, x.width_cells, x.height_cells]), before, 'placed items resized by saving a default');
      await page.evaluate(() => sdCloseForms()); await page.evaluate(() => sdOpenEquip('lift_chairs')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      eq([await page.inputValue('#sd-equip-w'), await page.inputValue('#sd-equip-h')], ['4', '6']);
      const n = await place(page, D4, 'lift_chairs', 4, 6, 24, 12); eq([n.width_cells, n.height_cells], [4, 6]);
    });
    await t('reset the default → factory 5 × 5 again; every placed chair keeps its own size', async () => {
      const before = (await items(page, D4)).map(x => [x.id, x.width_cells, x.height_cells]);
      await page.evaluate(() => sdOpenEquip('lift_chairs')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      await page.click('#sd-equip-form button:has-text("Reset to factory size")'); await page.waitForTimeout(300);
      eq([await page.inputValue('#sd-equip-w'), await page.inputValue('#sd-equip-h')], ['5', '5']);
      const card = await page.evaluate(() => document.querySelector('#sd-gallery-grid .sd-gallery-card').innerText); ok(/5 × 5 ft/.test(card) && !/★/.test(card), card);
      eq((await items(page, D4)).map(x => [x.id, x.width_cells, x.height_cells]), before); await page.evaluate(() => sdCloseForms());
    });
    await t('a default saved while rotated keeps its angle: the next one opens turned and lands turned', async () => {
      await page.evaluate(() => sdOpenEquip('stairlifts')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      await page.click('#sd-equip-form button:has-text("Rotate 90°")'); await page.click('#sd-equip-form button:has-text("Save as my default")'); await page.waitForTimeout(300);
      await page.evaluate(() => sdCloseForms()); await page.evaluate(() => sdOpenEquip('stairlifts')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      const r = await page.evaluate(() => [document.getElementById('sd-equip-w').value, document.getElementById('sd-equip-h').value, document.getElementById('sd-equip-img').style.transform]);
      eq(r, ['6', '2', 'rotate(90deg)']);
      const it = await place(page, D4, 'stairlifts', 6, 2, 10, 15); eq([it.width_cells, it.height_cells, it.rotation_deg], [6, 2, 90]);
      const d = await drawn(page, it.id); ok(d.img.rot === '90' && d.img.w === 2 && d.img.h === 6, JSON.stringify(d.img));
      await page.evaluate(() => sdOpenEquip('stairlifts')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      await page.click('#sd-equip-form button:has-text("Reset to factory size")'); await page.waitForTimeout(300); await page.evaluate(() => sdCloseForms());
    });
    await t("defaults belong to the signed-in dealer: another dealer on this browser starts from the factory size", async () => {
      await page.evaluate(() => sdOpenEquip('beds')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      await page.fill('#sd-equip-w', '4'); await page.fill('#sd-equip-h', '9'); await page.click('#sd-equip-form button:has-text("Save as my default")'); await page.waitForTimeout(300); await page.evaluate(() => sdCloseForms());
      const realId = await page.evaluate(() => AUTH.dealer.id);
      await page.evaluate(() => { AUTH.dealer = Object.assign({}, AUTH.dealer, { id: 'd-other-dealer' }); });
      await page.evaluate(() => sdOpenEquip('beds')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      eq([await page.inputValue('#sd-equip-w'), await page.inputValue('#sd-equip-h')], ['5', '8'], 'other dealer');
      await page.evaluate(() => sdCloseForms()); await page.evaluate(id => { AUTH.dealer = Object.assign({}, AUTH.dealer, { id }); }, realId);
      await page.evaluate(() => sdOpenEquip('beds')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      eq([await page.inputValue('#sd-equip-w'), await page.inputValue('#sd-equip-h')], ['4', '9'], 'own default back');
      await page.click('#sd-equip-form button:has-text("Reset to factory size")'); await page.waitForTimeout(300); await page.evaluate(() => sdCloseForms());
    });
    await t('Rotate in the size panel works when only the turned shape fits the floor (2 × 25 → 25 × 2 on a 30 × 20 floor)', async () => {
      await page.evaluate(() => sdOpenEquip('double_doors')); await page.waitForSelector('#sd-equip-w', { state: 'visible' });
      await page.fill('#sd-equip-w', '2'); await page.fill('#sd-equip-h', '25'); await page.click('#sd-equip-form button:has-text("Rotate 90°")');
      eq([await page.inputValue('#sd-equip-w'), await page.inputValue('#sd-equip-h'), await page.evaluate(() => document.getElementById('sd-equip-err').textContent)], ['25', '2', '']);
      await page.evaluate(() => sdCloseForms());
    });
    await t('keyboard: Tab reaches a placed item, Enter opens it with focus in Width; Escape closes; Placed Items has Edit buttons', async () => {
      const r = await page.evaluate(id => { const el = document.querySelector('#sd-grid .sd-item-block[data-id="' + id + '"]'); el.focus(); return { focused: document.activeElement === el, role: el.getAttribute('role'), tab: el.tabIndex, label: el.getAttribute('aria-label') }; }, lcB.id);
      ok(r.focused && r.role === 'button' && r.tab === 0 && /Lift Chairs|Pride/.test(r.label), JSON.stringify(r));
      await page.keyboard.press('Enter'); await page.waitForSelector('#sd-item-modal #sd-resize-w', { state: 'visible' });
      const f = await page.evaluate(() => ({ id: document.activeElement.id, role: document.querySelector('#sd-item-modal .sd-modal').getAttribute('role') })); eq(f, { id: 'sd-resize-w', role: 'dialog' });
      await page.keyboard.press('Escape'); ok(await page.evaluate(() => document.getElementById('sd-item-modal').style.display === 'none'), 'escape');
      const edits = await page.evaluate(() => [...document.querySelectorAll('#sd-items-panel-list .sd-items-panel-edit')].map(b => b.tagName + ':' + b.getAttribute('aria-label')));
      ok(edits.length === (await items(page, D4)).length && edits.every(x => /^BUTTON:Edit /.test(x)), edits.join('|'));
      await page.focus('#sd-items-panel-list .sd-items-panel-edit'); await page.keyboard.press('Enter'); await page.waitForSelector('#sd-item-modal #sd-resize-w', { state: 'visible' });
      await page.keyboard.press('Escape');
    });
    await t('Edit Size outline never lingers after Rotate, and "Use factory size" fills the type size in the item\'s orientation', async () => {
      await page.evaluate(id => sdOpenItem(id), lcB.id); await page.waitForSelector('#sd-item-modal #sd-resize-w', { state: 'visible' });
      await page.fill('#sd-resize-w', '6'); await page.fill('#sd-resize-h', '6'); await page.dispatchEvent('#sd-resize-w', 'input');
      ok(await page.evaluate(() => document.querySelectorAll('.sd-cell-preview-ok,.sd-cell-preview-bad').length) > 0, 'no outline drawn');
      await page.click('#sd-item-modal button:has-text("Rotate 90°")'); await page.waitForTimeout(300);
      eq(await page.evaluate(() => document.querySelectorAll('.sd-cell-preview-ok,.sd-cell-preview-bad').length), 0, 'outline left behind');
      await page.fill('#sd-resize-w', '2'); await page.fill('#sd-resize-h', '2'); await page.click('#sd-item-modal button:has-text("Apply Size")'); await page.waitForTimeout(300);
      await page.click('#sd-item-modal button:has-text("Use factory size")');
      eq([await page.inputValue('#sd-resize-w'), await page.inputValue('#sd-resize-h')], ['5', '5']);
      await page.click('#sd-item-modal button:has-text("Apply Size")'); await page.waitForTimeout(300);
      const s2 = (await items(page, D4)).find(x => x.id === lcB.id); eq([s2.width_cells, s2.height_cells], [5, 5]);
      await page.evaluate(() => sdCloseItemModal());
    });
    /* --- snapshot + restore with custom sizes --- */
    let snapSizes;
    await t('snapshot, change sizes, restore: the snapshot\'s custom sizes, angles and images come back', async () => {
      snapSizes = (await items(page, D4)).map(x => [x.id, x.width_cells, x.height_cells, x.rotation_deg]).sort();
      await page.evaluate(() => sdSaveSnapshot()); await page.waitForTimeout(600);
      await page.evaluate(id => document.querySelector('#sd-grid .sd-item-block[data-id="' + id + '"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })), blocker.id); await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup')));
      await page.waitForSelector('#sd-item-modal #sd-resize-w', { state: 'visible' }); await page.fill('#sd-resize-w', '2'); await page.fill('#sd-resize-h', '2'); await page.click('#sd-item-modal button:has-text("Apply Size")'); await page.waitForTimeout(300);
      await page.evaluate(() => sdCloseItemModal());
      ok((await items(page, D4)).find(x => x.id === blocker.id).width_cells === 2, 'resize before restore');
      const st = await store(page); const sid = Object.keys(st.designs[D4].snapshots).pop();
      await page.evaluate(sid => sdRestoreSnapshot(sid), sid); await page.waitForSelector('#sd-restore-modal', { state: 'visible' });
      await page.click('#sd-restore-confirm-btn'); await page.waitForTimeout(800);
      eq((await items(page, D4)).map(x => [x.id, x.width_cells, x.height_cells, x.rotation_deg]).sort(), snapSizes);
      const d = await drawn(page, blocker.id); ok(d.w === 4 && d.h === 4 && d.img.w === 4 && /square_table\.png$/.test(d.img.src), 'redrawn after restore ' + JSON.stringify(d));
    });
    /* --- reload: everything survives a fresh page --- */
    await ctx.close();
    await t('no page errors and no showroom call ever left the browser', () => { eq(errors, []); ok(sdCalls.every(u => u.startsWith('https://deploy-preview')), 'network: ' + sdCalls.filter(u => !u.startsWith('https://deploy-preview')).join(',')); });

    /* ================= reload persistence in ONE context (localStorage survives reloads) ================= */
    const R = await open(browser, 1280, 900, OPTS); const rp = R.page; rp.on('pageerror', e => errors.push(e.message));
    await rp.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, LEGACY]);
    await openDesigner(rp); await openPlan(rp, 'd2');
    await rp.evaluate(() => sdSetMode('items'));
    const a = await place(rp, 'd2', 'round_table', 3, 3, 6, 4), b2 = await place(rp, 'd2', 'round_table', 4, 4, 0, 5);
    await rp.reload({ waitUntil: 'domcontentloaded' });
    await rp.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'approved' && (state.manufacturers || []).length > 5, null, { timeout: 30000 });
    await rp.evaluate(() => { window.mergeCatalogEdits = async (slug, prods) => prods || []; });
    await openDesigner(rp); await openPlan(rp, 'd2');
    await t('save → reload → reopen: two round tables keep their own sizes and images; the old Annex item is untouched', async () => {
      const its = await items(rp, 'd2');
      const ta = its.find(x => x.id === a.id), tb = its.find(x => x.id === b2.id), old = its.find(x => x.id === 'it2_1');
      eq([ta.width_cells, ta.height_cells, tb.width_cells, tb.height_cells], [3, 3, 4, 4]);
      eq([old.width_cells, old.height_cells, old.dealer_cost, old.sales_price, old.turn_rate_weeks, old.equipment_type], [4, 2, 40, 90, 2, undefined]);
      const da = await drawn(rp, a.id), db = await drawn(rp, b2.id);
      ok(da.img.w === 3 && db.img.w === 4 && /round_table\.png$/.test(da.img.src), JSON.stringify([da, db]));
    });
    await R.ctx.close();

    /* ================= phone + tablet layouts ================= */
    for (const [w, h, label] of [[390, 844, 'phone'], [768, 1024, 'tablet']]) {
      const V = await open(browser, w, h, OPTS); const vp = V.page; vp.on('pageerror', e => errors.push(e.message));
      await vp.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, LEGACY]);
      await openDesigner(vp); await openPlan(vp, 'd1');
      await vp.evaluate(() => { sdZoomIn(); sdZoomIn(); sdZoomIn(); });   // zoomed in, the floor must scroll inside its own box, never the page
      await vp.waitForTimeout(200);
      await vp.evaluate(() => sdOpenEquip('beds')); await vp.waitForSelector('#sd-equip-w', { state: 'visible' });
      const r = await vp.evaluate(() => { const f = document.getElementById('sd-equip-form').getBoundingClientRect(); const inp = document.getElementById('sd-equip-w').getBoundingClientRect();
        const tab = [...document.querySelectorAll('#tabs .navtab')].find(x => /Showroom Designer/.test(x.textContent));
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, fl: f.left, fr: f.right, ih: inp.height, cards: document.querySelectorAll('#sd-gallery-grid .sd-gallery-card').length, tab: !!tab, h1: document.querySelector('#sec-showroom h1').textContent }; });
      await t(`${label}: no sideways scroll; size panel on screen with full-size inputs; 24 cards; tab + heading say Showroom Designer`, () => {
        ok(r.sw <= r.cw + 1, r.sw + '>' + r.cw); ok(r.fl >= 0 && r.fr <= w + 1, JSON.stringify(r)); ok(r.ih >= 40, 'input height ' + r.ih); eq(r.cards, 24); ok(r.tab, 'tab'); eq(r.h1.trim(), 'Showroom Designer'); });
      await vp.screenshot({ path: path.join(SHOTS, `${label}-size-panel.png`), fullPage: false });
      await vp.evaluate(() => { document.getElementById('sd-gallery').scrollIntoView(); }); await vp.screenshot({ path: path.join(SHOTS, `${label}-picker.png`) });
      await V.ctx.close();
    }
    await t('no page errors anywhere', () => eq(errors, []));
  } finally { await browser.close(); }
  console.log(`\nshowroom designer: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
