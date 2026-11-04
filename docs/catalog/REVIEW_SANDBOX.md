# Catalog Review Sandbox — the standard review and release process

The owner set this up on 2026-11-03 as the standard process for every HCPS Partner 360 ordering-platform change.

## The one address
**https://deploy-preview-26--hcpsonlineordering.netlify.app**

This is the deploy preview of PR #26, "Catalog Review Sandbox — DO NOT MERGE", a permanent draft that is never merged. Only signed-in members of the HCPS Netlify team can open it.

## What it shows
The branch `catalog-review` contains:
- the latest `main` (= production);
- every open pull request into `main` that is **ready for owner review**:
  - it is a non-draft PR, or a draft labelled `owner-review`;
  - its checks have passed on its current head, with **positive evidence**:
    - the required Netlify deploy-preview build status is present and successful (the latest result per check counts);
    - no other status or check run is failing or unfinished.

    A PR with no validation results at all is never treated as passing, and a skipped or cancelled Netlify build is not evidence.
  - after it is merged into the sandbox together with the PRs before it, every JSON file it touches still parses.
    Otherwise it is taken back out and listed for a person.
  - When a PR that was already in the sandbox gets a new commit, the sandbox keeps its last validated version until the
    new commit's checks pass, so the PR doesn't drop out and come back. The yellow bar says "newer version still being
    checked". A new commit whose checks fail removes the PR.
  - it merges cleanly with `main` and the PRs before it (merged in PR-number order).

A PR that is not ready, has failing or unfinished checks, or conflicts is left out. It is listed with the reason in `/catalog-review.json` on the sandbox. A conflict is never resolved automatically: the PR's own branch is updated and the sandbox picks it up. A PR labelled `sandbox-exclude` is left out.

The yellow bar at the top of every sandbox page names:
- the build's **review id**;
- each unpublished change and the manufacturers it touches.

Everything not named in the bar is exactly what is live.

## Updates
`.github/workflows/catalog-review-sandbox.yml` runs **main's own copy** of `scripts/catalog-review-sync.sh`:
- It never runs a PR's copy, so an unreviewed branch can't change what runs with write access.
- It executes no PR code; PR heads are only merged with git.

It runs:
- on every push to `main`;
- on every PR change (open / push / label / close);
- whenever a check or a Netlify status finishes.

The script builds the new combined tree and, if anything changed, pushes ONE new commit to `catalog-review` (fast-forward, never a force push). Netlify then rebuilds PR #26's preview, normally in about 2 minutes. The script never touches `main`, any PR branch, Netlify settings, the database or production.

## Viewing it as a dealer
1. Connect 360 → **Catalog Preview**. Its default address is the sandbox.
2. Click **TEST — Golden Sandbox**. The preview sign-in lasts 4 hours.

The shop treats the sandbox host as a private catalog preview:
- prices come from the private price record for that dealer;
- checkout shows the dealer acknowledgment and the HCPS order email but **records nothing**;
- the staff preview token can never create an order (`orders-api`);
- nothing goes to a manufacturer or the dealer;
- the only email is one copy of the HCPS order email to angelo@homecareproviderservices.us, marked CATALOG PREVIEW — NOT AN ORDER.

## Approving a release
1. Review in the sandbox. Note the **review id** in the yellow bar (also in `/catalog-review.json`).
2. Approve publication of specific PRs, naming that review id.
3. Before merging each approved PR, Claude checks that its head commit equals the head recorded under that review id.
   - If it differs (the PR changed after review), the new version is shown in the sandbox and needs a fresh review.
4. The approved PR merges through its normal checks; production deploys from `main`.
5. The sandbox rebuilds and the published change drops out of the "unpublished" list.

The sandbox itself is never permission to publish.
