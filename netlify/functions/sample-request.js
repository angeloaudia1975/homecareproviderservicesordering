/* ============================================================================
 * HCPS Ordering Portal — Ovation Medical "Request a Sample" → email via Resend
 * Netlify function.  Endpoint: /.netlify/functions/sample-request
 *
 * The portal (public/index.html) POSTs when a dealer requests a product sample:
 *   { business, account, contact, email, phone,
 *     product, product_code, manufacturer_name,
 *     address, city, state, zip, note, dealer_id, submitted_at }
 *
 * Sends ONE formatted email to HCPS (orders@homecareproviderservices.us) via
 * Resend on the homecareproviderservices.us domain, with a FIXED subject line:
 *   "Ovation Medical Sample Request"
 * reply_to is set to the requesting dealer so HCPS can reply to them directly.
 * No dependencies — uses the native fetch in the Netlify Node runtime.
 *
 * Env vars (Netlify → Site settings → Environment variables):
 *   RESEND_API_KEY  (required)  Resend key for homecareproviderservices.us
 *   SAMPLE_TO       (optional)  recipient(s), comma-separated. Falls back to
 *                               ORDER_TO, then orders@homecareproviderservices.us
 *   ORDER_FROM      (optional)  From header. default:
 *                               "HCPS Ordering Portal <orders@homecareproviderservices.us>"
 * ==========================================================================*/

const DEFAULT_TO = "orders@homecareproviderservices.us";
const DEFAULT_FROM = "HCPS Ordering Portal <orders@homecareproviderservices.us>";
const SUBJECT = "Ovation Medical Sample Request";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[c]));

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* ---------- build the email ---------- */
function buildEmail(r) {
  const submitted = r.submitted_at ? new Date(r.submitted_at) : new Date();
  const submittedStr = submitted.toLocaleString("en-US", {
    timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short",
  }) + " CT";

  const shipParts = [r.address, [r.city, r.state].filter(Boolean).join(", "), r.zip]
    .map((x) => (x || "").trim()).filter(Boolean);
  const shipping = shipParts.length ? shipParts.join(" · ") : "—";

  const field = (label, val) =>
    `<tr><td style="padding:3px 12px 3px 0;font:600 12px Arial,sans-serif;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:3px 0;font:400 13px Arial,sans-serif;color:#10263f;">${esc(val || "—")}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f5;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6e2dc;border-radius:12px;overflow:hidden;">
    <div style="background:#10263f;border-bottom:3px solid #ef6325;padding:18px 22px;">
      <div style="font:800 20px Arial,sans-serif;color:#fff;letter-spacing:.5px;">HomeCare Provider Services</div>
      <div style="font:600 11px Arial,sans-serif;color:#9fb0c4;letter-spacing:2px;text-transform:uppercase;">Ovation Medical — Sample Request</div>
    </div>
    <div style="padding:22px;">
      <div style="margin-bottom:14px;padding:12px 14px;background:#f6f7f5;border:1px solid #e6e2dc;border-radius:10px;">
        <div style="font:700 10px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:2px;">Sample requested</div>
        <div style="font:700 15px Arial,sans-serif;color:#10263f;">${esc(r.product || "—")}</div>
        ${r.product_code ? `<div style="font:400 12px Arial,sans-serif;color:#9aa2ac;">Item # ${esc(r.product_code)}</div>` : ""}
      </div>
      <table style="border-collapse:collapse;width:100%;">
        ${field("Dealer / Business", r.business)}
        ${field("HCPS Account #", r.account)}
        ${field("Contact", r.contact)}
        ${field("Email", r.email)}
        ${field("Phone", r.phone)}
        ${field("Ship sample to", shipping)}
        ${field("Submitted", submittedStr)}
      </table>
      ${r.note ? `<div style="margin-top:14px;padding:12px 14px;background:#f6f7f5;border-radius:8px;border:1px solid #e6e2dc;"><div style="font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;">Note from dealer</div><div style="font:400 13px/1.5 Arial,sans-serif;color:#10263f;white-space:pre-wrap;">${esc(r.note)}</div></div>` : ""}
      <div style="margin-top:18px;font:400 11px/1.5 Arial,sans-serif;color:#9aa2ac;">
        Sample request submitted through the HCPS Partner 360 ordering platform. Reply to this email to reach the dealer directly.
      </div>
    </div>
  </div></body></html>`;

  const text = [
    "OVATION MEDICAL — SAMPLE REQUEST",
    "HomeCare Provider Services",
    "",
    `Sample requested  : ${r.product || "—"}${r.product_code ? " (Item # " + r.product_code + ")" : ""}`,
    `Dealer / Business : ${r.business || "—"}`,
    `HCPS Account #    : ${r.account || "—"}`,
    `Contact           : ${r.contact || "—"}`,
    `Email             : ${r.email || "—"}`,
    `Phone             : ${r.phone || "—"}`,
    `Ship sample to    : ${shipping}`,
    `Submitted         : ${submittedStr}`,
    r.note ? `\nNOTE FROM DEALER\n---------------\n${r.note}` : "",
  ].join("\n");

  return { html, text, subject: SUBJECT };
}

/* ---------- send via Resend ---------- */
async function sendEmail(apiKey, from, to, replyTo, built) {
  const payload = { from, to, subject: built.subject, html: built.html, text: built.text };
  if (replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(replyTo))) payload.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, id: data.id || null, detail: res.ok ? undefined : data };
}

/* ---------- handler ---------- */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { Allow: "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error("RESEND_API_KEY is not set"); return json(500, { ok: false, error: "Email service not configured" }); }

  let r;
  try { r = JSON.parse(event.body || "{}"); }
  catch (e) { return json(400, { ok: false, error: "Invalid JSON body" }); }

  if (!r.business || !r.contact || !r.email) {
    return json(400, { ok: false, error: "Missing required fields (business, contact, email)." });
  }
  if (!r.product) {
    return json(400, { ok: false, error: "Missing the product being requested." });
  }
  if (!r.address || !r.city || !r.state || !r.zip) {
    return json(400, { ok: false, error: "Missing shipping address." });
  }

  const to = (process.env.SAMPLE_TO || process.env.ORDER_TO || DEFAULT_TO)
    .split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.ORDER_FROM || DEFAULT_FROM;

  try {
    const built = buildEmail(r);
    const sent = await sendEmail(apiKey, from, to, r.email, built);
    if (!sent.ok) { console.error("Resend error (sample)", sent.status, sent.detail); return json(502, { ok: false, error: "Email service rejected the request." }); }
    return json(200, { ok: true, id: sent.id });
  } catch (err) {
    console.error("sample-request send failed", err);
    return json(502, { ok: false, error: String(err) });
  }
};

// Exported for local testing.
exports._buildEmail = buildEmail;
