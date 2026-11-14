/* Owner 2026-11-14: a dealer brochure's REAL printed PDF carries the dealer's logo, name, branch address and phone — never
   HCPS as the seller — and the user's own offer content unchanged. Renders renderBrochure() in Chromium, prints it to PDF,
   reads the PDF back (pdftotext / pdfimages) and checks the logo is drawn at its own proportions.   node test/brochure-pdf.browser.js */
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { renderBrochure } = require(path.join(__dirname, '..', 'netlify', 'functions', 'brochure.js'));
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok  ', n); } catch (e) { fail++; console.log('FAIL', n, '\n    ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion'); };
/* a 300×100 dealer logo (wide, like most) as a raster data URL: drawn with a dark band so its rendered box is measurable */
const LOGO = (() => { const zlib = require('zlib'); const w = 300, h = 100; const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const v = (x < 20 || x > 279) ? 30 : 200; raw[o] = v; raw[o + 1] = 40; raw[o + 2] = 90; } }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64'); })();
const DEALER = { business_name: 'Integrity Home Medical — Germantown', address: '7710 Poplar Ave', city: 'Germantown', state: 'TN', zip: '38138', phone: '(901) 555-0142', email: 'germantown@integrity.test', website: 'https://integrity.test', logo_url: LOGO };
const PRODUCTS = [
  { name: 'Zen-O Lite Portable Oxygen Concentrator', code: 'RS-00501', manufacturer: 'Ohio Medical', tagline: 'Lightweight portable oxygen', features: ['Up to 2 L/min pulse', 'Long battery life'], price: 2295, msrp: 2895, hcps_logo: 'https://www.homecareproviderservices.org/assets/hcps-logo.png' },
  { name: 'ES0001 ErgoSteel Rollator', code: 'ES0001', manufacturer: 'Strongback Mobility', features: ['Steel frame'], price: 399.95, hcps_logo: 'https://www.homecareproviderservices.org/assets/hcps-logo.png' },
  { name: 'Yuwell YU300 Nebulizer', code: 'YU300', manufacturer: 'Yuwell', features: ['Quiet compressor'], price: 49.95, hcps_logo: 'https://www.homecareproviderservices.org/assets/hcps-logo.png' },
];
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brpdf-')); const browser = await chromium.launch();
  try {
    for (const P of PRODUCTS) {
      const html = renderBrochure(Object.assign({ quote_price: P.price }, P), { include_msrp: true, dealer: DEALER, reference: P.msrp || null, saving: P.msrp ? { dollars: P.msrp - P.price, pct: 1 - P.price / P.msrp } : null, offer_expires: '2026-12-31', offer_label: 'Holiday special — your price' });
      const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'load' });
      const box = await page.evaluate(() => [...document.querySelectorAll('img')].filter(i => /^data:image\/png/.test(i.src)).map(i => { const r = i.getBoundingClientRect(); return { w: r.width, h: r.height, nw: i.naturalWidth, nh: i.naturalHeight, ok: i.complete && i.naturalWidth > 0 }; }));
      const pdf = path.join(dir, P.code + '.pdf'); await page.pdf({ path: pdf, format: 'Letter', printBackground: true }); await page.close();
      const text = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
      const imgs = execFileSync('pdfimages', ['-list', pdf]).toString().split('\n').slice(2).filter(Boolean).map(l => l.trim().split(/\s+/)).map(c => ({ w: +c[3], h: +c[4] }));
      await t(`${P.manufacturer}: the printed PDF names the dealer as the seller — name, branch address, phone`, () => {
        ok(/Integrity Home Medical/.test(text) && /7710 Poplar Ave/.test(text) && /Germantown, TN 38138/.test(text) && /\(901\) 555-0142/.test(text), text.slice(-600));
        ok(!/Provided by HomeCare Provider Services/.test(text), 'HCPS shown as the seller'); });
      await t(`${P.manufacturer}: the dealer logo is drawn in the PDF, loaded, at its own 3:1 proportions (no stretch / crop)`, () => {
        ok(box.length >= 1 && box.every(b => b.ok), JSON.stringify(box)); ok(box.every(b => Math.abs(b.w / b.h - 3) < 0.05), 'aspect ' + JSON.stringify(box));
        ok(imgs.some(i => i.w === 300 && i.h === 100), 'logo embedded at full resolution: ' + JSON.stringify(imgs)); });
      await t(`${P.manufacturer}: the user's offer wording, expiry and product survive the branding unchanged`, () => {
        ok(text.includes(P.name.split(' ')[0]) && text.includes(P.code), 'product'); const flat = text.replace(/\s+/g, ' '); ok(/Holiday special/i.test(flat) && /December 31, 2026/.test(flat), 'offer text: ' + flat.slice(0, 1500));
        ok(text.includes(P.price.toLocaleString('en-US', { minimumFractionDigits: 2 })), 'offer price'); });
      await t(`${P.manufacturer}: a browser's printed page header names the dealer, not HCPS`, () => ok(/<title>[^<]*Integrity Home Medical[^<]*<\/title>/.test(html) && !/<title>[^<]*HomeCare Provider/.test(html), 'title'));
    }
  } finally { await browser.close(); }
  console.log(`brochure pdf: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
