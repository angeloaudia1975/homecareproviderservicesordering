/* catalog-identity-gate: a listed line whose public file has no stored commercial record fails the build; a known, owner-
   pending one only warns; Golden and unlisted files are not checked. Synthetic temp tree. */
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const CC = require('../netlify/functions/_catalog_commercial.js');
const G = require('../scripts/catalog-identity-gate.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-')); fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
const w = (n, v) => fs.writeFileSync(path.join(root, 'public/data', n), JSON.stringify(v));
const a = [{ code: 'A-1', name: 'A' }], b = [{ code: 'B-1', name: 'B' }], p = [{ code: 'P-1', name: 'P' }];
w('manufacturers.json', [{ slug: 'aline' }, { slug: 'bline' }, { slug: 'golden-technologies' }, { slug: 'pedifix' }]);
w('aline.json', a); w('bline.json', b); w('pedifix.json', p);
const id = v => CC.catalogIdentity(v);
let r = G.plan(root, [{ manufacturer: 'aline', identity_sha256: id(a) }, { manufacturer: 'bline', identity_sha256: id(b) }]);
assert.deepStrictEqual(r.checked, ['aline', 'bline', 'pedifix']);
assert.strictEqual(r.missing.length, 1, 'pedifix synthetic id is not the known one → missing');
r = G.plan(root, [{ manufacturer: 'aline', identity_sha256: id(a) }]);
assert.ok(r.missing.some(x => x.startsWith('bline ')), 'an unseeded file fails');
assert.ok(!r.missing.some(x => /golden/.test(x)));
assert.deepStrictEqual(G.KNOWN_BROKEN, {}, 'no line is known broken');
// PRICE LOSS: a part number priced in the previous stored version but not in the new one fails; a new unpriced part warns.
{
  const k = (c, f) => ({ k: c + '#0', h: 'x', order: [], f });
  const prev = { manufacturer: 'aline', identity_sha256: 'old', updated_at: '2026-11-01', rows: [k('A-1', { base_price: 1 }), k('A-2', { tiers: [{ min_qty: 2, price: 1 }] }), k('A-3', {})] };
  const good = { manufacturer: 'aline', identity_sha256: 'new', updated_at: '2026-11-02', rows: [k('A-1', { base_price: 1 }), k('A-2', { tiers: [{ min_qty: 2, price: 1 }] }), k('A-3', {}), k('A-9', {})] };
  let pl = G.priceLoss('aline', 'new', [prev, good]);
  assert.deepStrictEqual(pl.lost, [], 'nothing lost'); assert.deepStrictEqual(pl.newUnpriced, ['A-9'], 'new unpriced part listed (warn)');
  const bad = { manufacturer: 'aline', identity_sha256: 'new', updated_at: '2026-11-02', rows: [k('A-1', {}), k('A-2', { tiers: [] }), k('A-3', {})] };
  pl = G.priceLoss('aline', 'new', [prev, bad]);
  assert.deepStrictEqual(pl.lost, ['A-1', 'A-2'], 'a part that lost its price (and an emptied ladder) is caught');
  assert.deepStrictEqual(G.priceLoss('aline', 'new', [bad]).lost, [], 'no previous version → nothing to compare');
  // the newest OTHER version is the baseline, not an older one
  const older = Object.assign({}, prev, { identity_sha256: 'older', updated_at: '2026-10-01', rows: [k('A-1', {})] });
  assert.deepStrictEqual(G.priceLoss('aline', 'new', [older, prev, bad]).lost, ['A-1', 'A-2']);
  // and plan() reports it for a stored line
  const st = [{ manufacturer: 'aline', identity_sha256: id(a), updated_at: '2026-11-02', rows: [k('A-1', {})] },
              { manufacturer: 'aline', identity_sha256: 'prev', updated_at: '2026-11-01', rows: [k('A-1', { base_price: 1 })] },
              { manufacturer: 'bline', identity_sha256: id(b) }];
  r = G.plan(root, st);
  assert.ok(r.lost.length === 1 && /^aline .*A-1$/.test(r.lost[0]), 'plan lists the lost price: ' + JSON.stringify(r.lost));
}
// RETIRED: every owner-retired part number must stay on RETIRED_SKUS
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.deepStrictEqual(G.retiredProblems(html), [], 'the real storefront keeps every retired part number');
  assert.deepStrictEqual(G.retiredProblems(html.replace('"P3095-115"', '"P3095-11X"')), ['pedifix P3095-115'], 'a removed retired code is caught');
  assert.strictEqual(G.retiredProblems('no list').length, G.RETIRED_REQUIRED.pedifix.length, 'a missing list fails every code');
}
// the real tree: today every listed line except the known PediFix version has its record (registered identities)
console.log('catalog-identity-gate: ok');
