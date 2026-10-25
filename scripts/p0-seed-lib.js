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

/* exportSql — the initial seed as ONE idempotent, fail-closed SQL transaction, for the Supabase SQL editor
   (no service key needed). The output holds prices: the CLI writes it only outside every git work tree, mode
   0600, and it must never be committed, posted or pasted anywhere but the editor. It:
     · loads the planned records into a temp table (dropped at commit);
     · REFUSES (raises → nothing written) if a stored record with the same line + identity differs in any way
       (rows, row_count, rows_sha256, public_sha256), if a stored record belongs to a line or version that is
       not planned, or if the table / its guard / RLS are missing;
     · inserts only the records that are missing (already-stored ones are kept as they are);
     · then requires the table to hold EXACTLY the planned records (count, total rows, every value), RLS on,
       no policies, no SELECT for anon / authenticated — else raises and the transaction rolls back.
   No UPDATE / DELETE statement (pg-safeupdate). The final SELECT (after commit) is the summary the editor
   shows: per line identity / overlay prefixes and row counts, never a price. */
function exportSql(records, opts) {
  const recs = (records || []).slice().sort((a, b) => a.manufacturer < b.manufacturer ? -1 : 1);
  if (!recs.length) throw new Error('nothing to export');
  const HEX = /^[0-9a-f]{64}$/, SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/, REF = /^[A-Za-z0-9._\/-]{1,80}$/;
  recs.forEach(r => {
    if (!SLUG.test(r.manufacturer) || !HEX.test(r.identity_sha256) || !HEX.test(r.rows_sha256) || !HEX.test(r.public_sha256)
        || !REF.test(r.source_ref) || !Array.isArray(r.rows) || r.rows.length !== r.row_count || !CC.validOverlayRecord(r))
      throw new Error('record for ' + r.manufacturer + ' is not exportable (invalid shape)');
    if (sha(JSON.stringify(r.rows)) !== r.rows_sha256) throw new Error('record for ' + r.manufacturer + ': rows do not match rows_sha256');
  });
  if (new Set(recs.map(r => r.manufacturer)).size !== recs.length) throw new Error('one record per line expected');
  const body = recs.map(r => JSON.stringify(r.rows)).join('\n');
  let tag = 'p0j' + crypto.randomBytes(6).toString('hex');
  while (body.indexOf('$' + tag + '$') >= 0) tag = 'p0j' + crypto.randomBytes(6).toString('hex');
  const q = s => "'" + s + "'"; /* only validated hex / slug / ref values are quoted this way */
  const total = recs.reduce((n, r) => n + r.row_count, 0);
  const out = [];
  out.push('-- P0 private catalog seed — CONTAINS WHOLESALE PRICES. Never commit, post, or paste anywhere but the');
  out.push('-- Supabase SQL editor of the HCPS Ordering project. Generated by scripts/p0-seed-catalog-commercial.js');
  out.push('-- --export-sql from ' + (opts && opts.ref ? opts.ref : '?') + ': ' + recs.length + ' line(s), ' + total + ' row(s). Idempotent; keeps');
  out.push('-- records already stored when they match exactly; refuses (writes nothing) on any difference.');
  out.push('begin;');
  out.push('create temp table _p0_seed (manufacturer text primary key, identity_sha256 text not null, rows jsonb not null,');
  out.push('  row_count integer not null, rows_sha256 text not null, public_sha256 text not null, source_ref text not null) on commit drop;');
  recs.forEach(r => {
    out.push('insert into _p0_seed values (' + [q(r.manufacturer), q(r.identity_sha256), '$' + tag + '$' + JSON.stringify(r.rows) + '$' + tag + '$::jsonb',
      String(r.row_count), q(r.rows_sha256), q(r.public_sha256), q(r.source_ref)].join(', ') + ');');
  });
  out.push(`do $p0$
declare n integer; t bigint; m text;
begin
  if to_regclass('public.catalog_file_commercial') is null then raise exception 'P0 seed: catalog_file_commercial is not installed'; end if;
  if (select count(*) from _p0_seed) <> ${recs.length} or (select sum(row_count) from _p0_seed) <> ${total} then
    raise exception 'P0 seed: the planned records did not load completely'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.catalog_file_commercial'::regclass) then
    raise exception 'P0 seed: RLS is off on catalog_file_commercial — refusing'; end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.catalog_file_commercial'::regclass and not tgisinternal and tgenabled <> 'D') is not true then
    raise exception 'P0 seed: the guard trigger is missing or disabled — refusing'; end if;
  select c.manufacturer into m from public.catalog_file_commercial c join _p0_seed s using (manufacturer, identity_sha256)
   where c.rows <> s.rows or c.row_count <> s.row_count or c.rows_sha256 <> s.rows_sha256 or c.public_sha256 <> s.public_sha256 limit 1;
  if m is not null then raise exception 'P0 seed: the stored record for % differs from the verified plan — nothing written', m; end if;
  select c.manufacturer into m from public.catalog_file_commercial c
   where not exists (select 1 from _p0_seed s where s.manufacturer = c.manufacturer and s.identity_sha256 = c.identity_sha256) limit 1;
  if m is not null then raise exception 'P0 seed: a stored record (%) is not in the verified plan — nothing written', m; end if;
  insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
  select s.manufacturer, s.identity_sha256, s.rows, s.row_count, s.rows_sha256, s.public_sha256, s.source_ref from _p0_seed s
   where not exists (select 1 from public.catalog_file_commercial c where c.manufacturer = s.manufacturer and c.identity_sha256 = s.identity_sha256);
  select count(*), coalesce(sum(row_count), 0) into n, t from public.catalog_file_commercial;
  if n <> ${recs.length} or t <> ${total} then raise exception 'P0 seed: after the write the table holds % record(s) / % row(s), expected ${recs.length} / ${total}', n, t; end if;
  if exists (select 1 from _p0_seed s left join public.catalog_file_commercial c using (manufacturer, identity_sha256)
              where c.manufacturer is null or c.rows <> s.rows or c.row_count <> s.row_count or c.rows_sha256 <> s.rows_sha256 or c.public_sha256 <> s.public_sha256) then
    raise exception 'P0 seed: a stored record does not equal the plan after the write'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'catalog_file_commercial') then
    raise exception 'P0 seed: catalog_file_commercial has a policy — refusing'; end if;
  if has_table_privilege('anon', 'public.catalog_file_commercial', 'select') or has_table_privilege('authenticated', 'public.catalog_file_commercial', 'select') then
    raise exception 'P0 seed: anon or authenticated can read catalog_file_commercial — refusing'; end if;
end $p0$;`);
  out.push('commit;');
  out.push(`select c.manufacturer, left(c.identity_sha256, 16) as identity, left(c.rows_sha256, 16) as overlay,
       left(c.public_sha256, 16) as public, c.row_count, c.source_ref,
       count(*) over () as versions, sum(c.row_count) over () as total_rows,
       (select relrowsecurity from pg_class where oid = 'public.catalog_file_commercial'::regclass) as rls_on,
       not has_table_privilege('anon', 'public.catalog_file_commercial', 'select') as anon_denied
  from public.catalog_file_commercial c order by c.manufacturer;`);
  return { sql: out.join('\n') + '\n', lines: recs.length, rows: total };
}

module.exports = { planInitial, planReseed, record, exportSql };
