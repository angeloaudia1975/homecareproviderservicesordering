/* P0 (2026-10-23, issue #2) — mutation harness for the dealer-price lock-down.
   Each mutant reopens one hole (an anonymous or non-entitled caller gets prices, a failure falls back
   to a public copy, a stale public price survives the restore, the answer gets cached …) and must be
   KILLED by the P0 suites. The CONTROL mutant changes nothing that matters and must SURVIVE. */
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), FN = path.join(ROOT, 'netlify', 'functions');
const F = { layers: path.join(FN, 'catalog-layers.js'), feed: path.join(FN, 'catalog-feed.js'), cc: path.join(FN, '_catalog_commercial.js'),
            shop: path.join(ROOT, 'public', 'index.html'), hub: path.join(ROOT, 'public', 'dashboard.html'),
            seed: path.join(ROOT, 'scripts', 'p0-seed-lib.js') };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p0mut-'));

/* How each suite is pointed at a mutated copy. */
function suites(kind, file) {
  const n = p => path.join(__dirname, p);
  if (kind === 'layers') return [[n('p0layers.test.js'), file, F.feed]];
  if (kind === 'feed') return [[n('p0layers.test.js'), F.layers, file]];
  if (kind === 'shop') return [[n('p0shop.test.js'), file, F.hub], [n('p0commercial.test.js'), file], [n('p0parity.test.js'), file]];
  if (kind === 'hub') return [[n('p0shop.test.js'), F.shop, file], [n('p0commercial.test.js'), F.shop, { HUB: file }]];
  if (kind === 'cc') return [[n('p0commercial.test.js'), F.shop, { CC_MODULE: file }], [n('p0layers.test.js'), F.layers, F.feed, { CC_MODULE: file }]];
  if (kind === 'seed') return [[n('p0seed.test.js'), { SEED_LIB: file }]];
  throw new Error(kind);
}
const M = [
  ['layers', 'CONTROL — a comment', 'const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;', 'const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/; /* control */', 'survive'],
  ['layers', 'anonymous caller let through', 'if (!who) return { ok: false, status: 401, error: "unauthorized" };\n  if (!slug', 'if (!who) return { ok: true };\n  if (!slug'],
  ['layers', 'a dealer may read any line', '    return (who.lines || []).indexOf(slug) >= 0\n      ? { ok: true } : { ok: false, status: 403, error: "not entitled to this manufacturer" };', '    return { ok: true };'],
  ['layers', 'every staff role may read any line', 'return STAFF_ROLES.indexOf(String(who.role || "")) >= 0', 'return true'],
  ['layers', 'slug no longer validated', 'if (!slug || !SLUG_RE.test(slug))', 'if (!slug)'],
  ['layers', 'no commercial record answers empty instead of 503', 'if (!list.length) return { error: "this line has no commercial record yet" };',
    'if (!list.length) return { row: { identity_sha256: identity, rows: [] } };'],
  ['layers', 'an unreadable layer is swallowed', 'sb(`custom_products?manufacturer=eq.${e(slug)}&select=${LAYER_SELECT.custom_products}`),',
    'sb(`custom_products?manufacturer=eq.${e(slug)}&select=${LAYER_SELECT.custom_products}`).catch(() => []),'],
  ['layers', 'a malformed record is accepted', 'function validOverlay(rows, identity) {\n  return CC.validOverlayRecord', 'function validOverlay(rows, identity) {\n  return true || CC.validOverlayRecord'],
  ['layers', 'P0 review: the nearest stored version is answered for another public file', 'const row = list.find(r => r && r.identity_sha256 === identity);', 'const row = list.find(r => r && r.identity_sha256 === identity) || list[0];'],
  ['layers', 'P0 review: the identity is not required', 'if (!HEX64.test(identity)) return json(400,', 'if (false) return json(400,'],
  ['layers', 'P0 review: the answer does not say which version it is', '      identity_sha256: row.identity_sha256,\n', ''],
  ['layers', 'the answer may be cached', '"cache-control": "private, no-store, max-age=0",', '"cache-control": "public, max-age=300",'],
  ['layers', 'cross-origin reads allowed', '  "x-content-type-options": "nosniff",\n};', '  "x-content-type-options": "nosniff",\n  "access-control-allow-origin": "*",\n};'],
  ['layers', 'POST accepted', 'if (event.httpMethod !== "GET") return json(405, { error: "GET only" });', ''],
  ['feed', 'an expired preview token still works', '    if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) return null;\n', ''],
  ['feed', 'a pending dealer is treated as approved', 'if (!d || d.status !== "approved") return null;', 'if (!d) return null;'],
  ['feed', 'a deactivated staff login still counts', 'if (s && s.active !== false) return { kind: "staff"', 'if (s) return { kind: "staff"'],
  ['feed', 'an inactive line assignment entitles', '`dealer_manufacturers?dealer_id=eq.${encodeURIComponent(dealer_id)}&active=eq.true&select=manufacturer`', '`dealer_manufacturers?dealer_id=eq.${encodeURIComponent(dealer_id)}&select=manufacturer`'],
  ['shop', 'CONTROL — a comment in the engine', "  if(!jwt && !pvt) throw new Error('no dealer session or preview to authorise pricing');", "  if(!jwt && !pvt) throw new Error('no dealer session or preview to authorise pricing'); /* control */", 'survive'],
  ['shop', 'a failed load falls back to the public file', "    return [];\n  }\n  const H=", "    return prods;\n  }\n  const H="],
  ['shop', 'anonymous visitors still ask for the layers', "  if(!jwt && !pvt) throw new Error('no dealer session or preview to authorise pricing');\n", ''],
  ['shop', 'the preview token is not sent', "{ 'x-hcps-preview': pvt };\n  const r = await fetch('/.netlify/functions/catalog-layers", "{};\n  const r = await fetch('/.netlify/functions/catalog-layers"],
  ['shop', 'an incomplete answer is accepted', " || !Array.isArray(j.custom_products) || !Array.isArray(j.product_overrides))\n    throw", ")\n    throw"],
  ['shop', 'ok:false is accepted', "if(!j || j.ok!==true || !Array.isArray(j.file_overlay)", "if(!j || !Array.isArray(j.file_overlay)"],
  ['shop', 'a stale public price survives the restore', "      if(CATALOG_COMMERCIAL_KEYS.indexOf(key)>=0){ if(key in f) out[key]=nestedOrder(f[key]); }\n      else if(r && key in r) out[key]=r[key];\n    });\n    Object.keys(r||{}).forEach(key=>{ if(!(key in out) && CATALOG_COMMERCIAL_KEYS.indexOf(key)<0) out[key]=r[key]; });\n    Object.keys(f).forEach(key=>{ if(!(key in out) && CATALOG_COMMERCIAL_KEYS.indexOf(key)>=0) out[key]=nestedOrder(f[key]); });\n    return out;\n  });\n}\n/* The line's",
    "      if(CATALOG_COMMERCIAL_KEYS.indexOf(key)>=0){ if(key in f) out[key]=nestedOrder(f[key]); }\n      else if(r && key in r) out[key]=r[key];\n    });\n    Object.keys(r||{}).forEach(key=>{ if(!(key in out)) out[key]=r[key]; });\n    Object.keys(f).forEach(key=>{ if(!(key in out) && CATALOG_COMMERCIAL_KEYS.indexOf(key)>=0) out[key]=nestedOrder(f[key]); });\n    return out;\n  });\n}\n/* The line's"],
  ['shop', 'a short overlay is accepted', "  if(!Array.isArray(overlay) || overlay.length!==rows.length)\n    throw", "  if(!Array.isArray(overlay))\n    throw"],
  ['shop', 'P0 review: a row is matched by position even if its fingerprint differs', "    if(catalogRowPrint(r)!==o.h) throw new Error(", "    if(false) throw new Error("],
  ['shop', 'P0 review: an entry without a fingerprint is accepted', "    if(typeof o.h!=='string' || !/^[0-9a-f]{64}$/.test(o.h)) throw", "    if(false) throw"],
  ['shop', 'P0 review: commercial fields count towards a row\'s identity', "Object.keys(r).forEach(k=>{ if(CATALOG_COMMERCIAL_KEYS.indexOf(k)<0) p[k]=r[k]; });\n  return catalogSha256", "Object.keys(r).forEach(k=>{ p[k]=r[k]; });\n  return catalogSha256"],
  ['shop', 'P0 review: the row print ignores key VALUES (only names)', "  return catalogSha256(catalogCanon(p));", "  return catalogSha256(catalogCanon(Object.keys(p).sort()));"],
  ['shop', 'P0 review: the shop does not send its file\'s identity', "encodeURIComponent(slug) + '&identity=' + identity,", "encodeURIComponent(slug),"],
  ['shop', 'P0 review: an answer for another version is accepted', "  if(j.identity_sha256!==identity) throw", "  if(false) throw"],
  ['shop', 'P0 review: SHA-256 round constant wrong (pure-JS hash drifts from crypto)', "0x428a2f98,0x71374491,", "0x428a2f99,0x71374491,"],
  ['hub', 'P0 review: dashboard.html accepts another version\'s answer', "if(j&&j.ok===true&&j.identity_sha256===id&&Array.isArray", "if(j&&j.ok===true&&Array.isArray"],
  ['shop', 'the overlay may write a non-commercial field', "    Object.keys(f).forEach(key=>{ if(!(key in out) && CATALOG_COMMERCIAL_KEYS.indexOf(key)>=0) out[key]=nestedOrder(f[key]); });\n    return out;\n  });\n}\n/* The line's",
    "    Object.keys(f).forEach(key=>{ out[key]=nestedOrder(f[key]); });\n    return out;\n  });\n}\n/* The line's"],
  ['shop', 'the layer tables read with the public key again', "      Promise.resolve(layers.custom_products),\n", "      fetch(`${CONFIG.SUPABASE_URL}/rest/v1/custom_products?manufacturer=eq.${encodeURIComponent(slug)}&select=code,name,category,base_price,msrp,map,image,description,active,tiers,price_note`,{headers:H}).then(x=>x.ok?x.json():[]),\n"],
  ['shop', 'a commercial key dropped from the list', 'const CATALOG_COMMERCIAL_KEYS=["base_price","tiers","dealer_price","tier_prices","msrp","map","price_note","unit_cost","shipping","upgrades"];\n/* ROW IDENTITY',
    'const CATALOG_COMMERCIAL_KEYS=["base_price","tiers","dealer_price","msrp","map","price_note","unit_cost","shipping","upgrades"];\n/* ROW IDENTITY'],
  ['shop', 'Business Hub prices a line the dealer does not carry', "        if(hdr && carried.has(m.slug)){", "        if(hdr){"],
  ['shop', 'Business Hub keeps a stale public price when unpriced', "        if(!priced) items=items.map(p=>Object.assign({},p,{base_price:null,msrp:null,map:null}));\n", ''],
  ['shop', 'the catalog page says "coming soon" when pricing failed', "    if(_cs && _cs.source==='unavailable'){", "    if(false){"],
  ['hub', 'dashboard.html prices a line the dealer does not carry', "        if(hdr && carried.has(m.slug)){", "        if(hdr){"],
  ['hub', 'dashboard.html keeps a stale public price when unpriced', "        if(!priced) items=items.map(p=>Object.assign({},p,{base_price:null,msrp:null,map:null}));\n", ''],
  ['hub', 'dashboard.html restore drifts from the page', "    if(!o) throw new Error('catalog_file_mismatch: no commercial row for '+k);", "    if(!o) return r;"],
  ['cc', 'module: a commercial key dropped', '"tier_prices",', ''],
  ['cc', 'P0 review: module record check ignores the identity', "  return catalogSha256(rec.rows.map(o=>o.h).join('\\n'))===rec.identity_sha256;", "  return true;"],
  ['cc', 'P0 review: module record check accepts an entry without a fingerprint', "    if(typeof o.h!=='string' || !/^[0-9a-f]{64}$/.test(o.h)) return false;", ""],
  ['cc', 'P0 review: split stores no fingerprint', "overlay.push({k:keys[i], h:catalogRowPrint(r), order, f});", "overlay.push({k:keys[i], order, f});"],
  ['seed', 'P0 review: re-seed matches by position instead of fingerprint', "    const cand = (pool[h] || []).shift();", "    const cand = base && base.rows[i];"],
  ['seed', 'P0 review: re-seed guesses an edited row from its old price', "    report.unresolved.push(k);\n    overlay.push({ k, h, order: Object.keys(row), f: {} });", "    overlay.push({ k, h, order: Object.keys(row), f: {} });"],
  ['seed', 'P0 review: re-seed accepts a non-commercial supplied field', "else Object.keys(f).forEach(x => { if (CC.CATALOG_COMMERCIAL_KEYS.indexOf(x) < 0) problems.push(", "else Object.keys(f).forEach(x => { if (false) problems.push("],
  ['seed', 'P0 review: re-seed uses any stored version, not the deployed base', "const base = recs.find(r => r.identity_sha256 === baseIdentity) || null;", "const base = recs[0] || null;"],
  ['cc', 'module: split leaves prices in the public half', "    order.forEach(k=>{ if(CATALOG_COMMERCIAL_KEYS.indexOf(k)>=0) f[k]=r[k]; else p[k]=r[k]; });", "    order.forEach(k=>{ if(CATALOG_COMMERCIAL_KEYS.indexOf(k)>=0) f[k]=r[k]; p[k]=r[k]; });"],
];
let bad = 0;
console.log('mutant'.padEnd(64) + 'result'); console.log('-'.repeat(90));
for (const [kind, name, from, to, expect] of M) {
  const file = F[kind], src = fs.readFileSync(file, 'utf8'), n = src.split(from).length - 1;
  if (n !== 1) { console.log(name.padEnd(64) + `ANCHOR FOUND ${n}x — mutant is meaningless`); bad++; continue; }
  /* The seed library requires the module relative to its own folder, so its mutant sits beside it (removed after). */
  const mf = kind === 'seed' ? path.join(ROOT, 'scripts', '.mutant-p0-seed-lib.js') : path.join(TMP, kind + '-' + path.basename(file));
  fs.writeFileSync(mf, src.replace(from, to));
  const killedBy = [];
  for (const [test, ...args] of suites(kind, mf)) {
    const envX = args.find(a => a && typeof a === 'object') || {};
    try { execFileSync('node', [test, ...args.filter(a => typeof a === 'string')], { stdio: 'pipe', env: Object.assign({}, process.env, envX), timeout: 120000 }); }
    catch (e) { killedBy.push(path.basename(test)); }
  }
  const killed = killedBy.length > 0, want = expect === 'survive' ? false : true;
  if (killed !== want) bad++;
  if (kind === 'seed') fs.rmSync(mf, { force: true });
  console.log(name.padEnd(64) + (killed ? `killed by ${killedBy.join(', ')}` : 'survived') + (killed === want ? '' : '   <-- WRONG'));
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log('-'.repeat(90));
console.log(bad ? `${bad} mutant(s) did not behave as required.` : 'All mutants behaved as required (controls survived, every real mutant killed).');
process.exitCode = bad ? 1 : 0;
