/* Golden Service & Support — ORIGINAL PORTAL PARITY (owner 2026-11-14). Dealer 360 must show the owner's approved
   standalone portal (golden-dealer-portal portals/support/index.html = goldentechsupport.netlify.app), not a simplified
   rewrite. This test opens BOTH — the original file as it is, and Dealer 360's real public/index.html (_shop-harness.js) —
   at the same phone / tablet / desktop widths, and for every one of the six areas compares:
     · the area's visible text (same content, word for word, apart from the documented integration differences),
     · its structure (cards, tables, rows, inputs, buttons, images, thumbnails, filter buttons),
     · a pixel comparison of the rendered area (same size; differing pixels under a small budget),
   then checks the interactions inside Dealer 360 (tabs, parts by line / model / category / search, cart, quantities,
   order form, video filters + search, documents, labor rate table + autofill, the three submissions through the secure
   case submission with one idempotency key, case history) — and that nothing ever reaches send-parts, Golden or HCPS.
   GOLDEN_REPO=… ADMIN_REPO=… node test/golden-support-parity.browser.js   (writes screenshots to $PARITY_OUT if set) */
const path = require('path'), fs = require('fs');
const sharp = require('sharp');
const { chromium, open } = require('./_shop-harness.js');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const SUPPORT = path.join(GOLDEN, 'repo', 'portals', 'support');
const S = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog.js'));
const DATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog-data.json'));
const OUT = process.env.PARITY_OUT || '';
let pass = 0, fail = 0; const report = [];
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 1200)); } }
const TABS = ['troubleshoot', 'videos', 'parts', 'request', 'docs', 'labor'];
const CORS = { 'access-control-allow-origin': '*' };

/* the original, served exactly as goldentechsupport.netlify.app serves it; outside requests (YouTube thumbnails) are
   answered the same way on both sides so they compare like for like */
async function openOriginal(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const st = { sends: [] };
  await page.route('**/*', (route) => { const u = new URL(route.request().url());
    if (u.host === 'orig.test') { const f = path.join(SUPPORT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); return fs.existsSync(f) ? route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }) : route.fulfill({ status: 404, body: '' }); }
    if (/send-parts/.test(u.pathname)) { st.sends.push(u.href); return route.fulfill({ status: 500, body: '{}' }); }
    return route.abort(); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto('http://orig.test/'); await page.waitForTimeout(400);
  /* the ONE documented layout difference: Dealer 360's mobile rule (RULE 10) — inputs are 16px on phones / tablets so iOS
     does not zoom. It is applied to the original too, so the pixel comparison measures everything else. */
  if (w <= 980) await page.addStyleTag({ content: 'input, select, textarea { font-size: 16px !important; }' });
  /* documented difference 2: the original's derived "MSRP" (dealer × 2) is labelled "Calc. retail" in Dealer 360 */
  await page.evaluate(() => { const f = window.formatDealerMsrp; window.formatDealerMsrp = (p) => { const o = f(p); o.cell = String(o.cell).replace(' · MSRP ', ' · Calc. retail '); o.inline = String(o.inline).replace(' · MSRP ', ' · Calc. retail '); return o; }; });
  return { ctx, page, st };
}
async function openD360(browser, w, h, st) {
  const { ctx, page } = await open(browser, w, h, {});
  st.dialogs = []; page.on('dialog', (d) => { st.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.route(/img\.youtube\.com/, (r) => r.abort());
  await page.route(/send-parts|goldentech\.com|resend\.com/, (r) => { st.leak = (st.leak || []).concat(r.request().url()); return r.abort(); });
  await page.route('**/functions/golden-proxy', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); (st.calls = st.calls || []).push(b.action);
    let body = { ok: true, enabled: false, reason: 'off' };
    if (b.action === 'service_catalog') body = Object.assign({ ok: true, enabled: true, available: true, as_of: '2026-11-14T10:00:00Z' }, S.build(DATA, { seePrices: st.pv !== false, linked: true }));
    if (b.action === 'service_cases') body = st.submit ? { ok: true, enabled: true, cases: st.cases || [] } : { ok: true, enabled: false, reason: 'service_submit_switched_off' };
    if (b.action === 'service_submit') { st.submits = (st.submits || []).concat([b]);
      if (st.failFirst && st.submits.length === 1) return route.fulfill({ status: 502, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: false }) });
      const k = b.request.kind; st.cases = [{ case_no: 'GS-0A1B2C3D', kind: k, what: k === 'parts' ? '2 parts' : k, status: 'sent', created_at: '2026-11-14T10:00:00Z', routed_to: 'TEST service@homecareproviderservices.us', attachments: (b.request.attachments || []).length }];
      body = { ok: true, enabled: true, accepted: true, case_no: 'GS-0A1B2C3D', duplicate: st.submits.length > 1, routed_to: 'TEST service@homecareproviderservices.us', email: { status: 'sent' } }; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
  await page.evaluate(() => showView('goldsvc'));
  await page.waitForFunction(() => { const h = document.querySelector('#gsvHost'); return h && h.shadowRoot && h.shadowRoot.querySelector('#tab-troubleshoot'); }, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return { ctx, page };
}
/* run fn in the area's document: the original page, or Dealer 360's shadow root */
const inRoot = (page, d360, fn, arg) => page.evaluate(([d, src, a]) => { const R = d ? document.querySelector('#gsvHost').shadowRoot : document; return (new Function('R', 'a', src))(R, a); }, [d360, fn, arg]);
const clickTab = (page, d360, tab) => inRoot(page, d360, `const b=[...R.querySelectorAll('.tab-btn')].find(x=>(x.getAttribute('onclick')||'').includes("'${tab}'")); b.click(); return true;`);
const shape = (page, d360, tab) => inRoot(page, d360, `const p=R.getElementById('tab-${tab}'); const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  const q=s=>[...p.querySelectorAll(s)].filter(vis).length;
  return { text: p.innerText.replace(/\\s+/g,' ').trim(), cards:q('.card,.video-card,.doc-card,.ts-card'), tables:q('table'), rows:q('tr'), inputs:q('input,select,textarea'), buttons:q('button,.btn,a.btn-gold'), imgs:q('img'),
    h: Math.round(p.getBoundingClientRect().height), w: Math.round(p.getBoundingClientRect().width) };`);
/* allowed differences: Dealer 360 fills the dealer's own details and the account is Golden's verified record */
const norm = (s) => s.replace(/Verified by Golden on your account/g, '').replace(/MSRP \$/g, 'Calc. retail $').replace(/\s+/g, ' ').trim();
/* sticky / fixed bars (the original's header + tabs, Dealer 360's banner + menu) would be painted over the area in an
   element screenshot: they are hidden on both sides for the pixel comparison only */
async function shot(page, d360, tab) {
  await page.evaluate((d) => { const hide = (root) => root.querySelectorAll('*').forEach((e) => { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') e.style.visibility = 'hidden'; });
    hide(document); if (d) hide(document.querySelector('#gsvHost').shadowRoot); }, d360);
  const handle = await page.evaluateHandle(([d, tb]) => (d ? document.querySelector('#gsvHost').shadowRoot : document).getElementById('tab-' + tb), [d360, tab]);
  const el = handle.asElement(); await el.scrollIntoViewIfNeeded();
  return el.screenshot({ animations: 'disabled' });
}
/* differing pixels. Sub-pixel layout rounding makes long pages drift by a pixel here and there, so the original is cut into
   120 px bands and each band is compared at its best vertical alignment (±6 px around the previous band's; the first
   band ±48 px). A real layout or content difference still shows: it changes pixels whatever the alignment. */
async function pixelDiff(a, b) {
  /* slightly softened: text anti-aliasing at a fractional pixel position is not a difference anyone can see */
  const half = (x) => sharp(x).blur(1.2).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const A = await half(a), B = await half(b);
  const w = Math.min(A.info.width, B.info.width), BAND = 60;
  const band = (y0, y1, dy, step) => { let diff = 0, n = 0; for (let y = y0; y < y1; y += step) { const yb = y + dy; if (yb < 0 || yb >= B.info.height) { n += Math.ceil(w / step); diff += Math.ceil(w / step); continue; }
    for (let x = 0; x < w; x += step) { const i = (y * A.info.width + x) * 4, j = (yb * B.info.width + x) * 4; n++;
      if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) > 48) diff++; } } return [diff, n]; };
  let off = 0, D = 0, N = 0;
  for (let y0 = 0; y0 < A.info.height; y0 += BAND) { const y1 = Math.min(A.info.height, y0 + BAND), R = y0 === 0 ? 48 : 6;
    let best = off, bestR = Infinity; for (let k = 0; k <= 2 * R; k++) { const dy = off + (k % 2 ? (k + 1) / 2 : -k / 2); const [d, n] = band(y0, y1, dy, 2); const r = d / n; if (r < bestR - 1e-9) { bestR = r; best = dy; } }   // nearest offset wins a tie (blank bands)
    off = best; const [d, n] = band(y0, y1, off, 1); D += d; N += n; }
  return { ratio: D / N, dy: off, size: [A.info.width, A.info.height, B.info.width, B.info.height] };
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      /* the original is opened at the width Dealer 360 gives the portal (inside its page gutters): same component, same width */
      const st = { pv: true }; const D = await openD360(browser, w, h, st);
      const hw = await D.page.evaluate(() => Math.round(document.querySelector('#gsvHost').getBoundingClientRect().width));
      const O = await openOriginal(browser, hw, h);
      for (const tab of TABS) {
        await clickTab(O.page, false, tab); await clickTab(D.page, true, tab); await O.page.waitForTimeout(250); await D.page.waitForTimeout(250);
        const a = await shape(O.page, false, tab), b = await shape(D.page, true, tab);
        await t(`${label} · ${tab}: same content and structure as the original portal`, async () => {
          ok(norm(a.text) === norm(b.text), 'text differs:\n  original: ' + '\n  differs at: ' + (() => { const x = norm(a.text), y = norm(b.text); const i = [...x].findIndex((c, k) => c !== y[k]); return JSON.stringify([x.slice(Math.max(0, i - 40), i + 80), y.slice(Math.max(0, i - 40), i + 80)]); })());
          for (const k of ['cards', 'tables', 'rows', 'inputs', 'buttons', 'imgs']) ok(a[k] === b[k], `${k}: original ${a[k]}, Dealer 360 ${b[k]}`);
        });
        const [sa, sb] = [await shot(O.page, false, tab), await shot(D.page, true, tab)];
        if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${label}-${tab}-original.png`), sa); fs.writeFileSync(path.join(OUT, `${label}-${tab}-d360.png`), sb); }
        const px = await pixelDiff(sa, sb); report.push({ label, tab, ratio: +px.ratio.toFixed(4), size: px.size });
        await t(`${label} · ${tab}: renders like the original (same size, ${(px.ratio * 100).toFixed(2)}% pixels differ)`, async () => {
          ok(Math.abs(px.size[0] - px.size[2]) <= 2 && Math.abs(px.size[1] - px.size[3]) <= Math.max(4, px.size[1] * 0.01), 'size ' + px.size);
          ok(px.ratio < (tab === 'request' || tab === 'labor' || tab === 'parts' ? 0.03 : 0.015), 'pixels differ ' + px.ratio);   // forms: the dealer's own details are filled in
        });
      }
      const L = await D.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth }));
      await t(`${label}: no horizontal page scroll in Dealer 360`, async () => ok(L.overflow <= 1, 'overflow ' + L.overflow));
      await O.ctx.close(); await D.ctx.close();
    }

    /* ---- interactions inside Dealer 360 ---- */
    { const st = { pv: true, submit: true, failFirst: true }; const D = await openD360(browser, 390, 844, st); const P = D.page;
      const R = (src, a) => inRoot(P, true, src, a);
      await t('parts: lift chair by category, scooters / power chairs by model, search — counts from Golden\'s data', async () => {
        await clickTab(P, true, 'parts');
        const lift = await R(`return R.querySelectorAll('#partsBody tr').length`); ok(lift === DATA.parts.lift_chair.length, 'lift ' + lift);
        const sc = await R(`const s=R.getElementById('productLine'); s.value='scooter'; s.dispatchEvent(new Event('change')); return R.getElementById('modelSelect').options.length-1`);
        ok(sc === DATA.parts.scooter.length, 'scooter models ' + sc);
        const pc = await R(`const s=R.getElementById('productLine'); s.value='power_chair'; s.dispatchEvent(new Event('change')); return R.getElementById('modelSelect').options.length-1`);
        ok(pc === DATA.parts.power_chair.length, 'power chair models ' + pc);
        const found = await R(`const s=R.getElementById('productLine'); s.value='lift_chair'; s.dispatchEvent(new Event('change')); const q=R.getElementById('partsSearch'); q.value='motor'; q.dispatchEvent(new Event('input')); return [...R.querySelectorAll('#partsBody tr')].map(r=>r.innerText)`);
        ok(found.length > 0 && found.every((x) => /motor/i.test(x)), 'search ' + found.length);
        ok(found.every((x) => /Dealer \$[\d.]+ · Calc\. retail \$[\d.]+|Call/.test(x)), 'price labelled calculated retail: ' + found[0]);
      });
      await t('parts: add to cart with quantity, cart total, proceed to the original order form (dealer details from the account, Golden account read-only)', async () => {
        const r = await R(`const q=R.getElementById('partsSearch'); q.value=''; q.dispatchEvent(new Event('input'));
          const b=R.querySelectorAll('#partsBody .add-to-cart-btn'); const qi=R.querySelectorAll('#partsBody .qty-input-inline'); qi[0].value='2'; b[0].click(); b[1].click();
          return { badge: R.getElementById('cartCountBadge').textContent, total: R.getElementById('cartTotalBar').textContent }`);
        ok(/\d/.test(r.badge) && /\$\d/.test(r.total), JSON.stringify(r));
        const f = await R(`GSV.proceedToOrderForm(); const F=R.getElementById('partsOrderForm'); return { shown: F.getBoundingClientRect().height>0, dealer: F.querySelector('[name=dealer_name]').value, ro: F.querySelector('[name=account_number]').readOnly }`);
        ok(f.shown && f.dealer && f.ro, JSON.stringify(f));
      });
      await t('parts order: sent through the secure case submission — Golden decides identity and prices; a failed first try is retried with the SAME key; success shows the case; history lists it', async () => {
        await R(`const F=R.getElementById('partsOrderForm'); const set=(n,v)=>{const e=F.querySelector('[name='+n+']'); e.value=v; e.dispatchEvent(new Event('change'));};
          set('contact_name','Pat Tester'); set('email','pat@example.invalid'); set('ship_address','1 Test Way'); set('ship_city','Dayton'); set('ship_state','OH'); set('ship_zip','45402'); set('order_product_category','Power Lift Recliner');
          F.querySelector('.submit-btn').click(); return true`);
        await P.waitForTimeout(600);
        ok(st.submits && st.submits.length === 1, 'first try sent'); ok(st.dialogs.some((m) => /not be sent twice|could not be confirmed/i.test(m)), 'retry message: ' + st.dialogs.join(' | '));
        await R(`R.getElementById('partsOrderForm').querySelector('.submit-btn').click(); return true`); await P.waitForTimeout(600);
        ok(st.submits.length === 2 && st.submits[0].idempotency_key === st.submits[1].idempotency_key, 'same key');
        const rq = st.submits[1].request; ok(rq.kind === 'parts' && rq.line === 'lift_chair' && rq.items.length === 2 && rq.items[0].qty === 2, JSON.stringify(rq).slice(0, 300));
        ok(!JSON.stringify(rq).match(/"price"|dealer_name|account_number/), 'no price / identity from the browser');
        const done = await R(`const m=R.getElementById('orderSuccessMsg'); return { shown: m.getBoundingClientRect().height>0, text: m.innerText }`);
        ok(done.shown && /GS-0A1B2C3D/.test(done.text) && /TEST service@/.test(done.text), JSON.stringify(done));
        const hist = await R(`return R.getElementById('gsvHistory').innerText`); ok(/GS-0A1B2C3D/.test(hist) && /Sent to Golden/.test(hist), hist);
      });
      await t('service / RMA request: the original form (request type, urgency, parts search fills a row, photo) goes through the same submission', async () => {
        await clickTab(P, true, 'request');
        await R(`const q=R.getElementById('servicePartSearch'); q.value='motor'; q.dispatchEvent(new Event('input')); const it=R.querySelector('#servicePartResults [data-i], #servicePartResults .svc-part-result, #servicePartResults div[onclick], #servicePartResults button'); if(it) it.click(); return true`);
        const filled = await R(`return R.querySelector('[name=part_num_1]').value`);
        ok(filled, 'parts search filled a row');
        await R(`const F=R.getElementById('serviceRequestForm'); const set=(n,v)=>{const e=F.querySelector('[name='+n+']'); e.value=v;};
          set('contact_name','Pat Tester'); set('email','pat@example.invalid'); set('product_category','Power Lift Recliner'); set('model_number','PR-501'); set('serial_number','S123');
          set('issue_description','Chair will not recline after power outage.'); set('request_type','Warranty Replacement'); set('urgency','Urgent — Patient Dependent'); F.querySelector('.submit-btn').click(); return true`);
        await P.waitForTimeout(700);
        const rq = st.submits[st.submits.length - 1].request;
        ok(rq.kind === 'service' && rq.product_category === 'Power Lift Recliner' && rq.urgency === 'Urgent' && rq.parts.length === 1 && rq.issue.length > 10, JSON.stringify(rq).slice(0, 300));
      });
      await t('labor claim: the original rate table + repair autofill; required fields checked as before; sent through the same submission', async () => {
        await clickTab(P, true, 'labor');
        const rows = await R(`return R.querySelectorAll('#laborRateBody tr').length`); ok(rows > 5, 'rate rows ' + rows);
        const miss = await R(`const F=R.getElementById('laborClaimForm'); F.querySelector('[name=golden_auth_number]').value=''; GSV.submitLaborClaim({ preventDefault(){} }); return R.getElementById('laborMissingNote').innerText`);
        ok(/Authorization/.test(miss), miss);
        await R(`const F=R.getElementById('laborClaimForm'); const s=R.getElementById('laborRepairType'); s.selectedIndex=1; s.dispatchEvent(new Event('change'));
          const set=(n,v)=>{F.querySelector('[name='+n+']').value=v;}; set('contact_name','Pat'); set('contact_email','pat@example.invalid'); set('golden_auth_number','SO12345'); set('serial_number','S9'); set('repair_description','Replaced the lift motor under warranty.');
          F.querySelector('.submit-btn').click(); return true`);
        await P.waitForTimeout(700);
        const rq = st.submits[st.submits.length - 1].request; ok(rq.kind === 'labor' && rq.preauth_amount > 0 && rq.golden_auth_number === 'SO12345', JSON.stringify(rq).slice(0, 300));
      });
      await t('videos: thumbnails, category filters and search as in the original; documents link to Golden\'s hosted files', async () => {
        await clickTab(P, true, 'videos');
        const v = await R(`const all=R.querySelectorAll('#videoGrid .video-card').length; const sc=[...R.querySelectorAll('.filter-btn')].find(b=>/Scooter/i.test(b.textContent)); sc.click(); const n=R.querySelectorAll('#videoGrid .video-card').length;
          const q=R.getElementById('videoSearch'); q.value='calibration'; q.dispatchEvent(new Event('input')); return {all, n, thumbs:[...R.querySelectorAll('#videoGrid img')].every(i=>/img\\.youtube\\.com\\/vi\\//.test(i.getAttribute('src')))}`);
        ok(v.all > 10 && v.n > 0 && v.n < v.all && v.thumbs, JSON.stringify(v));
        await clickTab(P, true, 'docs');
        const d = await R(`return [...R.querySelectorAll('a.doc-download-btn')].map(a=>a.href)`);
        ok(d.length === 6 && d.every((u) => u.startsWith('https://goldentechsupport.netlify.app/docs/')), JSON.stringify(d));
      });
      await t('nothing reached send-parts, Golden or an email provider from the page', async () => ok(!(st.leak || []).length, JSON.stringify(st.leak)));
      await D.ctx.close(); }

    { const st = { pv: false, submit: false }; const D = await openD360(browser, 1280, 900, st); const R = (src) => inRoot(D.page, true, src);
      await t('prices hidden by Golden: every part shows "Call", no dealer price anywhere; sending switched off → the form says so, nothing sent', async () => {
        await clickTab(D.page, true, 'parts');
        const p = await R(`return [...R.querySelectorAll('#partsBody .price-cell')].map(c=>c.textContent.trim())`);
        ok(p.length && p.every((x) => x === 'Call'), p.slice(0, 3).join(','));
        await R(`R.querySelectorAll('#partsBody .add-to-cart-btn')[0].click(); GSV.proceedToOrderForm(); const F=R.getElementById('partsOrderForm'); const set=(n,v)=>{F.querySelector('[name='+n+']').value=v;};
          set('contact_name','Pat'); set('email','p@example.invalid'); set('order_product_category','Power Lift Recliner'); F.querySelector('.submit-btn').click(); return true`);
        await D.page.waitForTimeout(500);
        ok(!(st.submits || []).length, 'sent'); ok(st.dialogs.some((m) => /not switched on|support site|View as Dealer cannot send/i.test(m)), st.dialogs.join('|'));
      });
      await D.ctx.close(); }
  } finally { await browser.close(); }
  if (OUT) fs.writeFileSync(path.join(OUT, 'parity-report.json'), JSON.stringify(report, null, 2));
  console.log(`golden support parity: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
