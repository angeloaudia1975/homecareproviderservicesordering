/* RETIRED MANUFACTURER LINES and ORDERING HOLDS (owner decisions; one list each, read by every gate on this site).

   A RETIRED line is never listed, never priced and never ordered — whoever asks, whatever they are entitled to.
   This is deliberately separate from entitlements: the database keeps every historical dealer_manufacturers row
   (account numbers, active flags) untouched. Removing a line from RETIRED_LINES is the ONLY way back, and needs the
   owner's explicit decision.

   A HELD line (ORDERING_HOLDS) is an ACTIVE represented line whose catalog dealers may see, but which is not priced or
   ordered until HCPS has verified its current pricing and ordering terms: the order server refuses to price it, the
   storefront shows "Pricing being verified" and adds nothing to a cart, quotes and public storefronts leave it out.
   Lifting a hold is also an owner decision (after the price list is verified through Manufacturer Center).

   Ohio Medical / GCE: retired 2026-11-04 (Yuwell), RESTORED by the owner 2026-11-12 — Yuwell stays. Its canonical
   identifier is "ohio-medical"; the legacy "gce" is the same line (lineSlug maps it), so a hold or a check on either
   spelling means the same thing.

   The same file lives in both repos (homecareproviderservices and homecareproviderservicesordering
   netlify/functions/_retired_lines.js); test/retired-lines.test.js in each repo checks the two are identical. */
"use strict";

const RETIRED_LINES = Object.freeze({
  "complete-medical-supplies": "Complete Medical Supplies is no longer an HCPS partner (owner, 2026-10-23).",
});

const ORDERING_HOLDS = Object.freeze({
  /* (empty) Ohio Medical / GCE was held 2026-11-12 and opened the same day on the owner's 2026 rev price list. */
});

const ALIASES = Object.freeze({ gce: "ohio-medical" });   // legacy identifier → canonical

function norm(slug) { return String(slug == null ? "" : slug).trim().toLowerCase(); }
function lineSlug(slug) { const s = norm(slug); return Object.prototype.hasOwnProperty.call(ALIASES, s) ? ALIASES[s] : s; }
function isRetiredLine(slug) { return Object.prototype.hasOwnProperty.call(RETIRED_LINES, lineSlug(slug)); }
function retiredReason(slug) { return isRetiredLine(slug) ? RETIRED_LINES[lineSlug(slug)] : null; }
function isHeldLine(slug) { return Object.prototype.hasOwnProperty.call(ORDERING_HOLDS, lineSlug(slug)); }
function holdReason(slug) { return isHeldLine(slug) ? ORDERING_HOLDS[lineSlug(slug)] : null; }

module.exports = { RETIRED_LINES, ORDERING_HOLDS, ALIASES, lineSlug, isRetiredLine, retiredReason, isHeldLine, holdReason };
