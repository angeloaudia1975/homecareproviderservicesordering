"use strict";
/* Store only the two reviewed generated Git blobs. This script never changes a ref,
   commit, tree, issue, pull request, deployment or setting. Token exists in this step only. */
const fs = require("node:fs");
const crypto = require("node:crypto");
const REPOSITORY = "angeloaudia1975/homecareproviderservicesordering";
const BRANCH = "refs/heads/codex/victoria-product-search";
const FILES = [
  { path: "public/index.html", sha: "71720b3008f87b387a77debbbf7bcfd8bf57befe" },
  { path: "public/assets/dealer-victoria-panel.js", sha: "da2f727b5bec7ebc9deaba9721dda7e88da82b9e" }
];
function gitBlobSha(bytes) {
  return crypto.createHash("sha1")
    .update(Buffer.from("blob " + bytes.length + "\0"))
    .update(bytes).digest("hex");
}
async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY ||
      process.env.GITHUB_REF !== BRANCH ||
      process.env.GITHUB_EVENT_NAME !== "push") {
    throw new Error("Unexpected repository, branch or event.");
  }
  if (!process.env.GITHUB_TOKEN) throw new Error("The workflow token is unavailable.");
  // Validate both exact outputs before making either POST.
  const verified = FILES.map(file => {
    const bytes = fs.readFileSync(file.path);
    if (gitBlobSha(bytes) !== file.sha) {
      throw new Error(file.path + ": reviewed output hash mismatch.");
    }
    return Object.assign({}, file, { bytes });
  });
  const results = [];
  for (const file of verified) {
    const response = await fetch("https://api.github.com/repos/" + REPOSITORY + "/git/blobs", {
      method: "POST",
      headers: {
        authorization: "Bearer " + process.env.GITHUB_TOKEN,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "HCPS-Victoria-search-verification"
      },
      body: JSON.stringify({ encoding: "base64", content: file.bytes.toString("base64") }),
      redirect: "error",
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) {
      throw new Error(file.path + ": GitHub blob creation returned HTTP " + response.status);
    }
    const result = await response.json();
    if (result.sha !== file.sha) {
      throw new Error(file.path + ": GitHub returned an unexpected blob hash.");
    }
    results.push({ path: file.path, sha: result.sha });
    console.log(file.path + " " + result.sha);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    "## Verified Victoria source objects\n\n" +
    results.map(item => "- " + item.path + ": " + item.sha).join("\n") +
    "\n\nNo refs, commits, PRs or deployments were changed by this job.\n"
  );
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
