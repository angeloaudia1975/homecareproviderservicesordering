/* ============================================================================
 * HCPS Ordering Portal — order submission → email via Resend
 * Netlify function.  Endpoint: /.netlify/functions/submit-order
 *
 * The portal (public/index.html) POSTs a grouped payload when a dealer submits:
 *   { dealer:{...}, submitted_at, orders:[ {manufacturer_name, po, items, ...}, ... ] }
 * Each manufacturer is a SEPARATE order, so this sends one formatted email per
 * manufacturer to HCPS (orders@homecareproviderservices.us) via Resend on the
 * homecareproviderservices.us domain. reply_to is set to the dealer.
 *
 * THE SERVER PRICES THE ORDER (Phase 2.7). This function no longer emails whatever prices
 * the browser sent. It forwards the dealer's sign-in to orders-api "create", which re-prices
 * every line with the storefront's own engine for this dealer and records the order. If those
 * prices differ from what the dealer reviewed, nothing is recorded or emailed: the new prices
 * go back to the browser (409 prices_changed) for the dealer to review. Otherwise the email
 * carries the prices the server stored — never the browser's numbers.
 *
 * No dependencies — uses the native fetch in the Netlify Node runtime.
 *
 * Env vars (Netlify → Site settings → Environment variables):
 *   RESEND_API_KEY  (required)  Resend key for homecareproviderservices.us
 *   ORDER_TO        (optional)  recipient(s), comma-separated.
 *                               default: orders@homecareproviderservices.us
 *   ORDERS_API      (optional)  orders-api URL. default: the admin site's orders-api
 *   ORDER_FROM      (optional)  From header.
 *                               default: "HCPS Ordering Portal
 *                                         <orders@homecareproviderservices.us>"
 * ==========================================================================*/

const DEFAULT_TO = "orders@homecareproviderservices.us";
const DEFAULT_FROM = "HCPS Ordering Portal <orders@homecareproviderservices.us>";
const DEFAULT_ORDERS_API = "https://homecareproviderservices.netlify.app/.netlify/functions/orders-api";
const r2 = (n) => Math.round(Number(n) * 100) / 100;

/* Replace every price on the emailed orders with what the server recorded. The browser keeps
   the say over what is not a price (PO, notes, freight terms, display text). */
function applyServerPrices(orders, recorded) {
  const bySlug = {};
  (recorded || []).forEach((r) => { if (r && r.manufacturer_slug) bySlug[r.manufacturer_slug] = r; });
  return orders.map((o) => {
    const rec = bySlug[o.manufacturer_slug];
    if (!rec) throw new Error("no recorded order for " + (o.manufacturer_name || o.manufacturer_slug));
    const units = {};
    (rec.items || []).forEach((it) => { units[String(it.code)] = it; });
    const items = (o.items || []).map((it) => {
      const r = units[String(it.code)];
      if (!r) throw new Error("recorded order is missing " + it.code);
      return Object.assign({}, it, { qty: r.qty, unit: r.unit });
    });
    const sub = r2(rec.subtotal);
    const fee = Number(o.freight_fee) > 0 ? Number(o.freight_fee) : 0;
    return Object.assign({}, o, { items, items_subtotal: sub, estimated_total: r2(sub + fee), order_id: rec.order_id });
  });
}

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

/* ---------- freight summary ---------- */
function freightShort(o) {
  const lines = o.freight_lines || [];
  if (Number(o.freight_fee) > 0) return money(o.freight_fee) + " flat";
  if (lines.some((r) => r.status === "actual")) return "actual freight (confirmed by manufacturer)";
  if (lines.length) return "FREE";
  return "—";
}
function freightTermsHtml(o) {
  const lines = o.freight_lines || [];
  if (!lines.length && !o.freight_note) return "";
  let rows = lines.map((r) => {
    let right =
      r.status === "free" ? "FREE freight"
      : r.status === "flat" ? money(r.fee) + " freight"
      : "actual freight";
    let sub = r.remaining > 0 && r.freeAt ? ` (add ${money(r.remaining)} to reach free freight at ${money(r.freeAt)})` : "";
    return `<tr><td style="padding:2px 10px 2px 0;font:400 12px Arial,sans-serif;color:#4b5563;">${esc(r.label)}${sub}</td><td style="padding:2px 0;font:600 12px Arial,sans-serif;color:#10263f;text-align:right;white-space:nowrap;">${right}</td></tr>`;
  }).join("");
  const note = o.freight_note ? `<div style="font:italic 11px Arial,sans-serif;color:#9aa2ac;margin-top:4px;">${esc(o.freight_note)}</div>` : "";
  return `<div style="margin-top:10px;padding:8px 10px;background:#f6f7f5;border:1px solid #e6e2dc;border-radius:8px;">
    <div style="font:700 10px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;">Freight</div>
    <table style="border-collapse:collapse;width:100%;">${rows}</table>${note}</div>`;
}

/* ---------- item rows ---------- */
function itemsHtml(items) {
  return (items || []).map((it) => {
    const unit = Number(it.unit);
    const line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null;
    const codeUom = esc(it.code) + (it.uom ? ` · ${esc(it.uom)}` : "");
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:400 13px Arial,sans-serif;color:#10263f;">${esc(it.name)}${it.brand ? `<div style="font:400 11px Arial,sans-serif;color:#9aa2ac;">${esc(it.brand)}</div>` : ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:400 12px Arial,sans-serif;color:#6b7280;white-space:nowrap;">${codeUom}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:600 13px Arial,sans-serif;color:#10263f;text-align:center;">${esc(it.qty)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:400 13px Arial,sans-serif;color:#10263f;text-align:right;white-space:nowrap;">${Number.isFinite(unit) ? money(unit) : "—"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e6e2dc;font:700 13px Arial,sans-serif;color:#10263f;text-align:right;white-space:nowrap;">${line != null ? money(line) : "—"}</td>
    </tr>`;
  }).join("");
}
function itemsText(items) {
  return (items || []).map((it) => {
    const unit = Number(it.unit);
    const line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null;
    return `  ${it.qty} x ${it.name} (${it.code}${it.uom ? ", " + it.uom : ""})` +
      (Number.isFinite(unit) ? ` @ ${money(unit)} = ${money(line)}` : "");
  }).join("\n");
}

/* ---------- build one manufacturer email ---------- */
function buildEmail(dealer, order, submittedAt) {
  const submitted = submittedAt ? new Date(submittedAt) : new Date();
  const submittedStr = submitted.toLocaleString("en-US", {
    timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short",
  }) + " CT";

  const shipParts = [dealer.address, [dealer.city, dealer.state].filter(Boolean).join(", "), dealer.zip]
    .map((x) => (x || "").trim()).filter(Boolean);
  const shipping = shipParts.length ? shipParts.join(" · ") : "—";

  const field = (label, val) =>
    `<tr><td style="padding:3px 12px 3px 0;font:600 12px Arial,sans-serif;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:3px 0;font:400 13px Arial,sans-serif;color:#10263f;">${esc(val || "—")}</td></tr>`;

  const feeRow = Number(order.freight_fee) > 0
    ? `<tr><td colspan="4" style="padding:4px 10px;text-align:right;font:400 12px Arial,sans-serif;color:#6b7280;">Freight</td><td style="padding:4px 10px;text-align:right;font:600 12px Arial,sans-serif;color:#10263f;white-space:nowrap;">${money(order.freight_fee)}</td></tr>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f5;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e6e2dc;border-radius:12px;overflow:hidden;">
    <div style="background:#10263f;border-bottom:3px solid #ef6325;padding:18px 22px;">
      <div style="font:800 20px Arial,sans-serif;color:#fff;letter-spacing:.5px;">HomeCare Provider Services</div>
      <div style="font:600 11px Arial,sans-serif;color:#9fb0c4;letter-spacing:2px;text-transform:uppercase;">New Dealer Order — ${esc(order.manufacturer_name)}</div>
    </div>
    <div style="padding:22px;">
      <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
        ${field("Manufacturer", order.manufacturer_name)}
        ${field("PO Number", order.po)}
        ${field("Dealer / Business", dealer.business)}
        ${field("HCPS Account #", dealer.account)}
        ${field("Contact", dealer.contact)}
        ${field("Email", dealer.email)}
        ${field("Phone", dealer.phone)}
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
        <tbody>${itemsHtml(order.items)}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:8px 10px 2px;text-align:right;font:400 12px Arial,sans-serif;color:#6b7280;">Subtotal (${esc(order.items_count)} item${Number(order.items_count) === 1 ? "" : "s"})</td>
              <td style="padding:8px 10px 2px;text-align:right;font:600 12px Arial,sans-serif;color:#10263f;white-space:nowrap;">${money(order.items_subtotal)}</td></tr>
          ${feeRow}
          <tr><td colspan="4" style="padding:6px 10px;text-align:right;font:700 13px Arial,sans-serif;color:#10263f;border-top:1px solid #e6e2dc;">Estimated total</td>
              <td style="padding:6px 10px;text-align:right;font:800 15px Arial,sans-serif;color:#ef6325;white-space:nowrap;border-top:1px solid #e6e2dc;">${money(order.estimated_total)}</td></tr>
        </tfoot>
      </table>

      ${freightTermsHtml(order)}

      ${order.notes ? `<div style="margin-top:14px;padding:12px 14px;background:#f6f7f5;border-radius:8px;border:1px solid #e6e2dc;"><div style="font:700 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;">Notes</div><div style="font:400 13px/1.5 Arial,sans-serif;color:#10263f;white-space:pre-wrap;">${esc(order.notes)}</div></div>` : ""}

      <div style="margin-top:18px;font:400 11px/1.5 Arial,sans-serif;color:#9aa2ac;">
        Item prices are the dealer's account pricing as recorded by the server when the order was placed; final freight is confirmed by HCPS before the order is placed with the manufacturer. Reply to this email to reach the dealer directly.
      </div>
    </div>
  </div></body></html>`;

  const text = [
    `NEW DEALER ORDER — ${order.manufacturer_name}`,
    "HomeCare Provider Services",
    "",
    `PO Number         : ${order.po || "—"}`,
    `Dealer / Business : ${dealer.business || "—"}`,
    `HCPS Account #    : ${dealer.account || "—"}`,
    `Contact           : ${dealer.contact || "—"}`,
    `Email             : ${dealer.email || "—"}`,
    `Phone             : ${dealer.phone || "—"}`,
    `Ship to           : ${shipping}`,
    `Submitted         : ${submittedStr}`,
    "",
    "ITEMS",
    "=====",
    itemsText(order.items),
    "",
    `Subtotal (${order.items_count} item${Number(order.items_count) === 1 ? "" : "s"}): ${money(order.items_subtotal)}`,
    `Freight: ${freightShort(order)}`,
    `Estimated total: ${money(order.estimated_total)}`,
    order.freight_note ? `\n${order.freight_note}` : "",
    order.notes ? `\nNOTES\n-----\n${order.notes}` : "",
  ].join("\n");

  const subject =
    `New order — ${dealer.business || "Dealer"} — ${order.manufacturer_name}` +
    ` · PO ${order.po || "—"} · ${order.items_count} item${Number(order.items_count) === 1 ? "" : "s"} · ${money(order.estimated_total)}`;

  return { html, text, subject };
}

/* ---------- send one email via Resend ---------- */
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

/* ---------- normalize payload into {dealer, orders[]} ---------- */
function normalize(p) {
  if (Array.isArray(p.orders)) {
    return { dealer: p.dealer || {}, orders: p.orders, submitted_at: p.submitted_at };
  }
  // legacy single flat order
  const dealer = {
    business: p.business, account: p.account, contact: p.contact, email: p.email,
    phone: p.phone, address: p.address, city: p.city, state: p.state, zip: p.zip,
  };
  const order = {
    manufacturer_name: (p.items && p.items[0] && p.items[0].manufacturer) || "Order",
    po: p.po, notes: p.notes, items: p.items || [],
    items_count: p.items_count, items_subtotal: p.estimated_total,
    freight_fee: 0, freight_lines: [], estimated_total: p.estimated_total,
  };
  return { dealer, orders: [order], submitted_at: p.submitted_at };
}

/* ---------- handler ---------- */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { Allow: "POST, OPTIONS" }, body: "" };
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error("RESEND_API_KEY is not set"); return json(500, { ok: false, error: "Email service not configured" }); }

  let raw;
  try { raw = JSON.parse(event.body || "{}"); }
  catch (e) { return json(400, { ok: false, error: "Invalid JSON body" }); }

  /* The single flat payload predates server pricing and carries no line to price against. */
  if (!Array.isArray(raw.orders)) return json(400, { ok: false, status: "reload", error: "This page is out of date — please reload Partner 360 and submit again." });
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return json(401, { ok: false, status: "unauthorized", error: "Please sign in again to submit this order." });

  const { dealer, submitted_at } = normalize(raw);
  let orders = raw.orders;

  if (!dealer.business || !dealer.contact || !dealer.email) {
    return json(400, { ok: false, error: "Missing required dealer fields (business, contact, email)." });
  }
  if (!Array.isArray(orders) || orders.length === 0 || orders.every((o) => !(o.items || []).length)) {
    return json(400, { ok: false, error: "No items to order." });
  }
  for (const o of orders) {
    if (!(o.po || "").trim()) {
      return json(400, { ok: false, error: `Missing PO number for ${o.manufacturer_name || "a manufacturer"}.` });
    }
  }

  /* VALIDATE → PERSIST → NOTIFY. The recorded order is the proof that an order exists; an email
     never is. orders-api re-prices every line for this dealer and records the order with the
     server's numbers. If a price moved since the dealer reviewed the cart, nothing is recorded
     and nothing is emailed — the new prices go back for review. Only orders that were recorded
     are emailed, and the email carries the recorded prices. */
  const api = process.env.ORDERS_API || DEFAULT_ORDERS_API;
  const callApi = (body) => fetch(api, { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(body) });
  const notSubmitted = { ok: false, recorded: false, error: "Your order could not be confirmed, so nothing was submitted. Please try again." };
  let rec;
  try {
    const res = await callApi({ action: "create", orders, dealer });
    rec = await res.json().catch(() => null);
    if (res.status === 409 && rec && rec.status === "prices_changed")
      return json(409, { ok: false, recorded: false, status: "prices_changed", orders: rec.orders || [] });
    if (rec && rec.status === "unauthorized") return json(401, { ok: false, recorded: false, status: "unauthorized", error: "Please sign in again to submit this order." });
    if (!rec || !Array.isArray(rec.orders) || !rec.orders.length || (rec.status !== "recorded" && rec.status !== "partial"))
      return json(503, Object.assign({}, notSubmitted, { status: (rec && rec.status) || "pricing_unavailable" }));
  } catch (err) {
    console.error("orders-api unreachable", err);
    return json(503, Object.assign({}, notSubmitted, { status: "pricing_unavailable" }));
  }
  /* Only what was recorded goes any further. */
  const recordedSlugs = new Set(rec.orders.map((r) => r.manufacturer_slug));
  const notRecorded = orders.filter((o) => !recordedSlugs.has(o.manufacturer_slug)).map((o) => o.manufacturer_slug);
  try { orders = applyServerPrices(orders.filter((o) => recordedSlugs.has(o.manufacturer_slug)), rec.orders); }
  catch (err) {
    console.error("recorded order did not match the submission", err);
    try { await callApi({ action: "notification_failed", order_ids: rec.orders.map((r) => r.order_id) }); } catch (e) {}
    return json(502, { ok: false, recorded: true, status: "email_failed", not_recorded: notRecorded, orders: rec.orders, error: String(err.message || err) });
  }

  const to = (process.env.ORDER_TO || DEFAULT_TO).split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.ORDER_FROM || DEFAULT_FROM;

  /* A failed email never undoes a recorded order: it is retried once, then the order is flagged
     for staff (admin_notes in Orders) and the dealer is told. */
  const results = [];
  for (const order of orders) {
    let r = null, err = null;
    for (let attempt = 0; attempt < 2 && !(r && r.ok); attempt++) {
      try { r = await sendEmail(apiKey, from, to, dealer.email, buildEmail(dealer, order, submitted_at)); err = null; }
      catch (e) { err = e; r = null; }
      if (r && !r.ok) console.error("Resend error", order.manufacturer_name, r.status, r.detail);
      if (err) console.error("send failed", order.manufacturer_name, err);
    }
    results.push({ manufacturer: order.manufacturer_name, po: order.po, order_id: order.order_id, ok: !!(r && r.ok), id: r && r.id });
  }
  const unsent = results.filter((r) => !r.ok).map((r) => r.order_id).filter(Boolean);
  if (unsent.length) { try { await callApi({ action: "notification_failed", order_ids: unsent }); } catch (e) { console.error("could not flag unsent orders", unsent, e); } }

  const allOk = !unsent.length && !notRecorded.length;
  return json(allOk ? 200 : 207, { ok: allOk, recorded: true,
    status: notRecorded.length ? "partial" : (unsent.length ? "email_failed" : "submitted"),
    not_recorded: notRecorded, sent: results.filter((r) => r.ok).length, total: results.length, results, orders: rec.orders });
};

// Exported for local testing.
exports._buildEmail = buildEmail;
exports._normalize = normalize;
exports._applyServerPrices = applyServerPrices;
