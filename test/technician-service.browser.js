/* Technician logins in Golden Service & Support (owner 2026-11-15), in the REAL public/index.html (_shop-harness.js; nothing
   reaches HCPS, Golden or Supabase — the members API and golden-proxy are answered locally with Golden's real extracted
   support data, prices hidden as golden-proxy hides them for a member). At 390 / 768 / 1280:
     · a member login gets ONE view (Golden Service & Support); every other view routes back to it;
     · Viewer: troubleshooting, videos, parts, documents, its cases — no Service request / Labor tab; sending is refused;
     · Technician + Service: the Service request tab too, never Labor; a labor claim is refused before any call;
     · no dealer price on screen; no horizontal scroll.
   GOLDEN_REPO=… node test/technician-service.browser.js */
const path = require('path');
const { chromium, open } = require('./_shop-harness.js');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const S = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog.js'));
const DATA = require(path.join(GOLDEN, 'repo', 'functions', 'lib', 'service-catalog-data.json'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 400)); } };
const CORS = { 'access-control-allow-origin': '*' };
(async () => {
  const b = await chromium.launch();
  for (const role of ['viewer', 'technician_service']) for (const [w, h] of [[390, 844], [768, 1024], [1280, 900]]) {
    const { ctx, page } = await open(b, w, h, { html: (src) => src.replace('let SESSION=null, PROFILE=null;', 'let SESSION=null, PROFILE=null; window.__setSession=(x)=>{ SESSION=x; };').replace('async function gsvSendCase(d){', 'window.gsvSendCaseForTest=(d)=>gsvSendCase(d);\nasync function gsvSendCase(d){') });
    const st = { gp: [] };
    await page.route('**/dealer-members-api', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ ok: true, member: { role, dealer_name: 'TEST — Golden Sandbox', email: 'tech@t.test', can: [] } }) }));
    await page.route('**/functions/golden-proxy', (r) => { const x = JSON.parse(r.request().postData() || '{}'); st.gp.push(x);
      let body = { ok: true, enabled: false, reason: 'off' };
      if (x.action === 'service_catalog') body = Object.assign({ ok: true, enabled: true, available: true, as_of: '2026-11-15T10:00:00Z' }, S.build(DATA, { seePrices: false, linked: true }), { prices_visible: false });
      if (x.action === 'service_cases') body = { ok: true, enabled: true, cases: [{ case_no: 'GS-0A1B2C3D', kind: 'service', what: 'Lift motor', status: 'sent', created_at: '2026-11-15T10:00:00Z', routed_to: 'x@goldentech.com', attachments: 0 }] };
      if (x.action === 'service_submit') body = { ok: true, enabled: true, accepted: true, case_no: 'GS-0A1B2C3E', duplicate: false, routed_to: 'x@goldentech.com', email: { status: 'sent' } };
      return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__PREVIEW__ = null; window.__setSession({ access_token: 'tech-jwt', expires_at: Date.now() + 3600e3 }); AUTH.session = { access_token: 'tech-jwt', expires_at: Math.floor(Date.now() / 1000) + 3600 }; AUTH.dealer = null;
      document.getElementById('p360wrap') && (document.getElementById('p360wrap').style.display = 'block'); document.body.classList.add('p360on'); });
    const tag = `${role} ${w}`;
    await t(`${tag}: member mode — one view, other views route back to it`, async () => {
      ok(await page.evaluate(() => memberMode()), 'memberMode'); await page.waitForFunction(() => document.querySelector('#gsvHost') && document.querySelector('#gsvHost').shadowRoot, null, { timeout: 8000 });
      const nav = await page.$$eval('#nav a', (a) => a.map((x) => x.textContent)); ok(nav.length === 1 && /Golden Service/.test(nav[0]), JSON.stringify(nav));
      await page.evaluate(() => showView('orders')); ok(await page.evaluate(() => document.getElementById('view-goldsvc').classList.contains('on') && !document.getElementById('view-orders').classList.contains('on')), 'orders view opened');
      ok(!st.gp.some((x) => !/^service_/.test(x.action)), 'non-service Golden call: ' + JSON.stringify(st.gp.map((x) => x.action)));
    });
    await t(`${tag}: tabs by role, no labor, no dealer price`, async () => {
      const vis = await page.evaluate(() => { const r = document.querySelector('#gsvHost').shadowRoot; return [...r.querySelectorAll('.tab-btn')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => (x.getAttribute('onclick') || '').match(/'(\w+)'/)[1]); });
      ok(!vis.includes('labor'), 'labor tab: ' + vis); ok(vis.includes('request') === (role === 'technician_service'), 'request tab: ' + vis); ok(vis.includes('history') === (role === 'technician_service'), 'history tab: ' + vis); ok(vis.includes('docs') && vis.includes('videos') && vis.includes('parts'), 'read tabs: ' + vis);
      const all = await page.evaluate(() => document.querySelector('#gsvHost').shadowRoot.textContent + document.getElementById('view-goldsvc').textContent);
      ok(!/Dealer \$\d/.test(all), 'a dealer price is shown');
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 1, 'horizontal overflow ' + ov);
    });
    await t(`${tag}: sending — Viewer refused, Technician sends a service request, a labor claim never leaves the page`, async () => {
      const n0 = st.gp.filter((x) => x.action === 'service_submit').length;
      const svc = await page.evaluate(() => gsvSendCaseForTest({ type: 'service', contact_name: 'Pat', email: 'p@t.test', issue_description: 'x' }));
      const lab = await page.evaluate(() => gsvSendCaseForTest({ type: 'labor', contact_name: 'Pat', contact_email: 'p@t.test', preauth_amount: '120' }));
      const sent = st.gp.filter((x) => x.action === 'service_submit').slice(n0);
      ok(!lab.ok && sent.every((x) => x.request.kind !== 'labor'), 'labor sent');
      if (role === 'viewer') { ok(!svc.ok && /read service information only/.test(svc.error) && !sent.length, 'viewer sent: ' + JSON.stringify(svc)); }
      else { ok(svc.ok && sent.length === 1 && sent[0].request.kind === 'service', 'technician send: ' + JSON.stringify(svc)); }
    });
    await ctx.close();
  }
  await b.close(); console.log(`\ntechnician service (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
