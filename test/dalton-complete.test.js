/* Dalton Medical catalog completion (owner 2026-11-03): all 339 catalog SKUs accounted for — 331 on the dealer catalog
   with verified content, 8 retired by the owner (MC30 Cardiac Board retired 2026-11-05 in the photo review: 330 live, 9 retired) — content from Dalton's official product pages only, the owner's own
   review work preserved, disputed manufacturer facts hidden, and nothing commercial touched. Compares with git BASE_REF. */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.BASE_REF || 'origin/main';
const gitRaw = p => execFileSync('git', ['-C', ROOT, 'show', `${BASE}:${p}`], { encoding: 'utf8', maxBuffer: 256 << 20 });
/* Owner removed the wrong photo 2026-11-05 and will supply the correct one; until then the shop shows its "No image" placeholder. */
const AWAITING_PHOTO = ['R-CART-6'];
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const FIX = {"owner_desc_sha": {"BED1200i": "72d5d4b16831cbb4", "B-RAIL120i": "5db6e39c5f812bdb", "B-RAIL230i": "4e792e6e2b0b88c5", "B-RAIL42S": "53ceb4b16a657381", "BD-BPT120P": "28012c295ed0053b", "B-T3015P": "dadf62711a69edcf", "B-T3015TP": "85380f8e0ddb3e16", "B-TP100U": "4365371681f06d72", "B-TP100B": "67d73e0920fe669b", "B-MATT-M136": "6a3e65cf1bc13629", "A-DI10880010": "a98eb7b0781f6460", "NEB-68005-TG": "e02cda9f9b09ed9d", "NEB-68005-PD": "efd9f24427b42c3b", "NEB-68005-DG": "5dfe6f2479b8968c", "NEB-68005-FS": "3a04b468b69e89a8", "NEB-68001": "d8147c116a4a11dd", "BED1300i": "5de6f8ee74133171", "BED4200": "621329f96d8ad143", "BED4800": "0a06429566e337ec", "BED5400": "909f043ca99ac220", "B-T120": "f5a9f876eeecd176"}, "retired": ["AR-56430KDAR", "COM-DA650PB", "COM-DAP7050-D", "IN-AWP100", "IN-AWW091248", "MC01", "MC30", "PM-XCEL5000TURN", "TB-5006KDHD-2"], "title_only": ["BS-5002-4", "BS-5004-4", "IN-UPP39040", "K3DK16LTADJ", "K3DK18LTADJ", "K515FA", "K520FA", "K616EXP", "K618EXP", "PMC-260116-6", "PMC-260118-6", "PMC-260120-6", "R-DOC5100"], "owner_images": {"B-RAIL120i": ["/assets/products/dalton/gallery/8b5967ab0e6ea5e71fa3.jpg"], "B-RAIL230i": ["/assets/products/dalton/gallery/532dc20da479b53e8f1b.jpg"], "B-RAIL42S": ["/assets/products/dalton/gallery/6b46e1be217b04c07eff.jpg"], "B-T3015P": ["/assets/products/dalton/gallery/352ebdd715da70e3bc30.jpg", "/assets/products/dalton/gallery/c7f7ae87da40a746676c.jpg"], "B-TP100U": ["/assets/products/dalton/gallery/9b6c5968bc3d4096cc94.jpg"], "B-TP100B": ["/assets/products/dalton/gallery/fedd3d79b24f405523cd.jpg"], "B-MATT-M136": ["/assets/products/dalton/gallery/4212ede7468f09c9ad62.jpg"], "A-DI10880010": ["/assets/products/dalton/gallery/352f2ec906168b922863.jpg"], "NEB-68005-TG": ["/assets/products/dalton/gallery/8ad48fe85503ee60f1b9.jpg"], "NEB-68005-PD": ["/assets/products/dalton/gallery/d64b5a663d7e92579265.jpg"], "NEB-68005-DG": ["/assets/products/dalton/gallery/5c92afbe2bf60fbc51d6.jpg"], "NEB-68005-FS": ["/assets/products/dalton/gallery/73d4e9f06ee806a74da7.jpg"], "NEB-68001": ["/assets/products/dalton/gallery/d937a3f0cc10f99c44ce.png"]}};
const F = read('public/data/dalton.json'), C = read('public/data/content/dalton.json').pages, O = read('content-overrides/dalton.json');
const sha = s => crypto.createHash('sha256').update(String(s).trim()).digest('hex').slice(0, 16);
const pageOf = {}; for (const [k, p] of Object.entries(C)) for (const s of p.skus) pageOf[s.sku] = k;
const live = F.filter(r => !FIX.retired.includes(r.code)).map(r => r.code);
const dealerText = p => [p.name, p.description, ...(p.features || []), ...(p.specs || []).map(s => s.label + ': ' + s.value), ...p.skus.map(s => s.name)].join(' \n ');

t('339 catalog SKUs: 330 active on a published page, 9 retired by the owner (hidden, reason recorded)', () => {
  eq(F.length, 339); eq(live.length, 330);
  for (const c of F.map(r => r.code)) ok(pageOf[c], c + ' has a page');
  for (const c of live) { const s = C[pageOf[c]].skus.find(x => x.sku === c); ok(s.status !== 'hidden' && !s.disabled, c + ' active'); eq(C[pageOf[c]].status, 'published', c); }
  for (const c of FIX.retired) { const s = C[pageOf[c]].skus.find(x => x.sku === c); eq([s.status, s.disabled], ['hidden', true], c); ok(O._retired[c] && O._retired[c].reason, c + ' reason'); }
  eq(Object.keys(O._retired).sort(), FIX.retired);
});
t('commercial and catalog files untouched: dalton.json (identity + prices), manufacturers.json (freight), other lines', () => {
  eq(fs.readFileSync(path.join(ROOT, 'public/data/dalton.json'), 'utf8'), gitRaw('public/data/dalton.json'));
  /* manufacturers.json may change for other lines (e.g. a retirement); Dalton's own entry (freight) may not. */
  const own = l => JSON.stringify((l || []).find(m => m.slug === 'dalton'));
  eq(own(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/manufacturers.json'), 'utf8'))), own(JSON.parse(gitRaw('public/data/manufacturers.json'))));
  /* Other lines may change in their own PRs; a change that touches Dalton content must not touch another line too. */
  const daltonChanged = ['public/data/content/dalton.json', 'content-overrides/dalton.json'].some(f => fs.readFileSync(path.join(ROOT, f), 'utf8') !== gitRaw(f));
  if (daltonChanged) {
    for (const f of fs.readdirSync(path.join(ROOT, 'public/data/content')).filter(f => f !== 'dalton.json'))
      eq(fs.readFileSync(path.join(ROOT, 'public/data/content', f), 'utf8'), gitRaw('public/data/content/' + f), f);
    for (const f of fs.readdirSync(path.join(ROOT, 'content-overrides')).filter(f => f !== 'dalton.json'))
      eq(fs.readFileSync(path.join(ROOT, 'content-overrides', f), 'utf8'), gitRaw('content-overrides/' + f), f);
  }
});
t('every active product has a description and recorded provenance; verified pages cite Dalton and carry features', () => {
  for (const c of live) {
    const p = C[pageOf[c]];
    ok(p.description && p.description.length >= (FIX.title_only.includes(c) ? 20 : 40), c + ' description');
    const pv = p.field_provenance || {}; ok(pv.description && pv.features && pv.specs, c + ' provenance');
    if (FIX.title_only.includes(c)) { eq([p.features.length, p.specs.length], [0, 0], c + ' no unsourced features/specs'); ok(/no official Dalton product page/.test(pv.description), c); }
    else if (!FIX.owner_desc_sha[c] && !FIX.owner_images[c]) { ok(/^https:\/\/daltonmedical\.com\/product\//.test(p.source_url), c + ' Dalton source'); ok(p.features.length >= 1, c + ' features'); }
  }
});
t('the overrides hold the same content (a re-run of the enrichment keeps it)', () => {
  for (const c of live) { const k = pageOf[c], o = O[k]; ok(o, k); for (const f of ['description', 'features', 'specs']) eq(o[f], C[k][f], k + ' ' + f); }
});
t("the owner's saved descriptions are kept exactly", () => {
  for (const [c, h] of Object.entries(FIX.owner_desc_sha)) eq(sha(C[pageOf[c]].description), h, c);
});
t("the owner's uploaded photos are on their products, the main one first", () => {
  for (const [c, urls] of Object.entries(FIX.owner_images)) {
    const p = C[pageOf[c]]; eq(p.image, urls[0], c + ' main'); for (const u of urls) ok(p.images_gallery.some(g => g.url === u), c + ' has ' + u);
  }
});
t('no dealer-facing text carries editorial notes, dealer instructions or reimbursement claims', () => {
  for (const c of live) {
    const p = C[pageOf[c]], txt = dealerText(p);
    ok(!/confirm (before|whether)|dealers? should|to be determined|\bTBD\b/i.test(txt), c + ' note: ' + txt.match(/confirm[^.;]*/i));
    ok(!/medicare|medicaid|reimburs|insurance/i.test(p.description), c + ' reimbursement wording');
  }
});
t('disputed manufacturer facts are hidden until Dalton confirms', () => {
  const D = { capacity: ['TB-5006-2', 'A-WA1200BR', 'COM-300F-4', 'A-RHB1037', 'K2DK16F', 'K2DK16L', 'K2DK18F', 'K2DK18L', 'K2DK20F', 'K2DK20L'],
    waist: ['IN-AUB23010'], dims: ['IN-AUP12090'], length: ['R-WM0007', 'R-WM0137'], finish: ['B-BPW300-C'] };
  const RX = { capacity: /capacity|\d\s*-?\s*(lb|lbs)\b|weight limit/i, waist: /\b(22|25|32|36)\b.{0,12}(inch|in\b|″|")|waist range/i,
    dims: /\d+\s*(″|"|in\b)?\s*[x×]\s*\d+|\b(100|120)\s*(pcs|per case|\/case)/i, length: /\b7\s*(″|"|ft|feet|foot|-foot|in\b)|seven-foot/i, finish: /\boak\b/i };
  for (const [k, codes] of Object.entries(D)) for (const c of codes) { const p = C[pageOf[c]]; const txt = dealerText(p);
    ok(!RX[k].test(txt), c + ' still shows ' + k + ': ' + (txt.match(RX[k]) || [''])[0]); ok(Object.values(p.field_provenance).join(' ').length > 0, c); }
});
t('every photo a product shows exists', () => {
  for (const c of live) { const p = C[pageOf[c]]; for (const u of [p.image, ...(p.images_gallery || []).map(g => g.url), ...p.skus.map(s => s.image)].filter(Boolean))
    ok(fs.existsSync(path.join(ROOT, 'public', u)), c + ' missing file ' + u); if (!AWAITING_PHOTO.includes(c)) ok(p.image || p.skus.some(s => s.image), c + ' has a photo'); else eq([p.image, p.images_gallery.length], ['', 0], c + ' shows the No-image placeholder, never a wrong photo'); }
});
console.log(`\ndalton complete: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
