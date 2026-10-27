/* P0 (2026-10-23, issue #2) — FROZEN-LINE PARITY: the new private path gives a dealer exactly what
   the old public path gave, field for field.

   TODAY'S PATH  = the storefront engine of the base commit (P0_BASE_REF), the priced catalog files of
                   that commit, and the layer tables read the way the page read them (public key).
   NEW PATH      = this tree's storefront engine, this tree's STRIPPED catalog files, and the same
                   layer rows delivered by catalog-layers together with the commercial overlay the seed
                   script stores (split from the base commit's files).
   Both run the REAL engine lifted from each page, with the same dealer session, contract prices, cart
   and master-record answer. Compared per product: EVERY field (price, tiers, pools, MSRP / msrp_auto,
   MAP, uom, case_qty, basis, price note, group, name, images, content, flags …); then unitPrice at
   1/2/3/5/6/8/10/11/20/21/50 with the contract prices applied; then freight on several carts. Run
   twice: lines priced from the layers, and lines whose master record is authoritative.
   It also proves the code that renders cards, packs, notes, the cart and freight did not change.

   Layer rows come from test/fixtures-private/ (gitignored — real prices never enter this public
   repository; fill it with scripts/p0-fetch-fixtures.js). Without them the test FAILS unless
   P0_ALLOW_NO_FIXTURES=1. Fingerprints for the four frozen lines are printed.
   Usage: node test/p0parity.test.js [new index.html] */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE_REF = process.env.P0_BASE_REF || '4b1bad3';
const NEW_HTML = fs.readFileSync(process.argv[2] || process.env.SHOP || path.join(ROOT, 'public', 'index.html'), 'utf8');
const FIX = process.env.P0_FIXTURES || path.join(ROOT, 'test', 'fixtures-private');
const { engine } = require('./_engine.js');
const { grabDecl } = require('./extract-picker.js');
const CC = require(path.join(ROOT, 'netlify', 'functions', '_catalog_commercial.js'));
const LAYERS = require(path.join(ROOT, 'netlify', 'functions', 'catalog-layers.js'));
const { applyScrubs } = require(path.join(ROOT, 'scripts', 'p0-scrubs.js'));
const FROZEN = ['climbing-steps', 'strongback-mobility', 'ovation-medical', 'bemis'];

const { undoLineDiscount } = require('./_line_discount_undo.js');
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const git = p => execFileSync('git', ['-C', ROOT, 'show', `${BASE_REF}:${p}`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
const copy = v => JSON.parse(JSON.stringify(v));
const canon = v => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
const sha = v => crypto.createHash('sha256').update(JSON.stringify(canon(v))).digest('hex').slice(0, 16);

(async () => {
  let OLD_HTML;
  try { OLD_HTML = git('public/index.html'); } catch (e) {
    await t('the base commit is readable from git (' + BASE_REF + ')', () => { throw new Error('git show failed'); });
    return finish();
  }
  const have = fs.existsSync(path.join(FIX, 'custom_products.json'));
  if (!have) {
    if (process.env.P0_ALLOW_NO_FIXTURES === '1') { console.log('skip: no fixtures in ' + FIX + ' (P0_ALLOW_NO_FIXTURES=1)'); }
    else await t('layer fixtures present (run scripts/p0-fetch-fixtures.js)', () => { throw new Error('missing ' + FIX); });
  }
  const T = n => have ? JSON.parse(fs.readFileSync(path.join(FIX, n + '.json'), 'utf8')) : [];
  const tables = have ? { custom_products: T('custom_products'), product_overrides: T('product_overrides'), product_content: T('product_content'),
                          product_links: T('product_links'), product_media: T('product_media'), manufacturer_meta: T('manufacturer_meta') } : null;

  /* PostgREST as the public key saw it: rows of this line, only the selected columns. */
  const project = (rows, sel) => sel === '*' ? rows : rows.map(r => sel.split(',').reduce((o, c) => (c in r ? (o[c] = r[c]) : 0, o), {}));
  function restAnswer(url) {
    const u = new URL(url), table = u.pathname.split('/').pop();
    let rows = copy(tables[table] || []);
    const m = u.searchParams.get('manufacturer'); if (m && m.startsWith('eq.')) rows = rows.filter(r => r.manufacturer === m.slice(3));
    const st = u.searchParams.get('status'); if (st && st.startsWith('in.(')) { const ok = st.slice(4, -1).split(','); rows = rows.filter(r => ok.includes(r.status)); }
    rows = rows.filter(r => !(table === 'product_content' && r.disabled === true));
    return project(rows, u.searchParams.get('select') || '*');
  }
  /* The master record a line answers with. 'none' = not migrated (layers price the line);
     'record' = authoritative, with a record that differs from the layers on purpose (+$1, its own
     ladder, uom, case_qty, MAP) so the record path is exercised for real. */
  const feedFor = (mode, codes) => mode === 'none' ? { migrated: false, skus: [] } : { migrated: true, authoritative: true,
    skus: codes.map((c, i) => ({ code: c, base_price: 10 + i, msrp: 30 + i, map: 25 + i, tiers: [{ min_qty: 2, price: 9 + i }, { min_qty: 6, price: 8 + i, pool: 'p' }], uom: i % 3 ? 'Each' : 'Case', case_qty: i % 3 ? 1 : 4 })) };

  function oldPath(html, slug, full, mode, contract) {
    const calls = [];
    const fetch = async (url) => { const u = String(url); calls.push(u);
      if (u.startsWith('https://db.test/rest/v1/')) return { ok: true, status: 200, json: async () => restAnswer(u) };
      if (u.startsWith('/.netlify/functions/catalog-feed')) return { ok: true, status: 200, json: async () => feedFor(mode, full.map(r => r.code)) };
      if (u.startsWith('./data/content/')) return { ok: false, status: 404, json: async () => null };
      throw new Error('old path unexpected ' + u); };
    return { calls, E: engine(html, { fetch, auth: { session: { access_token: 'dealer' }, status: 'approved', prices: contract }, mfr: mfrEntry(slug) }) };
  }
  function newPath(html, slug, full, mode, contract) {
    const calls = [];
    const overlay = CC.splitCatalogFile(full).overlay;            // exactly what the seed script stores
    const fetch = async (url) => { const u = String(url); calls.push(u);
      if (/rest\/v1\/(custom_products|product_overrides|catalog_file_commercial)/.test(u)) throw new Error('the new page read a commercial table with the public key: ' + u);
      if (u.startsWith('https://db.test/rest/v1/')) return { ok: true, status: 200, json: async () => restAnswer(u) };
      if (u.startsWith('/.netlify/functions/catalog-layers')) {
        /* The REAL version pick of catalog-layers, against the record exactly as the seed stores it. */
        const asked = new URLSearchParams(u.split('?')[1]).get('identity');
        const v = LAYERS.pickVersion([{ manufacturer: slug, identity_sha256: CC.catalogIdentity(CC.splitCatalogFile(full).public), rows: copy(overlay) }], asked);
        if (!v.row) return { ok: false, status: 503, json: async () => ({ error: 'pricing_unavailable', reason: v.error }) };
        return { ok: true, status: 200, json: async () => ({ ok: true, manufacturer: slug, identity_sha256: v.row.identity_sha256, file_overlay: v.row.rows,
        custom_products: restAnswer(`https://db.test/rest/v1/custom_products?manufacturer=eq.${slug}&select=${LAYERS.LAYER_SELECT.custom_products}`),
        product_overrides: restAnswer(`https://db.test/rest/v1/product_overrides?manufacturer=eq.${slug}&select=${LAYERS.LAYER_SELECT.product_overrides}`) }) }; }
      if (u.startsWith('/.netlify/functions/catalog-feed')) return { ok: true, status: 200, json: async () => feedFor(mode, full.map(r => r.code)) };
      if (u.startsWith('./data/content/')) return { ok: false, status: 404, json: async () => null };
      throw new Error('new path unexpected ' + u); };
    return { calls, E: engine(html, { fetch, auth: { session: { access_token: 'dealer' }, status: 'approved', prices: contract }, mfr: mfrEntry(slug) }) };
  }
  const MFRS = JSON.parse(git('public/data/manufacturers.json'));
  const meta = slug => (tables ? tables.manufacturer_meta : []).find(m => m.slug === slug) || {};
  function mfrEntry(slug) {
    const m = copy(MFRS.find(x => x.slug === slug) || { slug }), mm = meta(slug);
    return Object.assign(m, { hasData: true, enrichedOnly: mm.enriched_only === true, categoryMap: (mm.category_map && typeof mm.category_map === 'object') ? mm.category_map : null,
      freight: (mm.freight_terms && typeof mm.freight_terms === 'object') ? mm.freight_terms : m.freight });
  }

  await t('the code that renders cards, packs, notes, prices, the cart and freight is unchanged', () => {
    const names = ['const money = ', 'function packOf', 'function packNote', 'function msrpIsEach', 'function mapIsEach', 'function priceHtml', 'function dealerPriceNote',
      'function groupLeads', 'function addToCart', 'function familyQty', 'function tierQty', 'function contractPrice', 'function unitPrice', 'function linesSubtotal',
      'function computeFreight', 'function freightTermsFor', 'function validFreightTerms', 'function inheritColorPrice', 'function fillMsrp', 'function noMsrpRule',
      'function reconcileShopPrices', 'function pageImageFor', 'function renderCart', 'function cartCount', 'function renderTabs'];
    /* The one approved change since P0 (owner policy 2026-10-27): the dealer's line discount. It is taken back out
       of the new page here, exactly and only as written, so ANY other change to this code still fails. */
    const NEW_P0 = undoLineDiscount(NEW_HTML);
    const changed = names.filter(n => { let a = null, b = null; try { a = grabDecl(OLD_HTML, n); } catch (e) {} try { b = grabDecl(NEW_P0, n); } catch (e) {} return a == null || a !== b; });
    ok(!changed.length, 'changed or not found: ' + changed.join(', '));
    const amp = h => h.slice(h.indexOf('async function applyMasterPrices('), h.indexOf('async function loadProducts(slug){'));
    ok(amp(OLD_HTML).length > 1000 && amp(OLD_HTML) === amp(NEW_HTML), 'applyMasterPrices / master-record path changed');
  });

  if (have) {
    const SLUGS = MFRS.filter(m => m.hasData).map(m => m.slug);
    for (const mode of ['none', 'record']) {
      for (const slug of SLUGS) {
        /* a line updated after P0 by a reviewed catalog update is checked by p0commercial against its registered version */
        if (require('../scripts/p0-lines.js').UPDATED[slug]) continue;
        let full; try { full = JSON.parse(git(`public/data/${slug}.json`)); } catch (e) { continue; }
        const strippedNow = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', slug + '.json'), 'utf8'));
        const contract = {}; full.slice(0, 3).forEach((r, i) => { contract[`${slug}::${r.code}`] = 5 + i; });
        await t(`${mode === 'none' ? 'layers' : 'record'} · ${slug}: every product, every field, every quantity, freight — identical`, async () => {
          const O = oldPath(OLD_HTML, slug, applyScrubs(slug, copy(full)), mode, contract), N = newPath(NEW_HTML, slug, full, mode, contract);
          const a = await O.E.mergeCatalogEdits(slug, applyScrubs(slug, copy(full))), b = await N.E.mergeCatalogEdits(slug, copy(strippedNow));
          ok(a.length > 0 || full.length === 0, 'old path listed nothing'); ok(a.length === b.length, `count ${a.length} vs ${b.length}`);
          ok(N.calls.some(u => /catalog-layers/.test(u)), 'new path did not use catalog-layers');
          const diffs = [];
          a.forEach((p, i) => { const q = b[i]; if (JSON.stringify(canon(p)) !== JSON.stringify(canon(q))) {
            const keys = [...new Set(Object.keys(p).concat(Object.keys(q || {})))].filter(k => JSON.stringify(canon(p[k])) !== JSON.stringify(canon((q || {})[k])));
            diffs.push(`${p.code}: ${keys.join(',')}`); } });
          ok(!diffs.length, diffs.length + ' product(s) differ: ' + diffs.slice(0, 5).join(' | '));
          const QTY = [1, 2, 3, 5, 6, 8, 10, 11, 20, 21, 50];
          const la = a.map(p => QTY.map(q => O.E.unitPrice(p, q))), lb = b.map(p => QTY.map(q => N.E.unitPrice(p, q)));
          ok(JSON.stringify(la) === JSON.stringify(lb), 'unit prices differ');
          const carts = [a.map(p => ({ p, qty: 1 })), a.slice(0, 3).map(p => ({ p, qty: 5 })), a.slice(0, 1).map(p => ({ p, qty: 40 }))];
          const cb = [b.map(p => ({ p, qty: 1 })), b.slice(0, 3).map(p => ({ p, qty: 5 })), b.slice(0, 1).map(p => ({ p, qty: 40 }))];
          const fa = carts.map(c => O.E.computeFreight(slug, c)), fb = cb.map(c => N.E.computeFreight(slug, c));
          ok(JSON.stringify(canon(fa)) === JSON.stringify(canon(fb)), 'freight differs');
          if (FROZEN.includes(slug)) {
            const fp = x => sha(x.map(p => ({ code: p.code, name: p.name, group: p.group, base_price: p.base_price, tiers: p.tiers, msrp: p.msrp, msrp_auto: p.msrp_auto, map: p.map,
              uom: p.uom, case_qty: p.case_qty, msrp_basis: p.msrp_basis, map_basis: p.map_basis, price_note: p.price_note, discontinued: !!p._discontinued })));
            console.log(`     frozen ${slug} (${mode}): ${a.length} products · commercial fingerprint today ${fp(a)} = new ${fp(b)} · full ${sha(a)} = ${sha(b)} · ladder ${sha(la)} · freight ${sha(fa)}`);
          }
        });
      }
    }
    await t('every frozen line was compared in both modes', () => {
      for (const s of FROZEN) ok(MFRS.some(m => m.slug === s && m.hasData), s + ' missing from manufacturers.json');
    });
  }
  finish();
})();
function finish() { console.log(`\np0 frozen-line parity: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; }
