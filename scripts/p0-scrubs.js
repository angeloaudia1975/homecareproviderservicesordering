/* P0 (2026-10-23): a price written into a NON-commercial text field of a public catalog file (one
   case found: a retired Complete Medical description ending "From $<price>/ea."). The scrub list
   names the row and field and the SHA-256 of the original text — never the text itself, because
   this repository is public — and the replacement. Applied by the strip and seed scripts and the
   tests alike, so the published file, the overlay check and the parity test agree. */
const crypto = require('crypto'), path = require('path');
const SCRUBS = require(path.join(__dirname, 'p0-public-scrubs.json'));
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
function applyScrubs(slug, rows) {
  (SCRUBS || []).filter(s => s.file === slug).forEach(s => (rows || []).forEach(r => {
    if (r && String(r.code) === String(s.code) && typeof r[s.field] === 'string' && sha(r[s.field]) === s.from_sha256) r[s.field] = s.to;
  }));
  return rows;
}
module.exports = { applyScrubs, SCRUBS };
