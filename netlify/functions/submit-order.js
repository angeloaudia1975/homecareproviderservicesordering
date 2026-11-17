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

const B = require("./_email_brand.js");   // RULE 22: one HCPS email design (verbatim copy of the admin repo module)
const DEFAULT_TO = "orders@homecareproviderservices.us";
/* Every HCPS dealer order reaches the owner's intake mailbox (owner, 2026-10-27), whatever ORDER_TO adds.
   Orders are NEVER sent to a manufacturer: HCPS reviews each one and places it with the manufacturer itself. */
const OWNER_INTAKE = "angelo@homecareproviderservices.us";
function recipients(envTo) {
  const list = String(envTo || DEFAULT_TO).split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.some((a) => a.toLowerCase() === OWNER_INTAKE)) list.push(OWNER_INTAKE);
  return [...new Map(list.map((a) => [a.toLowerCase(), a])).values()];
}
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
    /* One part number can be on an order twice (plain and with a railing upgrade, or in two ramp families):
       a recorded line is matched by code + family + upgrade, never by code alone. */
    const keyOf = (it) => [String(it.code), it.family == null ? "" : String(it.family), it.upgrade == null ? "" : String(it.upgrade)].join("::");
    const units = {};
    (rec.items || []).forEach((it) => { (units[keyOf(it)] = units[keyOf(it)] || []).push(it); });
    const items = (o.items || []).map((it) => {
      const r = (units[keyOf(it)] || []).shift();
      if (!r) throw new Error("recorded order is missing " + it.code);
      return Object.assign({}, it, { qty: r.qty, unit: r.unit, name: r.name || it.name });
    });
    const sub = r2(rec.subtotal);
    /* Freight is the server's too when it worked it out (2026-10-09): the HCPS email carries the
       freight stored on the order, never a figure the browser sent. */
    const serverFreight = rec.freight_fee != null && Number.isFinite(Number(rec.freight_fee));
    const fee = serverFreight ? r2(rec.freight_fee) : (Number(o.freight_fee) > 0 ? Number(o.freight_fee) : 0);
    const extra = serverFreight ? { freight_fee: fee, freight_lines: rec.freight_lines || o.freight_lines || [] } : {};
    const notice = rec.account_notice ? { account_notice: String(rec.account_notice) } : {};
    if (rec.account_hold === true) notice.account_hold = true;   // owner 2026-11-06: held — Pending Manufacturer Account Setup
    if (rec.account_unchecked === true) notice.account_unchecked = true;   // the account could not be read: held all the same (fail closed)
    /* delivery services (Dalton liftgate) and the dealer's manufacturer account number come from the recorded order */
    const svc = Array.isArray(rec.services) ? { services: rec.services.filter((x) => x && x.selected), services_fee: r2(rec.services_fee || 0), services_offered: rec.services.length > 0 } : { services: [], services_fee: 0 };
    if (rec.manufacturer_account) svc.manufacturer_account = String(rec.manufacturer_account);
    if (rec.status) svc.status = String(rec.status);
    return Object.assign({}, o, extra, notice, svc, { items, items_subtotal: sub, estimated_total: r2(sub + fee + svc.services_fee), order_id: rec.order_id });
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
  /* A manufacturer's own words travel on the freight row (freeLabel/flatLabel, 2026-10-10 Bemis). */
  const flat = lines.find((r) => r.status === "flat" && r.flatLabel), free = lines.find((r) => r.status === "free" && r.freeLabel);
  /* Per-item delivery (Corsicana): the listed charges, "included", or PENDING for a TBD item — never "FREE". */
  const per = lines.find((r) => r.status === "peritem");
  if (per) return (Number(o.freight_fee) > 0 ? money(o.freight_fee) + " " + per.label : (per.pending ? "" : "included (" + per.label + ")")) + (per.pending ? (Number(o.freight_fee) > 0 ? " + " : "") + "pending (actual from the manufacturer's confirmation)" : "");
  if (Number(o.freight_fee) > 0) return money(o.freight_fee) + " " + (flat ? flat.flatLabel : "flat");
  if (lines.some((r) => r.status === "actual")) return "PENDING — actual freight from the manufacturer's confirmation, after HCPS places the order";
  if (lines.length) return free ? free.freeLabel : "FREE";
  return "—";
}
/* ---------- item rows ---------- */
/* The unit the quantity counts (agreed 2026-10-09): "4-pack (4 each)" for a pack SKU, so
   "1 x A1005" can never be read as one cane holder. */
function unitLabel(it) {
  const n = Number(it && it.case_qty);
  const u = String((it && it.uom) || "").trim();
  if (n > 1) return `${u || n + "-pack"} (${n} each)`;
  return u;
}
function itemsHtml(items) {
  return (items || []).map((it) => {
    const unit = Number(it.unit);
    const line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null;
    const codeUom = esc(it.code) + (unitLabel(it) ? ` · ${esc(unitLabel(it))}` : "");
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
    return `  ${it.qty} x ${it.name} (${it.code}${unitLabel(it) ? ", " + unitLabel(it) : ""})` +
      (Number.isFinite(unit) ? ` @ ${money(unit)} = ${money(line)}` : "");
  }).join("\n");
}

/* ---------- build one manufacturer email ---------- */
/* THE STANDARD HCPS ORDER EMAIL (owner 2026-11-17; design reference: Golden's order email). One layout for every
   manufacturer and for dealer checkout and Manage Dealer alike: compact header, ONE status message, dealer + manufacturer
   account, contact, PO and order reference, submitted, ship-to, delivery services, a product table (SKU, description /
   configuration, qty, unit, line), totals that keep the merchandise subtotal apart from the total of known charges and say
   when freight is pending, the dealer's notes, and one link to the order screen for the processing detail. Phone-width
   friendly (stacked blocks, 600px max) and prints cleanly. The text part keeps "N x Item (CODE, unit)" lines and a
   "Freight:" line (Manufacturer Center's mc_verify reads them). Recipients are unchanged (routing is the handler's). */
const ORDER_SCREEN = "https://www.homecareproviderservices.org/admin/order-fulfillment.html";
function orderStatus(order) {
  const m = order.manufacturer_name || "the manufacturer";
  /* a held order's server notice is written for the dealer, so HCPS gets its own words; a new-account notice (no hold) is
     HCPS's own text from orders-api and is shown under the status */
  const detail = !order.account_hold && order.account_notice ? String(order.account_notice) : "";
  if (order.account_hold) return { tone: "hold", detail, text: order.account_unchecked
    ? `Pending manufacturer account setup — the dealer's ${m} account could not be checked when this order came in. Confirm it on Dealer 360 before placing this order.`
    : `Pending manufacturer account setup — do not place this order until the dealer's ${m} account is open.` };
  if (order.account_notice) return { tone: "warn", detail, text: `New ${m} account needed — received, not blocked. Open the account before placing this order.` };
  return { tone: "ok", detail: "", text: `Received by HCPS — ready to place with ${m}. Nothing has been sent to the manufacturer.` };
}
function servicesWords(order) {
  const L = (order.services || []).filter((x) => x && x.selected);
  return L.length ? L.map((x) => `${x.label} — ${money(x.fee)}`).join(" · ") : "";
}
function configLine(it) {
  const bits = [];
  if (it.brand) bits.push(it.brand);
  if (unitLabel(it)) bits.push(unitLabel(it));
  if (it.upgrade) bits.push("Option: " + it.upgrade);
  return bits.join(" · ");
}
function buildEmail(dealer, order, submittedAt) {
  const submitted = submittedAt ? new Date(submittedAt) : new Date();
  const submittedStr = submitted.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT";
  const shipParts = [dealer.ship_to_label, dealer.address, [dealer.city, dealer.state].filter(Boolean).join(", "), dealer.zip].map((x) => (x || "").trim()).filter(Boolean);
  const shipping = shipParts.length ? shipParts.join(" · ") : "—";
  const st = orderStatus(order);
  const tone = { ok: ["#e8f4ec", "#b9dcc4", "#14532d"], warn: ["#fff7e6", "#f1d9a6", "#8a5a00"], hold: ["#fdecea", "#f3b8b0", "#9b1c1c"] }[st.tone];
  /* freight not yet known: an "actual freight" line with no figure, or a per-item (Corsicana) charge still to be quoted */
  const pending = ((order.freight_lines || []).some((r) => r.status === "actual") && !(Number(order.freight_fee) > 0))
    || (order.freight_lines || []).some((r) => r.status === "peritem" && r.pending);
  const svcFee = r2(order.services_fee || 0);
  const known = r2(Number(order.items_subtotal || 0) + (Number(order.freight_fee) > 0 ? Number(order.freight_fee) : 0) + svcFee);
  const svc = servicesWords(order);
  /* "not on file" only when HCPS knows it is missing (a hold / new-account notice); otherwise a dash — never a guess */
  const acctWords = order.manufacturer_account || (order.account_hold && !order.account_unchecked || order.account_notice ? "not on file" : "—");
  const ref = order.order_id ? String(order.order_id).slice(0, 8).toUpperCase() : "—";
  const link = order.order_id ? `${ORDER_SCREEN}?order=${encodeURIComponent(order.order_id)}` : ORDER_SCREEN;
  const nItems = Number(order.items_count) || (order.items || []).reduce((n, it) => n + Number(it.qty || 0), 0);

  const L = "font:600 11px Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin:0 0 2px";
  const V = "font:400 13px/1.45 Arial,sans-serif;color:#10263f";
  const block = (label, lines) => `<div style="display:inline-block;vertical-align:top;width:100%;max-width:270px;margin:0 0 12px;padding-right:12px;box-sizing:border-box">
      <div style="${L}">${esc(label)}</div><div style="${V}">${lines.filter((x) => x != null && x !== "").map((x) => esc(x)).join("<br>") || "—"}</div></div>`;
  const TD = "padding:9px 8px;border-bottom:1px solid #eceae6;font:400 13px Arial,sans-serif;color:#10263f;vertical-align:top";
  const rows = (order.items || []).map((it) => {
    const unit = Number(it.unit), line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null, cfg = configLine(it);
    return `<tr><td style="${TD};white-space:nowrap;font-weight:700">${esc(it.code)}</td>
      <td style="${TD}">${esc(it.name)}${cfg ? `<div style="font-size:11.5px;color:#6b7280;margin-top:2px">${esc(cfg)}</div>` : ""}</td>
      <td style="${TD};text-align:center">${esc(it.qty)}</td>
      <td style="${TD};text-align:right;white-space:nowrap">${Number.isFinite(unit) ? money(unit) : "—"}</td>
      <td style="${TD};text-align:right;white-space:nowrap;font-weight:700">${line != null ? money(line) : "—"}</td></tr>`;
  }).join("");
  const tr = (label, val, strong) => `<tr><td style="padding:3px 8px;text-align:right;font:${strong ? "800 14px" : "400 13px"} Arial,sans-serif;color:#10263f">${label}</td><td style="padding:3px 8px;text-align:right;min-width:88px;max-width:210px;font:${strong ? "800 15px" : "600 13px"} Arial,sans-serif;color:${strong ? "#ef6325" : "#10263f"}">${val}</td></tr>`;
  const totals = tr(`Merchandise subtotal (${nItems} item${nItems === 1 ? "" : "s"})`, money(order.items_subtotal))
    + (order.services || []).filter((x) => x && x.selected).map((x) => tr(esc(x.label), money(x.fee))).join("")
    + tr("Freight", esc(pending && !(Number(order.freight_fee) > 0) ? "Pending" : freightShort(order)))
    + tr(pending ? "Total of known charges (freight pending)" : "Total", money(pending ? known : order.estimated_total), true);

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media print{.noprint{display:none!important}}</style></head>
<body style="margin:0;background:#f4f5f3;padding:16px 8px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e6e2dc;border-radius:10px;overflow:hidden;">
    <div style="background:#10263f;border-bottom:3px solid #ef6325;padding:12px 18px;">
      <div style="font:800 15px Arial,sans-serif;color:#fff">HCPS · New order · ${esc(order.manufacturer_name)}</div>
      <div style="font:400 12px Arial,sans-serif;color:#c9d4e2;margin-top:2px">${esc(dealer.business || "Dealer")} · PO ${esc(order.po || "—")} · Ref ${esc(ref)}</div>
    </div>
    <div style="background:${tone[0]};border-bottom:1px solid ${tone[1]};padding:10px 18px;font:700 13px Arial,sans-serif;color:${tone[2]}">${esc(st.text)}${st.detail ? `<div style="font:400 12px/1.45 Arial,sans-serif;margin-top:3px">${esc(st.detail)}</div>` : ""}</div>
    <div style="padding:16px 18px 6px;">
      ${block("Dealer", [dealer.business, dealer.account ? "HCPS account " + dealer.account : "", order.manufacturer_name + " account " + (acctWords)])}
      ${block("Contact", [dealer.contact, dealer.email, dealer.phone])}
      ${block("Order", ["PO " + (order.po || "—"), "HCPS order " + ref, "Submitted " + submittedStr].concat(order.placed_by ? [order.placed_by] : []))}
      ${block("Ship to", [shipping])}
      ${(order.services || []).length || order.services_offered ? block("Delivery services", [svc || "None requested"]) : ""}
    </div>
    <div style="padding:0 10px 4px;">
      <table role="presentation" style="border-collapse:collapse;width:100%">
        <thead><tr>${["SKU", "Description", "Qty", "Unit", "Line"].map((h, k) => `<th style="padding:6px 8px;text-align:${k < 2 ? "left" : k === 2 ? "center" : "right"};font:700 10.5px Arial,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#6b7280;border-bottom:2px solid #e6e2dc">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody></table>
      <table role="presentation" style="border-collapse:collapse;width:100%;margin-top:6px">${totals}</table>
      ${pending ? `<div style="font:400 11.5px/1.45 Arial,sans-serif;color:#6b7280;text-align:right;padding:2px 8px 0">Freight pending: the actual charge comes from the manufacturer's confirmation, after HCPS places the order.${order.freight_note ? " " + esc(order.freight_note) : ""}</div>` : ""}
    </div>
    ${order.notes ? `<div style="margin:12px 18px 0;padding:10px 12px;background:#f6f7f5;border:1px solid #e6e2dc;border-radius:8px"><div style="${L}">Order notes</div><div style="${V};white-space:pre-wrap">${esc(order.notes)}</div></div>` : ""}
    <div class="noprint" style="padding:16px 18px 18px"><a href="${esc(link)}" style="display:inline-block;background:#10263f;color:#fff;text-decoration:none;font:700 13px Arial,sans-serif;padding:11px 16px;border-radius:8px">Open this order in Order Review &amp; Fulfillment</a></div>
  </div></body></html>`;

  const text = [
    `HCPS · NEW ORDER · ${order.manufacturer_name}`,
    st.text,
    st.detail,
    "",
    `Dealer   : ${dealer.business || "—"}${dealer.account ? " (HCPS account " + dealer.account + ")" : ""}`,
    `${order.manufacturer_name} account: ${acctWords}`,
    `Contact  : ${[dealer.contact, dealer.email, dealer.phone].filter(Boolean).join(" · ") || "—"}`,
    `PO       : ${order.po || "—"}   HCPS order: ${ref}`,
    `Submitted: ${submittedStr}`,
    order.placed_by ? order.placed_by : "",
    `Ship to  : ${shipping}`,
    (order.services || []).length || order.services_offered ? `Delivery services: ${svc || "None requested"}` : "",
    "",
    "ITEMS",
    itemsText(order.items),
    "",
    `Merchandise subtotal (${nItems} item${nItems === 1 ? "" : "s"}): ${money(order.items_subtotal)}`,
    ...(order.services || []).filter((x) => x && x.selected).map((x) => `${x.label}: ${money(x.fee)}`),
    `Freight: ${freightShort(order)}`,
    pending ? `Total of known charges: ${money(known)} + freight (pending)` : `Total: ${money(order.estimated_total)}`,
    order.notes ? `\nORDER NOTES\n${order.notes}` : "",
    "",
    `Open the order: ${link}`,
  ].filter((x, k, a) => !(x === "" && a[k - 1] === "")).join("\n");

  const subject = (order.account_hold ? "[Held — account setup] " : order.account_notice ? "[New account needed] " : "") +
    `New order · ${dealer.business || "Dealer"} · ${order.manufacturer_name} · PO ${order.po || "—"} · ${money(pending ? known : order.estimated_total)}${pending ? " + freight" : ""}`;
  return { html, text, subject };
}

/* ---------- send one email via Resend ---------- */
async function sendEmail(apiKey, from, to, replyTo, built) {
  const payload = { from, to, subject: built.subject, html: B.cardFooter(built.html), text: built.text + B.textFooter };
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
  if (!Array.isArray(raw.orders)) return json(400, { ok: false, status: "reload", error: "This page is out of date — please reload the 360 Dealer Portal and submit again." });
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
    /* The checkout's submission key (C3-06): a retry of the same checkout is never recorded twice. */
    const key = typeof raw.submission_key === "string" && /^[A-Za-z0-9-]{16,64}$/.test(raw.submission_key) ? raw.submission_key : undefined;
    /* Manage Dealer (owner 2026-11-13): an HCPS staff session sends its explicit final confirmation; orders-api checks it */
    const onBehalf = /^Bearer\s+manage:/i.test(auth) && raw.on_behalf && typeof raw.on_behalf === "object"
      ? { confirm: raw.on_behalf.confirm === true, location_id: String(raw.on_behalf.location_id || "").slice(0, 40) } : undefined;
    const res = await callApi(Object.assign({ action: "create", orders, dealer }, key ? { submission_key: key } : {}, onBehalf ? { on_behalf: onBehalf } : {}));
    rec = await res.json().catch(() => null);
    if (res.status === 409 && rec && rec.status === "prices_changed")
      return json(409, { ok: false, recorded: false, status: "prices_changed", orders: rec.orders || [] });
    if (res.status === 428 && rec && rec.status === "confirm_required") return json(428, { ok: false, recorded: false, status: "confirm_required", error: rec.error });
    /* a delivery service the order must answer (Dalton liftgate with a bed) was not answered: nothing recorded */
    if (res.status === 400 && rec && rec.status === "services_choice_required") return json(400, { ok: false, recorded: false, status: "services_choice_required", error: rec.error, orders: rec.orders || [] });
    if (rec && rec.status === "unauthorized") return json(401, { ok: false, recorded: false, status: "unauthorized", error: "Please sign in again to submit this order." });
    /* Every order of this checkout was already recorded (a retry after a timeout, a second tab): nothing is recorded
       or emailed again. orders-api has noted the resubmission on the order so staff check the HCPS email arrived. */
    if (res.ok && rec && Array.isArray(rec.already_recorded) && rec.already_recorded.length
        && (!Array.isArray(rec.orders) || !rec.orders.length) && (rec.status === "recorded" || rec.status === "partial")) {
      const done = new Set(rec.already_recorded.map((r) => r.manufacturer_slug));
      const missing = orders.filter((o) => !done.has(o.manufacturer_slug)).map((o) => o.manufacturer_slug);
      return json(missing.length ? 207 : 200, { ok: !missing.length, recorded: true, status: missing.length ? "partial" : "already_recorded", duplicate: true,
        not_recorded: missing, sent: 0, total: 0, results: [], orders: rec.already_recorded, already_recorded: rec.already_recorded });
    }
    if (!rec || !Array.isArray(rec.orders) || !rec.orders.length || (rec.status !== "recorded" && rec.status !== "partial"))
      return json(503, Object.assign({}, notSubmitted, { status: (rec && rec.status) || "pricing_unavailable" }));
  } catch (err) {
    console.error("orders-api unreachable", err);
    return json(503, Object.assign({}, notSubmitted, { status: "pricing_unavailable" }));
  }
  /* Only what was recorded goes any further. */
  const recordedSlugs = new Set(rec.orders.map((r) => r.manufacturer_slug));
  /* Orders of this checkout recorded on an earlier try: not recorded again, not emailed again. */
  const already = Array.isArray(rec.already_recorded) ? rec.already_recorded : [];
  const alreadySlugs = new Set(already.map((r) => r.manufacturer_slug));
  const notRecorded = orders.filter((o) => !recordedSlugs.has(o.manufacturer_slug) && !alreadySlugs.has(o.manufacturer_slug)).map((o) => o.manufacturer_slug);
  try { orders = applyServerPrices(orders.filter((o) => recordedSlugs.has(o.manufacturer_slug)), rec.orders); }
  catch (err) {
    console.error("recorded order did not match the submission", err);
    try { await callApi({ action: "notification_failed", order_ids: rec.orders.map((r) => r.order_id) }); } catch (e) {}
    return json(502, { ok: false, recorded: true, status: "email_failed", not_recorded: notRecorded, orders: rec.orders, error: String(err.message || err) });
  }

  /* Placed by HCPS on a dealer's behalf: the HCPS order email says so first (the sentence comes from orders-api) */
  if (rec.placed_by_hcps) orders = orders.map((o) => Object.assign({}, o, { placed_by: String(rec.placed_by_hcps).slice(0, 300) }));

  /* Staff routing (owner 2026-11-13, switch opening_orders_v2 on the order server): Lori and the dealer's own rep are added
     to the HCPS order email. Only HCPS addresses are ever accepted from that answer. */
  const extra = Array.isArray(rec.notify_to) ? rec.notify_to.map((a) => String(a || "").trim()).filter((a) => /^[A-Za-z0-9._%+-]+@homecareproviderservices\.us$/i.test(a)).slice(0, 5) : [];
  const to = recipients([process.env.ORDER_TO || DEFAULT_TO].concat(extra).join(","));
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
    not_recorded: notRecorded, sent: results.filter((r) => r.ok).length, total: results.length, results, orders: rec.orders,
    ...(already.length ? { already_recorded: already } : {}) });
};

// Exported for local testing.
exports._buildEmail = buildEmail;
exports._normalize = normalize;
exports._applyServerPrices = applyServerPrices;
exports._recipients = recipients;
