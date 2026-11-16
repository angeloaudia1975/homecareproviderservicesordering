/* ONE HCPS EMAIL DESIGN (RULE 22, Angelo 2026-11-15) — every email Dealer 360 / Connect 360 / the ordering portal sends.
   • layout({...})     a complete branded email: navy header, white body, optional orange button, HCPS logo + contact footer.
   • frame(html, o)    an existing email body or document put into the same design (used where a sender already builds its own
                       inner content: order, quote, report, digest emails). Idempotent: an email that already carries the
                       design is returned unchanged.
   • signature(html)   a person-written email (rep follow-up, AI draft, campaign) keeps its text; the HCPS logo + contact
                       footer is added at the bottom like a signature. Idempotent.
   • cardFooter(html)  an email that already has the HCPS header card gets the logo footer inside the card.
   • textFooter        the plain-text footer for the text part.
   The logo is served from the HCPS website (src/assets/brand/hcps-email-logo.png); email clients need an absolute https URL.
   The ordering portal keeps a VERBATIM copy (homecareproviderservicesordering netlify/functions/_email_brand.js) — a test
   fails if the two differ. Never hand-make an email template again: a new email that skips this module is a defect. */
const LOGO_URL = "https://www.homecareproviderservices.org/assets/brand/hcps-email-logo.png";
const SITE_URL = "https://www.homecareproviderservices.org";
const PHONE = "937-626-5141", TOLL_FREE = "888-626-3140", FAX = "888-330-8630";   // owner 2026-11-15 (never 855-400-0345: that is CardChamp's)
const EMAIL = "info@homecareproviderservices.us";
const NAVY = "#0f2440", ORANGE = "#ef6325";
const MARK = "data-hcps-email=\"1\"";
const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u) : null);

function footerHtml() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ${MARK} style="border-top:1px solid #eef0f3;background:#ffffff">
  <tr><td align="center" style="padding:20px 26px 6px"><a href="${SITE_URL}" target="_blank" style="text-decoration:none"><img src="${LOGO_URL}" width="200" alt="HomeCare Provider Services — A Solutions Company" style="display:block;width:200px;max-width:70%;height:auto;border:0"></a></td></tr>
  <tr><td align="center" style="padding:6px 26px 18px;font:12px/1.6 ${FONT};color:#8a94a6">HomeCare Provider Services · A Solutions Company<br>Toll-free ${esc(TOLL_FREE)} · Phone ${esc(PHONE)} · Fax ${esc(FAX)}<br><a href="mailto:${EMAIL}" style="color:#8a94a6;text-decoration:underline">${EMAIL}</a> · <a href="${SITE_URL}" style="color:#8a94a6;text-decoration:underline">homecareproviderservices.org</a></td></tr></table>`;
}
const textFooter = `\n\n—\nHomeCare Provider Services · A Solutions Company\nToll-free ${TOLL_FREE} · Phone ${PHONE} · Fax ${FAX}\n${EMAIL} · ${SITE_URL.replace(/^https:\/\//, "")}`;

function shell(inner, o) {
  o = o || {};
  const pre = o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>` : "";
  const sub = o.subtitle ? `<div style="color:#9fb0c4;font-size:12px;margin-top:2px">${esc(o.subtitle)}</div>` : "";
  const width = Number(o.width) >= 520 && Number(o.width) <= 760 ? Number(o.width) : 600;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body ${MARK} style="margin:0;background:#f4f5f7;padding:24px 12px;font-family:${FONT};color:#141414">${pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:${width}px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e8ec">
      <tr><td style="background:${NAVY};border-bottom:3px solid ${ORANGE};padding:20px 26px">
        <div style="color:#fff;font-size:17px;font-weight:800;letter-spacing:.2px">HomeCare Provider Services</div>${sub}</td></tr>
      <tr><td style="padding:24px 26px;font-size:14.5px;line-height:1.55;color:#3c4450">${inner}</td></tr>
      <tr><td style="padding:0">${footerHtml()}</td></tr>
    </table></td></tr></table></body></html>`;
}
function button(b) {
  const u = b && safeUrl(b.url); if (!u) return "";
  return `<p style="margin:4px 0 20px"><a href="${esc(u)}" target="_blank" style="display:inline-block;background:${ORANGE};color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:700;font-size:15px">${esc(b.label || "Open")}</a></p>`;
}
/* A complete email. heading / paragraphs / footnote are TEXT (escaped); bodyHtml is trusted HTML the caller built and escaped. */
function layout(o) {
  o = o || {};
  const h = o.heading ? `<div style="font-size:19px;font-weight:800;color:#141414;margin:0 0 12px">${esc(o.heading)}</div>` : "";
  const ps = (o.paragraphs || []).map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join("");
  const plain = o.button && safeUrl(o.button.url) ? `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#98a1ad;word-break:break-all">If the button doesn't work, copy this address into your browser:<br>${esc(o.button.url)}</p>` : "";
  const note = o.footnote ? `<p style="margin:0 0 14px;font-size:13px;color:#6b7580">${esc(o.footnote)}</p>` : "";
  return shell(h + ps + (o.bodyHtml || "") + button(o.button) + note + plain, o);
}
/* An email a sender already built: its inner content goes into the standard design. A full document is reduced to its
   <body> content; an email that already carries the design comes back unchanged. */
function frame(html, o) {
  const s = String(html || "");
  if (s.includes(MARK)) return s;
  const m = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return shell(m ? m[1] : s, o);
}
/* A person-written email keeps its text exactly; the HCPS footer is added below it. */
function signature(html) {
  const s = String(html || "");
  if (s.includes(MARK)) return s;
  const block = `<div style="margin-top:24px;max-width:600px">${footerHtml()}</div>`;
  return /<\/body>/i.test(s) ? s.replace(/<\/body>/i, block + "</body>") : s + block;
}
/* An email that already has the HCPS header card (order / sample-request emails): the logo footer goes inside its card, as
   the card's last row. Falls back to signature() when the card cannot be found. Idempotent. */
function cardFooter(html) {
  const s = String(html || "");
  if (s.includes(MARK)) return s;
  const i = s.lastIndexOf("</div></body>");
  return i < 0 ? signature(s) : s.slice(0, i) + footerHtml() + s.slice(i);
}
module.exports = { layout, frame, signature, cardFooter, footerHtml, textFooter, LOGO_URL, PHONE, TOLL_FREE, FAX, EMAIL, MARK, esc };
