/* p0-reseed-by-code: the repair SQL carries each row's commercial fields from a stored base record of the same line by
   part number, holds no price in its text, passes the table's own guard, and the stored record prices the new public file
   exactly as the base priced the old one. Real PostgreSQL (PGHOST/PGUSER), synthetic catalog only. */
const { execFileSync } = require('child_process');
const assert = require('assert');
const CC = require('../netlify/functions/_catalog_commercial.js');
const LIB = require('./../scripts/p0-seed-lib.js');
const RB = require('../scripts/p0-reseed-by-code.js');
const DB = 'p0_reseed_test';
const psql = (sql, db) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', db || DB, '-c', sql], { encoding: 'utf8', env: Object.assign({ PGHOST: '127.0.0.1', PGUSER: 'postgres', PGPORT: '5432' }, process.env) });
const psqlFile = (f, db) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', db || DB, '-f', f], { encoding: 'utf8', env: Object.assign({ PGHOST: '127.0.0.1', PGUSER: 'postgres', PGPORT: '5432' }, process.env) });
try { psql(`drop database if exists ${DB}`, 'postgres'); psql(`create database ${DB}`, 'postgres'); }
catch (e) { console.log('SKIP: no local PostgreSQL'); process.exit(process.env.CI ? 1 : 0); }
psql('do $$ begin if not exists (select 1 from pg_roles where rolname=\'anon\') then create role anon; end if; if not exists (select 1 from pg_roles where rolname=\'authenticated\') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname=\'service_role\') then create role service_role; end if; end $$;');
psqlFile('supabase/p0_catalog_file_commercial.sql');
const fs = require('fs');
// a synthetic priced file (old version) and its stored record
const full = [
  { manufacturer: 'synth', code: 'S-1', name: 'Synthetic One', category: 'Displays', base_price: 11.11, msrp: 22.22 },
  { manufacturer: 'synth', code: 'S-2', name: 'Synthetic Two', category: 'Care', base_price: 33.33, tiers: [{ minQty: 6, price: 30 }] },
  { manufacturer: 'synth', code: 'S-2', name: 'Synthetic Two (case)', category: 'Care', base_price: 44.44 },
];
const oldPub = CC.splitCatalogFile(full).public;
const rec = LIB.planInitial('synth', full, oldPub, 'test').record;
psql(`insert into catalog_file_commercial (manufacturer, identity_sha256, rows, row_count, rows_sha256, public_sha256, source_ref) values ('synth','${rec.identity_sha256}','${JSON.stringify(rec.rows).replace(/'/g, "''")}',${rec.row_count},'${rec.rows_sha256}','${rec.public_sha256}','test')`);
// the new public file: a category moved, a unit word added, a new part number
const next = JSON.parse(JSON.stringify(oldPub)); next[0].category = 'Skin Care'; next[1].uom = 'Each';
next.push({ manufacturer: 'synth', code: 'S-3', name: 'Synthetic Three', category: 'Care' });
const out = RB.build('synth', next, ['f'.repeat(64), rec.identity_sha256], 'test');
assert.ok(!/11\.11|22\.22|33\.33|44\.44|base_price/.test(out.sql), 'the SQL holds no price and no commercial key');
fs.writeFileSync('/tmp/p0_rb.sql', out.sql);
const res = psqlFile('/tmp/p0_rb.sql');
assert.ok(/1\|/.test(res) || res.includes(out.identity.slice(0, 16)), res);
const stored = JSON.parse(psql(`select rows from catalog_file_commercial where manufacturer='synth' and identity_sha256='${out.identity}'`));
const restored = CC.restoreCatalogFile(next, stored);
assert.strictEqual(restored[0].base_price, 11.11); assert.strictEqual(restored[0].msrp, 22.22); assert.strictEqual(restored[0].category, 'Skin Care');
assert.deepStrictEqual(restored[1].tiers, [{ minQty: 6, price: 30 }]); assert.strictEqual(restored[1].uom, 'Each');
assert.strictEqual(restored[2].base_price, 44.44, 'the second S-2 keeps ITS price (key = code#occurrence)');
assert.strictEqual(restored[3].base_price, undefined, 'a new part number gets no price — never guessed');
assert.strictEqual(CC.recordForFile(next, [{ identity_sha256: out.identity, rows: stored }]).record != null, true);
// a second run changes nothing
psqlFile('/tmp/p0_rb.sql');
assert.strictEqual(psql(`select count(*) from catalog_file_commercial where manufacturer='synth'`).trim(), '2');
// no base stored → refused, nothing written
const out2 = RB.build('synth2', next.map(r => Object.assign({}, r, { manufacturer: 'synth2' })), ['e'.repeat(64)], 'test');
fs.writeFileSync('/tmp/p0_rb2.sql', out2.sql);
assert.throws(() => psqlFile('/tmp/p0_rb2.sql'), /none of the base versions/);
assert.strictEqual(psql(`select count(*) from catalog_file_commercial where manufacturer='synth2'`).trim(), '0');
assert.throws(() => RB.build('synth', full, [rec.identity_sha256]), /commercial fields/, 'a priced file is refused');
psql(`drop database ${DB}`, 'postgres');
console.log('p0-reseed-by-code.pg: ok');
