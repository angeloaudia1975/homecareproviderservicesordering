/* Regression tests for Victoria product recognition and search availability.
   Runs the real portal search and navigation functions in an isolated VM.
   Catalogs and published enrichment are repository fixtures; no network, accounts,
   prices, database writes or order submission. Existing browser suites cover DOM
   layout and product-family grouping (this harness deliberately uses SKU keys).
   Run: node test/victoria-product-search.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'public/assets/dealer-victoria-panel.js'), 'utf8');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'public/data/dalton.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(root, 'public/data/content/dalton.json'), 'utf8'));
const pages = Object.values(content.pages || {}).filter(p => p.status === 'published');
const catalog = raw.map(p => {
  const page = pages.find(g => (g.skus || []).some(s => String(s.sku).toUpperCase() === String(p.code).toUpperCase()));
  if (!page) return Object.assign({}, p);
  const sku = page.skus.find(s => String(s.sku).toUpperCase() === String(p.code).toUpperCase());
  return Object.assign({}, p, {
    name: sku.name || p.name, _encPage: page.name || '',
    description: page.description || p.description || '',
    _features: Array.isArray(page.features) ? page.features : []
  });
});
function extract(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'Actual portal function markers must be present');
  return html.slice(a, b);
}
const searchSource = extract("let _gsAll=null", "function gsRow(r)");
const referenceSource = extract('function catalogSkuHcpcs(', '/* RETIRED PART NUMBERS');
const lineSource = extract('const _lineInflight={};', '// Fetch this dealer');
const openSource = extract('async function dvOpenSearch(q)', 'async function dvOpenView(v)');
const row = (code, name, more) => Object.assign({ code, name, category: 'Wheelchairs' }, more);
const byCode = code => catalog.find(p => p.code === code);
const codes = results => Array.from(results, r => r.x.p.code).sort();
const slugs = results => Array.from(new Set(Array.from(results, r => r.x.slug))).sort();
const canonicalK3 = raw.filter(p => /^K3/.test(p.code)).map(p => p.code).sort();
const canonicalK1 = raw.filter(p => /^K1\b/.test(p.name)).map(p => p.code).sort();

function harness(opts = {}) {
  const datasets = Object.assign({ dalton: catalog }, opts.datasets);
  const control = { lines: opts.lines || ['dalton'], golden: !!opts.golden };
  const DASH = { lineCache: {} }, calls = {};
  const sandbox = {
    window: {}, DASH, AUTH: { dealer: { id: 'synthetic-A' }, status: 'approved' },
    PREVIEW: null, GOLDEN: { prices: false }, CATALOG_SOURCE: {},
    console, setTimeout, clearTimeout,
    entitledManufacturers: () => control.lines.map(slug => ({
      slug, name: slug === 'dalton' ? 'Dalton Medical' : slug === 'golden-technologies' ? 'Golden Technologies' : 'Other Brand',
      hasData: true
    })),
    goldenEntitled: () => control.golden,
    isGoldenSlug: slug => slug === 'golden-technologies',
    groupDisplayName: p => p._encPage || p._gname || p.name || p.code,
    groupKeyOf: p => p.code,
    unitPrice: () => { throw new Error('Search must not calculate prices'); },
    money: () => { throw new Error('Search must not format prices'); }
  };
  sandbox.loadLine = async slug => {
    if (Object.prototype.hasOwnProperty.call(DASH.lineCache, slug)) return DASH.lineCache[slug];
    calls[slug] = (calls[slug] || 0) + 1;
    const answer = opts.load ? await opts.load(slug, calls[slug], datasets[slug] || []) : { rows: datasets[slug] || [] };
    const rows = answer.rows || [];
    if (answer.cache !== false) DASH.lineCache[slug] = rows;
    return rows;
  };
  vm.createContext(sandbox);
  vm.runInContext(searchSource, sandbox, { timeout: 5000 });
  const api = sandbox.window;
  return {
    api, control, sandbox, calls, DASH,
    search: query => api.gsSearchAll(query),
    status: () => {
      assert.equal(typeof api.gsSearchStatus, 'function', 'Search availability must be observable');
      return JSON.parse(JSON.stringify(api.gsSearchStatus()));
    }
  };
}
function unavailable(h, slug) {
  const status = h.status();
  assert.equal(status.complete, false, 'An incomplete catalog is not a complete zero');
  assert.ok(status.reason, 'Unavailable search must have a reason');
  assert.ok(Array.isArray(status.unavailable) && status.unavailable.some(x => (typeof x === 'string' ? x : x.slug) === slug), JSON.stringify(status));
}
function complete(h) {
  const status = h.status();
  assert.equal(status.complete, true, JSON.stringify(status));
  assert.ok(!status.unavailable || status.unavailable.length === 0, JSON.stringify(status));
}
let passed = 0, failed = 0;
async function test(name, run) {
  try { await run(); passed++; console.log('ok  ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}

(async () => {
  await test('All inline executable scripts and the Victoria panel still parse', () => {
    let count = 0;
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/.test(m[1]) || /\btype\s*=\s*["'](?:application\/(?:ld\+)?json|text\/template)["']/i.test(m[1])) continue;
      if (!m[2].trim()) continue;
      new vm.Script(m[2], { filename: 'public/index.html:inline-' + (++count) });
    }
    assert.ok(count > 0);
    new vm.Script(panel, { filename: 'public/assets/dealer-victoria-panel.js' });
  });

  await test('Real Dalton K3 models are found without the DK30 bariatric false match', async () => {
    assert.equal(canonicalK3.length, 8, 'Fixture changed: review expected K3 identities');
    const h = harness(), result = await h.search('K3 wheelchair');
    assert.deepEqual(codes(result), canonicalK3);
    assert.ok(!codes(result).includes('K07DK30LSPW'));
    complete(h);
  });

  await test('K1 follows real model names and never matches DK16 inside K2 or K3 SKUs', async () => {
    assert.equal(canonicalK1.length, 8, 'Fixture changed: review expected K1 identities');
    const h = harness(), result = await h.search('K1 wheelchair');
    assert.deepEqual(codes(result), canonicalK1);
    assert.ok(!codes(result).includes('K2DK16F'));
    assert.ok(!codes(result).includes('K3DK16FTADJ'));
  });

  await test('Spoken, spaced, hyphenated and plural K1/K3 requests identify the same models', async () => {
    const h = harness();
    for (const query of ['Dalton K3 wheelchairs', 'K three wheelchair', 'K 3 wheelchair', 'K-3 wheelchair']) {
      assert.deepEqual(codes(await h.search(query)), canonicalK3, query);
    }
    for (const query of ['Dalton K1 wheelchairs', 'K one wheelchair', 'K 1 wheelchair', 'K-1 wheelchair']) {
      assert.deepEqual(codes(await h.search(query)), canonicalK1, query);
    }
  });

  await test('Exact and hyphenated item numbers retain exact ranking', async () => {
    const h = harness();
    const k3 = await h.search('K3DK16FTADJ');
    assert.equal(k3.length, 1); assert.equal(k3[0].x.p.code, 'K3DK16FTADJ'); assert.equal(k3[0].score, 0);
    const cart = await h.search('R-CART-6');
    assert.ok(cart.length); assert.equal(cart[0].x.p.code, 'R-CART-6'); assert.equal(cart[0].score, 0);
  });

  await test('Published descriptions and features support ordinary product language', async () => {
    const h = harness();
    assert.ok(byCode('K3DK16FTADJ').description.includes('lightweight'));
    assert.ok(codes(await h.search('lightweight wheelchair with adjustable height arms')).includes('K3DK16FTADJ'));
    assert.ok(codes(await h.search('K3 adjustable length front rigging')).includes('K3DK16FTADJ'), 'Feature-only phrase must be indexed');
    const noClassInference = harness({ datasets: { dalton: [row('GENERIC-A', 'Lightweight manual wheelchair', { description: 'A folding wheelchair with adjustable arms.' })] } });
    assert.equal((await noClassInference.search('K3 wheelchair')).length, 0, 'Do not infer K3 from lightweight');
  });

  await test('Light weight and height-adjustable arm search require the right product evidence', async () => {
    const real = harness();
    assert.ok(codes(await real.search('light weight wheelchair')).includes('K3DK16FTADJ'));
    assert.ok(codes(await real.search('height-adjustable arm wheelchair')).includes('K3DK16FTADJ'));
    assert.ok(codes(await real.search('wheelchair with adjustable arm height')).includes('K3DK16FTADJ'));
    const h = harness({ datasets: { dalton: [
      row('FIXED', 'Wheelchair', { description: 'Height-adjustable leg rests and fixed arms.' }),
      row('SPEC', 'Wheelchair', { _skuSpecs: [{ label: 'Arm Type', value: 'Height-adjustable' }] }),
      row('FIXED-OPTION', 'Wheelchair', { description: 'Family offered with height-adjustable arms.',
        _specs: [{ label: 'Arm Type', value: 'Height-adjustable' }], _skuSpecs: [{ label: 'Arm Type', value: 'Fixed' }] }),
    ] } });
    assert.deepEqual(codes(await h.search('height-adjustable arm wheelchair')), ['SPEC']);
  });

  await test('HCPCS searches use exact catalog references and never infer a code from a model name', async () => {
    const h = harness({ datasets: { dalton: [
      row('REFERENCE', 'Wheelchair', { _searchHcpcs: ['K0001'] }),
      row('MENTION', 'K1 wheelchair', { description: 'Compare to K0001 and K0003.' }),
      row('K0001', 'Wheelchair with a code-like SKU'),
    ] } });
    assert.deepEqual(codes(await h.search('HCPCS K0001 wheelchair')), ['REFERENCE']);
    assert.deepEqual(codes(await h.search('HCPCS code K0001 wheelchair')), ['REFERENCE']);
    assert.equal((await h.search('K0001'))[0].x.p.code, 'K0001', 'bare SKU retains exact priority');
    assert.deepEqual(codes(await h.search('K0003')), []);
    const unrelated = harness({ lines: ['other'], datasets: { other: [row('K3UNRELATED', 'Wheelchair'), row('K3', 'Literal SKU')] } });
    assert.deepEqual(codes(await unrelated.search('K3 wheelchair')), []);
    assert.deepEqual(codes(await unrelated.search('K3')), ['K3']);
  });

  await test('Catalog code references must be published, exact and unqualified', () => {
    const refs = vm.runInNewContext(referenceSource + ';catalogSkuHcpcs');
    const spec = value => [{ label: 'HCPCS code', value }];
    const sku = { sku: 'OPTION-A' };
    const page = { status: 'published', specs: spec('K0001'), skus: [sku] };
    assert.deepEqual(Array.from(refs(page, sku)), ['K0001']);
    assert.deepEqual(Array.from(refs({ ...page, status: 'approved' }, sku)), []);
    assert.deepEqual(Array.from(refs({ ...page, skus: [sku, { sku: 'OPTION-B' }] }, sku)), []);
    assert.deepEqual(Array.from(refs(page, { ...sku, specs: spec('K0001 pending') })), []);
    assert.deepEqual(Array.from(refs(page, { ...sku, specs: [...spec('K0001'), ...spec('K0003')] })), []);
  });

  await test('A catalog session reset isolates unfinished line loads even when both sessions carry the same line', async () => {
    let finish;
    const first = new Promise(resolve => { finish = resolve; });
    const DASH = { lineCache: {} };
    const s = { DASH, CATALOG_SOURCE: {}, isGoldenSlug: () => false,
      fetch: async () => ({ ok: true, json: async () => [] }),
      mergeCatalogEdits: async () => first };
    const load = vm.runInNewContext(lineSource + ';loadLine', s);
    const previous = load('dalton');
    await new Promise(resolve => setImmediate(resolve));
    DASH.lineCache = {};
    s.mergeCatalogEdits = async () => [{ code: 'CURRENT' }];
    assert.equal((await load('dalton'))[0].code, 'CURRENT');
    finish([{ code: 'PREVIOUS' }]);
    assert.equal((await previous).length, 0);
    assert.equal(DASH.lineCache.dalton[0].code, 'CURRENT');
  });

  await test('With and and are conversational filler, while without remains meaningful', async () => {
    const h = harness();
    assert.ok(codes(await h.search('K3 wheelchair with anti tippers and footrests')).includes('K3DK16FTADJ'));
    const fixture = harness({ datasets: { dalton: [row('K3ONLY', 'K3 wheelchair', { description: 'Comes with footrests and anti-tippers.' })] } });
    assert.equal((await fixture.search('K3 wheelchair without footrests')).length, 0, 'Negation must not be discarded as filler');
  });

  await test('Manufacturer words and current dealer access still restrict results', async () => {
    const other = row('K3OTHER', 'K3 wheelchair');
    const h = harness({ lines: ['dalton', 'other'], datasets: { other: [other], forbidden: [row('K3SECRET', 'K3 wheelchair')] } });
    assert.deepEqual(slugs(await h.search('Dalton K3 wheelchair')), ['dalton']);
    assert.ok(!(h.calls.forbidden > 0), 'An inaccessible line must never be loaded');
    assert.ok(!(await h.search('K3 wheelchair')).some(r => r.x.slug === 'forbidden'));
  });

  await test('Bed searches preserve semi-electric identity despite conflicting descriptive copy', async () => {
    const h = harness();
    const singular = codes(await h.search('hospital bed')), plural = codes(await h.search('hospital beds'));
    assert.deepEqual(singular, plural);
    for (const query of ['semi electric hospital beds', 'semi-electric hospital beds']) {
      const result = await h.search(query);
      assert.ok(result.length, query);
      assert.equal(result[0].x.p.code, 'BED1200i', query);
      assert.ok(!codes(result).includes('BED1300i'), 'Full-electric copy mentions semi-electric; its name must control identity');
    }
  });

  await test('An uncached temporary empty load retries on the next search', async () => {
    const h = harness({ load: async (slug, n, rows) => n === 1 ? { rows: [], cache: false } : { rows } });
    assert.equal((await h.search('K3 wheelchair')).length, 0);
    unavailable(h, 'dalton');
    assert.deepEqual(codes(await h.search('K3 wheelchair')), canonicalK3);
    assert.equal(h.calls.dalton, 2); complete(h);
  });

  await test('A rejected line load reports unavailable and then recovers', async () => {
    const h = harness({ load: async (slug, n, rows) => {
      if (n === 1) throw new Error('synthetic catalog outage');
      return { rows };
    } });
    await h.search('K3 wheelchair');
    unavailable(h, 'dalton');
    assert.deepEqual(codes(await h.search('K3 wheelchair')), canonicalK3);
    assert.equal(h.calls.dalton, 2); complete(h);
  });

  await test('A genuinely empty loaded catalog is a complete zero and is not retried', async () => {
    const h = harness({ datasets: { dalton: [] } });
    assert.equal((await h.search('K3 wheelchair')).length, 0); complete(h);
    assert.equal((await h.search('K3 wheelchair')).length, 0); complete(h);
    assert.equal(h.calls.dalton, 1);
  });

  await test('Partial results survive failure and only failed lines are retried', async () => {
    const h = harness({
      lines: ['dalton', 'other'], datasets: { other: [row('K3OTHER', 'K3 wheelchair')] },
      load: async (slug, n, rows) => slug === 'other' && n === 1 ? { rows: [], cache: false } : { rows }
    });
    assert.deepEqual(slugs(await h.search('K3 wheelchair')), ['dalton']); unavailable(h, 'other');
    assert.deepEqual(slugs(await h.search('K3 wheelchair')), ['dalton', 'other']); complete(h);
    assert.equal(h.calls.dalton, 1); assert.equal(h.calls.other, 2);
  });

  await test('Changing dealer and accessible lines cannot reuse the previous dealer results', async () => {
    const h = harness({ datasets: { other: [row('K3OTHER', 'K3 wheelchair')] } });
    assert.deepEqual(slugs(await h.search('K3 wheelchair')), ['dalton']);
    h.sandbox.AUTH.dealer.id = 'synthetic-B'; h.control.lines = ['other'];
    assert.deepEqual(slugs(await h.search('K3 wheelchair')), ['other']);
    assert.equal((await h.search('K3DK16FTADJ')).length, 0); complete(h);
  });

  await test('Golden remains absent without entitlement and PR-519 remains searchable when allowed', async () => {
    const h = harness({ lines: ['dalton', 'golden-technologies'], datasets: {
      'golden-technologies': [row('PR519', 'Golden PR519 lift chair', { category: 'Lift Chairs' })]
    } });
    assert.equal((await h.search('PR-519')).length, 0);
    h.control.golden = true;
    const result = await h.search('PR-519');
    assert.equal(result.length, 1); assert.equal(result[0].x.p.code, 'PR519');
    h.control.golden = false;
    assert.equal((await h.search('PR-519')).length, 0);
  });

  await test('A superseded slow search cannot overwrite another dealer results or availability', async () => {
    let finish;
    const gate = new Promise(resolve => { finish = resolve; });
    const h = harness({
      datasets: { other: [row('K3OTHER', 'K3 wheelchair')] },
      load: async (slug, n, rows) => slug === 'dalton' ? gate : { rows }
    });
    const previous = h.search('K3 wheelchair');
    for (let i = 0; i < 5 && !h.calls.dalton; i++) await Promise.resolve();
    assert.equal(h.calls.dalton, 1);
    h.sandbox.AUTH.dealer.id = 'synthetic-B'; h.control.lines = ['other'];
    assert.deepEqual(slugs(await h.search('K3 wheelchair')), ['other']);
    finish({ rows: catalog, cache: false });
    const oldResult = await previous;
    assert.ok(!oldResult.some(r => r.x.slug === 'dalton'), 'Previous dealer results must not escape a stale promise');
    assert.deepEqual(slugs(await h.search('K3 wheelchair')), ['other']); complete(h);
  });

  await test('Victoria distinguishes unavailable, genuine zero, and a successfully opened exact product', async () => {
    async function navigation(mode) {
      let shown = false;
      const hit = { x: { slug: 'dalton', p: byCode('K3DK16FTADJ') }, score: 0 };
      const sandbox = {
        window: {
          gsSearchAll: async () => { if (mode === 'throw') throw new Error('synthetic failure'); return mode === 'exact' ? [hit] : []; },
          gsSearchStatus: () => mode === 'unavailable'
            ? { complete: false, reason: 'catalog_unavailable', unavailable: ['dalton'] }
            : { complete: true, reason: null, unavailable: [] }
        },
        state: { active: '__all__' }, SHOPALL: '__all__', SL_Q: '',
        document: {
          querySelector: () => shown ? { textContent: '0 results' } : null,
          querySelectorAll: () => []
        },
        setTimeout: callback => { callback(); return 0; }, clearTimeout,
        dvOpenProduct: async (slug, code) => ({ ok: true, code, name: 'K3 wheelchair' })
      };
      sandbox.showShopSearch = async query => { sandbox.SL_Q = query; shown = true; };
      vm.createContext(sandbox); vm.runInContext(openSource, sandbox);
      return sandbox.dvOpenSearch('K3 wheelchair');
    }
    for (const mode of ['throw', 'unavailable']) {
      const result = await navigation(mode);
      assert.equal(result.ok, false, mode + ' must not be reported as zero matches');
      assert.ok(result.reason, mode + ' requires an actionable failure reason');
    }
    const zero = await navigation('zero');
    assert.equal(zero.ok, true); assert.equal(zero.count, 0);
    const exact = await navigation('exact');
    assert.equal(exact.ok, true); assert.equal(exact.opened.code, 'K3DK16FTADJ');
  });

  console.log('\nVictoria product search: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
