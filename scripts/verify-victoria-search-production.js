"use strict";
/* Public-file verification only: no dealer session, page scripts, API keys or database calls.
   Candidate pushes compare the recorded production baseline; marked main releases wait for
   the exact checked-out index and panel to be served. A main restore is not a release. */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const REPOSITORY = "angeloaudia1975/homecareproviderservicesordering";
const BRANCH = "refs/heads/codex/victoria-product-search";
const BASELINE = "6028c45fac37e237e0ab0b2981d7e76f144d599a";
const ORIGIN = "https://hcpsonlineordering.netlify.app";
const FILES = [
  { file: "public/index.html", route: "/" },
  { file: "public/assets/dealer-victoria-panel.js", route: "/assets/dealer-victoria-panel.js" }
];
const MAX_BYTES = 8 * 1024 * 1024;
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY ||
      process.env.GITHUB_EVENT_NAME !== "push") {
    throw new Error("Unexpected repository or event.");
  }
  const branch = process.env.GITHUB_REF;
  const message = execFileSync("git", ["log", "-1", "--format=%B"], { encoding: "utf8" });
  const marker = message.split(/\r?\n/).some(line => line.trim() === "[deploy]");
  const candidate = branch === BRANCH;
  const release = branch === "refs/heads/main" && marker;
  if (!candidate && !release) {
    console.log("No production check for a main commit without a release marker.");
    return;
  }
  const mode = candidate ? "baseline" : "release";
  const expected = FILES.map(item => {
    const bytes = candidate
      ? execFileSync("git", ["show", BASELINE + ":" + item.file], { maxBuffer: MAX_BYTES })
      : fs.readFileSync(item.file);
    return Object.assign({}, item, { sha256: digest(bytes) });
  });
  const deadline = Date.now() + (release ? 15 * 60 * 1000 : 60 * 1000);
  async function checkOne(item, attempt) {
    const url = new URL(item.route, ORIGIN);
    url.searchParams.set("victoria_verify", String(process.env.GITHUB_SHA || "") + "-" + attempt);
    const remaining = Math.max(1, deadline - Date.now());
    const response = await fetch(url, {
      method: "GET",
      headers: { "cache-control": "no-cache" },
      redirect: "follow",
      signal: AbortSignal.timeout(Math.min(15000, remaining))
    });
    if (new URL(response.url).origin !== ORIGIN) {
      throw new Error(item.file + ": unexpected response origin");
    }
    if (!response.ok) throw new Error(item.file + ": HTTP " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error(item.file + ": unexpectedly large response");
    const actual = digest(bytes);
    const matches = actual === item.sha256;
    console.log(item.file + " " + (matches ? "MATCH" : "MISMATCH") +
      " expected=" + item.sha256 + " actual=" + actual);
    return matches;
  }

  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    console.log(mode + " check, attempt " + attempt);
    const results = await Promise.allSettled(expected.map(item => checkOne(item, attempt)));
    for (const result of results) if (result.status === "rejected") {
      console.log(String(result.reason && result.reason.message || result.reason));
    }
    if (results.every(result => result.status === "fulfilled" && result.value === true)) {
      const summary = candidate
        ? "Production search files match the recorded baseline " + BASELINE + "."
        : "Production serves both exact reviewed files from " + process.env.GITHUB_SHA + ".";
      console.log(summary);
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "## Victoria product-search verification\n\n" + summary + "\n\n" +
        expected.map(item => "- " + item.file + ": " + item.sha256).join("\n") +
        "\n\nThis checks public file delivery; authenticated dealer acceptance is separate.\n"
      );
      return;
    }
    if (candidate && results.some(result => result.status === "fulfilled" && result.value === false)) {
      throw new Error("Production baseline differs. Reconcile before changing main.");
    }
    if (candidate && attempt >= 3) {
      throw new Error("Production baseline could not be read after three attempts.");
    }
    const wait = Math.min(candidate ? 5000 : 20000, deadline - Date.now());
    if (wait > 0) await sleep(wait);
  }
  throw new Error(release
    ? "The reviewed release files were not confirmed within 15 minutes. Publication remains unverified."
    : "Production baseline could not be confirmed. Reconcile before changing main.");
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
