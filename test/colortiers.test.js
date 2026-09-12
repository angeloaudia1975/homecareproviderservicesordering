/* Colour-variant price and ladder inheritance — behaviour suite.
   Lifts the real COLOR_SUFFIX and inheritColorPrice out of public/index.html and
   runs them, so these tests fail when the shipped code changes rather than when a
   copy of it does. */
const fs = require('fs');
const path = require('path');

const SHOP = process.env.SHOP_HTML
  || path.join(__dirname, '..', 'public', 'index.html');

function slice(html, anchor, what){
  const at = html.indexOf(anchor);
  if(at < 0) throw new Error('anchor not found: ' + what);
  if(html.indexOf(anchor, at + 1) >= 0) throw new Error('anchor not unique: ' + what);
  return at;
}

function lift(src){
  const html = src !== undefined ? src : fs.readFileSync(SHOP, 'utf8');

  // the colour token list — a single-line const, ends at its newline
  const cAt = slice(html, 'const COLOR_SUFFIX=', 'COLOR_SUFFIX');
  const cEnd = html.indexOf('\n', cAt);
  const constSrc = html.slice(cAt, cEnd);

  // the function — brace-matched from the body brace after the parameter list
  const fAt = slice(html, 'function inheritColorPrice(', 'inheritColorPrice');
  let i = html.indexOf(')', fAt); i = html.indexOf('{', i);
  let depth = 0, end = -1;
  for(let j = i; j < html.length; j++){
    if(html[j] === '{') depth++;
    else if(html[j] === '}'){ depth--; if(depth === 0){ end = j; break; } }
  }
  if(end < 0) throw new Error('unbalanced inheritColorPrice');

  const code = constSrc + '\n' + html.slice(fAt, end + 1)
             + '\n;module.exports={inheritColorPrice,COLOR_SUFFIX};';
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

/* The two Gen 2 ladders, exactly as Ovation's 2026 list prints them. */
const LADDER_10 = [{min_qty:2,price:44.95},{min_qty:6,price:37.95},
                   {min_qty:11,price:31.95},{min_qty:21,price:27.95}];
const LADDER_11 = [{min_qty:2,price:36.50},{min_qty:6,price:34.50},
                   {min_qty:11,price:29.95},{min_qty:21,price:24.95}];

function run(src){
  const M = lift(src);
  const inherit = M.inheritColorPrice;

  pass = 0; fail = 0; out.length = 0;

  /* A shop-shaped product. _priceIndex/_tierIndex are what mergeCatalogEdits attaches. */
  const P = (code, extra) => Object.assign({
    code,
    _priceIndex: { '10002': 49.95, '11002': 49.95, '1007': 199.00, 'CF002': 49.95 },
    _tierIndex:  { '10002': LADDER_10, '11002': LADDER_11, '1007': null, 'CF002': null },
  }, extra || {});

  /* ---- THE ONE THAT COST MONEY ------------------------------------------- */
  t('a colour SKU with no price and no ladder inherits both', () => {
    const p = inherit(P('10002BLACK'));
    eq(p.base_price, 49.95, 'base_price');
    eq(p.tiers, LADDER_10, 'tiers');
    eq(p._priceFromBase, '10002', 'price provenance');
    eq(p._tiersFromBase, '10002', 'ladder provenance');
  });

  t('a colour SKU that already has the price but NO ladder still gets the ladder', () => {
    // This is the shape that went unnoticed: the card looked right, and unitPrice()
    // fell through to base_price at every quantity.
    const p = inherit(P('10002GREY', { base_price: 49.95 }));
    eq(p.tiers, LADDER_10, 'tiers');
    eq(p._tiersFromBase, '10002', 'ladder provenance');
    eq(p._priceFromBase, undefined, 'price was not re-inherited');
  });

  t('a colour SKU that has its own ladder keeps it', () => {
    const own = [{min_qty:2,price:40}];
    const p = inherit(P('10002BLUE', { base_price: 49.95, tiers: own }));
    eq(p.tiers, own, 'tiers untouched');
    eq(p._tiersFromBase, undefined, 'no provenance — nothing was inherited');
  });

  t('the second Gen 2 family inherits its own ladder, not the first one', () => {
    eq(inherit(P('11002RED')).tiers, LADDER_11, 'tiers');
  });

  t('a ladder of its own survives even when the PRICE has to be inherited', () => {
    /* The one case where the two inheritances come apart, and the only reason the
       inner !haveTiers guard is not redundant with the early return above it: a SKU
       that was given a ladder by hand and left without a price. It must come out of
       here priced from the base part and still carrying the rungs someone typed. A
       mutation harness caught this missing — the guard was untested until then. */
    const own = [{min_qty:2,price:40}];
    const p = inherit(P('10002RED', { tiers: own }));
    eq(p.base_price, 49.95, 'price inherited');
    eq(p.tiers, own, 'its own ladder is untouched');
    eq(p._tiersFromBase, undefined, 'no ladder provenance');
  });

  /* ---- the guard that stops a ladder landing under the wrong price ------- */
  t('a colour that costs more than the base part does NOT take its breaks', () => {
    // A ladder built for a $49.95 boot under a $69.95 one would price 2+ below
    // the single unit for the wrong reason, and 21+ at barely a third of list.
    const p = inherit(P('10002RED', { base_price: 69.95 }));
    eq(p.tiers, undefined, 'no ladder inherited');
    eq(p.base_price, 69.95, 'its own price is left alone');
  });

  t('a half-cent difference is still the same price', () => {
    const p = inherit(P('10002RED', { base_price: 49.951 }));
    eq(p.tiers, LADDER_10, 'ladder inherited');
  });

  /* ---- rungs are copied, not shared -------------------------------------- */
  t('two colours of the same boot do not share one rung array', () => {
    const a = inherit(P('10002BLACK'));
    const b = inherit(P('10002RED'));
    if(a.tiers === b.tiers) throw new Error('same array object handed to both');
    if(a.tiers[0] === b.tiers[0]) throw new Error('same rung object handed to both');
    a.tiers[0].price = 1;
    eq(b.tiers[0].price, 44.95, 'the other colour is unaffected');
    eq(LADDER_10[0].price, 44.95, 'the index itself is unaffected');
  });

  /* ---- what must NOT inherit --------------------------------------------- */
  t('a non-colour suffix is not treated as a colour', () => {
    // Strongback 1007 and 1007AB are different products at different prices.
    const p = inherit(P('1007AB'));
    eq(p.base_price, undefined, 'no price inherited');
    eq(p.tiers, undefined, 'no ladder inherited');
  });

  t('a base part with no ladder of its own passes none on', () => {
    const p = inherit(P('CF002PK'));
    eq(p.base_price, 49.95, 'price still inherited');
    eq(p.tiers, undefined, 'nothing to inherit');
  });

  t('a colour whose base part is unknown inherits nothing', () => {
    const p = inherit(P('99999BLUE'));
    eq(p.base_price, undefined, 'no price');
    eq(p.tiers, undefined, 'no ladder');
  });

  t('a product that is entirely its own colour word is left alone', () => {
    // code === stem would otherwise make it inherit from itself.
    const p = inherit(P('BLUE'));
    eq(p.base_price, undefined, 'no price');
  });

  t('a fully priced, fully laddered SKU is returned untouched', () => {
    const own = [{min_qty:2,price:44.95}];
    const p = inherit(P('10002BLUE', { base_price: 49.95, tiers: own }));
    eq(p._priceFromBase, undefined, 'no price provenance');
    eq(p._tiersFromBase, undefined, 'no ladder provenance');
  });

  t('an empty tiers array counts as no ladder', () => {
    const p = inherit(P('10002BLACK', { base_price: 49.95, tiers: [] }));
    eq(p.tiers, LADDER_10, 'ladder inherited');
  });

  t('a product with no price index at all does not throw', () => {
    const p = inherit({ code: '10002BLUE' });
    eq(p.base_price, undefined, 'left alone');
  });

  t('a hyphen before the colour token is stripped on the second attempt', () => {
    const p = Object.assign(P('10002-BLUE'), {});
    inherit(p);
    eq(p.base_price, 49.95, 'base_price');
    eq(p.tiers, LADDER_10, 'tiers');
  });

  return { pass, fail, report: out.join('\n') };
}

module.exports = { run, lift, SHOP };

if(require.main === module){
  const r = run();
  console.log(r.report);
  console.log('\n' + r.pass + ' passed, ' + r.fail + ' failed');
  process.exit(r.fail ? 1 : 0);
}
