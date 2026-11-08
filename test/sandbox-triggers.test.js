'use strict';
/* Admin 360 B0 (2026-11-08): the Catalog Review Sandbox workflow skips events that can never change the sandbox
   (pending statuses; statuses / check suites on catalog-review itself or on main) so a private repo does not burn
   metered Actions minutes — while every event that can add, update or remove a PR still runs. */
const fs = require('fs'), path = require('path');
const Y = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'catalog-review-sandbox.yml'), 'utf8');
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const must = (re, why) => { if (!re.test(Y)) throw new Error(why); };
t('every trigger is still declared (push, pull_request_target, check_suite, status, workflow_dispatch)', () => {
  for (const k of ['push:', 'pull_request_target:', 'check_suite:', 'status:', 'workflow_dispatch:']) if (!Y.includes('\n  ' + k)) throw new Error('missing ' + k);
});
t('pending statuses are skipped', () => must(/github\.event\.state != 'pending'/, 'pending filter missing'));
t("statuses on the sandbox's own branch and on main are skipped", () => {
  must(/!contains\(github\.event\.branches\.\*\.name, 'catalog-review'\)/, 'catalog-review status filter missing');
  must(/!contains\(github\.event\.branches\.\*\.name, 'main'\)/, 'main status filter missing');
});
t('check suites on catalog-review and main are skipped', () => {
  must(/check_suite\.head_branch != 'catalog-review'/, 'check_suite sandbox filter missing');
  must(/check_suite\.head_branch != 'main'/, 'check_suite main filter missing');
});
t('the fork / sandbox-PR guard on pull_request_target is unchanged', () => {
  must(/github\.event\.pull_request\.head\.ref != 'catalog-review'/, 'sandbox PR guard missing');
  must(/github\.event\.pull_request\.head\.repo\.full_name == github\.repository/, 'fork guard missing');
});
t('push and workflow_dispatch are never filtered by the job condition', () => {
  const cond = Y.split('    if: >-')[1].split('    runs-on:')[0];
  if (/event_name == 'push'|event_name != 'push'|workflow_dispatch/.test(cond)) throw new Error('push/dispatch referenced in the job condition');
});
console.log(`\nsandbox-triggers: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
