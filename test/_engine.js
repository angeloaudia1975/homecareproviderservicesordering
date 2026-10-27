/* The storefront's product + pricing engine, lifted from the page the same way the admin site's
   test/extract-engine.js lifts it for the server (_shop_engine.js): the pricing functions, the
   catalog merge through applyMasterPrices, and the colour/MSRP fallbacks — verbatim — then run
   inside a scope built like the browser's (or the server's). Used by the P0 tests. */
const fs = require('fs'), path = require('path');
const { grabDecl } = require('./extract-picker.js');
function slice(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('anchor not found: ' + (i < 0 ? a : b)); return src.slice(i, j); }
function extract(src) {
  const pricing = ['function familyQty', 'function tierQty', 'function contractPrice','function lineRatePrice','function withUpgrade','function upgradeAddPurchase', 'function unitPrice', 'function linesSubtotal', 'function validFreightTerms', 'function freightTermsFor', 'function computeFreight'].map(a => { try { return grabDecl(src, a); } catch (e) { if (['function lineRatePrice','function withUpgrade','function upgradeAddPurchase'].includes(a)) return ''; throw e; } }).join('\n');   // lineRatePrice: added 2026-10-27, absent from older pages
  const startA = src.indexOf('/* Pure. The same rule as images-api.js') >= 0 ? '/* Pure. The same rule as images-api.js' : 'async function mergeCatalogEdits(slug, prods){';
  return pricing + '\n' + slice(src, startA, 'async function loadProducts(slug){') + '\n' + slice(src, 'const COLOR_SUFFIX=', '/* ---------- render tabs');
}
/* fetch: the stub; auth: AUTH object; preview: PREVIEW; mfr: state.manufacturers entry (with freight). */
function engine(html, { fetch, auth, preview, mfr, cart }) {
  const SOURCE = extract(html);
  const m = Object.assign({ slug: 'L', hasData: true }, mfr || {});
  const CONFIG = { SUPABASE_URL: 'https://db.test', SUPABASE_ANON: 'anon', CONTENT_APPROVED_ONLY: true };
  const state = { manufacturers: [m] };
  const quiet = { log() {}, warn() {}, error() {} };
  const mfrInfo = s => (s === m.slug ? m : { slug: s });
  return new Function('fetch', 'window', 'console', 'document', 'CONFIG', 'state', 'AUTH', 'PREVIEW', 'CART', 'mfrInfo',
    SOURCE + '\n;return { mergeCatalogEdits, unitPrice, computeFreight, CATALOG_SOURCE, restoreCatalogFile: typeof restoreCatalogFile==="function"?restoreCatalogFile:null };')(
    fetch, {}, quiet, {}, CONFIG, state, auth || { session: null, status: 'anon' }, preview || null, cart || new Map(), mfrInfo);
}
module.exports = { extract, engine };
