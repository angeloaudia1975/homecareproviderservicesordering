#!/bin/sh
# Netlify "ignore" gate (owner directive Rev 35, 2026-11-14 — after two credit-exhaustion outages).
# Netlify runs this before every build: exit 0 = SKIP the build (no credits), exit 1 = BUILD.
# Production deploys cost 15 credits each and were 96% of the Nov 5–14 spend (422 deploys = 6,330 of 6,560 credits).
#   • Deploy previews / branch deploys: unchanged rule — build only when a site path changed (they cost no deploy credits).
#   • Production: build ONLY when a site path changed AND a commit in the range carries "[deploy]" in its message.
#     Everything pushed without the marker waits and goes out with the next "[deploy]" commit (Netlify diffs from the
#     last successful build, CACHED_COMMIT_REF, so nothing is lost). Batch work; one [deploy] per finished release.
#   • First build / unknown previous build → build (fail open: never strand a fix because history is missing).
# Usage: sh scripts/netlify-deploy-gate.sh <path> [path…]
CUR="${COMMIT_REF:-HEAD}"; PREV="${CACHED_COMMIT_REF:-}"
if [ -z "$PREV" ] || ! git cat-file -e "$PREV^{commit}" 2>/dev/null; then echo "deploy-gate: no previous build known — building"; exit 1; fi
if git diff --quiet "$PREV" "$CUR" -- "$@"; then echo "deploy-gate: no site files changed since $PREV — skipping (no credits used)"; exit 0; fi
if [ "${CONTEXT:-production}" != "production" ]; then echo "deploy-gate: $CONTEXT build with site changes — building"; exit 1; fi
if git log --format=%B "$PREV..$CUR" 2>/dev/null | grep -q '\[deploy\]'; then echo "deploy-gate: [deploy] release marker found — building"; exit 1; fi
echo "deploy-gate: site files changed but no [deploy] marker since $PREV — HELD (no credits used). Push a commit whose message contains [deploy] to release everything waiting."
exit 0
