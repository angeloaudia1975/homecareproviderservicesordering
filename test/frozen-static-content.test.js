/* Per-page content (2026-11-16) review F1: a frozen Gold Standard line's dealer content is guarded in the database
   (mfr_content_guard). With per-page merge a visible page in its static content file would reach dealers through git,
   bypassing that guard — so a frozen line must have no static content file, or one with 0 visible pages. */
const fs = require('fs'), path = require('path');
const FROZEN = ['climbing-steps', 'strongback-mobility', 'ovation-medical', 'bemis'];
const VIS = ['published', 'active', 'discontinued'];
let fail = 0;
for (const s of FROZEN) {
  const f = path.join(__dirname, '..', 'public', 'data', 'content', s + '.json');
  if (!fs.existsSync(f)) { console.log('ok   ' + s + ': no static content file'); continue; }
  const pg = (JSON.parse(fs.readFileSync(f, 'utf8')).pages) || {};
  const vis = Object.keys(pg).filter(k => pg[k] && pg[k].disabled !== true && VIS.includes(pg[k].status));
  if (vis.length) { fail++; console.log('FAIL ' + s + ': ' + vis.length + ' visible static page(s) on a frozen line: ' + vis.slice(0, 5).join(', ')); }
  else console.log('ok   ' + s + ': static file has 0 visible pages');
}
console.log(fail ? `\n${fail} FAILED` : '\nfrozen-static-content: ALL PASS'); process.exit(fail ? 1 : 0);
