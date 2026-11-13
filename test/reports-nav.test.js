'use strict';
/* REPORTS NAVIGATION + CLICKABLE TRACKING (owner 2026-11-13, James Medical). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const grab = n => { const k = H.indexOf('function ' + n + '('); if (k < 0) throw new Error('missing ' + n); let d = 0, j = H.indexOf('{', k); for (;; j++) { if (H[j] === '{') d++; else if (H[j] === '}') { d--; if (!d) break; } } return H.slice(k, j + 1); };
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const ctx = { esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), encodeURIComponent };
vm.createContext(ctx); vm.runInContext(grab('rptNavHtml') + grab('orderTrackHtml') + ';this.nav=rptNavHtml;this.trk=orderTrackHtml;', ctx);
t('the same three tabs on every Reports screen, the active one marked', () => {
  for (const a of ['overview', 'total', 'orders']) { const h = ctx.nav(a);
    for (const l of ['Overview', 'Total Sales', 'Orders &amp; Tracking']) if (!h.includes(l)) throw new Error(a + ' missing ' + l);
    if ((h.match(/rpt-tab on/g) || []).length !== 1 || !new RegExp(`aria-selected="true"[^>]*>${a === 'overview' ? 'Overview' : a === 'total' ? 'Total Sales' : 'Orders'}`).test(h)) throw new Error('active ' + a); }
});
t('Orders & Tracking renders the tabs; Overview / Total Sales come back to the loaded report (no reload)', () => {
  if (!/\$\{typeof rptNavHtml==='function'\?rptNavHtml\('orders'\):''\}/.test(H)) throw new Error('orders view nav');
  if (!/if\(RPT_KEEP&&RPT\)\{ RPT_KEEP=false; renderReports\(\); return; \}/.test(H)) throw new Error('report kept');
  if (!/#view-orders \.rpt-tab\{/.test(H)) throw new Error('tab style on the orders view');
});
t('tracking: UPS numbers link to UPS; others are text "carrier not confirmed"; several shipments all shown; none → not yet available', () => {
  const u = ctx.trk('1Z999AA10123456784'); if (!/href="https:\/\/www\.ups\.com\/track\?tracknum=1Z999AA10123456784"/.test(u)) throw new Error(u);
  const f = ctx.trk('794612345678'); if (/href/.test(f) || !/carrier not confirmed/.test(f)) throw new Error(f);
  const m = ctx.trk('1Z999AA10123456784, 794612345678 1Z999AA10123456784'); if (!/2 shipments/.test(m)) throw new Error(m);
  if (ctx.trk('') !== 'Tracking not yet available.' || /href/.test(ctx.trk('javascript:alert(1)'))) throw new Error('empty / unsafe');
});
console.log(`\nreports nav: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
