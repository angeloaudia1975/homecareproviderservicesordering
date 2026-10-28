/* P0 — which lines get a private commercial record. ONE rule, used by the seed, the probe and the tests:
   a line is CURRENT when it is listed in this tree's public/data/manufacturers.json. A catalog file that
   is not listed there (a retired line, e.g. Complete Medical Supplies — PR ordering#4 deletes it) is never
   seeded, so a public file left behind can never be priced. RETIRED only names old URLs the outside probe
   keeps checking (404, or no commercial field); it is not used to decide what is seeded. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const RETIRED = ['complete-medical-supplies'];
function currentLines(root) {
  const p = path.join(root || ROOT, 'public', 'data', 'manufacturers.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')).map(m => String(m.slug));
}
/* Lines whose public file was changed AFTER the P0 seed by a reviewed catalog update (a new private version added with
   --add-version and run by Angelo). The P0 tests compare these against the identity registered here instead of the
   pre-strip base, so the file still cannot change silently: any other edit fails. */
const UPDATED = {
  dalton: { identity: '04d3bd510304a5717a29b074d6b6b14ef66fc5023f54d24e6a8e401ba5dde201', note: 'Dalton Dealer Price List Nov 2026 REVa (owner, tracker #42)' },
  access4u: { identity: '0e3a114ddff153a95a00fa601a6d88e23db52ed3b1b43e1536b38b9cfc1b51ec', note: 'Access4U Fall 2026 list = the whole active line (owner source-of-truth 2026-10-27 17:40)' },
};
module.exports = { currentLines, RETIRED, UPDATED };
