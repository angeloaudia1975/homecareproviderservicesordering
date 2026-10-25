#!/usr/bin/env node
/* P0 (2026-10-23, issue #2) — outside check with the PUBLIC key only (RULE 19). Read-only: GET requests.
     node scripts/p0-public-probe.js [storefront base, default https://hcpsonlineordering.netlify.app]
   PASS when: no published catalog file carries a commercial key; the public key reads nothing from
   catalog_file_commercial / custom_products / product_overrides (401/42501, or 0 rows); catalog-layers answers
   401 without a credential. The key and project URL are read from the deployed page, never stored here.
   Before the lock SQL runs, custom_products / product_overrides are EXPECTED to still read (reported OPEN). */
const CC = require('../netlify/functions/_catalog_commercial.js');
const BASE = (process.argv[2] || 'https://hcpsonlineordering.netlify.app').replace(/\/$/, '');
(async () => {
  const html = await (await fetch(BASE + '/index.html', { cache: 'no-store' })).text();
  const URL = (/SUPABASE_URL:\s*"([^"]+)"/.exec(html) || [])[1], KEY = (/SUPABASE_ANON:\s*"([^"]+)"/.exec(html) || [])[1];
  let bad = 0; const line = (ok, what) => { if (!ok) bad++; console.log((ok ? 'BLOCKED/CLEAN ' : 'OPEN          ') + what); };
  const mfrs = await (await fetch(BASE + '/data/manufacturers.json', { cache: 'no-store' })).json();
  for (const s of mfrs.map(m => m.slug).concat(require('./p0-lines.js').RETIRED)) {   // retired URLs: 404 or no commercial field
    const r = await fetch(`${BASE}/data/${s}.json`, { cache: 'no-store' });
    if (r.status === 404) { line(true, `/data/${s}.json (404)`); continue; }
    const found = CC.commercialKeysIn(await r.json()); line(!found.length, `/data/${s}.json ${found.length ? found.length + ' commercial field(s)' : 'no commercial field'}`);
  }
  for (const t of ['catalog_file_commercial', 'custom_products', 'product_overrides']) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const body = await r.text(); let rows = null; try { rows = JSON.parse(body); } catch (e) {}
    const denied = r.status === 401 || r.status === 403 || /42501/.test(body) || (Array.isArray(rows) && rows.length === 0) || r.status === 404;
    line(denied, `${t}: HTTP ${r.status}${Array.isArray(rows) ? ', ' + rows.length + ' row(s)' : ''}`);
  }
  const l = await fetch(`${BASE}/.netlify/functions/catalog-layers?manufacturer=bemis&identity=${'0'.repeat(64)}`);
  line(l.status === 401 || l.status === 404, `catalog-layers without a credential: HTTP ${l.status}`);
  console.log(bad ? `\n${bad} OPEN` : '\nALL BLOCKED / CLEAN'); process.exitCode = bad ? 1 : 0;
})();
