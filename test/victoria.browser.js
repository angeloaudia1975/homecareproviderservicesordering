/* Ask Victoria — basic dealer interface (owner 2026-11-15, G6). REAL public/index.html (_shop-harness.js); the facts API is
   answered locally (nothing reaches HCPS). At 390 / 768 / 1280: hidden unless the server answers enabled; hidden in a staff
   preview and for a technician login; every supported topic answers from the facts with a source; free text is routed by its
   words; an unsupported question says what Victoria can do; prices only through the price action (not authorized → no
   price); inventory / lead times say "not available"; nothing is ordered or sent; server text is escaped; 44 px targets;
   no horizontal scroll.   node test/victoria.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 400)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const FACTS = { ok: true, enabled: true, as_of: '2026-11-15T20:00:00Z', facts: {
  accounts: [{ manufacturer: 'Yuwell', slug: 'yuwell', account_number_on_file: true, authorized_to_order: true, application: null, status: 'Account on file — ordering' },
    { manufacturer: '<img src=x onerror=window.__xss=1>Evil', slug: 'evil', authorized_to_order: false, status: 'Not authorized' }],
  orders: { open: [{ manufacturer: 'Yuwell', date: '2026-11-15T19:32:21Z', po: 'TEST-1', status: 'pending_account_setup', held_for_account: true, shipments: [] }],
    recent: [{ manufacturer: 'PediFix', date: '2026-11-13T23:28:57Z', po: 'TEST-MANAGE-1', status: 'shipped', shipments: [{ carrier: 'UPS', tracking_number: '1Z999', ship_date: '2026-11-14', est_delivery_date: '2026-11-18' }] }],
    source: 'HCPS order records + manufacturer reports' },
  freight: [{ manufacturer: 'Yuwell', policy: 'Actual freight unless the order includes an SP-3.', source: 'manufacturers.json' }],
  help: [{ id: 'ordering-basics', title: 'Placing an order', area: 'ordering' }],
  golden_service: { available: true, cases: [{ case_no: 'GS-0A1B2C3D', kind: 'service', what: 'Lift motor', status: 'sent', created_at: '2026-11-15' }], source: 'Golden Technologies (via HCPS)' },
  not_yet_available: ['inventory', 'lead times'] } };
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [768, 1024], [1280, 900]]) {
    const { ctx, page } = await open(b, w, h, { html: (src) => src.replace('let SESSION=null, PROFILE=null;', 'let SESSION=null, PROFILE=null; window.__setSession=(x)=>{ SESSION=x; };') });
    const st = { calls: [], enabled: true, other: [] };
    await page.route('**/victoria-dealer-api', (r) => { const x = JSON.parse(r.request().postData() || '{}'); st.calls.push({ x, auth: r.request().headers().authorization });
      if (!st.enabled) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, enabled: false, reason: 'victoria_dealer_off' }) });
      if (x.action === 'price') { const l = x.lines[0]; const body = l.manufacturer !== 'yuwell' ? { ok: true, enabled: true, priced: false, reason: 'not_authorized_for_line' }
        : { ok: true, enabled: true, priced: true, source: 'HCPS pricing engine (the same check as checkout)', orders: [{ manufacturer: 'yuwell', freight_at_this_quantity: 0, lines: [{ code: l.code, name: 'YHT101 Infrared Ear Thermometer', qty: l.qty, your_price: 9, line_total: 9 * l.qty, available: true, contract_price: false, msrp: 18, map: null }] }] };
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTS) }); });
    await page.route('**/orders-api', (r) => { st.other.push(r.request().url()); return r.fulfill({ status: 500, body: '{}' }); });
    await page.route('**/submit-order', (r) => { st.other.push(r.request().url()); return r.fulfill({ status: 500, body: '{}' }); });
    await page.waitForTimeout(1500);
    await t(`${w}: staff preview — Victoria not probed, nav hidden`, async () => {
      await page.evaluate(async () => { await window.__vicTest.probe(); }); ok(!st.calls.length, 'probed in preview'); ok(await page.$eval('#vicNav', (e) => e.style.display === 'none'), 'nav shown'); });
    await page.evaluate(() => { window.__PREVIEW__ = null; window.__setSession({ access_token: 'dealer-jwt', expires_at: Date.now() + 3600e3 }); document.getElementById('p360wrap').style.display = 'block'; document.body.classList.add('p360on'); });
    await t(`${w}: server off → nav stays hidden; enabled → "Ask Victoria" appears (dealer's own sign-in)`, async () => {
      st.enabled = false; await page.evaluate(async () => { await window.__vicTest.probe(); }); ok(await page.$eval('#vicNav', (e) => e.style.display === 'none'), 'shown while off');
      st.enabled = true; await page.evaluate(async () => { await window.__vicTest.probe(); }); ok(await page.$eval('#vicNav', (e) => e.style.display !== 'none'), 'not shown'); ok(st.calls.at(-1).auth === 'Bearer dealer-jwt', 'own token');
    });
    await t(`${w}: every topic answers with a source; inventory says not available; unsupported text explains`, async () => {
      await page.evaluate(() => showView('victoria'));
      for (const [k, re] of [['orders', /Yuwell[\s\S]*waiting for your manufacturer account/], ['tracking', /UPS · 1Z999/], ['accounts', /Yuwell — Account on file/], ['freight', /SP-3/], ['service', /GS-0A1B2C3D/], ['help', /Placing an order/], ['stock', /not available yet/]]) {
        await page.evaluate((k) => { document.getElementById('p360wrap').style.display = 'block'; vicAsk(k, true); }, k); const txt = await page.$eval('#vicLog .card', (e) => e.textContent); ok(re.test(txt), k + ': ' + txt.slice(0, 160)); if (k !== 'stock') ok(/Source:/.test(txt), k + ' source'); }
      await page.fill('#vicQ', 'where is my shipment?'); await page.click('#view-victoria button[type=submit]'); ok(/1Z999/.test(await page.$eval('#vicLog .card', (e) => e.textContent)), 'routed to tracking');
      for (const q of ['Place an order for 2 YHT101', 'Email my rep that I need help', 'cancel my last order']) { await page.fill('#vicQ', q); await page.click('#view-victoria button[type=submit]'); const c = await page.$eval('#vicLog .card', (e) => e.textContent); ok(/Victoria is read-only: she can't place, change or cancel orders, send emails/.test(c) && !/PO /.test(c), 'action refused: ' + q); }
      await page.fill('#vicQ', 'how do i place an order'); await page.click('#view-victoria button[type=submit]'); ok(/Placing an order/.test(await page.$eval('#vicLog .card', (e) => e.textContent)), 'how-to still routes to help');
      await page.fill('#vicQ', 'write me a poem'); await page.click('#view-victoria button[type=submit]'); ok(/I can only answer from your HCPS records/.test(await page.$eval('#vicLog .card', (e) => e.textContent)), 'unsupported');
      ok(!(await page.evaluate(() => window.__xss)), 'server text executed'); ok(!st.other.length, 'order / submit called');
    });
    await t(`${w}: price — your price from the price action; another line → no price`, async () => {
      await page.evaluate(() => vicAsk('price', true)); await page.fill('#vicCode', 'YHT101'); await page.evaluate(async () => { await vicPrice(); });
      ok(/your price \$9\.00 each[\s\S]*MSRP \$18\.00/.test(await page.$eval('#vicPriceOut', (e) => e.textContent)), 'price');
      const opts = await page.$$eval('#vicMfr option', (o) => o.map((x) => x.value)); ok(opts.join() === 'yuwell', 'only authorized lines offered: ' + opts);
      await page.evaluate(() => { const s = document.getElementById('vicMfr'); s.innerHTML += '<option value="evil">x</option>'; s.value = 'evil'; }); await page.evaluate(async () => { await vicPrice(); });
      ok(/not authorized to order that line/.test(await page.$eval('#vicPriceOut', (e) => e.textContent)), 'server refusal shown'); ok(!st.other.length, 'nothing ordered');
    });
    await t(`${w}: 44 px targets, 16 px inputs, no horizontal scroll`, async () => {
      const r = await page.evaluate(() => { const v = document.getElementById('view-victoria'); const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        return { small: [...v.querySelectorAll('.btn,button')].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent), tiny: [...v.querySelectorAll('input,select')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length, ov: document.documentElement.scrollWidth - innerWidth, label: !!v.querySelector('label[for=vicQ]') }; });
      ok(!r.small.length && !r.tiny && r.ov <= 1 && r.label, JSON.stringify(r)); });
    await ctx.close();
  }
  await b.close(); console.log(`\nvictoria (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
