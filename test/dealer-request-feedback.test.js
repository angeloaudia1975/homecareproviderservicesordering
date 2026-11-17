/* The portal tells the dealer whether a request was saved and whether HCPS's email went, and a retry reuses the same
   request_key (owner 2026-11-17). Runs the page's OWN sendDealerRequest (extracted from index.html and dashboard.html)
   against simulated server answers. */
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
let checks = 0;
for (const file of ["index.html", "dashboard.html"]) {
  const src = fs.readFileSync(path.join(__dirname, "../public", file), "utf8");
  const a = src.indexOf("const REQ_KEYS={};"), b = src.indexOf("async function reqTracking(");
  assert.ok(a > 0 && b > a, file + ": helper found");
  const alerts = [], sent = []; let answer = null;
  const ctx = { window: {}, crypto: { randomUUID: () => "00000000-0000-4000-8000-" + String(sent.length).padStart(12, "0") }, TOOLS_ENDPOINT: "x",
    alert: (m) => alerts.push(m), api: async (ep, body) => { sent.push(body); if (answer instanceof Error) throw answer; return answer; } };
  ctx.window.crypto = ctx.crypto;
  vm.createContext(ctx); vm.runInContext(src.slice(a, b) + "; this.send = sendDealerRequest;", ctx);
  const body = { action: "pricing_request", code: "PR448" };
  (async () => {})();
  const go = async (ans) => { answer = ans; alerts.length = 0; const r = await ctx.send(body, "Sent OK"); return { r, msg: alerts[0], key: sent[sent.length - 1].request_key }; };
  module.exports[file] = (async () => {
    let x = await go({ ok: true, saved: true, notified: false, message: "Your request is saved, but … Try again" });
    assert.strictEqual(x.r, false); assert.ok(/saved/.test(x.msg)); const k1 = x.key; assert.ok(/^[A-Za-z0-9-]{8,64}$/.test(k1)); checks += 3;
    x = await go(new Error("network")); assert.strictEqual(x.r, false); assert.ok(/not sent/.test(x.msg)); assert.strictEqual(x.key, k1, "retry reuses the key"); checks += 3;
    x = await go({ ok: false, saved: false, notified: false, error: "Your request was not sent — call" }); assert.ok(/not sent/.test(x.msg)); assert.strictEqual(x.key, k1); checks += 2;
    x = await go({ ok: true, saved: true, notified: true }); assert.strictEqual(x.r, true); assert.strictEqual(x.msg, "Sent OK"); assert.strictEqual(x.key, k1); checks += 3;
    x = await go({ ok: true, saved: true, notified: true }); assert.notStrictEqual(x.key, k1, "after success a new request gets a new key"); checks += 1;
    const other = await (answer = { ok: true, saved: false, notified: true }, ctx.send({ action: "pricing_request", code: "PR535" }, "Sent OK"));
    assert.strictEqual(other, true); assert.ok(/could not be saved/.test(alerts[alerts.length - 1])); checks += 2;
  })();
}
Promise.all(Object.values(module.exports)).then(() => {
  const idx = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  /* Manage Dealer: api() sends EVERY dealer-tools call with the manage token (mgAll), so these need no MANAGE_TOOLS entry */
  assert.ok(/const mgAll=[^\n]*endpoint===TOOLS_ENDPOINT/.test(idx), "Manage Dealer routes every dealer-tools call"); checks++;
  for (const f of ["index.html", "dashboard.html"]) { const s = fs.readFileSync(path.join(__dirname, "../public", f), "utf8");
    assert.ok(!/try\{ await api\(TOOLS_ENDPOINT,\{action:"(pricing|literature|tracking)_request"/.test(s), f + ": no silent request"); checks++; }
  console.log(`dealer request feedback: ${checks} checks pass`);
}).catch((e) => { console.error("FAIL", e.message); process.exit(1); });
