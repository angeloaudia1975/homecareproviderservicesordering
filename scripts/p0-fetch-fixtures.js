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
/* Reads every row in pages of 1,000 (PostgREST caps one answer at its max-rows; a single big request was silently cut
   short) and checks the total the server reports (Prefer: count=exact) — a short or duplicated read fails the run.
   Only counts and HTTP statuses are printed: never a row, a price or a server message body. GET only. */
const PAGE = 1000;
async function readAll(t) {
  const rows = [], seen = new Set(); let total = null;
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*`, { method: 'GET', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`,
      Prefer: 'count=exact', 'Range-Unit': 'items', Range: `${from}-${from + PAGE - 1}` } });
    if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`);
    const cr = /\/(\d+)$/.exec(r.headers.get('content-range') || ''); if (cr) total = Number(cr[1]);
    let page; try { page = await r.json(); } catch (e) { throw new Error('answer was not JSON'); }
    if (!Array.isArray(page)) throw new Error('answer was not a list');
    for (const x of page) { const k = JSON.stringify(x); if (seen.has(k)) throw new Error('the same row came back twice (unstable paging)'); seen.add(k); rows.push(x); }
    if (page.length < PAGE) break;
  }
  if (total == null) throw new Error('no row total reported');
  if (rows.length !== total) throw new Error(`read ${rows.length} of ${total} rows`);
  return rows;
}
(async () => {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(URL || ''))) { console.error('Supabase address not found or not https'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  for (const t of TABLES) {
    try { const rows = await readAll(t); fs.writeFileSync(path.join(OUT, t + '.json'), JSON.stringify(rows)); console.log(`${t}: ${rows.length} row(s)`); }
    catch (e) { console.error(`${t}: ${e.message}`); process.exitCode = 1; }
  }
})();
