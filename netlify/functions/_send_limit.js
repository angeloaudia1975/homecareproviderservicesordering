/* LIMITS ON DOCUMENTS A DEALER EMAILS (C3-07 Stage 4, owner 2026-11-05). Brochures (and, later, quotes) go out from an
   HCPS address, so a signed-in dealer could still be used to send a flood. Each send is recorded in dealer_document_sends
   (recipient DOMAIN + a SHA-256 of the address — never the address) BEFORE it is sent, and refused past:
     10 per dealer per hour · 40 per dealer per 24 hours · 5 to the same recipient per 24 hours.
   A send the provider refused is marked failed and does not count. A store that can't be read refuses the send (fail
   closed); only a database that doesn't have the table yet (before the Stage 4 SQL) lets the send through, as before. */
const crypto = require('crypto');
const LIMITS = { hour: 10, day: 40, recipient: 5 };
const MISSING = s => /42P01|PGRST205|Could not find the table|does not exist/i.test(String(s || ''));

async function reserve({ url, key, dealer_id, kind, to, now }) {
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const t = now || Date.now();
  const to_hash = crypto.createHash('sha256').update(String(to).trim().toLowerCase()).digest('hex');
  const dayAgo = new Date(t - 864e5).toISOString(), hourAgo = new Date(t - 36e5).toISOString();
  let rows;
  try {
    const r = await fetch(`${url}/rest/v1/dealer_document_sends?dealer_id=eq.${encodeURIComponent(dealer_id)}&status=eq.sent&created_at=gte.${encodeURIComponent(dayAgo)}&select=to_hash,created_at&limit=1000`, { headers: H });
    const txt = await r.text();
    if (!r.ok) { if (MISSING(txt)) return { ok: true, untracked: true }; throw new Error(r.status + ' ' + txt.slice(0, 120)); }
    rows = JSON.parse(txt || '[]');
  } catch (e) { console.error('send limit unreadable', e && e.message); return { ok: false, status: 503, error: 'Email is unavailable for a moment — please try again.' }; }
  const inHour = rows.filter(x => x.created_at >= hourAgo).length;
  if (inHour >= LIMITS.hour) return { ok: false, status: 429, error: `You can email up to ${LIMITS.hour} documents an hour — please try again later.` };
  if (rows.length >= LIMITS.day) return { ok: false, status: 429, error: `You've reached today's limit of ${LIMITS.day} emailed documents.` };
  if (rows.filter(x => x.to_hash === to_hash).length >= LIMITS.recipient) return { ok: false, status: 429, error: `This recipient already received ${LIMITS.recipient} documents from you today.` };
  try {
    const r = await fetch(`${url}/rest/v1/dealer_document_sends`, { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, H),
      body: JSON.stringify({ dealer_id, kind, to_domain: String(to).split('@')[1] || '', to_hash, status: 'sent' }) });
    const txt = await r.text();
    if (!r.ok) { if (MISSING(txt)) return { ok: true, untracked: true }; throw new Error(r.status + ' ' + txt.slice(0, 120)); }
    const row = (JSON.parse(txt || '[]') || [])[0] || {};
    return { ok: true, id: row.id };
  } catch (e) { console.error('send not recorded', e && e.message); return { ok: false, status: 503, error: 'Email is unavailable for a moment — please try again.' }; }
}
async function markFailed({ url, key, id }) {
  if (!id) return;
  try { await fetch(`${url}/rest/v1/dealer_document_sends?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'failed' }) }); } catch (e) {}
}
module.exports = { reserve, markFailed, LIMITS };
