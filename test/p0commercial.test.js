/* P0 (2026-10-23, issue #2) — splitting the catalog file into a public half and a private
   commercial overlay, and putting it back together.
   · runs the REAL restoreCatalogFile lifted from the storefront page (and the module's copy);
   · round-trips every real catalog file as it was BEFORE the strip (read from git, P0_BASE_REF,
     default the main commit this branch started from) — byte for byte;
   · proves the page, the Business Hub page and the module carry the same text.
   Usage: node test/p0commercial.test.js [index.html] */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SHOP = process.argv[2] || process.env.SHOP || path.join(ROOT, 'public', 'index.html');
const HUB = process.env.HUB || path.join(ROOT, 'public', 'dashboard.html');
const MOD_PATH = process.env.CC_MODULE || path.join(ROOT, 'netlify', 'functions', '_catalog_commercial.js');
const BASE_REF = process.env.P0_BASE_REF || '4b1bad3';
const html = fs.readFileSync(SHOP, 'utf8');
const CC = require(MOD_PATH);
const { applyScrubs } = require(path.join(ROOT, 'scripts', 'p0-scrubs.js'));

function liftRestore(src) {
  const a = src.indexOf('const CATALOG_COMMERCIAL_KEYS='), b = src.indexOf('\n}\n', src.indexOf('function restoreCatalogFile(', a));
  if (a < 0 || b < 0) throw new Error('restoreCatalogFile not found in the page');
  const code = src.slice(a, b + 2);
  const mod = { exports: {} };
  new Function('module', code + '\n;module.exports={restoreCatalogFile,CATALOG_COMMERCIAL_KEYS,catalogSha256,catalogIdentity,catalogRowPrint};')(mod);
  return { code, ...mod.exports };
}
const PAGE = liftRestore(html);

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const throws = (fn, re, m) => { let e = null; try { fn(); } catch (x) { e = x; } ok(e && re.test(String(e.message)), (m || 'expected a mismatch') + (e ? ': ' + e.message : ': nothing thrown')); };

for (const [label, restore] of [['page', PAGE.restoreCatalogFile], ['module', CC.restoreCatalogFile]]) {
  const full = () => [
    { manufacturer: 'L', code: 'A1', name: 'Alpha', base_price: 10, tiers: [{ min_qty: 2, price: 9 }], msrp: 20, map: null, price_note: 'MAP $X', image: '/a.jpg' },
    { manufacturer: 'L', code: 'SR3', name: 'Ramp 1', family: 'f1', base_price: 5, dealer_price: 4, tier_prices: { 15: 3 } },
    { manufacturer: 'L', code: 'SR3', name: 'Ramp 2', family: 'f2', base_price: 6, shipping: { ups: 35 }, unit_cost: 1 },
  ];
  t(`${label}: split then restore gives back the file byte for byte (key order kept, duplicate codes kept apart)`, () => {
    const f = full(), s = CC.splitCatalogFile(f);
    eq(JSON.stringify(restore(s.public, s.overlay)), JSON.stringify(f));
  });
  t(`${label}: the public half carries no commercial key at all`, () => {
    eq(CC.commercialKeysIn(CC.splitCatalogFile(full()).public), [], 'commercial keys left');
  });
  t(`${label}: a commercial value left on a public row is dropped — the overlay is the only source`, () => {
    const s = CC.splitCatalogFile(full()); s.public[0].base_price = 1; s.public[0].map = 99; s.public[0].dealer_price = 1;
    const r = restore(s.public, s.overlay);
    eq(r[0].base_price, 10, 'stale public price ignored'); eq(r[0].map, null, 'stale MAP ignored'); ok(!('dealer_price' in r[0]), 'stray key dropped');
  });
  t(`${label}: a commercial key the overlay does not hold is absent, never kept from the public row`, () => {
    const s = CC.splitCatalogFile(full()); delete s.overlay[0].f.msrp; s.public[0].msrp = 999;
    ok(!('msrp' in restore(s.public, s.overlay)[0]), 'msrp kept from public');
  });
  t(`${label}: the overlay can never write a non-commercial field (name, image, code)`, () => {
    const s = CC.splitCatalogFile(full()); s.overlay[0].f.name = 'HIJACK'; s.overlay[0].f.image = 'x'; s.overlay[0].order.push('evil'); s.overlay[0].f.evil = 1;
    const r = restore(s.public, s.overlay)[0]; eq(r.name, 'Alpha'); eq(r.image, '/a.jpg'); ok(!('evil' in r), 'unknown key injected');
  });
  t(`${label}: a public field added after the split is a NEW version — refused until the line is re-seeded`, () => {
    const s = CC.splitCatalogFile(full()); s.public[0].subcategory = 'New'; throws(() => restore(s.public, s.overlay), /A1#0 is not the catalog row/);
  });
  /* P0 review — row identity. Never a positional match across versions. */
  t(`${label}: swapped duplicate-code variants (SR3#0 ↔ SR3#1) are refused, never priced with each other's price`, () => {
    const s = CC.splitCatalogFile(full()); const pub = [s.public[0], s.public[2], s.public[1]];
    throws(() => restore(pub, s.overlay), /SR3#0 is not the catalog row/);
  });
  t(`${label}: same part numbers, same row count, another non-commercial field changed (family) — refused`, () => {
    const s = CC.splitCatalogFile(full()); s.public[1].family = 'f2'; s.public[2].family = 'f1';
    throws(() => restore(s.public, s.overlay), /catalog_file_mismatch: SR3#0/);
  });
  t(`${label}: a changed name / image / group with an unchanged part number — refused`, () => {
    for (const [k, v] of [['name', 'Alpha 2'], ['image', '/b.jpg'], ['group', 'G']]) {
      const s = CC.splitCatalogFile(full()); s.public[0][k] = v; throws(() => restore(s.public, s.overlay), /A1#0 is not the catalog row/, k);
    }
  });
  t(`${label}: a non-commercial field removed from the public row — refused`, () => {
    const s = CC.splitCatalogFile(full()); delete s.public[0].image; throws(() => restore(s.public, s.overlay), /A1#0 is not the catalog row/);
  });
  t(`${label}: a commercial entry with no fingerprint, or a malformed one, is refused (fail closed)`, () => {
    for (const h of [undefined, '', 'abc', 'A'.repeat(64), 7]) {
      const s = CC.splitCatalogFile(full()); if (h === undefined) delete s.overlay[1].h; else s.overlay[1].h = h;
      throws(() => restore(s.public, s.overlay), /SR3#0 has no identity fingerprint/, String(h));
    }
  });
  t(`${label}: another row's fingerprint on an entry is refused`, () => {
    const s = CC.splitCatalogFile(full()); s.overlay[1].h = s.overlay[2].h; throws(() => restore(s.public, s.overlay), /SR3#0 is not the catalog row/);
  });
  t(`${label}: key ORDER inside a public row does not change its identity (only content does)`, () => {
    const f = full(), s = CC.splitCatalogFile(f); const r0 = s.public[0], re = {}; Object.keys(r0).reverse().forEach(k => { re[k] = r0[k]; });
    eq(JSON.stringify(restore([re, s.public[1], s.public[2]], s.overlay)), JSON.stringify(f));
  });
  t(`${label}: a stale commercial value on a public row does not change its identity (prices are not part of it)`, () => {
    const s = CC.splitCatalogFile(full()); const a = CC.catalogRowPrint(s.public[0]); s.public[0].base_price = 999; s.public[0].tiers = [];
    eq(CC.catalogRowPrint(s.public[0]), a);
  });
  t(`${label}: one row too few or too many in the overlay is a mismatch`, () => {
    const s = CC.splitCatalogFile(full());
    throws(() => restore(s.public, s.overlay.slice(1)), /catalog_file_mismatch/, 'short');
    throws(() => restore(s.public.slice(1), s.overlay), /catalog_file_mismatch/, 'long');
  });
  t(`${label}: a row whose part number has no overlay entry is a mismatch`, () => {
    const s = CC.splitCatalogFile(full()); s.public[0].code = 'ZZ'; throws(() => restore(s.public, s.overlay), /no commercial row for ZZ#0/);
  });
  t(`${label}: the overlay must be one entry per row (no duplicate keys)`, () => {
    const s = CC.splitCatalogFile(full()); s.overlay[2].k = s.overlay[1].k; throws(() => restore(s.public, s.overlay), /catalog_file_mismatch/);
  });
  t(`${label}: no overlay, or a public file that is not a list, is a mismatch`, () => {
    throws(() => restore([], null), /catalog_file_mismatch/); throws(() => restore({}, []), /catalog_file_mismatch/);
  });
  t(`${label}: re-ordered public rows still find their own commercial row`, () => {
    const f = full(), s = CC.splitCatalogFile(f); const r = restore([s.public[0], s.public[1], s.public[2]].reverse().reverse(), s.overlay.slice().reverse());
    eq(JSON.stringify(r), JSON.stringify(f));
  });
}

t('the page and the module carry the same commercial keys, identity helpers and restore text', () => {
  eq(PAGE.CATALOG_COMMERCIAL_KEYS, CC.CATALOG_COMMERCIAL_KEYS, 'keys');
  const modSrc = fs.readFileSync(MOD_PATH, 'utf8');
  const a = modSrc.indexOf('const CATALOG_COMMERCIAL_KEYS='), b = modSrc.indexOf('\n}\n', modSrc.indexOf('function restoreCatalogFile(', a));
  eq(PAGE.code, modSrc.slice(a, b + 2), 'shared block text (keys → sha256 → canon → row print → identity → restore)');
});
t('the pure-JS SHA-256 equals node:crypto on 2,000 random strings (ASCII + multi-byte) and the block boundaries', () => {
  const c = require('crypto'); let bad = 0;
  const strs = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(65), 'é😀中'];
  for (let i = 0; i < 2000; i++) { let x = ''; const L = (i * 7919) % 400; for (let j = 0; j < L; j++) x += String.fromCodePoint(((i + 1) * (j + 3) * 2654435761 % 0x2fff) + 32); strs.push(x); }
  for (const x of strs) if (PAGE.catalogSha256(x) !== c.createHash('sha256').update(x, 'utf8').digest('hex') || CC.catalogSha256(x) !== PAGE.catalogSha256(x)) bad++;
  eq(bad, 0, 'mismatching digests');
});
t('identity: one changed row changes the line identity; identical files share it; the split file and the full file share it', () => {
  const f = [{ code: 'A', name: 'x', base_price: 1 }, { code: 'B', name: 'y' }], s = CC.splitCatalogFile(f);
  eq(CC.catalogIdentity(f), CC.catalogIdentity(s.public), 'prices are not part of identity');
  ok(CC.catalogIdentity([{ code: 'A', name: 'x' }, { code: 'B', name: 'y!' }]) !== CC.catalogIdentity(s.public), 'changed row');
  ok(CC.catalogIdentity([s.public[1], s.public[0]]) !== CC.catalogIdentity(s.public), 'reordered rows');
  eq(PAGE.catalogIdentity(s.public), CC.catalogIdentity(s.public), 'page = module');
});
t('validOverlayRecord: identity must equal the entries\' fingerprints in order; every entry fingerprinted; one per key', () => {
  const s = CC.splitCatalogFile([{ code: 'A', base_price: 1 }, { code: 'A', base_price: 2, name: 'b' }]);
  const rec = { rows: s.overlay, identity_sha256: CC.catalogIdentity(s.public) };
  ok(CC.validOverlayRecord(rec), 'good record');
  ok(!CC.validOverlayRecord({ rows: s.overlay.slice().reverse(), identity_sha256: rec.identity_sha256 }), 'reordered entries');
  ok(!CC.validOverlayRecord({ rows: s.overlay, identity_sha256: 'c'.repeat(64) }), 'wrong identity');
  ok(!CC.validOverlayRecord({ rows: s.overlay.map(o => ({ k: o.k, order: o.order, f: o.f })), identity_sha256: rec.identity_sha256 }), 'no fingerprints');
  ok(!CC.validOverlayRecord({ rows: [s.overlay[0], Object.assign({}, s.overlay[1], { k: s.overlay[0].k })], identity_sha256: rec.identity_sha256 }), 'duplicate key');
  ok(!CC.validOverlayRecord({ rows: s.overlay }), 'no identity');
  { const rows = s.overlay.map((o, i) => (i ? o : { k: o.k, order: o.order, f: o.f }));
    ok(!CC.validOverlayRecord({ rows, identity_sha256: CC.catalogSha256(rows.map(o => o.h).join('\n')) }), 'an entry without a fingerprint, identity computed over the blank'); }
  ok(!CC.validOverlayRecord(null) && !CC.validOverlayRecord({ rows: {}, identity_sha256: rec.identity_sha256 }), 'not a record');
  const pick = CC.recordForFile(s.public, [{ identity_sha256: 'd'.repeat(64) }, rec]);
  eq(pick.record, rec, 'recordForFile picks the matching version'); eq(CC.recordForFile([{ code: 'Z' }], [rec]).record, null, 'no version for another file');
});
t('the Business Hub page carries the same restore text', () => {
  const hub = liftRestore(fs.readFileSync(HUB, 'utf8'));
  eq(hub.code, PAGE.code, 'dashboard.html restore');
});
t('the keys cover every commercial field the catalog files ever carried', () => {
  for (const k of ['base_price', 'tiers', 'dealer_price', 'tier_prices', 'msrp', 'map', 'price_note', 'unit_cost', 'shipping'])
    ok(CC.CATALOG_COMMERCIAL_KEYS.includes(k), 'missing ' + k);
});

/* Every real catalog file as it was before the strip. */
let originals = null;
try {
  const list = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', BASE_REF + ':public/data/manufacturers.json'], { encoding: 'utf8' }));
  originals = {};
  for (const m of list) {
    try { originals[m.slug] = execFileSync('git', ['-C', ROOT, 'show', `${BASE_REF}:public/data/${m.slug}.json`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { originals[m.slug] = null; }
  }
} catch (e) { originals = null; }
if (!originals) {
  if (process.env.P0_ALLOW_NO_GIT === '1') console.log('skip real files (P0_ALLOW_NO_GIT=1): git ref ' + BASE_REF + ' unavailable');
  else t('the pre-strip catalog files are readable from git ' + BASE_REF, () => { throw new Error('git show failed — fetch the base commit or set P0_BASE_REF'); });
} else {
  const UPD = require('../scripts/p0-lines.js').UPDATED;
  for (const slug of Object.keys(originals)) {
    const txt = originals[slug]; if (txt == null) continue;
    if (UPD[slug]) { t(`real file ${slug}: updated after P0 (${UPD[slug].note}) — the tree file is exactly the registered version`, () => {
      const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', slug + '.json'), 'utf8'));
      eq(PAGE.catalogIdentity(cur), UPD[slug].identity, 'identity'); eq(CC.commercialKeysIn(cur), [], 'commercial field in the public file'); }); continue; }
    t(`real file ${slug}: split → restore (page code) is byte-identical to the original`, () => {
      const f = JSON.parse(txt), s = CC.splitCatalogFile(f);
      eq(JSON.stringify(PAGE.restoreCatalogFile(s.public, s.overlay)), JSON.stringify(f));
      eq(CC.commercialKeysIn(s.public), [], 'public half still commercial');
    });
    t(`real file ${slug}: every row fingerprinted; the identity of the public file in this tree = the seeded record's`, () => {
      const f = applyScrubs(slug, JSON.parse(txt)), s = CC.splitCatalogFile(f);
      ok(s.overlay.every(o => /^[0-9a-f]{64}$/.test(o.h)), 'fingerprint missing');
      const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', slug + '.json'), 'utf8'));
      eq(PAGE.catalogIdentity(cur), CC.catalogIdentity(s.public), 'identity');
      ok(CC.validOverlayRecord({ rows: s.overlay, identity_sha256: CC.catalogIdentity(cur) }), 'record');
      eq(JSON.stringify(PAGE.restoreCatalogFile(cur, s.overlay)), JSON.stringify(f), 'the deployed public file + its record = the original');
      const dup = {}; cur.forEach((r, i) => { (dup[r.code] = dup[r.code] || []).push(i); });
      Object.values(dup).filter(ix => ix.length > 1).forEach(ix => ok(new Set(ix.map(i => CC.catalogRowPrint(cur[i]))).size === ix.length,
        'two rows with the same part number are publicly identical — their commercial rows could not be told apart: ' + cur[ix[0]].code));
      Object.values(dup).filter(ix => ix.length > 1).slice(0, 5).forEach(ix => {
        const sw = cur.slice(); [sw[ix[0]], sw[ix[1]]] = [sw[ix[1]], sw[ix[0]]];
        if (CC.catalogRowPrint(sw[ix[0]]) !== CC.catalogRowPrint(cur[ix[0]])) throws(() => PAGE.restoreCatalogFile(sw, s.overlay), /catalog_file_mismatch/, 'swapped duplicates priced');
      });
    });
    t(`real file ${slug}: the stripped file in this tree equals the public half (nothing else changed)`, () => {
      const p = path.join(ROOT, 'public', 'data', slug + '.json');
      const cur = JSON.parse(fs.readFileSync(p, 'utf8'));
      eq(JSON.stringify(cur), JSON.stringify(applyScrubs(slug, CC.splitCatalogFile(JSON.parse(txt)).public)));
    });
  }
}
/* 2026-10-25: a record read back from Postgres jsonb reorders keys inside nested objects (tiers, shipping).
   Restore must still give the priced file back byte for byte — module AND page copy (the Gold Standard
   fingerprint compares text). Synthetic rows; no real price. */
t('a jsonb-reordered overlay (nested keys re-sorted) restores byte for byte — module and page', () => {
  const full = [
    { code: 'A1', name: 'Alpha', base_price: 1.5, tiers: [{ minQty: 1, price: 1.5 }, { minQty: 5, price: 1.25 }], image: 'a.jpg' },
    { code: 'B2', name: 'Beta', base_price: 9, shipping: { white_glove: null, ups: 3, ltl: 4 }, tiers: [{ minQty: 1, price: 9 }] },
  ];
  const s = CC.splitCatalogFile(full);
  const jsonbish = v => Array.isArray(v) ? v.map(jsonbish) : (v && typeof v === 'object')
    ? Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).reduce((o, k) => (o[k] = jsonbish(v[k]), o), {}) : v;
  const back = jsonbish(JSON.parse(JSON.stringify(s.overlay)));
  ok(JSON.stringify(back[0].f.tiers[0]) === '{"price":1.5,"minQty":1}', 'jsonb model did not reorder');
  ok(JSON.stringify(CC.restoreCatalogFile(s.public, back)) === JSON.stringify(full), 'module restore not byte-identical');
  ok(JSON.stringify(PAGE.restoreCatalogFile(s.public, back)) === JSON.stringify(full), 'page restore not byte-identical');
});
console.log(`\np0 commercial split/restore: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
