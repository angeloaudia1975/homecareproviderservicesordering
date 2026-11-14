#!/usr/bin/env node
/* Catalog enrichment audit (owner 2026-11-14 §5) — READ-ONLY. For every manufacturer on the storefront's list and every
   product in its catalog file, joined with the enrichment pages the storefront actually shows (product_content, the
   same public read and visibility statuses as the shop), reports per field: verified complete / missing / not
   applicable / pending verification. No prices are read or printed (wholesale prices are server-only).
   node scripts/catalog-enrichment-audit.js [--json out.json] [--md out.md]   (needs network to the HCPS Supabase project) */
'use strict';
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
const HTML = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const URL_ = (HTML.match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1], KEY = (HTML.match(/SUPABASE_ANON:\s*"([^"]+)"/) || [])[1];
const VISIBLE = ['published', 'active', 'discontinued'];
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
/* Products where an HCPCS code does not apply (accessories, parts, supplies sold to dealers that are not billed alone) */
const HCPCS_NA = /\b(battery|batteries|charger|adapter|cord|power supply|backpack|rucksack|bag|case|filter|sieve|wrench|tool|cannula filter|replacement|parts?|kit|display|tubing|strap|cushion|cover|pouch|holder|bracket|mount)\b/i;
const HCPCS_LIKELY = /concentrator|wheelchair|walker|rollator|cane|crutch|commode|shower chair|tub transfer|bed rail|hospital bed|nebulizer|cpap|brace|orthosis|splint|boot|walking boot|knee|ankle|wrist|lumbar|cervical|compression|seat cushion|lift chair|toilet seat|raised toilet/i;

async function pages(slug) {
  const r = await fetch(`${URL_}/rest/v1/product_content?manufacturer=eq.${encodeURIComponent(slug)}&status=in.(${VISIBLE.join(',')})&select=page_key,status,disabled,skus,name,description,features,billing_codes,specs,warranty,source_url,image,images_gallery,documents,videos,options`, { headers: { apikey: KEY, authorization: 'Bearer ' + KEY } });
  if (!r.ok) throw new Error('product_content ' + r.status);
  return (await r.json()).filter((p) => p.disabled !== true);
}
const nonEmpty = (v) => Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : !!String(v || '').trim();
const imgOk = (u) => { if (!u) return false; if (/^https?:/.test(u)) return 'remote'; return fs.existsSync(path.join(PUB, u.replace(/^\//, ''))); };

(async () => {
  const mfrs = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'manufacturers.json'), 'utf8'));
  const report = [];
  for (const m of mfrs) {
    const slug = m.slug || m.id; const file = path.join(PUB, 'data', (m.catalogFile || slug) + '.json');
    let rows = []; try { rows = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(rows)) rows = rows.products || []; } catch (e) { rows = null; }
    let pg = []; let pgErr = null; try { pg = await pages(slug); } catch (e) { pgErr = e.message; }
    const pageOf = (code) => pg.find((p) => (p.skus || []).some((s) => String(s.code || s.sku || s).toUpperCase() === String(code).toUpperCase()));
    const prods = (rows || []).map((r) => {
      const p = pageOf(r.code) || null; const nm = (p && p.name) || r.name || '';
      const img = (p && (p.image || (p.images_gallery || [])[0])) || r.image;
      const gallery = p ? (p.images_gallery || []).length : 0;
      const desc = (p && p.description) || r.description || '';
      const hc = (p && nonEmpty(p.billing_codes)) || !!String(r.hcpc || '').trim();
      const st = {
        identity: r.code && nm ? 'complete' : 'missing',
        primary_image: img ? (imgOk(typeof img === 'object' ? img.url : img) ? 'complete' : 'missing (file not found)') : 'missing',
        additional_images: gallery > 1 ? 'complete' : p ? 'missing' : 'pending (no enrichment page)',
        description: desc.length >= 80 ? 'complete' : desc ? 'thin' : 'missing',
        features: p && nonEmpty(p.features) ? 'complete' : p ? 'missing' : 'pending (no enrichment page)',
        specifications: p && nonEmpty(p.specs) ? 'complete' : /weight|lbs|capacity|dimension|flow|size/i.test(desc) ? 'in description' : 'missing',
        warranty: p && nonEmpty(p.warranty) ? 'complete' : /warrant/i.test(desc) ? 'in description' : 'pending verification',
        hcpcs: hc ? 'complete' : /concentrator/i.test(nm) ? 'pending verification' : HCPCS_NA.test(nm) ? 'not applicable' : HCPCS_LIKELY.test(nm + ' ' + (r.category || '')) ? 'missing' : 'pending verification',
        documents: p && nonEmpty(p.documents) ? 'complete' : r.details_url ? 'manufacturer page link' : 'missing',
        enrichment_page: p ? p.status : 'none',
      };
      return { code: r.code, name: nm.slice(0, 90), status: st };
    });
    const count = (k, v) => prods.filter((x) => String(x.status[k]).startsWith(v)).length;
    const keys = ['identity', 'primary_image', 'additional_images', 'description', 'features', 'specifications', 'warranty', 'hcpcs', 'documents'];
    const summary = {}; for (const k of keys) summary[k] = { complete: count(k, 'complete') + count(k, 'in description') + count(k, 'manufacturer page'), missing: count(k, 'missing') + count(k, 'thin'), na: count(k, 'not applicable'), pending: count(k, 'pending') };
    report.push({ slug, name: m.name, file: rows ? path.basename(file) : 'missing', products: prods.length, enrichment_pages: pg.length, pages_error: pgErr, summary, products_detail: prods });
  }
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify({ generated: new Date().toISOString(), report }, null, 2));
  const md = ['| Manufacturer | Products | Enrichment pages | Image | Extra images | Description | Features | Specs | Warranty | HCPCS (done / n.a. / missing / pending) | Docs |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of report) { const s = r.summary, f = (k) => `${s[k].complete}/${r.products}`;
    md.push(`| ${r.name} | ${r.products} | ${r.enrichment_pages} | ${f('primary_image')} | ${f('additional_images')} | ${f('description')} | ${f('features')} | ${f('specifications')} | ${f('warranty')} | ${s.hcpcs.complete} / ${s.hcpcs.na} / ${s.hcpcs.missing} / ${s.hcpcs.pending} | ${f('documents')} |`); }
  if (arg('--md')) fs.writeFileSync(arg('--md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
