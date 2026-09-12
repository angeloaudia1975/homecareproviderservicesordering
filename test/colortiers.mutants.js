/* Mutation harness for colour-variant price and ladder inheritance.

   Two failure modes matter and they pull opposite ways. Inheriting too little is
   what put sixty Gen 2 boots on list price at every quantity. Inheriting too much
   would put a ladder under a price it was never written for, which is worse,
   because it is wrong in the dealer's favour and nobody reports those.

   SCOPE, HONESTLY: these mutants cover inheritColorPrice, the consumer. The
   producer — the priceIndex/tierIndex builder inside mergeCatalogEdits — is not
   reachable from here (it is async and fetches), so it is verified by reading and
   by the live sweep against the storefront, not by this harness.

   Every anchor must occur exactly once. CONTROL is a genuine no-op and must
   SURVIVE; if it dies the harness is failing everything and no other result means
   anything. */
const fs = require('fs');
const suite = require('./colortiers.test');

const src = fs.readFileSync(suite.SHOP, 'utf8');

const MUTANTS = [
  { name: 'CONTROL — a comment, changing nothing',
    from: '  const tdx=p._tierIndex||{};',
    to:   '  const tdx=p._tierIndex||{}; /* control mutant */',
    expect: 'survive' },

  // --- inheriting too little (the bug this change exists to fix)
  { name: 'stop once the price is present, as the old code did',
    from: '  if(havePrice && haveTiers) return p;',
    to:   '  if(havePrice) return p;' },

  { name: 'never inherit a ladder at all',
    from: '    if(!haveTiers && samePrice && Array.isArray(rungs) && rungs.length){',
    to:   '    if(false){' },

  { name: 'treat an empty ladder as a ladder, so nothing is inherited',
    from: '  const haveTiers = Array.isArray(p.tiers) && p.tiers.length>0;',
    to:   '  const haveTiers = Array.isArray(p.tiers);' },

  { name: 'call a half-cent difference a different price',
    from: '    const samePrice=Math.abs(Number(p.base_price)-Number(v))<0.005;',
    to:   '    const samePrice=Math.abs(Number(p.base_price)-Number(v))<0;' },

  // --- inheriting too much (the dangerous direction)
  { name: 'drop the same-price guard, so a ladder lands under any price',
    from: '    const samePrice=Math.abs(Number(p.base_price)-Number(v))<0.005;',
    to:   '    const samePrice=true;' },

  { name: 'overwrite a ladder the SKU already has',
    from: '    if(!haveTiers && samePrice',
    to:   '    if(samePrice' },

  { name: 'overwrite a price the SKU already has',
    from: '    if(!havePrice){ p.base_price=v; p._priceFromBase=stem; }',
    to:   '    { p.base_price=v; p._priceFromBase=stem; }' },

  { name: 'inherit across a non-colour suffix too',
    from: '  const m=code.match(COLOR_SUFFIX); if(!m) return p;',
    to:   '  const m=code.match(/[A-Z]+$/); if(!m) return p;' },

  // --- aliasing
  { name: 'hand every colour the same rung array instead of a copy',
    from: '      p.tiers=rungs.map(t=>Object.assign({},t));',
    to:   '      p.tiers=rungs;' },

  { name: 'copy the array but share the rung objects inside it',
    from: '      p.tiers=rungs.map(t=>Object.assign({},t));',
    to:   '      p.tiers=rungs.slice();' },

  // --- provenance
  { name: 'stop recording where an inherited ladder came from',
    from: '      p._tiersFromBase=stem;',
    to:   '      ;' },
];

let bad = 0;
console.log('mutant                                                    anchors  result');
console.log('-'.repeat(78));

for(const m of MUTANTS){
  const hits = src.split(m.from).length - 1;
  if(hits !== 1){
    console.log(m.name.padEnd(56) + String(hits).padStart(6) + '   ANCHOR NOT UNIQUE — mutant is meaningless');
    bad++; continue;
  }
  const mutated = src.replace(m.from, m.to);
  let r;
  try { r = suite.run(mutated); }
  catch(e){ r = { pass: 0, fail: -1, report: 'threw: ' + e.message }; }

  const survived = r.fail === 0;
  const wantSurvive = m.expect === 'survive';
  const ok = survived === wantSurvive;
  if(!ok) bad++;

  const verdict = survived
    ? (wantSurvive ? 'survived (correct — no-op)' : 'SURVIVED — untested behaviour')
    : (wantSurvive ? 'KILLED — harness is broken' : 'killed by ' + r.fail + ' test(s)');
  console.log(m.name.padEnd(56) + String(hits).padStart(6) + '   ' + verdict);
}

console.log('-'.repeat(78));
console.log(bad === 0
  ? 'All mutants behaved as required (control survived, every real mutant killed).'
  : bad + ' mutant(s) did not behave as required.');
process.exit(bad ? 1 : 0);
