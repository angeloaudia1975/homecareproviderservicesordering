'use strict';
/* Mutation harness for scripts/catalog-review-sync.sh: each mutant weakens one eligibility rule; the test must fail. */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'scripts', 'catalog-review-sync.sh');
const orig = fs.readFileSync(F, 'utf8');
const M = [
  ['missing required status counts as success', '      else "missing" end', '      else "success" end'],
  ['empty required list counts as success', 'elif ($need | length) == 0 then "missing"', 'elif ($need | length) == 0 then "success"'],
  ['pending status ignored', 'elif any($latest[]; .state == "pending")', 'elif false and any($latest[]; .state == "pending")'],
  ['failed check run ignored', 'any($runs[]; .status == "completed" and', 'any($runs[]; false and'],
  ['oldest status per context used', 'map(sort_by(.created_at, .id) | last)', 'map(first)'],
  ['sandbox sync job not excluded', '| not))) as $runs', '| not) or true)) as $runs'],
  ['any app named sync excluded', '((.app.slug // "") == "github-actions")', 'true'],
  ['skipped build counts as evidence', '((.description // "") | test("skip|cancel|ignor"; "i") | not)', 'true'],
  ['combined JSON not validated', '! jq empty "$f" >/dev/null 2>&1 && badjson="$f"', 'false && badjson="$f"'],
  ['PR list limit ignored', '[ "$(jq \'length\' <<<"$raw_prs")" -lt 100 ] ||', 'true ||'],
  ['failed new commit keeps old version', 'if [ "$ck" = pending ] || [ "$ck" = unknown ]; then', 'if true; then'],
  ['pending new commit drops the PR', 'if [ -n "$ph" ] && [ "$ph" != "$sha" ] && git cat-file', 'if false && git cat-file'],
  ['kept head not re-checked', '&& [ "$(checks_of "$ph")" = success ]; then', '; then'],
  ['already-in-main not detected', 'if git merge-base --is-ancestor "$sha" HEAD 2>/dev/null; then skip', 'if false; then skip'],
  ['drafts admitted', 'if [ "$(jq -r .draft <<<"$row")" = true ] &&', 'if false &&'],
  ['exclude label ignored', 'if [ "$(jq -r .excluded <<<"$row")" = true ]; then', 'if false; then'],
];
let killed = 0;
try {
  for (const [name, a, b] of M) {
    if (!orig.includes(a)) { console.log('NOT FOUND ' + name); continue; }
    fs.writeFileSync(F, orig.replace(a, b));
    let survived = true;
    try { execFileSync('node', [path.join(__dirname, 'catalog-review-sync.test.js')], { stdio: 'ignore' }); } catch (e) { survived = false; }
    console.log((survived ? 'SURVIVED ' : 'killed   ') + name); if (!survived) killed++;
  }
} finally { fs.writeFileSync(F, orig); }
console.log(`\ncatalog-review-sync mutants: ${killed}/${M.length} killed`);
process.exit(killed === M.length ? 0 : 1);
