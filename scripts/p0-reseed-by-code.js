#!/usr/bin/env node
/* P0 repair — a line's deployed public catalog file has NO private commercial record (the storefront answers "Pricing
   could not be loaded" and the order server refuses to price the line: catalog_version_not_seeded).

   Writes ONE idempotent SQL transaction that adds the missing record for the DEPLOYED public file by carrying each row's
   commercial fields from an already-stored record of the SAME line, matched by the row key (part number + occurrence,
   "code#n") — the same key restoreCatalogFile uses. It never types, derives or changes a price: the SQL copies `f`
   (the commercial fields) row for row inside the database, so this file and its output hold NO commercial value.

   Use it only for a public-file edit that changed no commercial field (e.g. a category, unit wording or photo): the
   carried record then prices exactly as the base did. A row with no stored base row (a new part number) gets NO commercial
   fields (shown without a price) and is listed by the SQL's result — supply it through Manufacturer Center, never guess.

   The SQL: refuses unless the target identity is still missing; tries the bases in the order given and uses the FIRST that
   is stored; inserts nothing if no base is stored; the table's own guard re-checks that the identity equals the rows'
   fingerprints. Returns: base used, rows carried, rows without a base row (codes), total rows.

   node scripts/p0-reseed-by-code.js <slug> <file.json | https://…/data/slug.json> <baseIdentityFull>[,<baseIdentityFull>…] > out.sql */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const CC = require('../netlify/functions/_catalog_commercial.js');

function build(slug, pub, bases, sourceRef) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) throw new Error('bad slug');
  if (!Array.isArray(pub) || !pub.length) throw new Error('the public file is not a non-empty list');
  if (CC.commercialKeysIn(pub).length) throw new Error('the public file carries commercial fields — refusing');
  if (!bases.length || bases.some(b => !/^[0-9a-f]{64}$/.test(b))) throw new Error('give the full 64-hex base identities');
  const keys = CC.catalogRowKeys(pub);
  const rows = pub.map((r, i) => ({ k: keys[i], h: CC.catalogRowPrint(r), order: Object.keys(r), i: i + 1 }));
  const identity = CC.catalogIdentity(pub);
  const publicSha = crypto.createHash('sha256').update(JSON.stringify(pub)).digest('hex');
  const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
  const data = JSON.stringify(rows);
  const ref = String(sourceRef || ('reseed-by-code ' + new Date().toISOString().slice(0, 10))).slice(0, 80);
  return { identity, sql: `-- P0 repair: add the commercial record for ${slug} public file ${identity.slice(0, 16)} (${pub.length} rows), carried by
-- part number from an already-stored record of the same line. Holds NO price: commercial fields are copied inside the database.
begin;
create temp table _rb_new (k text primary key, h text not null, ord jsonb not null, i int not null) on commit drop;
insert into _rb_new (k, h, ord, i)
  select x->>'k', x->>'h', x->'order', (x->>'i')::int from jsonb_array_elements(${lit(data)}::jsonb) as t(x);
do $$
declare base text; n_new int; n_carried int; missing text; ident text;
begin
  if exists (select 1 from public.catalog_file_commercial where manufacturer = ${lit(slug)} and identity_sha256 = ${lit(identity)}) then
    raise notice 'already stored — nothing to do'; return;
  end if;
  select encode(sha256(convert_to(string_agg(h, E'\\n' order by i), 'UTF8')), 'hex') into ident from _rb_new;
  if ident <> ${lit(identity)} then raise exception 'the embedded rows do not give identity %', ${lit(identity)}; end if;
  select b into base from unnest(array[${bases.map(lit).join(', ')}]::text[]) with ordinality as u(b, o)
   where exists (select 1 from public.catalog_file_commercial c where c.manufacturer = ${lit(slug)} and c.identity_sha256 = u.b)
   order by o limit 1;
  if base is null then raise exception 'none of the base versions is stored for % — nothing written', ${lit(slug)}; end if;
  insert into public.catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref)
  select ${lit(slug)}, ${lit(identity)},
         jsonb_agg(jsonb_build_object('k', n.k, 'h', n.h, 'order', n.ord, 'f', coalesce(b.e->'f', '{}'::jsonb)) order by n.i),
         count(*),
         encode(sha256(convert_to(jsonb_agg(jsonb_build_object('k', n.k, 'h', n.h, 'f', coalesce(b.e->'f', '{}'::jsonb)) order by n.i)::text, 'UTF8')), 'hex'),
         ${lit(publicSha)}, ${lit(ref + ' from ' + slug)}
    from _rb_new n
    left join (select x.e from public.catalog_file_commercial c, jsonb_array_elements(c.rows) as x(e)
                where c.manufacturer = ${lit(slug)} and c.identity_sha256 = base) b on b.e->>'k' = n.k;
  select count(*) into n_new from _rb_new;
  select count(*) into n_carried from _rb_new n where exists (select 1 from public.catalog_file_commercial c, jsonb_array_elements(c.rows) x(e)
    where c.manufacturer = ${lit(slug)} and c.identity_sha256 = base and x.e->>'k' = n.k);
  select string_agg(k, ', ' order by i) into missing from _rb_new n where not exists (select 1 from public.catalog_file_commercial c, jsonb_array_elements(c.rows) x(e)
    where c.manufacturer = ${lit(slug)} and c.identity_sha256 = base and x.e->>'k' = n.k);
  raise notice 'base % · % of % rows carried · without a base row: %', left(base, 16), n_carried, n_new, coalesce(missing, 'none');
end $$;
select manufacturer, left(identity_sha256, 16) as version, row_count,
       (select count(*) from jsonb_array_elements(rows) x(e) where x.e->'f' = '{}'::jsonb) as rows_without_commercial_fields,
       (select string_agg(x.e->>'k', ', ') from jsonb_array_elements(rows) x(e) where x.e->'f' = '{}'::jsonb) as those_rows
  from public.catalog_file_commercial where manufacturer = ${lit(slug)} order by updated_at;
commit;
` };
}

if (require.main === module) {
  (async () => {
    const [slug, src, bases] = process.argv.slice(2);
    if (!slug || !src || !bases) { console.error('usage: p0-reseed-by-code.js <slug> <file|url> <base1>[,<base2>…]'); process.exit(2); }
    const pub = /^https:\/\//.test(src) ? await (await fetch(src)).json() : JSON.parse(fs.readFileSync(src, 'utf8'));
    process.stdout.write(build(slug, pub, bases.split(',').map(s => s.trim()), null).sql);
  })().catch(e => { console.error(e.message); process.exit(1); });
}
module.exports = { build };
