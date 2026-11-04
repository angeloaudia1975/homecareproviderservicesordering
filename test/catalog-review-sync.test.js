'use strict';
/* Catalog Review Sandbox — eligibility (owner, 2026-11-03): runs scripts/catalog-review-sync.sh for real against a local
   origin repository and canned GitHub answers (SANDBOX_API_STUB), in dry-run mode, and checks which PRs enter the sandbox.
   A PR enters ONLY with positive evidence: the required Netlify status present and successful on its head, nothing failing
   or unfinished, and it is ready (non-draft or labelled owner-review), not excluded, and merges cleanly. */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'catalog-review-sync.sh');
const REPO = 'acme/shop';
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); } };
const sh = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

function world(prs, extraEnv = {}, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-'));
  const origin = path.join(root, 'origin.git'), seed = path.join(root, 'seed'), work = path.join(root, 'work'), stub = path.join(root, 'stub');
  fs.mkdirSync(stub);
  sh(root, 'init', '-q', '--bare', '-b', 'main', origin);
  sh(root, 'init', '-q', '-b', 'main', seed);
  fs.mkdirSync(path.join(seed, 'public/data'), { recursive: true });
  fs.writeFileSync(path.join(seed, 'public/data/acme.json'), '{"v":1}\n');
  fs.writeFileSync(path.join(seed, 'README'), 'base\n');
  sh(seed, 'add', '-A'); sh(seed, 'commit', '-qm', 'base'); sh(seed, 'remote', 'add', 'origin', origin); sh(seed, 'push', '-q', 'origin', 'main');
  const list = [];
  for (const p of prs) {
    sh(seed, 'checkout', '-q', '-B', p.ref, 'main');
    const f = p.file || ('public/data/m' + p.n + '.json');
    fs.mkdirSync(path.join(seed, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(seed, f), p.content || ('{"pr":' + p.n + '}\n'));
    sh(seed, 'add', '-A'); sh(seed, 'commit', '-qm', 'pr ' + p.n);
    if (p.second) { p.oldSha = sh(seed, 'rev-parse', 'HEAD');
      fs.writeFileSync(path.join(stub, (`commits/${p.oldSha}/statuses?per_page=100`).replace(/[/?=&]/g, '_') + '.json'), JSON.stringify(p.oldStatuses || [ok()]));
      fs.writeFileSync(path.join(stub, (`commits/${p.oldSha}/check-runs?per_page=100`).replace(/[/?=&]/g, '_') + '.json'), JSON.stringify({ check_runs: [] })); fs.writeFileSync(path.join(seed, f), p.second); sh(seed, 'add', '-A'); sh(seed, 'commit', '-qm', 'pr ' + p.n + ' update'); }
    const sha = sh(seed, 'rev-parse', 'HEAD');
    sh(seed, 'push', '-q', 'origin', p.ref, `HEAD:refs/pull/${p.n}/head`);
    list.push({ number: p.n, title: 'PR ' + p.n, draft: !!p.draft, labels: (p.labels || []).map(name => ({ name })),
      head: { ref: p.ref, sha, repo: { full_name: p.fork ? 'someone/fork' : REPO } } });
    const key = s => s.replace(/[/?=&]/g, '_');
    if (p.statuses !== null) fs.writeFileSync(path.join(stub, key(`commits/${sha}/statuses?per_page=100`) + '.json'), JSON.stringify(p.statuses || []));
    if (p.runs !== null) fs.writeFileSync(path.join(stub, key(`commits/${sha}/check-runs?per_page=100`) + '.json'), JSON.stringify({ check_runs: p.runs || [] }));
  }
  // a change on main that PR conflicts are measured against
  sh(seed, 'checkout', '-q', 'main');
  for (const p of prs.filter(x => x.inMain)) sh(seed, 'merge', '-q', '--no-edit', p.ref);
  fs.writeFileSync(path.join(seed, 'public/data/acme.json'), '{"v":2}\n');
  sh(seed, 'commit', '-qam', 'main moves'); sh(seed, 'push', '-q', 'origin', 'main');
  fs.writeFileSync(path.join(stub, 'pulls_state_open_base_main_per_page_100.json'), JSON.stringify(opts.prList ? opts.prList(list) : list));
  if (opts.prevSandbox) {   // a previous sandbox build that included these PRs at their OLD heads
    sh(seed, 'checkout', '-q', '-B', 'catalog-review', 'main');
    const inc = [];
    for (const p of prs.filter(x => x.oldSha)) { sh(seed, 'merge', '-q', '--no-edit', p.oldSha); inc.push({ pr: p.n, head: p.oldSha }); }
    fs.writeFileSync(path.join(seed, 'public/catalog-review.json'), JSON.stringify({ included: inc, skipped: [] }));
    sh(seed, 'add', '-A'); sh(seed, 'commit', '-qm', 'old sandbox'); sh(seed, 'push', '-q', 'origin', 'catalog-review');
    sh(seed, 'checkout', '-q', 'main');
  }
  sh(root, 'clone', '-q', origin, work);
  let out = '', err = null;
  try {
    out = execFileSync('bash', [SCRIPT], { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GITHUB_REPOSITORY: REPO, SANDBOX_API_STUB: stub, SANDBOX_DRY_RUN: '1', GH_TOKEN: '', GITHUB_TOKEN: '',
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...extraEnv } });
  } catch (e) { err = e; out = (e.stdout || '') + (e.stderr || ''); }
  const mf = path.join(work, 'public/catalog-review.json');
  const manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : null;
  const originMain = sh(origin, 'rev-parse', 'main');
  const branches = sh(origin, 'branch', '--list');
  return { manifest, out, err, originMain, branches, root };
}
const NET = 'netlify/hcpsonlineordering/deploy-preview';
const ok = (ctx = NET, id = 1, at = '2026-11-03T10:00:00Z') => ({ context: ctx, state: 'success', id, created_at: at });
const st = (state, ctx = NET, id = 1, at = '2026-11-03T10:00:00Z') => ({ context: ctx, state, id, created_at: at });
const run = (name, conclusion, status = 'completed') => ({ name, status, conclusion });

const W = world([
  { n: 1, ref: 'green', statuses: [ok()], runs: [run('Redirect rules', 'success'), run('Pages changed', 'neutral')] },
  { n: 2, ref: 'no-results', statuses: [], runs: [] },
  { n: 3, ref: 'runs-only', statuses: [], runs: [run('Redirect rules', 'success')] },
  { n: 4, ref: 'other-status-only', statuses: [ok('some/other-ci')], runs: [] },
  { n: 5, ref: 'draft', draft: true, statuses: [ok()], runs: [] },
  { n: 6, ref: 'draft-ready', draft: true, labels: ['owner-review'], statuses: [ok()], runs: [], file: 'content-overrides/dalton.json' },
  { n: 7, ref: 'status-failed', statuses: [st('failure')], runs: [] },
  { n: 8, ref: 'status-pending', statuses: [st('pending')], runs: [] },
  { n: 9, ref: 'run-failed', statuses: [ok()], runs: [run('Header rules', 'failure')] },
  { n: 10, ref: 'run-pending', statuses: [ok()], runs: [run('Header rules', null, 'in_progress')] },
  { n: 11, ref: 'retried-green', statuses: [st('failure', NET, 1, '2026-11-03T09:00:00Z'), ok(NET, 2, '2026-11-03T10:00:00Z')], runs: [] },
  { n: 12, ref: 'went-red', statuses: [ok(NET, 1, '2026-11-03T09:00:00Z'), st('failure', NET, 2, '2026-11-03T10:00:00Z')], runs: [] },
  { n: 13, ref: 'excluded', labels: ['sandbox-exclude'], statuses: [ok()], runs: [] },
  { n: 14, ref: 'fork', fork: true, statuses: [ok()], runs: [] },
  { n: 15, ref: 'conflict', file: 'public/data/acme.json', content: '{"v":"pr"}\n', statuses: [ok()], runs: [] },
  { n: 16, ref: 'own-sync-red', statuses: [ok()], runs: [{ ...run('catalog-review-sandbox-sync', 'failure'), app: { slug: 'github-actions' } }] },
  { n: 17, ref: 'api-unreadable', statuses: null, runs: null },
  { n: 18, ref: 'other-status-failed', statuses: [ok(), st('error', 'some/other-ci', 3)], runs: [] },
  { n: 19, ref: 'foreign-sync-red', statuses: [ok()], runs: [{ ...run('sync', 'failure'), app: { slug: 'some-other-app' } }] },
  { n: 20, ref: 'skipped-build', statuses: [{ ...ok(), description: 'Deploy Preview skipped' }], runs: [] },
  { n: 23, ref: 'in-main', inMain: true, statuses: [ok()], runs: [] },
  { n: 21, ref: 'bad-json', file: 'content-overrides/acme.json', content: '{"a":1,\n"b":2\n', statuses: [ok()], runs: [] },
]);
const inc = () => (W.manifest.included || []).map(p => p.pr);
const why = n => ((W.manifest.skipped || []).find(p => p.pr === n) || {}).reason || '(not listed)';

t('script ran to the end (dry run)', () => { if (W.err || !W.manifest) throw new Error(W.out.slice(-800)); if (!/DRY RUN/.test(W.out)) throw new Error(W.out); });
t('exactly the eligible PRs are included: #1, #6, #11, #16 (and not #19–#21)', () => { const g = inc().join(','); if (g !== '1,6,11,16') throw new Error('included ' + g); });
t('no validation results at all → not included (missing evidence)', () => { if (!/no successful required check/.test(why(2))) throw new Error(why(2)); });
t('green check runs but no Netlify status → not included', () => { if (!/no successful required check/.test(why(3))) throw new Error(why(3)); });
t('only an unrelated status → not included', () => { if (!/no successful required check/.test(why(4))) throw new Error(why(4)); });
t('draft without owner-review → not included', () => { if (!/draft/.test(why(5))) throw new Error(why(5)); });
t('failed / pending status or check run → not included', () => {
  for (const [n, w] of [[7, 'failure'], [8, 'pending'], [9, 'failure'], [10, 'pending'], [12, 'failure'], [18, 'failure']]) if (!why(n).includes('checks ' + w)) throw new Error('#' + n + ': ' + why(n));
});
t('a check that failed and then passed counts by its latest result', () => { if (!inc().includes(11)) throw new Error(why(11)); });
t('sandbox-exclude label and fork PRs are left out', () => { if (!/labelled sandbox-exclude/.test(why(13))) throw new Error(why(13)); if (inc().includes(14) || W.manifest.skipped.some(p => p.pr === 14)) throw new Error('fork listed'); });
t('a conflicting PR is skipped, never force-resolved', () => { if (!/does not merge cleanly/.test(why(15))) throw new Error(why(15)); });
t('a check run named like ours but from another app still counts (and is red)', () => { if (!why(19).includes('checks failure')) throw new Error(why(19)); });
t('a skipped Netlify build is not evidence', () => { if (!/no successful required check/.test(why(20))) throw new Error(why(20)); });
t('a merged result with invalid JSON is rolled back and left out', () => { if (!/not valid JSON/.test(why(21))) throw new Error(why(21)); });
t('a PR already contained in main adds nothing and blames nothing', () => { if (!/already contained/.test(why(23))) throw new Error(why(23)); });
t('unreadable check answers → not included', () => { if (!/checks unknown/.test(why(17))) throw new Error(why(17)); });
t('manifest names the manufacturer a PR touches and a review id', () => {
  const p6 = W.manifest.included.find(p => p.pr === 6); if (!p6 || p6.manufacturers.join() !== 'dalton') throw new Error(JSON.stringify(p6));
  if (!/^[0-9a-f]{12}$/.test(W.manifest.review_id || '')) throw new Error('review_id ' + W.manifest.review_id);
});
t('dry run pushes nothing: origin has no catalog-review branch, main unchanged by the script', () => {
  if (/catalog-review/.test(W.branches)) throw new Error(W.branches);
});
fs.rmSync(W.root, { recursive: true, force: true });
t('a PR whose new commit is still being checked keeps its last validated version (no drop-out)', () => {
  const E = world([
    { n: 1, ref: 'updating', statuses: [st('pending')], runs: [], second: '{"pr":1,"v":2}\n' },
    { n: 2, ref: 'new-and-pending', statuses: [st('pending')], runs: [] },
    { n: 3, ref: 'updated-and-failed', statuses: [st('failure')], runs: [], second: '{"pr":3,"v":2}\n' },
    { n: 4, ref: 'kept-head-went-red', statuses: [st('pending')], runs: [], second: '{"pr":4,"v":2}\n', oldStatuses: [st('failure')] },
  ], {}, { prevSandbox: true });
  try {
    const p1 = (E.manifest && E.manifest.included || []).find(p => p.pr === 1);
    const old = E.manifest && null;
    if (!p1 || !/still being checked/.test(p1.note || '')) throw new Error(JSON.stringify(E.manifest) + E.out.slice(-400));
    if ((E.manifest.included || []).some(p => p.pr === 2)) throw new Error('a never-validated pending PR was included');
    if ((E.manifest.included || []).some(p => p.pr === 3)) throw new Error('a PR whose new commit FAILED kept its old version');
    if ((E.manifest.included || []).some(p => p.pr === 4)) throw new Error('a kept head whose own checks turned red was still shown');
  } finally { fs.rmSync(E.root, { recursive: true, force: true }); }
});
t('100 or more open PRs stops the run instead of dropping some', () => {
  const E = world([{ n: 1, ref: 'green', statuses: [ok()], runs: [] }], {}, { prList: l => Array.from({ length: 100 }, (_, i) => ({ ...l[0], number: 1000 + i })) });
  try { if (!E.err || !/pagination/.test(E.out)) throw new Error('ran: ' + E.out.slice(-300)); }
  finally { fs.rmSync(E.root, { recursive: true, force: true }); }
});
t('a misconfigured (empty) required-check list admits nothing', () => {
  const E = world([{ n: 1, ref: 'green', statuses: [ok()], runs: [] }], { SANDBOX_REQUIRED_STATUSES: ',' });
  try { if (!E.manifest || E.manifest.included.length) throw new Error(JSON.stringify(E.manifest && E.manifest.included)); }
  finally { fs.rmSync(E.root, { recursive: true, force: true }); }
});
console.log(`\ncatalog-review-sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
