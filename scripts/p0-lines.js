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
module.exports = { currentLines, RETIRED };
