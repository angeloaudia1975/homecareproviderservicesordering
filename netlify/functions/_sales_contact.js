/* Sales contacts (owner 2026-11-18) — one validator for a salesperson's name / title / email / phone, used by the dealer's
   saved list (dealer-tools-api) and by a brochure's one-time contact (ordering brochure.js keeps an identical copy). Plain
   text only: no markup, no line breaks, sensible lengths. */
'use strict';
const MAX = 25;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const PHONE_RE = /^[0-9+().\-\s x#ext]{7,30}$/i;
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function validate(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'Enter the sales contact.' };
  const name = txt(c.name, 120), title = txt(c.title, 80), email = txt(c.email, 200), phone = txt(c.phone, 30);
  if (!name) return { error: 'Enter the salesperson\'s name.' };
  if (email && !EMAIL_RE.test(email)) return { error: 'Enter a valid email address for the sales contact.' };
  if (phone && !PHONE_RE.test(phone)) return { error: 'Enter a valid phone number for the sales contact.' };
  if (!email && !phone) return { error: 'Enter an email or a phone number for the sales contact.' };
  return { contact: { name, title: title || null, email: email || null, phone: phone || null } };
}
module.exports = { validate, MAX, EMAIL_RE };
