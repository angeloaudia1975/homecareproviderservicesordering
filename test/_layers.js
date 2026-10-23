/* P0 (2026-10-23) test helper: the storefront now gets a line's commercial layers ONLY from
   catalog-layers. Tests that lift the real mergeCatalogEdits hand it what production hands it:
   the PUBLIC half of the catalog file (commercial keys removed), plus a catalog-layers answer
   carrying the commercial overlay and the custom_products / product_overrides tables.
   wrap(merge) takes the full file a test writes, strips it, and remembers the overlay. */
const path = require('path');
const CC = require(path.join(__dirname, '..', 'netlify', 'functions', '_catalog_commercial.js'));
module.exports = function withLayers(tables) {
  const st = { file: [] };
  const copy = v => JSON.parse(JSON.stringify(v));
  return {
    answer(url) {
      if (!/\/\.netlify\/functions\/catalog-layers\?/.test(String(url))) return null;
      return { ok: true, status: 200, json: async () => ({ ok: true,
        file_overlay: CC.splitCatalogFile(st.file).overlay,
        custom_products: copy((tables || {}).custom_products || []),
        product_overrides: copy((tables || {}).product_overrides || []) }) };
    },
    wrap(merge) {
      return async (slug, prods) => { st.file = copy(prods || []); return merge(slug, CC.splitCatalogFile(prods || []).public); };
    },
  };
};
