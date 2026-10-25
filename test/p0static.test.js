/* P0 (2026-10-23, issue #2) — nothing the site publishes carries a wholesale price.
   Scans every file under public/ (what Netlify publishes): JSON for commercial keys at any depth and
   for dollar amounts in any string; HTML / JS / text for a priced literal (`$12.34`, `base_price:12`).
   Also checks the CDN rule for /data/* and that the scan itself can fail (a planted price is caught).
   Usage: node test/p0static.test.js [publish dir] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PUB = process.argv[2] || process.env.PUBLISH_DIR || path.join(ROOT, 'public');
const CC = require(path.join(ROOT, 'netlify', 'functions', '_catalog_commercial.js'));

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }
const ok = (c, m) => { if (!c) throw new Error(m); };

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const MONEY = /\$\s?\d[\d,]*(?:\.\d{2})?/;
/* Dollar figures that are not wholesale prices: the empty cart total, freight thresholds that the
   storefront states to every dealer (manufacturers.json / Corsicana LTL), and "$0" wording. */
const ALLOWED = new Set(['$0.00', '$0', '$1', '$2,500', '$15']);   // $1 = a regex back-reference in the page's code
/* Freight TERMS (manufacturers.json `freight`, shown to every dealer at checkout) are terms, not
   wholesale prices; whether they should also leave the public file is an owner decision (see
   docs/security/P0_PRICE_EXPOSURE.md). Every other path is scanned. */
const SKIP_PATH = (rel, p) => rel === path.join('data', 'manufacturers.json') && /^\[\d+\]\.freight\./.test(p);
const moneyIn = s => (String(s).match(new RegExp(MONEY.source, 'g')) || []).filter(m => !ALLOWED.has(m.replace(/\s/g, '')));
function jsonFindings(j, rel) {
  const out = CC.commercialKeysIn(j).map(p => rel + p);
  const walkV = (v, p) => { if (typeof v === 'string') { const m = SKIP_PATH(rel, p) ? [] : moneyIn(v); if (m.length) out.push(`${rel}${p} = "${v.slice(0, 60)}"`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walkV(x, p + '[' + i + ']'));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => walkV(v[k], p + '.' + k)); };
  walkV(j, ''); return out;
}
function textFindings(txt, rel) {
  const out = [];
  txt.split('\n').forEach((line, i) => {
    moneyIn(line).forEach(m => out.push(`${rel}:${i + 1} ${m}`));
    if (/\b(base_price|dealer_price|unit_cost)\s*["']?\s*:\s*\d/.test(line)) out.push(`${rel}:${i + 1} priced literal`);
  });
  return out;
}
function scan(dir) {
  const found = [];
  for (const f of walk(dir)) {
    const rel = path.relative(dir, f);
    if (/\.json$/i.test(f)) found.push(...jsonFindings(JSON.parse(fs.readFileSync(f, 'utf8')), rel));
    else if (/\.(html?|js|mjs|css|txt|csv|md|xml|svg)$/i.test(f) || !path.extname(f)) found.push(...textFindings(fs.readFileSync(f, 'utf8'), rel));
  }
  return found;
}

t('no published JSON file carries a commercial key or a dollar figure', () => {
  const f = walk(PUB).filter(x => /\.json$/i.test(x)).flatMap(x => jsonFindings(JSON.parse(fs.readFileSync(x, 'utf8')), path.relative(PUB, x)));
  ok(!f.length, f.length + ' finding(s): ' + f.slice(0, 8).join(' | '));
});
t('no published page, script or text file carries a priced literal', () => {
  const f = walk(PUB).filter(x => !/\.json$/i.test(x) && (/\.(html?|js|mjs|css|txt|csv|md|xml|svg)$/i.test(x) || !path.extname(x)))
    .flatMap(x => textFindings(fs.readFileSync(x, 'utf8'), path.relative(PUB, x)));
  ok(!f.length, f.length + ' finding(s): ' + f.slice(0, 8).join(' | '));
});
t('every catalog file is still there, still a list, every row still has its part number (only prices left)', () => {
  const list = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'manufacturers.json'), 'utf8'));
  for (const m of list.filter(m => m.hasData)) {
    const j = JSON.parse(fs.readFileSync(path.join(PUB, 'data', m.slug + '.json'), 'utf8'));
    ok(Array.isArray(j) && j.every(r => r && r.code != null && r.code !== ''), m.slug);
  }
});
t('the scan really finds a planted price (the test can fail)', () => {
  const os = require('os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p0scan-'));
  fs.mkdirSync(path.join(tmp, 'data'));
  fs.writeFileSync(path.join(tmp, 'data', 'x.json'), JSON.stringify([{ code: 'A', tiers: [] }]));
  fs.writeFileSync(path.join(tmp, 'data', 'y.json'), JSON.stringify([{ code: 'B', note: 'Volume 2+ $12.50' }]));
  fs.writeFileSync(path.join(tmp, 'p.html'), '<script>const p={base_price: 9};</script><p>Dealer $47.00</p>');
  const f = scan(tmp); fs.rmSync(tmp, { recursive: true, force: true });
  ok(f.some(x => /x\.json.*tiers/.test(x)) && f.some(x => /y\.json/.test(x)) && f.some(x => /priced literal/.test(x)) && f.some(x => /\$47\.00/.test(x)), f.join(' | '));
});
t('the CDN never caches /data/* (no stale published copy after a deploy)', () => {
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  ok(/for\s*=\s*"\/data\/\*"[\s\S]*?Cache-Control\s*=\s*"no-store"/.test(toml), 'missing no-store on /data/*');
});
t('the old Partner 360 admin pages that still sit in public/ are redirected away (never served)', () => {
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  for (const f of fs.readdirSync(path.join(PUB, 'admin'))) {
    const paths = ['/admin/' + f]; if (/\.html$/.test(f) && f !== 'index.html') paths.push('/admin/' + f.replace(/\.html$/, ''));
    for (const p of paths)   // Netlify serves x.html at /x too ("pretty URLs") — both must be redirected
      ok(new RegExp('from\\s*=\\s*"' + p.replace(/[.]/g, '\\.') + '"\\s*\\n\\s*to\\s*=\\s*"[^"]+"\\s*\\n\\s*status\\s*=\\s*\\d+\\s*\\n\\s*force\\s*=\\s*true').test(toml), p + ' is not force-redirected');
  }
});
console.log(`\np0 static assets: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
