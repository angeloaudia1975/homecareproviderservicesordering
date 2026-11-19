/* Owner 2026-11-19: single-product brochure — ES0001 fits two US Letter pages (photo, introduction and price + features on
   page 1; 12 measurements as 6 rows of 2 labelled pairs, clinical applications, full warranty and ONE dealer footer on page
   2); a short brochure stays on one page; the selected salesperson is the sole contact. Synthetic data; prints to PDF in
   Chromium and counts pages. PLAYWRIGHT_MODULE=… node test/brochure-layout.browser.js */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const B = require(path.join(__dirname, '..', 'netlify', 'functions', 'brochure.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const IMG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="#ccc"/></svg>').toString('base64');
const rows = [['Rear Wheel Size', '24"'], ['Seat Width', '18"'], ['Seat Depth', '16.5"'], ['Seat Height', '20"'], ['Total Width', '27"'], ['Total Length', '44"'], ['Total Height', '37"'], ['Backrest Height', '18.5"'], ['Carry Weight', '18.3 lb'], ['Total Weight', '35.7 lb'], ['Weight Capacity', '300 lb'], ['Rear Wheels', 'Quick-release']];
const P = { name: 'ErgoSteel Comfort Wheelchair 18"', code: 'ES0001', manufacturer: 'Strongback Mobility', tagline: 'Ergonomic targeted lumbar support, stabilizing comfort, award winning design, budget-friendly reliability',
  description: 'A robust steel-frame manual wheelchair with a patented ergonomic seating system and push-button removable 24" wheels. '.repeat(5), images: [IMG],
  features: ['Award-winning, exclusive, ergonomically curved frame design', 'Heavy-duty steel frame and 300-pound weight capacity of superior quality and durability', 'Posture support technology prevents slouching and back pain to create the most comfortable wheelchair on the market, focused on comfort and not extras', 'Desktop length arms', 'Quick release wheels for enhanced and easy storage and transport', 'Swing away detachable footrest', 'Compact flipback design caregiver ergonomic handles for easy transport'],
  clinical: ['Mobility impairment requiring manual wheelchair assistance', 'Long-term or everyday wheelchair dependence for ambulatory limitations', 'Post-injury or post-surgical mobility support during recovery', 'Degenerative or chronic conditions affecting walking ability', 'Users requiring standard adult seating dimensions for daily activities', 'Individuals needing caregiver-assisted transport', 'Rehabilitation settings requiring durable, economical seating solutions'],
  specs: [], sizing: { columns: ['Name', 'Ergosteel'], rows }, warranty: 'Two-year manufacturer warranty on the frame against material and manufacturing defects from the date of purchase. The seat and all other parts are warranted for 12 months from the date of purchase.', quote_price: 299, billing_codes: [] };
const D = { business_name: 'James Medical Equipment Bowling Green', address: '1 Main St', city: 'Bowling Green', state: 'KY', zip: '42101', phone: '270-555-0100', email: 'janet@example.com', website: 'jamesmedical.example' };
const SC = { name: 'Angelo Audia', title: null, phone: '937-626-5141', email: 'angelo@homecareproviderservices.us' };
async function pages(browser, html) { const pg = await browser.newPage(); await pg.setContent(html, { waitUntil: 'load' }); await pg.emulateMedia({ media: 'print' });
  const f = path.join(os.tmpdir(), 'br-' + Date.now() + Math.random() + '.pdf'); await pg.pdf({ path: f, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  const n = (fs.readFileSync(f).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const footerPage = await pg.evaluate(() => { const r = document.querySelector('.foot').getBoundingClientRect(); return r.top; }); await pg.close(); return { n, footerPage }; }
(async () => {
  const browser = await chromium.launch();
  try {
    const html = B.renderBrochure(P, { dealer: D, sales_contact: SC, reference: 399, saving: { dollars: 100, percent: 25 }, offer_label: 'Your price' });
    await t('ES0001 prints on exactly two Letter pages, with MSRP | Your price | You save', async () => { const r = await pages(browser, html); ok(r.n === 2, 'pages ' + r.n);
      ok(/<div class="l">MSRP<\/div><div class="ref">\$399\.00/.test(html) && /\$299\.00/.test(html) && /\$100\.00 <span class="sp">\(25\.0%\)/.test(html), 'price row'); });
    await t('the 12 measurements are 6 rows of two labelled pairs; nothing dropped', () => { const m = html.match(/<table class="pairs">([\s\S]*?)<\/table>/); ok(m, 'pairs');
      ok((m[1].match(/<tr>/g) || []).length === 6 && (m[1].match(/class="k"/g) || []).length === 12, 'rows'); rows.forEach(r => ok(m[1].includes(r[0]), r[0])); });
    await t('features in two columns; clinical, full warranty and one footer follow', () => { ok(/<ul class="feat two">/.test(html), 'two'); ok(html.includes('warranted for 12 months'), 'warranty'); ok((html.match(/class="foot/g) || []).length === 1, 'one footer'); });
    await t('the selected salesperson is the sole contact: dealer name + address stay, account phone / email / website do not print', () => {
      const f = html.slice(html.indexOf('class="foot')); ok(f.includes('James Medical Equipment Bowling Green') && f.includes('1 Main St') && f.includes('Angelo Audia') && f.includes('937-626-5141'), 'kept');
      ok(!f.includes('270-555-0100') && !f.includes('janet@example.com') && !f.includes('jamesmedical.example'), 'account contact printed'); });
    await t('no salesperson → the account contact prints', () => { const h = B.renderBrochure(P, { dealer: D }); const f = h.slice(h.indexOf('class="foot')); ok(f.includes('270-555-0100') && f.includes('janet@example.com'), 'account'); });
    await t('a short brochure stays on one page', async () => { const h = B.renderBrochure(Object.assign({}, P, { features: P.features.slice(0, 3), clinical: [], sizing: null, description: 'Short.' }), { dealer: D }); const r = await pages(browser, h); ok(r.n === 1, 'pages ' + r.n); });
    await t('longer content is never truncated: every feature prints even past two pages', async () => { const many = Array.from({ length: 12 }, (_, i) => 'Feature number ' + i + ' ' + 'x'.repeat(120)); const h = B.renderBrochure(Object.assign({}, P, { features: many }), { dealer: D }); many.forEach(f => ok(h.includes(f.slice(0, 20)), 'missing')); });
  } finally { await browser.close(); }
  console.log(`\nbrochure layout: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
