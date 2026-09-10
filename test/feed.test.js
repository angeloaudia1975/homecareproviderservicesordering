/* Catalog feed — behaviour suite.
   Loads the real function file and exercises its exported pure parts.
   CATALOG_FEED overrides the path so this runs from a clone or from anywhere. */
const path = require('path');
const FEED = process.env.CATALOG_FEED
  || path.join(__dirname, '..', 'netlify', 'functions', 'catalog-feed.js');

let pass = 0, fail = 0;
const out = [];
function t(name, fn){
  try { fn(); pass++; out.push('  ok   ' + name); }
  catch(e){ fail++; out.push('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, what){
  if(JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((what || 'value') + ': got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
}

function load(src){
  const fs = require('fs');
  const code = src !== undefined ? src : fs.readFileSync(FEED, 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', 'process', 'fetch', code)(
    mod, mod.exports, require, { env: {} }, () => { throw new Error('no network in tests'); });
  return mod.exports;
}

function run(src){
  const M = load(src);
  const { authorize, feedRows } = M;

  pass = 0; fail = 0; out.length = 0;

  /* ---- who may see a price ----------------------------------------------- */
  t('no caller gets no prices', () => {
    eq(authorize(null, 'ovation-medical'), { ok:false, status:401, error:'unauthorized' });
  });

  t('a caller with no manufacturer is a bad request, not an empty feed', () => {
    eq(authorize({ kind:'staff' }, ''), { ok:false, status:400, error:'manufacturer required' });
  });

  t('staff may read any line', () => {
    eq(authorize({ kind:'staff', role:'rep' }, 'ovation-medical'), { ok:true });
    eq(authorize({ kind:'staff', role:'president' }, 'climbing-steps'), { ok:true });
  });

  t('a dealer may read a line they carry', () => {
    eq(authorize({ kind:'dealer', lines:['ovation-medical','climbing-steps'] }, 'climbing-steps'), { ok:true });
  });

  t('a dealer is refused a line they do not carry, and told which problem it is', () => {
    const g = authorize({ kind:'dealer', lines:['ovation-medical'] }, 'climbing-steps');
    eq(g.ok, false, 'ok');
    eq(g.status, 403, 'status — not 401, and not 404');
  });

  t('a dealer with no lines at all sees nothing', () => {
    eq(authorize({ kind:'dealer', lines:[] }, 'ovation-medical').status, 403, 'status');
    eq(authorize({ kind:'dealer' }, 'ovation-medical').status, 403, 'missing lines behaves as none');
  });

  t('an unrecognised caller shape is refused rather than waved through', () => {
    eq(authorize({ kind:'robot' }, 'ovation-medical').status, 401, 'status');
    eq(authorize({}, 'ovation-medical').status, 401, 'status');
  });


  t('a staff preview is a dealer caller with that dealer\'s lines', () => {
    // previewMe() sets AUTH.status approved but never a session, so preview has
    // no JWT. It must still be entitled to exactly the dealer's own lines.
    eq(authorize({ kind:'dealer', dealer_id:'d1', lines:['climbing-steps'] }, 'climbing-steps'), { ok:true });
    eq(authorize({ kind:'dealer', dealer_id:'d1', lines:['climbing-steps'] }, 'ovation-medical').status, 403, 'and no more than those');
  });

  /* ---- what goes on the wire --------------------------------------------- */
  t('a full row survives intact', () => {
    const [r] = feedRows([{ code:'ST006SN', option_label:'Large', base_price:27.95, msrp:55.9,
      msrp_auto:true, map:null, tiers:[{min_qty:6,price:23.85},{min_qty:2,price:25.45}],
      price_note:'eff. 2026-01-01', uom:'EA', hcpcs:'L1234', case_qty:12 }]);
    eq(r.code, 'ST006SN', 'code');
    eq(r.base_price, 27.95, 'base_price');
    eq(r.msrp_auto, true, 'msrp_auto');
    eq(r.tiers, [{min_qty:2,price:25.45},{min_qty:6,price:23.85}], 'tiers sorted by quantity');
    eq(r.case_qty, 12, 'case_qty');
  });

  t('a missing MAP is absent, never zero', () => {
    const [r] = feedRows([{ code:'A1', base_price:10, map:null }]);
    eq('map' in r, false, 'map omitted');
    eq(r.base_price, 10, 'base_price kept');
  });

  t('an empty string is treated as absent, not as a number', () => {
    const [r] = feedRows([{ code:'A1', base_price:'', msrp:'', map:'' }]);
    eq('base_price' in r, false, 'base_price');
    eq('msrp' in r, false, 'msrp');
  });

  t('a zero price is a real number and is kept', () => {
    const [r] = feedRows([{ code:'A1', base_price:0 }]);
    eq(r.base_price, 0, 'base_price');
  });

  t('msrp_auto false is left off — only a derived MSRP announces itself', () => {
    const [r] = feedRows([{ code:'A1', msrp:30, msrp_auto:false }]);
    eq('msrp_auto' in r, false, 'msrp_auto');
    eq(r.msrp, 30, 'msrp');
  });

  t('an empty or malformed ladder does not become an empty array', () => {
    eq('tiers' in feedRows([{ code:'A1', tiers:[] }])[0], false, 'empty array');
    eq('tiers' in feedRows([{ code:'A1', tiers:null }])[0], false, 'null');
    eq('tiers' in feedRows([{ code:'A1', tiers:[{min_qty:'x',price:'y'}] }])[0], false, 'unparseable rungs');
  });

  t('the feed carries no identity fields, whatever the row holds', () => {
    const [r] = feedRows([{ code:'A1', name:'Walking Boot', category:'Orthopedics',
      subcategory:'Boots', image:'https://example/x.png', description:'text', base_price:10 }]);
    eq(Object.keys(r).sort(), ['base_price','code'], 'keys');
  });

  t('rows come back in code order however they arrived', () => {
    eq(feedRows([{code:'C'},{code:'A'},{code:'B'}]).map(r=>r.code), ['A','B','C'], 'order');
  });

  t('an empty catalog is an empty list, not a failure', () => {
    eq(feedRows([]), [], 'empty');
    eq(feedRows(null), [], 'null');
  });

  return { pass, fail, report: out.join('\n') };
}

module.exports = { run, FEED };

if(require.main === module){
  const r = run();
  console.log(r.report);
  console.log('\n' + r.pass + ' passed, ' + r.fail + ' failed');
  process.exit(r.fail ? 1 : 0);
}
