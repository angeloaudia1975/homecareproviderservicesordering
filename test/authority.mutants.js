/* Mutation harness for per-line price authority.

   The permissive direction is the dangerous one. Granting authority to a line
   whose mirror has failed serves prices that froze at whatever they were when it
   broke — and a frozen price looks exactly like a correct one on the card, in the
   cart, and on the order. The restrictive direction just means the storefront
   keeps using the layers, which is where it has been all along.

   Every anchor must occur exactly once. CONTROL is a genuine no-op and must
   SURVIVE; if it dies the harness is failing everything. */
const fs = require('fs');
const suite = require('./authority.test');

const src = fs.readFileSync(suite.FEED, 'utf8');

const MUTANTS = [
  { name: 'CONTROL — a comment, changing nothing',
    from: 'function recordAuthority(metaRows) {',
    to:   'function recordAuthority(metaRows) { /* control mutant */',
    expect: 'survive' },

  // --- granting authority it must not grant
  { name: 'ignore a failed mirror and serve the frozen record anyway',
    from: '  if (m.record_resync_error)',
    to:   '  if (false)' },

  { name: 'treat a missing meta row as permission',
    from: '  if (!m) return { authoritative: false, note: "no manufacturer_meta row for this line" };',
    to:   '  if (!m) return { authoritative: true, note: null };' },

  { name: 'accept any truthy flag, not just true',
    from: '  if (m.record_authoritative !== true)',
    to:   '  if (!m.record_authoritative)' },

  { name: 'grant authority to every migrated line',
    from: '  if (m.record_authoritative !== true)\n    return { authoritative: false, note: "this line still prices from the legacy layers" };',
    to:   '  ;' },

  { name: 'read the flag off the array instead of the row',
    from: '  const m = Array.isArray(metaRows) && metaRows[0] ? metaRows[0] : null;',
    to:   '  const m = metaRows || null;' },

  // --- refusing authority it should grant
  { name: 'never grant authority at all',
    from: '  return { authoritative: true, note: null };',
    to:   '  return { authoritative: false, note: "never" };' },

  { name: 'treat a cleared error column as a failure',
    from: '  if (m.record_resync_error)',
    to:   '  if (m.record_resync_error != null)' },

  // --- the explanation a person reads
  { name: 'drop the underlying error from the note',
    from: '             note: "the record is behind the layers: " + String(m.record_resync_error) };',
    to:   '             note: "the record is behind the layers" };' },

  { name: 'report a broken mirror as merely "not switched on"',
    from: '  if (m.record_resync_error)\n    return { authoritative: false,\n             note: "the record is behind the layers: " + String(m.record_resync_error) };',
    to:   '  if (m.record_resync_error)\n    return { authoritative: false, note: "this line still prices from the legacy layers" };' },

  { name: 'return a note alongside a grant, so the shop reports a reason it does not have',
    from: '  return { authoritative: true, note: null };',
    to:   '  return { authoritative: true, note: "ok" };' },
];

let bad = 0;
console.log('mutant                                                          anchors  result');
console.log('-'.repeat(84));

for(const m of MUTANTS){
  const hits = src.split(m.from).length - 1;
  if(hits !== 1){
    console.log(m.name.padEnd(62) + String(hits).padStart(6) + '   ANCHOR NOT UNIQUE — mutant is meaningless');
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
  console.log(m.name.padEnd(62) + String(hits).padStart(6) + '   ' + verdict);
}

console.log('-'.repeat(84));
console.log(bad === 0
  ? 'All mutants behaved as required (control survived, every real mutant killed).'
  : bad + ' mutant(s) did not behave as required.');
process.exit(bad ? 1 : 0);
