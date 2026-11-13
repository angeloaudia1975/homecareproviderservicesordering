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
// the real tree: today every listed line except the known PediFix version has its record (registered identities)
console.log('catalog-identity-gate: ok');
