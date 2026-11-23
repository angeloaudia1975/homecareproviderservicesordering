/* When did a release reach production? (owner 2026-11-22 18:25 — Learning & Improvement recurrence is measured from the moment
   the named fix was actually live, not from when someone marked it fixed.)
   Netlify gives every function the commit it was built from (COMMIT_REF) and the deploy context. The first time a production
   function of a site runs a commit it has not seen, that commit and the time go into app_settings `deploy_seen`
   ({rev, commits: {"<site>:<sha12>": first_seen_iso}}), compare-and-set, once per function instance. That is the earliest
   OBSERVED time the release was serving — never earlier than the real publish, possibly a little later (until a function runs).
   A release that is never observed (superseded before anything ran) has no production time; the page says so and never flags
   a recurrence for it. Nothing here is a secret; no request data is stored. */
"use strict";
const KEY = "deploy_seen", MAX = 400;
let seenHere = false;
let INFO = {}; try { INFO = require("./_build_info.json") || {}; } catch (e) { INFO = {}; }   // written by the build (scripts/write-build-info.js)
const buildCommit = () => sha12(process.env.COMMIT_REF) || sha12(INFO.commit);
const buildContext = () => String(process.env.CONTEXT || INFO.context || "");
const sha12 = (v) => { const s = String(v || "").trim().toLowerCase(); return /^[0-9a-f]{7,40}$/.test(s) ? s.slice(0, 12) : null; };
async function observe(sb, site, now) {
  if (seenHere) return false; seenHere = true;
  const c = buildCommit(); if (!c || buildContext() !== "production") return false;
  const k = `${site}:${c}`;
  try {
    for (let i = 0; i < 4; i++) {
      const r = await sb("GET", `app_settings?key=eq.${KEY}&select=value`); const prev = r && r[0] ? r[0].value || {} : null;
      if (prev && prev.commits && prev.commits[k]) return false;
      const commits = Object.assign({}, (prev && prev.commits) || {}); commits[k] = new Date(now || Date.now()).toISOString();
      const keep = Object.entries(commits).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, MAX);
      const next = { rev: (Number(prev && prev.rev) || 0) + 1, commits: Object.fromEntries(keep) };
      const w = prev ? await sb("PATCH", `app_settings?key=eq.${KEY}&value->>rev=eq.${Number(prev.rev) || 0}`, { value: next }, { Prefer: "return=representation" })
        : await sb("POST", "app_settings?on_conflict=key", [{ key: KEY, value: next }], { Prefer: "resolution=ignore-duplicates,return=representation" });
      if (Array.isArray(w) && w.length === 1) return true;
    }
  } catch (e) { console.error(JSON.stringify({ deploy_seen: "write_failed", msg: String(e && e.message || e).slice(0, 80) })); }
  return false;
}
/* the earliest observed production time of a named release (any site); null = not observed */
function deployedAt(seen, ref) {
  const r = sha12(ref); if (!r) return null; let best = null;
  for (const [k, at] of Object.entries((seen && seen.commits) || {})) { const c = k.split(":")[1] || ""; if ((c.startsWith(r) || r.startsWith(c)) && (!best || at < best)) best = at; }
  return best;
}
module.exports = { KEY, observe, deployedAt, sha12, buildCommit, _reset: () => { seenHere = false; } };
