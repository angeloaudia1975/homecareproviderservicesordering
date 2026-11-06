// Showroom speed (2026-11-05): the Showroom loads every line TOGETHER, not one after another,
// and a line already loading is shared, never fetched twice. Executes the real code from
// public/index.html against stubs. No network.
//   node test/showroom-speed.test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = process.env.SHOWROOM_SRC ? fs.readFileSync(process.env.SHOWROOM_SRC, 'utf8') : fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok  ', n); } catch (e) { fail++; console.log('FAIL', n, '\n    ', e && e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const block = (start) => { const i = H.indexOf(start); if (i < 0) throw new Error('missing ' + start); let d = 0, j = H.indexOf('{', i); for (; j < H.length; j++) { if (H[j] === '{') d++; else if (H[j] === '}' && --d === 0) break; } return H.slice(i, j + 1); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The Showroom's catalog builder, lifted exactly as it ships (catOf + sdPreloadCatalog). */
function showroomSandbox(lines, loadLine) {
  const ctx = { window: {}, Promise, Number, Math, String, Object, Array, JSON, console,
    entitledManufacturers: () => lines, isGoldenSlug: s => s === 'golden-technologies', loadLine,
    dealerCostOf: p => p.base_price };
  vm.createContext(ctx);
  vm.runInContext('var _sdCatalog=[];\n' + block('function catOf(p)') + '\n' + block('window.sdPreloadCatalog = async function') + ';', ctx);
  return ctx.window;
}
/* loadLine + _loadLineOnce, lifted exactly as they ship. */
function lineSandbox(fetchImpl) {
  const ctx = { DASH: { lineCache: {} }, Promise, console, JSON, Error, isGoldenSlug: () => false, goldenEntitled: () => false,
    CATALOG_SOURCE: {}, fetch: fetchImpl, mergeCatalogEdits: async (slug, rows) => rows };
  vm.createContext(ctx);
  vm.runInContext(H.slice(H.indexOf('const _lineInflight={};'), H.indexOf('\n', H.indexOf('const _lineInflight={};'))).replace('const ', 'var ') + '\n' + block('function loadLine(slug)') + '\n' + block('async function _loadLineOnce(slug)') + '\nthis.loadLine=loadLine;', ctx);
  return ctx;
}

(async () => {
  const LINES = [{ slug: 'a', name: 'A', hasData: true }, { slug: 'golden-technologies', name: 'Golden', hasData: true },
    { slug: 'nodata', name: 'N', hasData: false }, { slug: 'b', name: 'B', hasData: true }, { slug: 'c', name: 'C', hasData: true }];
  const PRODS = { a: [{ code: 'A1', name: 'Walker', base_price: 10 }], b: [{ code: 'B1', name: 'Lift Chair', base_price: 100, msrp: 250 }], c: [{ code: 'C1', name: 'Ramp', base_price: 50 }] };

  await t('every line loads at the same time, not one after another', async () => {
    let live = 0, peak = 0; const asked = [];
    const w = showroomSandbox(LINES, async slug => { asked.push(slug); live++; peak = Math.max(peak, live); await sleep(40); live--; return PRODS[slug]; });
    const t0 = Date.now(); await w.sdPreloadCatalog(); const ms = Date.now() - t0;
    eq(peak, 3, 'lines loading at once'); ok(ms < 100, 'took ' + ms + 'ms for 3 x 40ms lines (sequential would be 120ms+)');
    eq(asked.sort(), ['a', 'b', 'c'], 'lines asked for');
  });
  await t('the equipment list is identical and in line order, whichever line finishes first', async () => {
    const delay = { a: 60, b: 5, c: 30 };
    const w = showroomSandbox(LINES, async slug => { await sleep(delay[slug]); return PRODS[slug]; });
    const out = await w.sdPreloadCatalog();
    eq(out.map(x => x.sku), ['A1', 'B1', 'C1'], 'order');
    eq(out.map(x => x.category), ['mobility', 'lift_chair', 'ramp'], 'categories');
    eq([w.MSRP_PRICES.A1, w.MSRP_PRICES.B1], [20, 250], 'retail: MSRP, else 2x dealer cost');
  });
  await t('Golden is never loaded or placed (its prices never pass through HCPS pricing); lines without data are skipped', async () => {
    const asked = [];
    const w = showroomSandbox(LINES, async slug => { asked.push(slug); return PRODS[slug] || [{ code: 'G1', name: 'Golden chair', base_price: 1 }]; });
    const out = await w.sdPreloadCatalog();
    ok(!asked.includes('golden-technologies') && !asked.includes('nodata'), 'asked ' + asked);
    ok(!out.some(x => /Golden/.test(x.name)), 'Golden placed');
  });
  await t('a line that fails to load leaves the others intact', async () => {
    const w = showroomSandbox(LINES, async slug => { if (slug === 'b') throw new Error('down'); return PRODS[slug]; });
    eq((await w.sdPreloadCatalog()).map(x => x.sku), ['A1', 'C1']);
  });
  await t('a line already loading is shared: two callers, one request', async () => {
    let n = 0;
    const L = lineSandbox(async () => { n++; await sleep(20); return { ok: true, json: async () => [{ code: 'X' }] }; });
    const [p, q] = await Promise.all([L.loadLine('dalton'), L.loadLine('dalton')]);
    eq(n, 1, 'catalog requests'); eq(p, q); eq(p.map(x => x.code), ['X']);
    await L.loadLine('dalton'); eq(n, 1, 'cached after load');
  });
  await t('a failed load is not remembered: the next visit tries again', async () => {
    let n = 0;
    const L = lineSandbox(async () => { n++; if (n === 1) return { ok: false, status: 503 }; return { ok: true, json: async () => [{ code: 'Y' }] }; });
    eq(await L.loadLine('dalton'), []);
    eq((await L.loadLine('dalton')).map(x => x.code), ['Y']); eq(n, 2);
  });

  console.log(`showroom speed: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
