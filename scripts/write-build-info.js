/* Netlify build step (owner 2026-11-22): Netlify gives the BUILD its commit (COMMIT_REF) and context (CONTEXT) but not the
   functions at run time, so the build writes them into netlify/functions/_build_info.json, which the bundler ships with the
   functions (_deploy_seen.js reads it). Nothing secret: a commit hash and a context name. */
"use strict";
const fs = require("fs"), path = require("path");
const sha = String(process.env.COMMIT_REF || "").toLowerCase();
const info = { commit: /^[0-9a-f]{7,40}$/.test(sha) ? sha.slice(0, 12) : null, context: process.env.CONTEXT ? String(process.env.CONTEXT).slice(0, 40) : null };
fs.writeFileSync(path.join(__dirname, "..", "netlify", "functions", "_build_info.json"), JSON.stringify(info) + "\n");
console.log("build info:", JSON.stringify(info));
