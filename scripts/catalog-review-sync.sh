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
api(){ curl -fsSL -H "Accept: application/vnd.github+json" ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "https://api.github.com/repos/$REPO/$1"; }
git config user.name  >/dev/null 2>&1 || git config user.name  "catalog-review-sandbox"
git config user.email >/dev/null 2>&1 || git config user.email "catalog-review-sandbox@users.noreply.github.com"

prs=$(api "pulls?state=open&base=main&per_page=100" | jq -c --arg repo "$REPO" --arg br "$BRANCH" --arg lb "$LABEL" --arg rl "$READY_LABEL" \
  '[.[] | select(.head.repo.full_name==$repo and .head.ref!=$br) | {n:.number, ref:.head.ref, sha:.head.sha, title:.title, draft:.draft, excluded:([.labels[].name]|index($lb)!=null), ready_label:([.labels[].name]|index($rl)!=null)}] | sort_by(.n)')

git fetch -q origin main
git fetch -q origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null || true
git checkout -q --detach origin/main
main_sha=$(git rev-parse HEAD)
# Which manufacturers a change touches (catalog, content, overrides, sources, product photos), by its files.
mfr_of(){ git diff --name-only "$main_sha...$1" | sed -nE 's#^(public/data/content|public/data|content-overrides|content-sources)/([a-z0-9-]+)\.json$#\2#p; s#^public/assets/products/([a-z0-9-]+)/.*#\1#p' | grep -vx manufacturers | sort -u | jq -R . | jq -sc .; }
other_of(){ git diff --name-only "$main_sha...$1" | grep -vE '^(public/data/|content-overrides/|content-sources/|public/assets/products/)' | jq -R . | jq -sc 'length'; }
# Checks on a PR head: "pass" when every commit status and check run finished green (the sandbox's own `sync` job aside).
checks_of(){ local st cr
  st=$(api "commits/$1/status" | jq -r '.state + " " + (.statuses|length|tostring)')
  cr=$(api "commits/$1/check-runs?per_page=100" | jq -r '[.check_runs[]|select(.name!="sync")] | if any(.status!="completed") then "pending" elif any(.conclusion as $c | ["success","neutral","skipped"]|index($c)|not) then "failure" else "success" end')
  case "$st" in "failure "*|"error "*) echo failure; return;; "pending 0") ;; "pending "*) echo pending; return;; esac
  echo "$cr"; }
included='[]'; skipped='[]'
while IFS= read -r row; do
  n=$(jq -r .n <<<"$row"); sha=$(jq -r .sha <<<"$row")
  skip(){ skipped=$(jq -c --argjson r "$row" --arg why "$1" '.+[$r+{reason:$why}]' <<<"$skipped"); }
  if [ "$(jq -r .excluded <<<"$row")" = true ]; then skip "labelled $LABEL"; continue; fi
  if [ "$(jq -r .draft <<<"$row")" = true ] && [ "$(jq -r .ready_label <<<"$row")" != true ]; then skip "draft (work in progress) — label it $READY_LABEL when it is ready for owner review"; continue; fi
  ck=$(checks_of "$sha")
  if [ "$ck" != success ]; then skip "checks $ck on its latest commit — added automatically once they pass"; continue; fi
  git fetch -q origin "$sha" 2>/dev/null || git fetch -q origin "+refs/pull/$n/head:refs/remotes/pr/$n"
  if git merge -q --no-ff --no-edit -m "sandbox: merge #$n" "$sha" >/dev/null 2>&1; then
    included=$(jq -c --argjson r "$row" --argjson m "$(mfr_of "$sha")" --argjson o "$(other_of "$sha")" '.+[$r+{manufacturers:$m, other_files:$o}]' <<<"$included")
  else
    git merge --abort 2>/dev/null || git reset -q --hard
    skip "does not merge cleanly with main and the PRs before it — update that PR to see it here"
  fi
done < <(jq -c '.[]' <<<"$prs")

# What this sandbox contains — served at /catalog-review.json on the sandbox only (never on main).
# review_id names exactly what is in this build (main + each PR's head): record it when approving a release.
jq -n --arg main "$main_sha" --argjson inc "$included" --argjson sk "$skipped" --arg at "$(date -u +%FT%TZ)" \
  '{sandbox:"HCPS catalog review sandbox — private preview, not production", built_at:$at, main:$main,
    included:[$inc[]|{pr:.n,title,branch:.ref,head:.sha,manufacturers,other_files}], skipped:[$sk[]|{pr:.n,title,branch:.ref,reason}]}' > public/catalog-review.json
rid=$( { echo "$main_sha"; jq -r '.included[]|"\(.pr) \(.head)"' public/catalog-review.json; } | sha256sum | cut -c1-12)
jq --arg rid "$rid" '{review_id:$rid}+.' public/catalog-review.json > public/catalog-review.json.tmp && mv public/catalog-review.json.tmp public/catalog-review.json
git add public/catalog-review.json
git commit -q -m "sandbox: manifest" >/dev/null 2>&1 || true
tree=$(git rev-parse 'HEAD^{tree}')

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
