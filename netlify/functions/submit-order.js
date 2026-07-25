/* ============================================================================
 * HCPS Ordering Portal — order submission → email via Resend
 * Netlify function.  Endpoint: /.netlify/functions/submit-order
 *
 * The portal front end (public/index.html) POSTs the order payload here when a
 * dealer clicks "Submit Order to HCPS".  This formats the cart into an order
 * email and sends it to HCPS via Resend on the homecareproviderservices.us
 * domain (the same domain/provider the main site's contact form uses).
 *
 * No dependencies — uses the native fetch available in the Netlify Node runtime.
 *
 * Environment variables (set in the Netlify site → Site settings → Env vars):
 *   RESEND_API_KEY  (required)  Resend API key for homecareproviderservices.us
 *   ORDER_TO        (optional)  recipient(s), comma-separated.
 *                               default: orders@homecareproviderservices.us
 *   ORDER_FROM      (optional)  From header.
 *                               default: "HCPS Ordering Portal
 *                                         <orders@homecareproviderservices.us>"
 * ==========================================================================*/

const DEFAULT_TO = "orders@homecareproviderservices.us";
const DEFAULT_FROM = "HCPS Ordering Portal <orders@homecareproviderservices.us>";

/* ---------- helpers ---------- */
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[c]));

const money = (n) => {
  const v = Number(n);
  return Number.isFinite(v)
    ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* Pretty manufacturer label from a slug, e.g. "abm-respiratory-care" → "Abm Respiratory Care" */
const mfrLabel = (slug) =>
  String(slug || "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "—";

/* ---------- email builders ---------- */
function buildRows(items) {
  // Group line items by manufacturer for readability.
  const groups = new Map();
  for (const it of items) {
    const key = it.manufacturer || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return groups;
}

function itemsHtml(items) {
  const groups = buildRows(items);
  let out = "";
  for (const [slug, rows] of groups) {
    out += `<tr><td colspan="5" style="padding:14px 10px 6px;font:700 12px/1.2 Arial,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#ef6325;border-bottom:2px solid #ef6325;">${esc(mfrLabel(slug))}</td></tr>`;
    for (const it of rows) {
      const unit = Number(it.unit);
      const line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null;
      out += `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:400 13px Arial,sans-serif;color:#10263f;">${esc(it.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:400 13px Arial,sans-serif;color:#6b7280;white-space:nowrap;">${esc(it.code)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:600 13px Arial,sans-serif;color:#10263f;text-align:center;">${esc(it.qty)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:400 13px Arial,sans-serif;color:#10263f;text-align:right;white-space:nowrap;">${Number.isFinite(unit) ? money(unit) : "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:700 13px Arial,sans-serif;color:#10263f;text-align:right;white-space:nowrap;">${line != null ? money(line) : "—"}</td>
      </tr>`;
    }
  }
  return out;
}

function itemsText(items) {
  const groups = buildRows(items);
  const lines = [];
  for (const [slug, rows] of groups) {
    lines.push("");
    lines.push(mfrLabel(slug).toUpperCase());
    lines.push("-".repeat(mfrLabel(slug).length));
    for (const it of rows) {
      const unit = Number(it.unit);
      const line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null;
      lines.push(
        `  ${it.qty} x ${it.name} (${it.code})` +
          (Number.isFinite(unit) ? ` @ ${money(unit)} = ${money(line)}` : "")
      );
    }
  }
  return lines.join("\n");
}

function buildEmail(p) {
  const submitted = p.submitted_at ? new Date(p.submitted_at) : new Date();
  const submittedStr = submitted.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " CT";

  const shipParts = [p.address, [p.city, p.state].filter(Boolean).join(", "), p.zip]
    .map((x) => (x || "").trim())
    .filter(Boolean);
  const shipping = shipParts.length ? shipParts.join(" · ") : "—";

  const field = (label, val) =>
    `<tr><td style="padding:3px 12px 3px 0;font:600 12px Arial,sans-serif;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:3px 0;font:400 13px Arial,sans-serif;color:#10263f;">${esc(val || "—")}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f5;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e6e2dc;border-radius:12px;overflow:hidden;">
    <div style="background:#10263f;border-bottom:3px solid #ef6325;padding:18px 22px;">
      <div style="font:800 20px Arial,sans-serif;color:#fff;letter-spacing:.5px;">HomeCare Provider Services</div>
      <div style="font:600 11px Arial,sans-serif;color:#9fb0c4;letter-spacing:2px;text-transform:uppercase;">New Dealer Order</div>
    </div>
    <div style="padding:22px;">
      <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
        ${field("Dealer / Business", p.business)}
        ${field("HCPS Account #", p.account)}
        ${field("Contact", p.contact)}
        ${field("Email", p.email)}
        ${field("Phone", p.phone)}
        ${field("PO Number", p.po)}
        ${field("Ship to", shipping)}
        ${field("Submitted", submittedStr)}
      </table>

      <table style="border-collapse:collapse;width:100%;margin-top:14px;">
        <thead><tr>
          <th style="padding:6px 10px;text-align:left;font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #e6e2dc;">Product</th>
          <th style="padding:6px 10px;text-align:left;font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #e6e2dc;">Item&nbsp;#</th>
          <th style="padding:6px 10px;text-align:center;font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #e6e2dc;">Qty</th>
          <th style="padding:6px 10px;text-align:right;font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #e6e2dc;">Unit</th>
          <th style="padding:6px 10px;text-align:right;font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:1px solid #e6e2dc;">Line</th>
        </tr></thead>
        <tbody>${itemsHtml(p.items)}</tbody>
        <tfoot><tr>
          <td colspan="4" style="padding:12px 10px;text-align:right;font:700 13px Arial,sans-serif;color:#10263f;">Estimated total (${esc(p.items_count)} item${Number(p.items_count) === 1 ? "" : "s"})</td>
          <td style="padding:12px 10px;text-align:right;font:800 15px Arial,sans-serif;color:#ef6325;white-space:nowrap;">${money(p.estimated_total)}</td>
        </tr></tfoot>
      </table>

      ${p.notes ? `<div style="margin-top:16px;padding:12px 14px;background:#f6f7f5;border-radius:8px;border:1px solid #e6e2dc;"><div style="font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;">Notes</div><div style="font:400 13px/1.5 Arial,sans-serif;color:#10263f;white-space:pre-wrap;">${esc(p.notes)}</div></div>` : ""}

      <div style="margin-top:18px;font:400 11px/1.5 Arial,sans-serif;color:#9aa2ac;">
        Estimated totals use list pricing; account-specific pricing is confirmed by HCPS before the order is placed with the manufacturer. Reply to this email to reach the dealer directly.
      </div>
    </div>
  </div></body></html>`;

  const text = [
    "NEW DEALER ORDER — HomeCare Provider Services",
    "",
    `Dealer / Business : ${p.business || "—"}`,
    `HCPS Account #    : ${p.account || "—"}`,
    `Contact           : ${p.contact || "—"}`,
    `Email             : ${p.email || "—"}`,
    `Phone             : ${p.phone || "—"}`,
    `PO Number         : ${p.po || "—"}`,
    `Ship to           : ${shipping}`,
    `Submitted         : ${submittedStr}`,
    "",
    "ITEMS",
    "=====",
    itemsText(p.items),
    "",
    `Estimated total (${p.items_count} item${Number(p.items_count) === 1 ? "" : "s"}): ${money(p.estimated_total)}`,
    p.notes ? `\nNOTES\n-----\n${p.notes}` : "",
    "",
    "Estimated totals use list pricing; account pricing is confirmed by HCPS.",
  ].join("\n");

  const subject =
    `New order — ${p.business || "Dealer"}` +
    (p.account ? ` (${p.account})` : "") +
    ` · ${p.items_count} item${Number(p.items_count) === 1 ? "" : "s"} · ${money(p.estimated_total)}`;

  return { html, text, subject };
}

/* ---------- handler ---------- */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Allow": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return json(500, { ok: false, error: "Email service not configured" });
  }

  let p;
  try {
    p = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  // Basic validation — mirrors the front-end required fields.
  const items = Array.isArray(p.items) ? p.items : [];
  if (!p.business || !p.contact || !p.email || items.length === 0) {
    return json(400, {
      ok: false,
      error: "Missing required fields (business, contact, email) or empty cart.",
    });
  }

  const to = (process.env.ORDER_TO || DEFAULT_TO).split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.ORDER_FROM || DEFAULT_FROM;
  const { html, text, subject } = buildEmail(p);

  const emailPayload = {
    from,
    to,
    subject,
    html,
    text,
  };
  // Route replies to the dealer if they gave a plausible email.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email))) {
    emailPayload.reply_to = p.email;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend error", res.status, data);
      return json(502, { ok: false, error: "Email send failed", detail: data });
    }
    return json(200, { ok: true, id: data.id || null });
  } catch (err) {
    console.error("submit-order failed", err);
    return json(500, { ok: false, error: "Unexpected error sending order" });
  }
};

// Exported for local testing.
exports._buildEmail = buildEmail;
