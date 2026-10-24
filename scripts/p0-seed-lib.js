/* P0 (2026-10-23, issue #2; review fixes) — pure planning for catalog_file_commercial records.
   No I/O, no prices printed: the CLI (scripts/p0-seed-catalog-commercial.js) reads and writes; this
   module decides what a record must hold, and refuses when it cannot be sure.

   A RECORD belongs to exactly one version of a line's PUBLIC catalog file:
     { manufacturer, identity_sha256 = catalogIdentity(public file), rows: [{k, h, order, f}], row_count,
       rows_sha256 = sha256(JSON of rows), public_sha256 = sha256(JSON of the public file), source_ref }

   planInitial — the first seed: the priced file from git history, split; the public half must equal the
                 file in the working tree EXACTLY (after the recorded scrubs) and restore must give back the
                 original byte for byte.
   planReseed  — a later edit of a public file (a legacy static catalog update): the next version's record
                 is built from the version(s) already stored. Each new row takes the commercial fields of the
                 stored entry with the SAME fingerprint (same public content, wherever it moved — so a reorder
                 of duplicate part numbers is carried by identity, never by position). A row with no
                 fingerprint match (new or edited content) must be supplied explicitly (a private file kept
                 outside the repository); otherwise the plan is refused. Nothing is guessed. */
const crypto = require('crypto');
const CC = require('../netlify/functions/_catalog_commercial.js');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const copy = v => JSON.parse(JSON.stringify(v));

function record(slug, overlay, pub, sourceRef) {
  const rows = JSON.stringify(overlay);
  return { manufacturer: slug, identity_sha256: CC.catalogIdentity(pub), rows: overlay, row_count: overlay.length,
           rows_sha256: sha(rows), public_sha256: sha(JSON.stringify(pub)), source_ref: String(sourceRef || '').slice(0, 80) };
}

/* full = the priced file (git history, scrubs already applied); current = the public file in the tree. */
function planInitial(slug, full, current, sourceRef) {
  const problems = [];
  const s = CC.splitCatalogFile(full);
  if (JSON.stringify(current) !== JSON.stringify(s.public)) problems.push('the public file in this tree differs from the split');
  let back = null; try { back = CC.restoreCatalogFile(current, s.overlay); } catch (e) { problems.push(String(e.message || e)); }
  if (back && JSON.stringify(back) !== JSON.stringify(full)) problems.push('restore does not give back the original');
  const rec = record(slug, s.overlay, current, sourceRef);
  if (!CC.validOverlayRecord(rec)) problems.push('the record is not internally valid');
  return { ok: !problems.length, problems, record: rec };
}

/* stored = the line's stored records (any versions); baseIdentity = the identity of the public file the
   new one replaces (the deployed one — the CLI computes it from git); next = the edited public file;
   supplied = optional { "<code>#<occurrence in the NEW file>": { <commercial fields only> } }. */
function planReseed(slug, stored, baseIdentity, next, supplied, sourceRef) {
  const problems = [], report = { carried: 0, supplied: 0, unresolved: [], unused_supplied: [] };
  if (!Array.isArray(next)) return { ok: false, problems: ['the new public file is not a list'], report };
  if (CC.commercialKeysIn(next).length) problems.push('the new public file still carries commercial fields — strip it first');
  const recs = (Array.isArray(stored) ? stored : []).filter(r => r && r.manufacturer === slug);
  const base = recs.find(r => r.identity_sha256 === baseIdentity) || null;
  if (!base) problems.push('no stored record for the base version ' + String(baseIdentity || '?').slice(0, 16) + ' of this line to carry commercial rows from');
  else if (!CC.validOverlayRecord(base)) problems.push('the stored base version is not internally valid');
  const sup = supplied || {};
  Object.keys(sup).forEach(k => {
    const f = sup[k];
    if (!f || typeof f !== 'object' || Array.isArray(f)) problems.push('supplied ' + k + ' is not an object of commercial fields');
    else Object.keys(f).forEach(x => { if (CC.CATALOG_COMMERCIAL_KEYS.indexOf(x) < 0) problems.push('supplied ' + k + ' names a non-commercial field: ' + x); });
  });
  /* Candidate commercial entries of the base version by fingerprint; identical public rows (same
     fingerprint) are consumed in their stored order. */
  const pool = {};
  if (base) base.rows.forEach(o => { (pool[o.h] = pool[o.h] || []).push(o); });
  const keys = CC.catalogRowKeys(next), used = new Set(), overlay = [];
  next.forEach((row, i) => {
    const h = CC.catalogRowPrint(row), k = keys[i];
    const cand = (pool[h] || []).shift();
    if (cand) { overlay.push({ k, h, order: copy(cand.order), f: copy(cand.f) }); report.carried++; return; }
    if (Object.prototype.hasOwnProperty.call(sup, k)) {
      const f = copy(sup[k]); used.add(k);
      overlay.push({ k, h, order: Object.keys(row).concat(Object.keys(f)), f }); report.supplied++; return;
    }
    report.unresolved.push(k);
    overlay.push({ k, h, order: Object.keys(row), f: {} });
  });
  report.unused_supplied = Object.keys(sup).filter(k => !used.has(k));
  if (report.unresolved.length) problems.push(report.unresolved.length + ' row(s) are new or edited and have no supplied commercial fields: ' + report.unresolved.slice(0, 10).join(', '));
  if (report.unused_supplied.length) problems.push('supplied entries that match no new or edited row: ' + report.unused_supplied.slice(0, 10).join(', '));
  report.dropped = Object.values(pool).reduce((n, l) => n + l.length, 0);
  const rec = record(slug, overlay, next, sourceRef);
  if (!CC.validOverlayRecord(rec)) problems.push('the record is not internally valid');
  try { CC.restoreCatalogFile(next, overlay); } catch (e) { problems.push(String(e.message || e)); }
  if (recs.some(r => r.identity_sha256 === rec.identity_sha256)) report.already_stored = true;
  return { ok: !problems.length, problems, report, record: rec };
}

module.exports = { planInitial, planReseed, record };
