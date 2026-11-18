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
function itemsText(items) {
  return (items || []).map((it) => {
    const unit = Number(it.unit);
    const line = Number.isFinite(unit) ? unit * Number(it.qty || 0) : null;
    return `  ${it.qty} x ${it.name} (${it.code}${unitLabel(it) ? ", " + unitLabel(it) : ""})` +
      (Number.isFinite(unit) ? ` @ ${money(unit)} = ${money(line)}` : "");
  }).join("\n");
}

/* ---------- THE HCPS ORDER EMAIL KIT (owner 2026-11-17, second pass after his Outlook review) ----------
   One set of email-safe building blocks for BOTH order emails: the processing email HCPS receives (buildEmail) and the
   dealer's acknowledgment (buildDealerAck — orders-api runs it from its verbatim copy, _hcps_email.js), so both show the
   same order information the same way. Built for Outlook as well as phones: a 640px centred table (an MSO ghost table
   holds the width in Outlook for Windows), layout tables with explicit widths, inline styles, two-column details that
   stack below 620px, one product column (SKU + name + configuration) then Qty / Unit / Line, totals kept together, the
   pending-freight explanation said ONCE, and a "bulletproof" button (VML roundrect in Outlook, a padded link elsewhere).
   The HCPS logo heads every email; the footer is one short line. The data-hcps-email mark tells _email_brand.js the email
   already carries the HCPS design (RULE 22), so frame()/cardFooter() leave it unchanged. */
const EM = { NAVY: "#0f2440", ORANGE: "#ef6325", INK: "#1f2937", MUTED: "#6b7280", LINE: "#e5e7eb", SOFT: "#f8fafc", BG: "#f1f3f6",
  FONT: "Arial,Helvetica,sans-serif", W: 640,
  LOGO: "https://www.homecareproviderservices.org/assets/brand/hcps-email-logo.png", SITE: "https://www.homecareproviderservices.org",
  PHONE: "937-626-5141", EMAIL: "info@homecareproviderservices.us" };
const ORDER_SCREEN = "https://www.homecareproviderservices.org/admin/order-fulfillment.html";
const PORTAL_ORDERS = "https://hcpsonlineordering.netlify.app/";
const emTone = { ok: ["#ecf7f0", "#14532d"], warn: ["#fff7e6", "#8a5a00"], hold: ["#fdecea", "#9b1c1c"], info: ["#eef3fa", "#0f2440"] };
function emButton(url, label) {
  const u = /^https:\/\/[^\s"'<>]+$/i.test(String(url || "")) ? String(url) : ""; if (!u) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(u)}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="14%" strokecolor="${EM.NAVY}" fillcolor="${EM.NAVY}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-- --><a href="${esc(u)}" target="_blank" style="background:${EM.NAVY};border-radius:6px;color:#ffffff;display:inline-block;font-family:${EM.FONT};font-size:15px;font-weight:bold;line-height:44px;text-align:center;text-decoration:none;width:200px;-webkit-text-size-adjust:none;mso-hide:all;">${esc(label)}</a><!--<![endif]-->
</td></tr></table>`;
}
/* label / value blocks, two per row. "Fluid hybrid": each block is an inline-block up to 280px wide, so a narrow window or
   reading pane puts them one under the other with no media query (Outlook on the web and phone apps ignore some); Outlook
   for Windows gets a two-column ghost table instead. Long addresses may break so a pane is never forced wider (a forced
   width makes Outlook on the web shrink the whole email). blocks: [{label, lines:[text…]}] (text, escaped here) */
function emDetails(blocks) {
  const block = (bk) => `<div class="em-col" style="display:inline-block;width:100%;max-width:280px;vertical-align:top;padding:0 0 16px 0;">
      <div style="font-family:${EM.FONT};font-size:11px;line-height:16px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:${EM.MUTED};">${esc(bk.label)}</div>
      <div style="font-family:${EM.FONT};font-size:14px;line-height:21px;color:${EM.INK};word-break:break-word;overflow-wrap:anywhere;">${bk.lines.filter((x) => x != null && x !== "").map((x) => esc(x)).join("<br>") || "—"}</div></div>`;
  const list = (blocks || []).filter(Boolean); let rows = "";
  for (let i = 0; i < list.length; i += 2) {
    rows += `<tr><td style="font-size:0;line-height:0;" valign="top">
<!--[if mso]><table role="presentation" width="584" cellpadding="0" cellspacing="0" border="0"><tr><td width="280" valign="top" style="padding:0 12px 16px 0;"><![endif]-->${block(list[i])}<!--[if mso]></td><td width="292" valign="top" style="padding:0 0 16px 0;"><![endif]-->${list[i + 1] ? block(list[i + 1]) : ""}<!--[if mso]></td></tr></table><![endif]-->
</td></tr>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">${rows}</table>`;
}
/* the product table: one product column (SKU bold, name, configuration), then Qty / Unit / Line */
function emProducts(items) {
  const th = (t, al, w) => `<th align="${al}"${w ? ` width="${w}"` : ""} style="font-family:${EM.FONT};font-size:11px;line-height:16px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:${EM.MUTED};padding:8px 0 8px ${al === "left" ? 0 : 8}px;border-bottom:2px solid ${EM.LINE};text-align:${al};">${t}</th>`;
  const rows = (items || []).map((it) => {
    const unit = Number(it.unit), line = it.line != null ? Number(it.line) : (Number.isFinite(unit) ? unit * Number(it.qty || 0) : null);
    const cfg = [it.brand, unitLabel(it), it.upgrade ? "Option: " + it.upgrade : "", it.config].filter(Boolean).join(" · ");
    const td = (al, inner, extra) => `<td align="${al}" valign="top" style="font-family:${EM.FONT};font-size:14px;line-height:20px;color:${EM.INK};padding:10px 0 10px ${al === "left" ? 0 : 8}px;border-bottom:1px solid ${EM.LINE};text-align:${al};${extra || ""}">${inner}</td>`;
    return `<tr>${td("left", `<div style="font-weight:bold;">${esc(it.code)}</div><div>${esc(it.name)}</div>${cfg ? `<div style="font-size:12px;line-height:17px;color:${EM.MUTED};">${esc(cfg)}</div>` : ""}`)}${td("center", esc(it.qty))}${td("right", Number.isFinite(unit) ? money(unit) : "—", "white-space:nowrap;")}${td("right", line != null && Number.isFinite(line) ? money(line) : "—", "white-space:nowrap;font-weight:bold;")}</tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>${th("Product", "left")}${th("Qty", "center", 36)}${th("Unit", "right")}${th("Line", "right")}</tr>${rows}</table>`;
}
/* totals kept together: [[label, value, strong]] — value text is escaped here */
function emTotals(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td colspan="2" style="height:6px;line-height:6px;font-size:1px;">&nbsp;</td></tr>${rows.map(([l, v, strong]) =>
    `<tr><td align="right" style="font-family:${EM.FONT};font-size:${strong ? 15 : 14}px;line-height:22px;color:${EM.INK};${strong ? "font-weight:bold;border-top:1px solid " + EM.LINE + ";background:" + EM.SOFT + ";" : ""}padding:${strong ? "10px" : "3px"} 0 ${strong ? "10px" : "3px"} 0;">${esc(l)}</td>
      <td align="right" style="font-family:${EM.FONT};font-size:${strong ? 16 : 14}px;line-height:22px;${String(v).length <= 14 ? "white-space:nowrap;" : ""}${strong ? "font-weight:bold;color:" + EM.ORANGE + ";border-top:1px solid " + EM.LINE + ";background:" + EM.SOFT + ";" : "color:" + EM.INK + ";"}padding:${strong ? "10px" : "3px"} ${strong ? "8px" : "0"} ${strong ? "10px" : "3px"} 12px;">${esc(v)}</td></tr>`).join("")}</table>`;
}
/* PROGRESS (owner 2026-11-17 19:10: "clearly distinguish HCPS receipt from manufacturer confirmation"): three steps in one
   row — what HCPS has done, what happens next, and the manufacturer's own confirmation (which comes from the manufacturer,
   never from this email). steps: [{label, sub, state: done|next|wait|hold}] */
function emProgress(steps) {
  const C = { done: ["#14532d", "#ecf7f0", "&#10003;"], next: [EM.NAVY, "#eef3fa", "&#8594;"], wait: [EM.MUTED, "#f8fafc", "&#8226;"], hold: ["#9b1c1c", "#fdecea", "!"] };
  /* fluid hybrid, like the details: three steps side by side where there is room, one under the other on a phone or a narrow
     reading pane (no media query needed); Outlook for Windows gets a three-column ghost table */
  const step = (x, last) => { const c = C[x.state] || C.wait;
    return `<div class="em-col" style="display:inline-block;width:100%;max-width:186px;vertical-align:top;padding:0 ${last ? 0 : 6}px 6px 0;">
      <div style="background:${c[1]};border-top:3px solid ${c[0]};padding:8px 10px;font-family:${EM.FONT};">
      <div style="font-size:12px;line-height:17px;font-weight:bold;color:${c[0]};">${c[2]} ${esc(x.label)}</div>${x.sub ? `<div style="font-size:11px;line-height:15px;color:${EM.MUTED};">${esc(x.sub)}</div>` : ""}</div></div>`; };
  const L = steps || [];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td style="font-size:0;line-height:0;" valign="top">
<!--[if mso]><table role="presentation" width="584" cellpadding="0" cellspacing="0" border="0"><tr><![endif]-->${L.map((x, i) => `<!--[if mso]><td width="${i === L.length - 1 ? 192 : 196}" valign="top"><![endif]-->${step(x, i === L.length - 1)}<!--[if mso]></td><![endif]-->`).join("")}<!--[if mso]></tr></table><![endif]-->
</td></tr></table>`;
}
const emLabel = (t) => `<div style="font-family:${EM.FONT};font-size:11px;line-height:16px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:${EM.MUTED};padding:0 0 4px 0;">${esc(t)}</div>`;
/* the delivery facts said one way in both emails: chosen services, then the freight terms */
function emDelivery(o) {
  const svc = (o.services || []).filter((x) => x && x.selected);
  const offered = (o.services || []).length || o.services_offered;
  const fr = emPending(o) ? "Freight: pending (explained with the totals)" : (o.freight_lines || []).length || Number(o.freight_fee) > 0 ? "Freight: " + freightShort(o).replace(/^FREE$/, "Free") : "Freight: not included";
  return [offered ? (svc.length ? svc.map((x) => `${x.label} — ${money(x.fee)}`).join(" · ") : "No delivery services requested") : "", fr].filter(Boolean);
}
function emNote(text, label) {
  return text ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td style="background:${EM.SOFT};border:1px solid ${EM.LINE};padding:12px 14px;font-family:${EM.FONT};font-size:14px;line-height:21px;color:${EM.INK};">${label ? `<div style="font-size:11px;line-height:16px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:${EM.MUTED};">${esc(label)}</div>` : ""}<div>${esc(text).replace(/\r?\n/g, "<br>")}</div></td></tr></table>` : "";
}
const emSmall = (text) => text ? `<div style="font-family:${EM.FONT};font-size:12px;line-height:18px;color:${EM.MUTED};">${esc(text)}</div>` : "";
/* the whole document. sections: [html…] each in its own padded row */
function emDocument(o) {
  const tone = emTone[o.tone] || emTone.info;
  const row = (inner, pad) => `<tr><td class="em-pad" style="padding:${pad || "0 28px 18px 28px"};">${inner}</td></tr>`;
  return `<!DOCTYPE html><html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no">
<title>${esc(o.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>body{margin:0;padding:0;} table{border-collapse:collapse;} img{border:0;line-height:100%;outline:none;text-decoration:none;}
@media screen and (max-width:620px){ .em-wrap{width:100%!important;} .em-pad{padding-left:16px!important;padding-right:16px!important;} .em-col{display:block!important;width:100%!important;max-width:100%!important;padding-right:0!important;} .em-title{font-size:20px!important;line-height:26px!important;} }
@media print{ .em-noprint{display:none!important;} }</style></head>
<body data-hcps-email="1" style="margin:0;padding:0;background:${EM.BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EM.BG};">${esc(o.preheader || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${EM.BG};"><tr><td align="center" style="padding:24px 8px;">
<!--[if mso]><table role="presentation" width="${EM.W}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="em-wrap" width="${EM.W}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EM.W}px;background:#ffffff;border:1px solid ${EM.LINE};">
${row(`<a href="${EM.SITE}" target="_blank"><img src="${EM.LOGO}" width="170" height="84" alt="HomeCare Provider Services" style="display:block;width:170px;max-width:60%;height:auto;"></a>`, "20px 28px 16px 28px")}
<tr><td class="em-pad" style="background:${EM.NAVY};padding:18px 28px 16px 28px;border-bottom:3px solid ${EM.ORANGE};">
  <div style="font-family:${EM.FONT};font-size:11px;line-height:16px;font-weight:bold;letter-spacing:.8px;text-transform:uppercase;color:#aebbd0;">${esc(o.kicker || "")}</div>
  <div class="em-title" style="font-family:${EM.FONT};font-size:22px;line-height:28px;font-weight:bold;color:#ffffff;">${esc(o.title)}</div>
  ${o.subtitle ? `<div style="font-family:${EM.FONT};font-size:13px;line-height:19px;color:#d4dcea;">${esc(o.subtitle)}</div>` : ""}</td></tr>
${o.status ? `<tr><td class="em-pad" style="background:${tone[0]};padding:12px 28px;font-family:${EM.FONT};font-size:14px;line-height:21px;font-weight:bold;color:${tone[1]};">${esc(o.status)}${o.statusDetail ? `<div style="font-weight:normal;font-size:13px;line-height:19px;">${esc(o.statusDetail)}</div>` : ""}</td></tr>` : ""}
<tr><td style="height:20px;line-height:20px;font-size:1px;">&nbsp;</td></tr>
${(o.sections || []).filter(Boolean).map((x) => row(x)).join("\n")}
${o.button ? `<tr><td class="em-pad em-noprint" style="padding:4px 28px 24px 28px;">${o.button}</td></tr>` : ""}
<tr><td class="em-pad" style="padding:14px 28px;border-top:1px solid ${EM.LINE};font-family:${EM.FONT};font-size:12px;line-height:18px;color:${EM.MUTED};" align="center">HomeCare Provider Services · ${EM.PHONE} · <a href="mailto:${EM.EMAIL}" style="color:${EM.MUTED};text-decoration:underline;">${EM.EMAIL}</a></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
/* order facts shared by both emails */
function emPending(o) {
  const L = o.freight_lines || [];
  return (L.some((r) => r.status === "actual") && !(Number(o.freight_fee) > 0)) || L.some((r) => r.status === "peritem" && r.pending);
}
const emRef = (id) => (id ? String(id).slice(0, 8).toUpperCase() : "—");
const emWhen = (d) => (d ? new Date(d) : new Date()).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT";
const emShipTo = (dealer) => [dealer.ship_to_label, dealer.address, [dealer.city, dealer.state].filter(Boolean).join(", ") + (dealer.zip ? " " + dealer.zip : "")].map((x) => String(x || "").trim()).filter(Boolean);
/* the totals block + the ONE freight explanation: subtotal, each chosen service, freight, then either "Total" or
   "Total excluding pending freight" */
function emMoney(o) {
  const pending = emPending(o), sub = Number(o.items_subtotal != null ? o.items_subtotal : o.subtotal) || 0;
  const svc = (o.services || []).filter((x) => x && x.selected), svcFee = r2(o.services_fee || svc.reduce((t, x) => t + Number(x.fee || 0), 0));
  const fee = Number(o.freight_fee) > 0 ? Number(o.freight_fee) : 0, known = r2(sub + fee + svcFee);
  const n = Number(o.items_count) || (o.items || []).reduce((t, it) => t + Number(it.qty || 0), 0);
  const rows = [[`Merchandise subtotal${n ? ` (${n} item${n === 1 ? "" : "s"})` : ""}`, money(sub)]]
    .concat(svc.map((x) => [x.label, money(x.fee)]))
    .concat((o.freight_lines || []).length || fee ? [["Freight", pending && !fee ? "Pending" : (pending ? money(fee) + " + pending" : freightShort(o).replace(/^FREE$/, "Free"))]] : [])
    .concat([[pending ? "Total excluding pending freight" : (!(o.freight_lines || []).length && !fee ? "Total (freight not included)" : "Total"), money(pending ? known : (o.estimated_total != null ? o.estimated_total : known)), true]]);
  const note = pending ? "Freight is pending: the actual charge comes from the manufacturer's order confirmation, after HCPS places the order." + (o.freight_note ? " " + o.freight_note : "") : "";
  return { rows, note, pending, known, total: pending ? known : Number(o.estimated_total != null ? o.estimated_total : known) };
}

/* ---------- build one manufacturer email (the processing email HCPS receives) ---------- */
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
function buildEmail(dealer, order, submittedAt) {
  const st = orderStatus(order), mny = emMoney(order), ref = emRef(order.order_id), when = emWhen(submittedAt);
  const svc = servicesWords(order), offered = (order.services || []).length || order.services_offered;
  const acctWords = order.manufacturer_account || (order.account_hold && !order.account_unchecked || order.account_notice ? "not on file" : "—");
  const ship = emShipTo(dealer);
  const link = order.order_id ? `${ORDER_SCREEN}?order=${encodeURIComponent(order.order_id)}` : ORDER_SCREEN;
  const html = emDocument({
    title: `New order · ${order.manufacturer_name}`, kicker: "HCPS order processing", subtitle: `${dealer.business || "Dealer"} · PO ${order.po || "—"} · Ref ${ref}`,
    preheader: `${dealer.business || "Dealer"} · ${order.manufacturer_name} · PO ${order.po || "—"} · ${money(mny.total)}${mny.pending ? " + freight" : ""}`,
    tone: st.tone, status: st.text, statusDetail: st.detail,
    sections: [
      emProgress([{ label: order.account_hold ? "Recorded by HCPS" : "Received by HCPS", sub: when, state: "done" },
        order.account_hold ? { label: "Account setup", sub: "Manufacturer account needed first", state: "hold" } : { label: "Place with manufacturer", sub: "HCPS's next step", state: "next" },
        { label: "Manufacturer confirmation", sub: "Comes from the manufacturer once placed", state: "wait" }]),
      emDetails([
        { label: "Dealer", lines: [dealer.business, dealer.account ? "HCPS account " + dealer.account : "", `${order.manufacturer_name} account ${acctWords}`] },
        { label: "Contact", lines: [dealer.contact, dealer.email, dealer.phone] },
        { label: "Order", lines: ["PO " + (order.po || "—"), "HCPS order " + ref, "Submitted " + when].concat(order.placed_by ? [order.placed_by] : []) },
        { label: "Ship to", lines: ship.length ? ship : ["—"] },
        { label: "Delivery", lines: emDelivery(order) },
      ]),
      emLabel("Products") + emProducts((order.items || []).map((it) => Object.assign({}, it))),
      emTotals(mny.rows) + (mny.note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:8px;line-height:8px;font-size:1px;">&nbsp;</td></tr></table>` + emSmall(mny.note) : ""),
      order.notes ? emNote(order.notes, "Order notes") : "",
    ],
    button: emButton(link, "Review order"),
  });

  const text = [
    `HCPS · NEW ORDER · ${order.manufacturer_name}`,
    st.text,
    st.detail,
    "",
    `Dealer   : ${dealer.business || "—"}${dealer.account ? " (HCPS account " + dealer.account + ")" : ""}`,
    `${order.manufacturer_name} account: ${acctWords}`,
    `Contact  : ${[dealer.contact, dealer.email, dealer.phone].filter(Boolean).join(" · ") || "—"}`,
    `PO       : ${order.po || "—"}   HCPS order: ${ref}`,
    `Submitted: ${when}`,
    order.placed_by ? order.placed_by : "",
    `Ship to  : ${ship.join(" · ") || "—"}`,
    offered ? `Delivery services: ${svc || "None requested"}` : "",
    "",
    "ITEMS",
    itemsText(order.items),
    "",
    ...mny.rows.slice(0, -1).filter((r) => r[0] !== "Freight").map((r) => `${r[0]}: ${r[1]}`),
    `Freight: ${freightShort(order)}`,
    mny.pending ? `Total of known charges: ${money(mny.known)} + freight (pending)` : `Total: ${money(mny.total)}`,
    order.notes ? `\nORDER NOTES\n${order.notes}` : "",
    "",
    `Review order: ${link}`,
  ].filter((x, k, a) => !(x === "" && a[k - 1] === "")).join("\n");

  const subject = (order.account_hold ? "[Held — account setup] " : order.account_notice ? "[New account needed] " : "") +
    `New order · ${dealer.business || "Dealer"} · ${order.manufacturer_name} · PO ${order.po || "—"} · ${money(mny.total)}${mny.pending ? " + freight" : ""}`;
  return { html, text, subject };
}

/* ---------- the dealer's acknowledgment (orders-api sends it; built here so both emails share one kit) ----------
   dealer: {business, contact, email, phone, ship_to_label, address, city, state, zip, _onBehalf}
   summaries: the recorded orders [{line, po, order_id, items:[{code,name,qty,unit_price,line_total,unit_label}], subtotal,
     freight_fee, estimated_total, freight_lines, freight_note, services, services_fee, account_notice, account_hold, status_label}]
   opts: {portal, holdLabel, submittedAt} */
function buildDealerAck(dealer, summaries, opts) {
  opts = opts || {}; const S = (summaries || []).filter(Boolean); const portal = /^https:\/\//.test(String(opts.portal || "")) ? String(opts.portal).replace(/\/?$/, "/") : PORTAL_ORDERS;
  const many = S.length > 1, when = emWhen(opts.submittedAt), ship = emShipTo(dealer);
  const held = S.filter((s) => s.account_hold), lines = S.map((s) => s.line);
  const next = held.length
    ? `Pending Manufacturer Account Setup — your order${many ? "s are" : " is"} saved; ${held.length < S.length ? held.map((s) => s.line).join(", ") + " waits for" : "it waits for"} the manufacturer account step below${held.length < S.length ? ", and HCPS reviews the others and places them with the manufacturer" : ""}.`
    : `HCPS will review ${many ? "them" : "it"} and place ${many ? "them" : "it"} with ${lines.join(" and ")}. You'll receive the manufacturer's confirmation once ${many ? "they're" : "it's"} placed.`;
  const blocks = S.map((s) => {
    const items = (s.items || []).map((it) => ({ code: it.code, name: it.name, qty: it.qty, unit: it.unit_price != null ? it.unit_price : it.unit, line: it.line_total, config: it.unit_label || "" }));
    const mny = emMoney(Object.assign({}, s, { items, items_subtotal: s.subtotal }));
    /* the server's own words for this order: a held order says exactly what is needed (open the account, or HCPS checking an
       account it could not read); a new-account notice (not held) says the order is not held for it */
    const notice = s.account_notice ? emNote(s.account_hold ? s.account_notice : `${s.account_notice} — HCPS will help you open this manufacturer account. Your order is recorded and is not held for it.`) : "";
    return { s, mny, html:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td style="font-family:${EM.FONT};font-size:16px;line-height:22px;font-weight:bold;color:${EM.NAVY};padding:0 0 8px 0;">${esc(s.line)} <span style="font-weight:normal;color:${EM.MUTED};font-size:14px;">· PO ${esc(s.po || "—")} · Ref ${esc(emRef(s.order_id))}</span></td></tr></table>`
      + (notice ? notice + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:10px;line-height:10px;font-size:1px;">&nbsp;</td></tr></table>` : "")
      + emProducts(items) + emTotals(mny.rows) + (mny.note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:8px;line-height:8px;font-size:1px;">&nbsp;</td></tr></table>` + emSmall(mny.note) : "") };
  });
  const first = S.find((s) => s.order_id && !/^PREVIEW-/.test(String(s.order_id)));
  /* one order: open that order; several: My Orders (each order is listed there with its PO) */
  const link = first && !many ? `${portal}?order=${encodeURIComponent(first.order_id)}` : `${portal}?order=orders`;
  const head = held.length === S.length ? "We've received your order — waiting for your account" : `We've received your order${many ? "s" : ""}`;
  const html = emDocument({
    title: head, kicker: "Order received", subtitle: dealer.business || "",
    preheader: S.map((s) => `${s.line} · PO ${s.po || "—"}`).join(" · "),
    tone: held.length ? "warn" : "info", status: next, statusDetail: dealer._onBehalf || "",
    sections: [
      emProgress([{ label: held.length ? "Saved by HCPS" : "Received by HCPS", sub: when, state: "done" },
        held.length === S.length ? { label: "Account setup", sub: "Manufacturer account first", state: "hold" }
          : held.length ? { label: "HCPS places your orders", sub: "Some wait for a manufacturer account", state: "hold" } : { label: "HCPS places your order", sub: "With the manufacturer", state: "next" },
        { label: "Manufacturer confirmation", sub: "Sent to you once placed", state: "wait" }]),
      emDetails([
        { label: many ? "Orders" : "Order", lines: S.map((s) => `${many ? s.line + " · " : ""}PO ${s.po || "—"} · Ref ${emRef(s.order_id)}`).concat(["Submitted " + when]) },
        { label: "Account", lines: [dealer.business, dealer.contact, dealer.email] },
        { label: "Ship to", lines: ship.length ? ship : ["—"] },
        { label: "Delivery", lines: many ? S.map((s) => s.line + ": " + emDelivery(s).join(" · ")) : emDelivery(S[0] || {}) },
      ]),
    ].concat(blocks.map((b) => b.html)),
    button: emButton(link, many ? "View orders" : "View order"),
  });
  const text = [
    head, "", next, dealer._onBehalf || "", "",
    `Submitted: ${when}`, `Ship to  : ${ship.join(" · ") || "—"}`, "",
  ].concat(blocks.map(({ s, mny }) => [
    `${s.line} — PO ${s.po || "—"} · Ref ${emRef(s.order_id)}`,
    s.account_notice ? (s.account_hold ? `  ${s.account_notice}` : `  ${s.account_notice} — HCPS will help you open this manufacturer account. Your order is recorded and is not held for it.`) : "",
    ...(s.items || []).map((it) => `  ${Number(it.qty)} x ${it.name || it.code || "Item"}${it.unit_label ? " (" + it.unit_label + ")" : ""} @ ${money(it.unit_price != null ? it.unit_price : it.unit)} = ${money(it.line_total)}`),
    ...mny.rows.map((r) => `  ${r[0]}: ${r[1]}`),
    mny.note ? "  " + mny.note : "",
    "",
  ].filter((x) => x !== "").join("\n"))).concat([`View ${many ? "your orders" : "your order"}: ${link}`]).filter((x, k, a) => !(x === "" && a[k - 1] === "")).join("\n");
  const subject = `We've received your order${many ? "s" : ""} — ` + S.map((s) => `${s.line} · PO ${s.po || "—"}`).join("; ");
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
exports._buildDealerAck = buildDealerAck;
exports._normalize = normalize;
exports._applyServerPrices = applyServerPrices;
exports._recipients = recipients;
