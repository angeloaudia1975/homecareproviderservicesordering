#!/usr/bin/env bash
# Rebuild the CATALOG REVIEW SANDBOX branch: main + every open pull request into main from this repository that is
# READY FOR OWNER REVIEW, merged in PR-number order. Ready = its checks all passed on its current head AND it is either
# not a draft or labelled `owner-review` (a draft without that label is work in progress and is left out).
# A PR that does not merge cleanly is skipped (never force-resolved) and listed.
# The result is pushed to the branch `catalog-review` as a NEW commit (fast-forward, never a force push).
# That branch has one permanent DRAFT pull request ("Catalog Review Sandbox — DO NOT MERGE"); Netlify builds
# its deploy preview at one stable address, which the shop treats as a private catalog preview (STAGING):
# staff open it through Connect 360 → Catalog Preview with the TEST dealer; orders there are never recorded.
# Nothing here touches main, any PR branch, production, the database or Netlify settings.
#   Needs: git, curl, jq; GH_TOKEN (or GITHUB_TOKEN) able to read PRs and push the catalog-review branch.
#   Optional: SANDBOX_DRY_RUN=1 builds the commit and prints it without pushing.
#   Optional: SANDBOX_EXCLUDE_LABEL (default "sandbox-exclude") — a PR with this label is left out.
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-angeloaudia1975/homecareproviderservicesordering}"
BRANCH="catalog-review"
LABEL="${SANDBOX_EXCLUDE_LABEL:-sandbox-exclude}"
READY_LABEL="${SANDBOX_READY_LABEL:-owner-review}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
# Commit statuses that MUST be present and successful before a PR may enter the sandbox (positive evidence: a PR with no
# validation results at all is never treated as passing). Netlify's deploy preview builds the PR — that build is the check.
REQUIRED="${SANDBOX_REQUIRED_STATUSES:-netlify/hcpsonlineordering/deploy-preview}"
api(){
  # Tests point SANDBOX_API_STUB at a folder of canned GitHub answers (path with / ? = & replaced by _).
  if [ -n "${SANDBOX_API_STUB:-}" ]; then cat "$SANDBOX_API_STUB/$(printf '%s' "$1" | tr '/?=&' '____').json"; return; fi
  curl -fsSL -H "Accept: application/vnd.github+json" ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "https://api.github.com/repos/$REPO/$1"; }
git config user.name  >/dev/null 2>&1 || git config user.name  "catalog-review-sandbox"
git config user.email >/dev/null 2>&1 || git config user.email "catalog-review-sandbox@users.noreply.github.com"

raw_prs=$(api "pulls?state=open&base=main&per_page=100")
# Never silently drop PRs past the first page.
[ "$(jq 'length' <<<"$raw_prs")" -lt 100 ] || { echo "100 or more open PRs — the sandbox needs pagination before it can run" >&2; exit 1; }
prs=$(jq -c --arg repo "$REPO" --arg br "$BRANCH" --arg lb "$LABEL" --arg rl "$READY_LABEL" \
  '[.[] | select(.head.repo.full_name==$repo and .head.ref!=$br) | {n:.number, ref:.head.ref, sha:.head.sha, title:.title, draft:.draft, excluded:([.labels[].name]|index($lb)!=null), ready_label:([.labels[].name]|index($rl)!=null)}] | sort_by(.n)' <<<"$raw_prs")

git fetch -q origin main
git fetch -q origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null || true
git checkout -q --detach origin/main
main_sha=$(git rev-parse HEAD)
# The previous build's manifest: a PR it included whose NEW head is still being checked keeps its last validated head
# (marked), instead of dropping out and coming back — that would cost two Netlify builds per push.
prev_manifest=$(git show "origin/$BRANCH:public/catalog-review.json" 2>/dev/null || echo '{}')
prev_head_of(){ jq -r --argjson n "$1" '(.included // [])[] | select(.pr == $n) | .head' <<<"$prev_manifest" | head -1; }
# Which manufacturers a change touches (catalog, content, overrides, sources, product photos), by its files.
mfr_of(){ git diff --name-only "$main_sha...$1" | sed -nE 's#^(public/data/content|public/data|content-overrides|content-sources)/([a-z0-9-]+)\.json$#\2#p; s#^public/assets/products/([a-z0-9-]+)/.*#\1#p' | grep -vx manufacturers | sort -u | jq -R . | jq -sc .; }
other_of(){ git diff --name-only "$main_sha...$1" | grep -vE '^(public/data/|content-overrides/|content-sources/|public/assets/products/)' | jq -R . | jq -sc 'length'; }
# Checks on a PR head. "success" ONLY with positive evidence: every required status present and successful (latest per
# context, and not a skipped/cancelled build), no other status failing or pending, and every check run finished green
# (this sandbox's own GitHub Actions job aside).
# Missing required evidence = "missing" (not ready). Any failure = "failure". Anything unfinished = "pending".
checks_of(){ local sj cj
  sj=$(api "commits/$1/statuses?per_page=100") || { echo unknown; return; }
  cj=$(api "commits/$1/check-runs?per_page=100") || { echo unknown; return; }
  jq -rn --argjson s "$sj" --argjson c "$cj" --arg req "$REQUIRED" '
    ($s | group_by(.context) | map(sort_by(.created_at, .id) | last)) as $latest
    | ($c.check_runs | map(select(((.name == "sync" or .name == "catalog-review-sandbox-sync") and ((.app.slug // "") == "github-actions")) | not))) as $runs
    | ($req | split(",") | map(select(length > 0))) as $need
    | if any($latest[]; .state == "failure" or .state == "error")
         or any($runs[]; .status == "completed" and ((.conclusion // "") as $x | ["success","neutral","skipped"] | index($x) | not)) then "failure"
      elif any($latest[]; .state == "pending") or any($runs[]; .status != "completed") then "pending"
      elif ($need | length) == 0 then "missing"
      elif all($need[]; . as $n | any($latest[]; .context == $n and .state == "success" and ((.description // "") | test("skip|cancel|ignor"; "i") | not))) then "success"
      else "missing" end'; }
included='[]'; skipped='[]'
while IFS= read -r row; do
  n=$(jq -r .n <<<"$row"); sha=$(jq -r .sha <<<"$row")
  skip(){ skipped=$(jq -c --argjson r "$row" --arg why "$1" '.+[$r+{reason:$why}]' <<<"$skipped"); }
  if [ "$(jq -r .excluded <<<"$row")" = true ]; then skip "labelled $LABEL"; continue; fi
  if [ "$(jq -r .draft <<<"$row")" = true ] && [ "$(jq -r .ready_label <<<"$row")" != true ]; then skip "draft (work in progress) — label it $READY_LABEL when it is ready for owner review"; continue; fi
  ck=$(checks_of "$sha"); note=""
  if [ "$ck" = pending ] || [ "$ck" = unknown ]; then
    ph=$(prev_head_of "$n")
    # only a kept head that is still in the PR's history and whose own checks are still green
    if [ -n "$ph" ] && [ "$ph" != "$sha" ] && git cat-file -e "$ph^{commit}" 2>/dev/null \
       && { git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch -q origin "$sha" 2>/dev/null || git fetch -q origin "+refs/pull/$n/head:refs/remotes/pr/$n" 2>/dev/null; } \
       && git merge-base --is-ancestor "$ph" "$sha" 2>/dev/null && [ "$(checks_of "$ph")" = success ]; then
      sha="$ph"; ck=success; note="newer commit $(jq -r .sha <<<"$row" | cut -c1-7) still being checked — showing the last validated version"; fi
  fi
  case "$ck" in
    success) ;;
    missing) skip "no successful required check yet ($REQUIRED) on its latest commit — added automatically once it passes"; continue;;
    *) skip "checks $ck on its latest commit — added automatically once they pass"; continue;;
  esac
  if ! { git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch -q origin "$sha" 2>/dev/null || git fetch -q origin "+refs/pull/$n/head:refs/remotes/pr/$n" 2>/dev/null; } \
     || ! git cat-file -e "$sha^{commit}" 2>/dev/null; then skip "its commit could not be fetched — retried on the next run"; continue; fi
  if git merge-base --is-ancestor "$sha" HEAD 2>/dev/null; then skip "already contained in main (or in a PR before it) — nothing to add"; continue; fi
  pre=$(git rev-parse HEAD)
  if git merge -q --no-ff --no-edit -m "sandbox: merge #$n" "$sha" >/dev/null 2>&1; then
    # The COMBINED result must still be valid: every JSON file this merge touched must parse.
    badjson=""
    while IFS= read -r -d '' f; do case "$f" in *.json) [ -f "$f" ] && ! jq empty "$f" >/dev/null 2>&1 && badjson="$f";; esac; done < <(git diff -z --name-only "$pre" HEAD)
    if [ -n "$badjson" ]; then git reset -q --hard "$pre"; skip "combined with the PRs before it, $badjson is not valid JSON — needs a person"; continue; fi
    included=$(jq -c --argjson r "$row" --arg sha "$sha" --arg note "$note" --argjson m "$(mfr_of "$sha")" --argjson o "$(other_of "$sha")" \
      '.+[$r+{sha:$sha, note:$note, manufacturers:$m, other_files:$o}]' <<<"$included")
  else
    git merge --abort 2>/dev/null || git reset -q --hard
    skip "does not merge cleanly with main and the PRs before it — update that PR to see it here"
  fi
done < <(jq -c '.[]' <<<"$prs")

# What this sandbox contains — served at /catalog-review.json on the sandbox only (never on main).
# review_id names exactly what is in this build (main + each PR's head): record it when approving a release.
jq -n --arg main "$main_sha" --argjson inc "$included" --argjson sk "$skipped" --arg at "$(date -u +%FT%TZ)" \
  '{sandbox:"HCPS catalog review sandbox — private preview, not production", built_at:$at, main:$main,
    included:[$inc[]|{pr:.n,title,branch:.ref,head:.sha,manufacturers,other_files} + (if .note != "" then {note} else {} end)], skipped:[$sk[]|{pr:.n,title,branch:.ref,reason}]}' > public/catalog-review.json
rid=$( { echo "$main_sha"; jq -r '.included[]|"\(.pr) \(.head)"' public/catalog-review.json; } | sha256sum | cut -c1-12)
jq --arg rid "$rid" '{review_id:$rid}+.' public/catalog-review.json > public/catalog-review.json.tmp && mv public/catalog-review.json.tmp public/catalog-review.json
git add public/catalog-review.json
tree=$(git write-tree)

prev=$(git rev-parse -q --verify "origin/$BRANCH" || true)
if [ -n "$prev" ]; then
  same_tree=$( [ "$(git rev-parse "$prev^{tree}")" = "$tree" ] && echo y || echo n )
  # Rebuild only when the content changed (the manifest's timestamp aside) — every push costs a Netlify build.
  if [ "$same_tree" = y ] || git diff --quiet "$prev" "$tree" -- . ':(exclude)public/catalog-review.json'; then
    if jq -e --slurpfile o <(git show "$prev:public/catalog-review.json" 2>/dev/null || echo '{}') \
         '. as $n | ($o[0].included // []) == $n.included and ($o[0].skipped // []) == $n.skipped' public/catalog-review.json >/dev/null; then
      echo "catalog-review: unchanged — nothing pushed"; exit 0; fi
  fi
  parents=(-p "$prev" -p "$main_sha")
else
  parents=(-p "$main_sha")
fi
msg="Catalog review sandbox $rid: main@${main_sha:0:7}$(jq -r '[.included[]|" + #\(.pr)@\(.head[0:7])"]|join("")' public/catalog-review.json)"
commit=$(git commit-tree "$tree" "${parents[@]}" -m "$msg")
if [ -n "${SANDBOX_DRY_RUN:-}" ]; then echo "DRY RUN — would push $commit"; echo "$msg"; exit 0; fi
git push -q origin "$commit:refs/heads/$BRANCH"
echo "$msg"
jq -r '.skipped[]|"skipped #\(.pr) (\(.title)): \(.reason)"' public/catalog-review.json
