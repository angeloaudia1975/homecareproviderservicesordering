#!/bin/sh
# Netlify "ignore" gate (owner directive Rev 35, 2026-11-14 — after two credit-exhaustion outages).
# Netlify runs this before every build: exit 0 = SKIP the build (no credits), exit 1 = BUILD.
# Production deploys cost 15 credits each and were 96% of the Nov 5–14 spend (422 deploys = 6,330 of 6,560 credits).
#   • Deploy previews / branch deploys: unchanged rule — build only when a site path changed (they cost no deploy credits).
#   • Production: build ONLY when a site path changed AND THE COMMIT BEING BUILT (COMMIT_REF itself) has a line that is
#     exactly "[deploy]" (alone on its own line — a message that merely MENTIONS it doesn't count; learned 2026-11-14).
#     Everything pushed without the marker waits and goes out with the next "[deploy]" commit, whose tree carries it.
#   • Why only the commit being built (race found 2026-11-15): CACHED_COMMIT_REF is the last SUCCESSFUL build. While a
#     [deploy] release is still building, a later push (another session's held work, or a held-work restore) was compared
#     with the build BEFORE the release, so the release's marker sat inside its range and authorized publishing it
#     (83245f7 published; 45063ed had to be cancelled by hand). A marker authorizes only its own commit now. If Netlify
#     cancels a queued release in favour of a newer push, nothing publishes (fail closed): push a fresh [deploy] commit.
#   • Unknown previous build (first build, cache cleared, shallow clone): previews build; production builds only when the
#     commit being built carries the marker (review 2026-11-15: it used to publish anything).
#   • Squash merges: GitHub's default squash message repeats every branch commit's message, so a [deploy] line from any of
#     them would authorize the build. Release through a merge commit (type [deploy] yourself) or edit the squash message.
# Usage: sh scripts/netlify-deploy-gate.sh <path> [path…]
CUR="${COMMIT_REF:-HEAD}"; PREV="${CACHED_COMMIT_REF:-}"
MARK=0; git log -1 --format=%B "$CUR" 2>/dev/null | grep -qx '[[:space:]]*\[deploy\][[:space:]]*' && MARK=1
if [ -z "$PREV" ] || ! git cat-file -e "$PREV^{commit}" 2>/dev/null; then
  # Unknown previous build: previews still build (no deploy credits); production builds only a commit that carries the marker.
  if [ "${CONTEXT:-production}" != "production" ] || [ "$MARK" = 1 ]; then echo "deploy-gate: no previous build known — building"; exit 1; fi
  echo "deploy-gate: no previous build known and no [deploy] marker on $CUR — HELD"; exit 0
fi
if git diff --quiet "$PREV" "$CUR" -- "$@"; then echo "deploy-gate: no site files changed since $PREV — skipping (no credits used)"; exit 0; fi
if [ "${CONTEXT:-production}" != "production" ]; then echo "deploy-gate: $CONTEXT build with site changes — building"; exit 1; fi
if [ "$MARK" = 1 ]; then echo "deploy-gate: [deploy] release marker on $CUR — building"; exit 1; fi
echo "deploy-gate: site files changed but no [deploy] marker on the commit being built ($CUR) — HELD (no credits used). Push a commit with a line that is exactly [deploy] to release everything waiting."
exit 0
