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
  new Function('module', code + '\n;module.exports={restoreCatalogFile,CATALOG_COMMERCIAL_KEYS};')(mod);
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
  t(`${label}: a public field added after the split still comes through`, () => {
    const s = CC.splitCatalogFile(full()); s.public[0].subcategory = 'New'; eq(restore(s.public, s.overlay)[0].subcategory, 'New');
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

t('the page and the module carry the same commercial keys and the same restore text', () => {
  eq(PAGE.CATALOG_COMMERCIAL_KEYS, CC.CATALOG_COMMERCIAL_KEYS, 'keys');
  const modSrc = fs.readFileSync(MOD_PATH, 'utf8');
  const a = modSrc.indexOf('function restoreCatalogFile('), b = modSrc.indexOf('\n}\n', a);
  const pa = PAGE.code.indexOf('function restoreCatalogFile(');
  eq(PAGE.code.slice(pa), modSrc.slice(a, b + 2), 'restoreCatalogFile text');
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
  for (const slug of Object.keys(originals)) {
    const txt = originals[slug]; if (txt == null) continue;
    t(`real file ${slug}: split → restore (page code) is byte-identical to the original`, () => {
      const f = JSON.parse(txt), s = CC.splitCatalogFile(f);
      eq(JSON.stringify(PAGE.restoreCatalogFile(s.public, s.overlay)), JSON.stringify(f));
      eq(CC.commercialKeysIn(s.public), [], 'public half still commercial');
    });
    t(`real file ${slug}: the stripped file in this tree equals the public half (nothing else changed)`, () => {
      const p = path.join(ROOT, 'public', 'data', slug + '.json');
      const cur = JSON.parse(fs.readFileSync(p, 'utf8'));
      eq(JSON.stringify(cur), JSON.stringify(applyScrubs(slug, CC.splitCatalogFile(JSON.parse(txt)).public)));
    });
  }
}
console.log(`\np0 commercial split/restore: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
