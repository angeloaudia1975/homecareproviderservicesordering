#!/usr/bin/env node
/* P0 (2026-10-23): fetch the live layer tables the parity test (test/p0parity.test.js) runs on, into
   test/fixtures-private/ — a GITIGNORED folder. These rows carry real prices; they are never committed
   (this repository is public). Reads with SUPABASE_SERVICE_ROLE when it is set (needed once the lock
   SQL has run), otherwise with the storefront's public key, read from public/index.html at run time.
   Read-only: GET requests only. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const URL = process.env.SUPABASE_URL || (/SUPABASE_URL:\s*"([^"]+)"/.exec(html) || [])[1];
const KEY = process.env.SUPABASE_SERVICE_ROLE || (/SUPABASE_ANON:\s*"([^"]+)"/.exec(html) || [])[1];
const OUT = path.join(ROOT, 'test', 'fixtures-private');
const TABLES = ['custom_products', 'product_overrides', 'product_content', 'product_links', 'product_media', 'manufacturer_meta'];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const t of TABLES) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=10000`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.error(`${t}: HTTP ${r.status}`); process.exitCode = 1; continue; }
    const rows = await r.json();
    fs.writeFileSync(path.join(OUT, t + '.json'), JSON.stringify(rows));
    console.log(`${t}: ${rows.length} row(s)`);
  }
})();
