/* Mutation harness for the Phase 5 price reconciliation.
   The mutants that matter are the ones that could change a dealer's price:
   the record winning before it should, a silent record blanking a live price,
   a real difference going unreported. CONTROL must survive. */
const fs = require('fs');
const suite = require('./shopprices.test');

const src = fs.readFileSync(suite.SHOP, 'utf8');

const MUTANTS = [
  { name: 'CONTROL — a comment, changing nothing',
    from: '  let matched = 0, unmatched = 0;',
    to:   '  let matched = 0, unmatched = 0; /* control mutant */',
    expect: 'survive' },

  { name: 'let the record win before Phase 6',
    from: '        if(authoritative) p[k] = m[k];',
    to:   '        p[k] = m[k];' },

  { name: 'let the record win on ladders before Phase 6',
    from: '        if(authoritative) p.tiers = m.tiers;',
    to:   '        p.tiers = m.tiers;' },

  { name: 'let a silent record blank a live price',
    from: '      if(m[k] == null) return;',
    to:   '      if(false) return;' },

  { name: 'let a null ladder in the record clear the storefront ladder',
    from: '    if(m.tiers != null){',
    to:   '    if(true){' },

  { name: 'stop reporting differences',
    from: '        diffs.push({ code: p.code, field: k, layers: p[k], record: m[k] });',
    to:   '        if(false) diffs.push({ code: p.code, field: k, layers: p[k], record: m[k] });' },

  { name: 'treat every price as different (tolerance removed)',
    from: '                       : Math.abs(Number(a) - Number(b)) < 0.005;',
    to:   '                       : Math.abs(Number(a) - Number(b)) < 0;' },

  { name: 'compare codes raw instead of normalised',
    from: '  const norm = c => String(c == null ? "" : c).toUpperCase().replace(/[^A-Z0-9]/g, "");',
    to:   '  const norm = c => String(c == null ? "" : c);' },

  { name: 'ignore the storefront spelling of a ladder rung',
    from: "    ? t.map(x => Math.round(Number(x.min_qty != null ? x.min_qty : x.minQty)) + ':' + Number(x.price))",
    to:   "    ? t.map(x => Math.round(Number(x.min_qty)) + ':' + Number(x.price))" },

  { name: 'let ladder order count as a difference',
    from: "       .sort().join(',')",
    to:   "       .join(',')" },

  { name: 'copy identity fields across too',
    from: '    ["base_price", "msrp", "map"].forEach(k => {',
    to:   '    ["base_price", "msrp", "map", "name", "category", "image"].forEach(k => {' },

  { name: 'touch SKUs the record has never heard of',
    from: '    if(!m){ unmatched++; return; }',
    to:   '    if(!m){ unmatched++; }' },
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
