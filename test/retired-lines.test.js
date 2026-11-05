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
let pass = 0, fail = 0; let chain = Promise.resolve(); const t = (n, f) => { chain = chain.then(async () => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }); };
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
  if (!/state\.manufacturers = \(\(await r\.json\(\)\)\|\|\[\]\)\.filter\(m=>m&&!isRetiredSlug\(m\.slug\)\)/.test(H)) throw new Error('loadManufacturers does not filter');
  if (!/function quotableLine\(slug\)\{ if\(typeof isRetiredSlug==="function"&&isRetiredSlug\(slug\)\) return false;/.test(H)) throw new Error('quotableLine does not refuse retired lines');
  // the price list / showroom re-read of manufacturers.json filters too, and curated "also available" rows skip retired lines
  if (!/const mf=\(\(await fetch\('\/data\/manufacturers\.json'\)[^\n]*\.filter\(m=>m&&!isRetiredSlug\(m\.slug\)&&\(!shopList\|\|shopList\.has\(String\(m\.slug\)\)\)\)/.test(H)) throw new Error('loadPricing reads the unfiltered list');
  if (!/\(cur\|\|\[\]\)\.filter\(r=>r&&!isRetiredSlug\(r\.related_manufacturer\)/.test(H)) throw new Error('curated related rows not filtered');
  // one normalisation: trimmed + case-insensitive, like the servers
  const m2 = /function isRetiredSlug\(slug\)\{[^\n]*\}/.exec(H); if (!m2) throw new Error('isRetiredSlug missing');
  const L = /const RETIRED_LINE_SLUGS=(\[[^\]]*\]);/.exec(H)[0];
  const f = new Function(L + m2[0] + ' return isRetiredSlug;')();
  for (const v of ['gce', ' GCE ', 'Ohio-Medical', 'complete-medical-supplies']) if (!f(v)) throw new Error('not retired: ' + JSON.stringify(v));
  for (const v of ['yuwell', 'pedifix', '', null]) if (f(v)) throw new Error('live retired: ' + v);
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
t('the legacy catalog-api answers 410 for a retired line, read or write, before touching the database', async () => {
  process.env.SUPABASE_URL = 'https://sb.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'x'; process.env.ANALYTICS_TOKEN = 'tok-test-1234';
  const HD = { 'x-analytics-token': 'tok-test-1234' };
  const realFetch = global.fetch; let calls = 0; global.fetch = async () => { calls++; throw new Error('network'); };
  try {
    const api = require(path.join(ROOT, 'netlify', 'functions', 'catalog-api.js'));
    for (const q of ['gce', 'ohio-medical', ' Ohio-Medical ', 'complete-medical-supplies']) {
      const r = await api.handler({ httpMethod: 'GET', headers: HD, queryStringParameters: { manufacturer: q } });
      if (r.statusCode !== 410) throw new Error('GET ' + q + ' -> ' + r.statusCode);
    }
    for (const b of [{ action: 'save_product', manufacturer: 'gce', product: { code: 'X' } }, { action: 'save_override', manufacturer: 'ohio-medical', code: 'X', patch: {} }, { action: 'save_product', product: { manufacturer: 'GCE', code: 'X' } }]) {
      const r = await api.handler({ httpMethod: 'POST', headers: HD, body: JSON.stringify(b) });
      if (r.statusCode !== 410) throw new Error('POST ' + JSON.stringify(b) + ' -> ' + r.statusCode);
    }
    if (calls) throw new Error('database or network was called ' + calls + ' times');
  } finally { global.fetch = realFetch; }
});
t('legacy catalog-api fails closed: no token configured → 503, wrong or missing token → 401, before any read', async () => {
  process.env.SUPABASE_URL = 'https://sb.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'x';
  const realFetch = global.fetch; let calls = 0; global.fetch = async () => { calls++; throw new Error('network'); };
  try {
    const api = require(path.join(ROOT, 'netlify', 'functions', 'catalog-api.js'));
    delete process.env.ANALYTICS_TOKEN;
    for (const h of [{}, { 'x-analytics-token': '' }, { 'x-analytics-token': 'anything' }]) {
      const r = await api.handler({ httpMethod: 'GET', headers: h, queryStringParameters: { manufacturer: 'dalton' } });
      if (r.statusCode !== 503) throw new Error('unset token answered ' + r.statusCode);
    }
    process.env.ANALYTICS_TOKEN = 'tok-test-1234';
    for (const h of [{}, { 'x-analytics-token': 'tok-test-123' }, { 'x-analytics-token': 'tok-test-12345' }]) {
      for (const ev of [{ httpMethod: 'GET', headers: h, queryStringParameters: { manufacturer: 'dalton' } }, { httpMethod: 'POST', headers: h, body: '{"action":"save_product","manufacturer":"dalton","product":{"code":"X"}}' }]) {
        const r = await api.handler(ev); if (r.statusCode !== 401) throw new Error(ev.httpMethod + ' with ' + JSON.stringify(h) + ' answered ' + r.statusCode);
      }
    }
    if (calls) throw new Error('reached the network ' + calls + ' times');
  } finally { global.fetch = realFetch; }
});
t('the line switch: manufacturer_meta.active = false removes the line from the storefront list', () => {
  if (!/manufacturer_meta\?select=slug,logo_url,enriched_only,category_order,category_map,freight_terms,active`/.test(H)) throw new Error('active not selected');
  if (!/const off=new Set\(\(lg\|\|\[\]\)\.filter\(o=>o&&o\.active===false\)/.test(H)) throw new Error('active=false not honoured');
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
chain.then(() => { console.log(`\nretired lines: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); });
