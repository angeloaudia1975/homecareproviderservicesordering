/* Mutation harness for the catalog feed. Every anchor must occur exactly once.
   CONTROL is a genuine no-op and must SURVIVE. The mutants that matter most are
   the ones that hand a price to someone who should not have it — if any of
   those survives, the suite is not actually testing the gate. */
const fs = require('fs');
const suite = require('./feed.test');

const src = fs.readFileSync(suite.FEED, 'utf8');

const MUTANTS = [
  { name: 'CONTROL — a comment, changing nothing',
    from: 'function authorize(who, slug) {',
    to:   'function authorize(who, slug) { /* control mutant */',
    expect: 'survive' },

  { name: 'let an unauthenticated caller through',
    from: '  if (!who) return { ok: false, status: 401, error: "unauthorized" };',
    to:   '  if (!who) return { ok: true };' },

  { name: 'let a dealer read any line',
    from: '      ? { ok: true }\n      : { ok: false, status: 403, error: "not entitled to this manufacturer" };',
    to:   '      ? { ok: true }\n      : { ok: true };' },

  { name: 'treat a dealer with no lines as entitled to everything',
    from: '    return (who.lines || []).indexOf(slug) >= 0',
    to:   '    return (who.lines || [slug]).indexOf(slug) >= 0' },

  { name: 'wave through an unknown caller shape',
    from: '  return { ok: false, status: 401, error: "unauthorized" };\n}',
    to:   '  return { ok: true };\n}' },

  { name: 'stop requiring a manufacturer',
    from: '  if (!slug) return { ok: false, status: 400, error: "manufacturer required" };',
    to:   '  if (!slug) return { ok: true };' },

  { name: 'send a missing price as zero',
    from: '  const n = v => (v == null || v === "" ? null : Number(v));',
    to:   '  const n = v => Number(v || 0);' },

  { name: 'leak the product name into the feed',
    from: '    if (r.option_label) o.option_label = r.option_label;',
    to:   '    if (r.option_label) o.option_label = r.option_label; if (r.name) o.name = r.name;' },

  { name: 'stop sorting the quantity ladder',
    from: '        .sort((a, b) => a.min_qty - b.min_qty);',
    to:   '        .sort((a, b) => b.min_qty - a.min_qty);' },

  { name: 'keep an empty ladder as an empty array',
    from: '      if (!o.tiers.length) delete o.tiers;',
    to:   '      if (false) delete o.tiers;' },

  { name: 'announce every MSRP as derived',
    from: '    if (r.msrp_auto === true) o.msrp_auto = true;',
    to:   '    if (r.msrp_auto !== undefined) o.msrp_auto = true;' },

  { name: 'return rows in whatever order they arrived',
    from: '  out.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));',
    to:   '  out.sort((a, b) => 0);' },
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
