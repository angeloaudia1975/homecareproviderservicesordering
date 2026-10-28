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
  access4u: { identity: '0e3a114ddff153a95a00fa601a6d88e23db52ed3b1b43e1536b38b9cfc1b51ec', note: 'Access4U Fall 2026 list = the whole active line (owner source-of-truth 2026-10-27 Angelo 2026-10-27 17:40)' },
  corsicana: { identity: 'eb940470e93a9643d9a5e744fef02b4bda0bb4841952906f390a120fc6a7244e', note: 'Corsicana Healthcare 2026 rev workbook (owner 2026-10-27): MSRP as listed, SB10MATPRON1-TL case of 10, LBHR/LBCW official photos' },
  'abm-respiratory-care': { identity: 'de0548731a75f324941bdf00ef468710961a5418dcf61be96c3fe4b26511adb4', note: 'ABM Respiratory Care 2026 — new line, first version (BiWaze Clear + Cough schedules, owner 2026-10-27)', new_line: true },
  'airavant-bongorx': { identity: 'c0f492e4e3845f9f18e1e667f4fe6c67ab834f28aee48e378479152df159fa81', note: 'Bongo Rx Price List 2026 (18023 Rev F): MAP, section mix-and-match pools (owner 2026-10-27)' },
  pedifix: { identity: '158233406b5bbef820baf0fc05f9080f63e837ef6b33255a4b86b514bd1ecbe4', note: 'PediFix 2025 Retail Order Form REV1025 (OTC, eff. 7/1/25; row 543 REV0725) = the whole active line (owner 2026-10-27)' },
};
module.exports = { currentLines, RETIRED, UPDATED };
