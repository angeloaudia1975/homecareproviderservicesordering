'use strict';
/* Retired manufacturer lines (owner 2026-10-23 Complete Medical; 2026-11-04 Ohio Medical / GCE, replaced by Yuwell).
   A retired line is never listed, never priced, never ordered, whatever the dealer_manufacturers rows say, and
   correcting its identifier on either side ("gce" / "ohio-medical") can never re-open it. Historical rows,
   account numbers, orders and commissions are kept in the database untouched. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const R = require(path.join(ROOT, 'netlify', 'functions', '_retired_lines.js'));
const H = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const MF = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'manufacturers.json'), 'utf8'));
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const WANT = ['complete-medical-supplies', 'gce', 'ohio-medical'];

t('the server list holds every retired identifier, Ohio Medical under BOTH spellings', () => {
  const got = Object.keys(R.RETIRED_LINES).sort(); if (JSON.stringify(got) !== JSON.stringify(WANT)) throw new Error(got.join());
  for (const s of ['gce', 'ohio-medical', 'OHIO-MEDICAL', ' gce ']) if (!R.isRetiredLine(s)) throw new Error(s);
  for (const s of ['access4u', 'pedifix', 'yuwell', '', null]) if (R.isRetiredLine(s)) throw new Error('live line retired: ' + s);
  if (!Object.isFrozen(R.RETIRED_LINES)) throw new Error('list not frozen');
});
t('the storefront filters the same list out of manufacturers.json and out of new quotes', () => {
  const m = /const RETIRED_LINE_SLUGS=(\[[^\]]*\]);/.exec(H); if (!m) throw new Error('RETIRED_LINE_SLUGS missing');
  const list = JSON.parse(m[1]).sort(); if (JSON.stringify(list) !== JSON.stringify(WANT)) throw new Error('storefront list differs: ' + list);
  if (!/state\.manufacturers = \(\(await r\.json\(\)\)\|\|\[\]\)\.filter\(m=>m&&!RETIRED_LINE_SLUGS\.includes/.test(H)) throw new Error('loadManufacturers does not filter');
  if (!/function quotableLine\(slug\)\{ if\(typeof RETIRED_LINE_SLUGS!=="undefined"&&RETIRED_LINE_SLUGS\.includes/.test(H)) throw new Error('quotableLine does not refuse retired lines');
});
t('no retired line is listed, and no public catalog file or product photo folder is left for one', () => {
  for (const m of MF) if (R.isRetiredLine(m.slug)) throw new Error('listed: ' + m.slug);
  for (const s of WANT) {
    if (fs.existsSync(path.join(ROOT, 'public', 'data', s + '.json'))) throw new Error('catalog file left: ' + s);
    if (fs.existsSync(path.join(ROOT, 'public', 'data', 'content', s + '.json'))) throw new Error('content file left: ' + s);
    if (fs.existsSync(path.join(ROOT, 'public', 'assets', 'products', s))) throw new Error('photo folder left: ' + s);
  }
});
t('historical orders of a retired line keep its name — never the bare slug', () => {
  const m = /const RETIRED_LINE_NAMES=(\{[^}]*\});/.exec(H); if (!m) throw new Error('RETIRED_LINE_NAMES missing');
  const names = JSON.parse(m[1]); for (const s of WANT) if (!names[s]) throw new Error('no name for ' + s);
  if (names.gce !== names['ohio-medical']) throw new Error('the two Ohio Medical spellings show different names');
  for (const re of [/\|\| retiredLineName\(o\.manufacturer\) \|\| o\.manufacturer/, /name:retiredLineName\(slug\)\|\|slug\}/, /return m\?m\.name:\(retiredLineName\(slug\)\|\|slug\)/])
    if (!re.test(H)) throw new Error('history view does not use the retired name: ' + re);
  const fn = new Function(m[0] + ' function retiredLineName(slug){ return RETIRED_LINE_NAMES[String(slug||"").toLowerCase()]||null; } return retiredLineName;')();
  if (fn('GCE') !== 'Ohio Medical / GCE' || fn('yuwell') !== null) throw new Error('retiredLineName wrong');
});
t('both server gates consult the list before any entitlement or staff check', () => {
  for (const f of ['catalog-feed.js', 'catalog-layers.js']) {
    const s = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', f), 'utf8');
    const i = s.indexOf('RETIRED.isRetiredLine(slug)'), j = s.indexOf('who.kind === "staff"');
    if (i < 0) throw new Error(f + ': no retired-line gate'); if (j >= 0 && i > j) throw new Error(f + ': staff are checked before the retired gate');
  }
});
t('the admin site holds the identical list (when its checkout is beside this one)', () => {
  const other = process.env.ADMIN_REPO || path.join(ROOT, '..', 'homecareproviderservices');
  const f = path.join(other, 'netlify', 'functions', '_retired_lines.js');
  if (!fs.existsSync(f)) { console.log('     (admin checkout not found — set ADMIN_REPO to compare)'); return; }
  const A = require(f); if (JSON.stringify(A.RETIRED_LINES) !== JSON.stringify(R.RETIRED_LINES)) throw new Error('the two repos disagree');
});
console.log(`\nretired lines: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
