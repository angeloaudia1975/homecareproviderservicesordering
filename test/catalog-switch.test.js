/* Switching manufacturers shows ONLY the last line chosen (ABM regression, 2026-10-26).
   Runs the storefront's own loadProducts + selectManufacturer text (sliced from public/index.html) in a
   sandbox with a fake network whose replies arrive in a chosen order, and checks:
   - Strongback (slow) then ABM (empty, no catalog) → ABM shows "Coming soon", never Strongback's products;
   - an empty line then a line with data → that line's products;
   - A → B → A with A's first load finishing last → the screen shows A's newest load only once;
   - a catalog file that cannot be read empties the line instead of keeping the previous one;
   - Home chosen while a line loads → the late load never writes over Home;
   - a direct loadProducts() call (Access4U hub) still loads. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
function slice(a, b) { const i = SRC.indexOf(a), j = SRC.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('anchor: ' + (i < 0 ? a : b)); return SRC.slice(i, j); }
const LOAD = slice('async function loadProducts(slug){', '// If a product has no MSRP, derive one at 2×');
const SELECT = slice('async function selectManufacturer(slug){', 'let SHIPTO_LABEL=');

let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(name, fn) { try { await fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }

function world() {
  const pending = {};              // url -> [resolve list]
  const rendered = [];
  const ctx = {
    console, Set, Map, Promise, Error, JSON, Object, Array, String, Number,
    HOME: '__home__',
    CONFIG: { GOLDEN_SLUG: 'golden-technologies' },
    state: { active: null, products: [], manufacturers: [
      { slug: 'strongback-mobility', hasData: true }, { slug: 'abm-respiratory-care', hasData: false },
      { slug: 'access4u', hasData: true }, { slug: 'broken', hasData: true } ] },
    A4U: {}, _viewedLines: new Set(),
    document: { body: { classList: { add() {}, remove() {} } }, getElementById() { return null; } },
    window: { scrollTo() {} },
    isGoldenSlug: s => s === 'golden-technologies',
    mergeCatalogEdits: async (slug, prods) => { await new Promise(r => (pending['merge:' + slug] = pending['merge:' + slug] || []).push(r)); return prods.map(p => Object.assign({ manufacturer: slug }, p)); },
    fetch: url => new Promise(res => (pending[url] = pending[url] || []).push(res)),
    renderTabs() {}, renderBanner() {}, renderA4U() {}, renderSW() {}, track() {},
    renderHome: async () => { rendered.push({ home: true }); },
    renderProducts() { rendered.push({ active: ctx.state.active, codes: ctx.state.products.map(p => p.code) }); },
  };
  vm.createContext(ctx);
  vm.runInContext(LOAD + '\n' + SELECT + '\nthis.loadProducts=loadProducts; this.selectManufacturer=selectManufacturer;', ctx);
  const tick = () => new Promise(r => setImmediate(r));
  async function answer(slug, prods, status = 200) {
    for (let i = 0; i < 20 && !(pending['./data/' + slug + '.json'] || []).length; i++) await tick();
    const res = pending['./data/' + slug + '.json'].shift();
    res({ ok: status < 400, status, json: async () => { if (status >= 400) throw new Error('not json'); return prods; } });
    for (let i = 0; i < 20 && !(pending['merge:' + slug] || []).length && status < 400; i++) await tick();
    if (status < 400 && (pending['merge:' + slug] || []).length) pending['merge:' + slug].shift()();
    for (let i = 0; i < 20; i++) await tick();
  }
  return { ctx, rendered, answer, tick };
}
const SB = [{ code: 'SB100' }, { code: '1003AB' }];

(async () => {
  await t('slow Strongback then empty ABM: ABM shows no Strongback products', async () => {
    const w = world();
    const a = w.ctx.selectManufacturer('strongback-mobility');
    const b = w.ctx.selectManufacturer('abm-respiratory-care');
    await b;
    await w.answer('strongback-mobility', SB);
    await a;
    ok(w.ctx.state.active === 'abm-respiratory-care', 'active ' + w.ctx.state.active);
    ok(w.ctx.state.products.length === 0, 'products on ABM: ' + w.ctx.state.products.map(p => p.code));
    const last = w.rendered[w.rendered.length - 1];
    ok(last.active === 'abm-respiratory-care' && last.codes.length === 0, 'last render ' + JSON.stringify(last));
    ok(!w.rendered.some(r => r.active === 'abm-respiratory-care' && r.codes.length), 'Strongback codes rendered under ABM');
  });
  await t('empty ABM then Strongback: Strongback products', async () => {
    const w = world();
    await w.ctx.selectManufacturer('abm-respiratory-care');
    const p = w.ctx.selectManufacturer('strongback-mobility');
    await w.answer('strongback-mobility', SB); await p;
    ok(w.ctx.state.products.map(x => x.code).join() === 'SB100,1003AB', 'got ' + w.ctx.state.products.map(x => x.code));
    ok(w.rendered[w.rendered.length - 1].active === 'strongback-mobility', 'last render not Strongback');
  });
  await t('A → B → A with the first A load finishing last: only the newest A load is shown', async () => {
    const w = world();
    const a1 = w.ctx.selectManufacturer('strongback-mobility');
    const b = w.ctx.selectManufacturer('access4u');
    const a2 = w.ctx.selectManufacturer('strongback-mobility');
    await w.answer('access4u', [{ code: 'SR3' }]); await b;
    await w.answer('strongback-mobility', [{ code: 'OLD' }]); await a1;     // first (stale) Strongback load
    ok(!w.ctx.state.products.some(p => p.code === 'OLD'), 'stale load written');
    ok(!w.rendered.some(r => r.codes && r.codes.includes('SR3')), 'Access4U rendered after it was left');
    await w.answer('strongback-mobility', SB); await a2;
    ok(w.ctx.state.products.map(x => x.code).join() === 'SB100,1003AB', 'got ' + w.ctx.state.products.map(x => x.code));
  });
  await t('unreadable catalog file empties the line (previous line not kept)', async () => {
    const w = world();
    const p = w.ctx.selectManufacturer('strongback-mobility'); await w.answer('strongback-mobility', SB); await p;
    const q = w.ctx.selectManufacturer('broken'); await w.answer('broken', null, 404); await q;
    ok(w.ctx.state.products.length === 0, 'kept ' + w.ctx.state.products.map(x => x.code));
    ok(w.rendered[w.rendered.length - 1].active === 'broken', 'not rendered');
  });
  await t('Home chosen while a line loads: the late load never writes over Home', async () => {
    const w = world();
    const p = w.ctx.selectManufacturer('strongback-mobility');
    await w.ctx.selectManufacturer('__home__');
    await w.answer('strongback-mobility', SB); await p;
    ok(w.ctx.state.active === '__home__', 'active ' + w.ctx.state.active);
    ok(w.ctx.state.products.length === 0, 'products written under Home');
    ok(!w.rendered.some(r => r.active === '__home__' && r.codes), 'product grid rendered under Home');
  });
  await t('direct loadProducts call (Access4U hub) still loads and reports current', async () => {
    const w = world();
    const p = w.ctx.loadProducts('access4u'); await w.answer('access4u', [{ code: 'SR3' }]);
    ok((await p) === true, 'not current'); ok(w.ctx.state.products[0].code === 'SR3', 'not loaded');
  });
  await t('an unknown line is empty', async () => {
    const w = world(); w.ctx.state.products = [{ code: 'X' }];
    ok((await w.ctx.loadProducts('no-such-line')) === true && w.ctx.state.products.length === 0, 'kept products');
  });
  console.log(`\ncatalog switch: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
