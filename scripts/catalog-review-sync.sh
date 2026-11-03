#!/usr/bin/env bash
# Rebuild the CATALOG REVIEW SANDBOX branch: main + every open pull request into main from this repository,
# merged in PR-number order. A PR that does not merge cleanly is skipped (never force-resolved) and listed.
# The result is pushed to the branch `catalog-review` as a NEW commit (fast-forward, never a force push).
# That branch has one permanent DRAFT pull request ("Catalog Review Sandbox — DO NOT MERGE"); Netlify builds
# its deploy preview at one stable address, which the shop treats as a private catalog preview (STAGING):
# staff open it through Connect 360 → Catalog Preview with the TEST dealer; orders there are never recorded.
# Nothing here touches main, any PR branch, production, the database or Netlify settings.
#   Needs: git, curl, jq; GH_TOKEN (or GITHUB_TOKEN) able to read PRs and push the catalog-review branch.
#   Optional: SANDBOX_EXCLUDE_LABEL (default "sandbox-exclude") — a PR with this label is left out.
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-angeloaudia1975/homecareproviderservicesordering}"
BRANCH="catalog-review"
LABEL="${SANDBOX_EXCLUDE_LABEL:-sandbox-exclude}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
api(){ curl -fsSL -H "Accept: application/vnd.github+json" ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "https://api.github.com/repos/$REPO/$1"; }
git config user.name  >/dev/null 2>&1 || git config user.name  "catalog-review-sandbox"
git config user.email >/dev/null 2>&1 || git config user.email "catalog-review-sandbox@users.noreply.github.com"

prs=$(api "pulls?state=open&base=main&per_page=100" | jq -c --arg repo "$REPO" --arg br "$BRANCH" --arg lb "$LABEL" \
  '[.[] | select(.head.repo.full_name==$repo and .head.ref!=$br) | {n:.number, ref:.head.ref, sha:.head.sha, title:.title, draft:.draft, excluded:([.labels[].name]|index($lb)!=null)}] | sort_by(.n)')

git fetch -q origin main
git fetch -q origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null || true
git checkout -q --detach origin/main
main_sha=$(git rev-parse HEAD)
included='[]'; skipped='[]'
while IFS= read -r row; do
  n=$(jq -r .n <<<"$row"); sha=$(jq -r .sha <<<"$row")
  if [ "$(jq -r .excluded <<<"$row")" = true ]; then skipped=$(jq -c --argjson r "$row" '.+[$r+{reason:"labelled sandbox-exclude"}]' <<<"$skipped"); continue; fi
  git fetch -q origin "$sha" 2>/dev/null || git fetch -q origin "+refs/pull/$n/head:refs/remotes/pr/$n"
  if git merge -q --no-ff --no-edit -m "sandbox: merge #$n" "$sha" >/dev/null 2>&1; then
    included=$(jq -c --argjson r "$row" '.+[$r]' <<<"$included")
  else
    git merge --abort 2>/dev/null || git reset -q --hard
    skipped=$(jq -c --argjson r "$row" '.+[$r+{reason:"does not merge cleanly with main and the PRs before it — update that PR to see it here"}]' <<<"$skipped")
  fi
done < <(jq -c '.[]' <<<"$prs")

# What this sandbox contains — served at /catalog-review.json on the sandbox only (never on main).
jq -n --arg main "$main_sha" --argjson inc "$included" --argjson sk "$skipped" --arg at "$(date -u +%FT%TZ)" \
  '{sandbox:"HCPS catalog review sandbox — private preview, not production", built_at:$at, main:$main,
    included:[$inc[]|{pr:.n,title,branch:.ref,head:.sha}], skipped:[$sk[]|{pr:.n,title,branch:.ref,reason}]}' > public/catalog-review.json
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
msg="Catalog review sandbox: main@${main_sha:0:7}$(jq -r '[.included[]|" + #\(.pr)@\(.head[0:7])"]|join("")' public/catalog-review.json)"
commit=$(git commit-tree "$tree" "${parents[@]}" -m "$msg")
git push -q origin "$commit:refs/heads/$BRANCH"
echo "$msg"
jq -r '.skipped[]|"skipped #\(.pr) (\(.title)): \(.reason)"' public/catalog-review.json
