/* Phase 5 price reconciliation — behaviour suite.
   Lifts the real reconcileShopPrices out of public/index.html and runs it. */
const fs = require('fs');
const path = require('path');

const SHOP = process.env.SHOP_HTML
  || path.join(__dirname, '..', 'public', 'index.html');

function lift(src){
  const html = src !== undefined ? src : fs.readFileSync(SHOP, 'utf8');
  const at = html.indexOf('function reconcileShopPrices(');
  if(at < 0) throw new Error('anchor not found: reconcileShopPrices');
  // brace-match from the body brace after the parameter list
  let i = html.indexOf(')', at); i = html.indexOf('{', i);
  let depth = 0, end = -1;
  for(let j = i; j < html.length; j++){
    if(html[j] === '{') depth++;
    else if(html[j] === '}'){ depth--; if(depth === 0){ end = j; break; } }
  }
  if(end < 0) throw new Error('unbalanced reconcileShopPrices');
  const code = html.slice(at, end + 1) + '\n;module.exports={reconcileShopPrices};';
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

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

function run(src){
  const { reconcileShopPrices } = lift(src);
  pass = 0; fail = 0; out.length = 0;

  const P = (over) => Object.assign({ code:'A1', base_price:10, msrp:20, map:null, tiers:null }, over || {});

  /* ---- agreement: the ordinary case ------------------------------------- */
  t('identical prices produce no differences and change nothing', () => {
    const prods = [P()];
    const r = reconcileShopPrices(prods, [{ code:'A1', base_price:10, msrp:20 }], true);
    eq(r.matched, 1, 'matched');
    eq(r.diffs, [], 'diffs');
    eq(prods[0].base_price, 10, 'base_price untouched');
  });

  t('a half-cent wobble is not a difference', () => {
    const r = reconcileShopPrices([P({ base_price:10.001 })], [{ code:'A1', base_price:10, msrp:20 }], true);
    eq(r.diffs, [], 'diffs');
  });

  t('codes match through case and punctuation', () => {
    const r = reconcileShopPrices([P({ code:'MP-P08-KIT' })], [{ code:'mp p08 kit', base_price:10, msrp:20 }], true);
    eq(r.matched, 1, 'matched');
    eq(r.unmatched, 0, 'unmatched');
  });

  /* ---- THE SAFETY PROPERTY: who wins a disagreement ---------------------- */
  t('while the record is not authoritative, the layers stand', () => {
    const prods = [P({ base_price:27.95 })];
    const r = reconcileShopPrices(prods, [{ code:'A1', base_price:19.95, msrp:20 }], false);
    eq(prods[0].base_price, 27.95, 'storefront price unchanged');
    eq(r.diffs.length, 1, 'but the difference is reported');
    eq(r.diffs[0].layers, 27.95, 'reported layers value');
    eq(r.diffs[0].record, 19.95, 'reported record value');
  });

  t('when the record IS authoritative, it wins and still reports', () => {
    const prods = [P({ base_price:27.95 })];
    const r = reconcileShopPrices(prods, [{ code:'A1', base_price:19.95, msrp:20 }], true);
    eq(prods[0].base_price, 19.95, 'record applied');
    eq(r.diffs.length, 1, 'still reported');
  });

  /* ---- a silent record must never erase a price -------------------------- */
  t('a field the record does not carry never blanks the storefront', () => {
    const prods = [P({ base_price:27.95, msrp:55.9, map:12 })];
    reconcileShopPrices(prods, [{ code:'A1' }], true);
    eq(prods[0].base_price, 27.95, 'base_price kept');
    eq(prods[0].msrp, 55.9, 'msrp kept');
    eq(prods[0].map, 12, 'map kept');
  });

  t('a SKU the record has never heard of is left completely alone', () => {
    const prods = [P({ code:'GHOST', base_price:99 })];
    const r = reconcileShopPrices(prods, [{ code:'A1', base_price:10 }], true);
    eq(r.unmatched, 1, 'unmatched');
    eq(prods[0].base_price, 99, 'untouched');
    eq(r.diffs, [], 'no difference reported for a SKU that was not compared');
  });

  t('an empty record list changes nothing at all', () => {
    const prods = [P()];
    const r = reconcileShopPrices(prods, [], true);
    eq(r.matched, 0, 'matched');
    eq(prods[0].base_price, 10, 'untouched');
  });

  /* ---- quantity ladders --------------------------------------------------- */
  t('an identical ladder in a different order is not a difference', () => {
    const r = reconcileShopPrices(
      [P({ tiers:[{min_qty:6,price:23.85},{min_qty:2,price:25.45}] })],
      [{ code:'A1', tiers:[{min_qty:2,price:25.45},{min_qty:6,price:23.85}] }], true);
    eq(r.diffs, [], 'diffs');
  });

  t('the storefront spelling of a ladder compares against the record spelling', () => {
    // The old layers wrote minQty; the record writes min_qty. Same ladder.
    const r = reconcileShopPrices(
      [P({ tiers:[{minQty:2,price:25.45}] })],
      [{ code:'A1', tiers:[{min_qty:2,price:25.45}] }], true);
    eq(r.diffs, [], 'diffs');
  });

  t('a genuinely different ladder is reported', () => {
    const prods = [P({ tiers:[{min_qty:2,price:25.45}] })];
    const r = reconcileShopPrices(prods, [{ code:'A1', tiers:[{min_qty:2,price:19.99}] }], false);
    eq(r.diffs.length, 1, 'reported');
    eq(prods[0].tiers, [{min_qty:2,price:25.45}], 'layers stand');
  });

  t('a null ladder in the record does not clear the storefront ladder', () => {
    const prods = [P({ tiers:[{min_qty:2,price:25.45}] })];
    reconcileShopPrices(prods, [{ code:'A1', base_price:10 }], true);
    eq(prods[0].tiers, [{min_qty:2,price:25.45}], 'ladder kept');
  });

  /* ---- the label the dealer sees ----------------------------------------- */
  t('the suggested-MSRP marker is never touched', () => {
    // _msrp_suggested is decided before this runs, from whether the LAYERS
    // stated an MSRP. The record knows more than the storefront does about
    // which MSRPs were generated, and surfacing that here would change what
    // 270 Ovation cards say. Phase 5 changes no labels.
    const prods = [P({ msrp:55.9, _msrp_suggested:true })];
    reconcileShopPrices(prods, [{ code:'A1', msrp:55.9, msrp_auto:true }], true);
    eq(prods[0]._msrp_suggested, true, 'marker survives');
    const p2 = [P({ msrp:30 })];
    reconcileShopPrices(p2, [{ code:'A1', msrp:30, msrp_auto:true }], true);
    eq('_msrp_suggested' in p2[0], false, 'and is not invented');
  });

  t('identity fields are untouchable even if the record carries them', () => {
    const prods = [P({ name:'Real Name', category:'Real Category', image:'a.png' })];
    reconcileShopPrices(prods, [{ code:'A1', base_price:10, name:'Feed Name',
      category:'Feed Category', image:'b.png' }], true);
    eq(prods[0].name, 'Real Name', 'name');
    eq(prods[0].category, 'Real Category', 'category');
    eq(prods[0].image, 'a.png', 'image');
  });

  /* ---- shape ------------------------------------------------------------- */
  t('null inputs do not throw', () => {
    const r = reconcileShopPrices(null, null, true);
    eq(r.matched, 0, 'matched');
    eq(r.diffs, [], 'diffs');
  });

  return { pass, fail, report: out.join('\n') };
}

module.exports = { run, SHOP };

if(require.main === module){
  const r = run();
  console.log(r.report);
  console.log('\n' + r.pass + ' passed, ' + r.fail + ' failed');
  process.exit(r.fail ? 1 : 0);
}
