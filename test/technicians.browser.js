/* Service technicians (Golden Service 360 Stage 5) in the REAL page: the Account Center card, a one-time link, cancel / remove,
   the card hidden when the server is switched off or in a staff preview, and accepting an invitation. The members API is
   answered locally (no network). Phone, tablet, desktop.   ADMIN_REPO=… node test/technicians.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 300)); } };
const ok = (c, m) => { if (!c) throw new Error(m || ('not ok @' + new Error().stack.split('\n')[2])); };
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [768, 1024], [1280, 900]]) {
    const { page } = await open(b, w, h, { html: (src) => src.replace('let SESSION=null, PROFILE=null;', 'let SESSION=null, PROFILE=null; window.__setSession=(x)=>{ SESSION=x; };') });
    const calls = []; let state = { on: true, invites: [], members: [{ uid: '33333333-3333-4333-8333-333333333333', email: 'tech@dealer.test', role: 'technician_service', active: true }] };
    await page.route('**/dealer-members-api', async (route) => { const body = JSON.parse(route.request().postData() || '{}'); calls.push({ body, auth: route.request().headers().authorization });
      if (!state.on) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'switched_off' }) });
      if (body.action === 'list') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invites: state.invites, members: state.members }) });
      if (body.action === 'invite') { state.invites = [{ id: '44444444-4444-4444-8444-444444444444', email: body.email, role: body.role, status: 'pending', expires_at: '2026-11-22T00:00:00Z' }];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invite: { id: state.invites[0].id, email: body.email, role: body.role, expires_at: '2026-11-22T00:00:00Z' }, link: 'https://shop.test/?member_invite=' + 'k'.repeat(43) }) }); }
      if (body.action === 'revoke_invite') { state.invites = []; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      if (body.action === 'accept_new') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, role: 'viewer', email: 'new.tech@dealer.test' }) });
      if (body.action === 'accept') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"role":"viewer"}' });
      if (body.action === 'me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, member: { role: 'viewer', dealer_name: 'Acme Medical', can: [] } }) });
      return route.fulfill({ status: 400, body: '{}' }); });
    await t(`${w}: staff preview — no technicians card, members API not called`, async () => {
      await page.evaluate(async () => { await techCard(); }); ok(!(await page.$('#techCard .card')), 'card shown in preview'); ok(!calls.length, 'API called in preview'); });
    await page.evaluate(() => { window.__PREVIEW__ = null; window.__setSession({ access_token: 'dealer-jwt', expires_at: Date.now() + 3600e3 }); });
    await t(`${w}: signed-in dealer — card lists the technician, no prices anywhere in it`, async () => {
      await page.waitForTimeout(2500);   // let the page finish its own first render
      await page.evaluate(async () => { const h = document.getElementById('view-account'); h.classList.add('on'); h.innerHTML = '<div></div>'; await techCard(); });
      await page.waitForSelector('#techCard .card', { timeout: 5000 });
      const txt = await page.$eval('#techCard', (e) => e.textContent); ok(/Service technicians/.test(txt) && /tech@dealer\.test/.test(txt) && /Technician \+ Service/.test(txt), txt.slice(0, 200));
      ok(/never see prices, orders, purchases or reports/.test(txt), 'warning text'); ok(calls.at(-1).auth === 'Bearer dealer-jwt', 'own session token ' + calls.at(-1).auth);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 1, 'horizontal overflow ' + ov); });
    await t(`${w}: invitation — one-time link shown with its warning, copy button, then cancel`, async () => {
      await page.fill('#techEmail', 'new@dealer.test'); await page.selectOption('#techRole', 'viewer');
      await page.evaluate(async () => { await techInvite(); });
      await page.waitForFunction(() => /shown only now/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      const txt = await page.$eval('#techCard', (e) => e.textContent); ok(/shown only now/.test(txt) && /HCPS does not email it/.test(txt) && /member_invite=k{43}/.test(txt), txt.slice(0, 300));
      ok(calls.some((c) => c.body.action === 'invite' && c.body.email === 'new@dealer.test' && c.body.role === 'viewer' && !('can_see_prices' in c.body)), 'invite call ' + JSON.stringify(calls.map((c) => c.body)));
      await page.evaluate(async () => { await techRevokeInvite('44444444-4444-4444-8444-444444444444'); });
      ok(!/Open invitations/.test(await page.$eval('#techCard', (e) => e.textContent)), 'cancelled'); });
    await t(`${w}: server switched off — no card`, async () => { state.on = false; await page.evaluate(async () => { await techCard(); }); ok(!(await page.$('#techCard .card'))); state.on = true; });
    await t(`${w}: invitation link — token kept for the tab, address bar cleaned, accept once signed in, member banner`, async () => {
      await page.evaluate(() => { history.replaceState(null, '', '/?member_invite=' + 'k'.repeat(43)); });
      await page.evaluate(() => { const u = new URL(location.href), tk = u.searchParams.get('member_invite'); sessionStorage.setItem('hcps_member_invite', tk); u.searchParams.delete('member_invite'); history.replaceState(null, '', u.pathname); AUTH.session = { access_token: 'tech-jwt' }; AUTH.status = 'none'; });
      await page.evaluate(async () => { await memberInviteCheck(); });
      ok(/Accept technician access/.test(await page.$eval('#modal', (e) => e.innerText)), 'accept prompt'); ok(!/member_invite/.test(await page.evaluate(() => location.href)), 'url cleaned');
      await page.evaluate(async () => { await memberAccept(); }); await page.waitForTimeout(300);
      const acc = calls.find((c) => c.body.action === 'accept'); ok(acc && acc.body.token === 'k'.repeat(43) && acc.auth === 'Bearer tech-jwt', 'accept with own session');
      ok(/Technician access for Acme Medical/.test(await page.$eval('#memberBanner', (e) => e.innerText)), 'banner'); ok(!(await page.evaluate(() => sessionStorage.getItem('hcps_member_invite'))), 'token cleared'); });
    await t(`${w}: no login yet — create the technician login from the invitation (no sign-in, token + password only)`, async () => {
      await page.evaluate(() => { sessionStorage.setItem('hcps_member_invite', 'k'.repeat(43)); AUTH.session = null; });
      await page.evaluate(async () => { await memberInviteCheck(); }); ok(/Create login/.test(await page.$eval('#modal', (e) => e.innerText)), 'create option');
      await page.fill('#memberPw', 'short'); await page.evaluate(async () => { await memberCreate(); }); ok(/at least 10/.test(await page.$eval('#memberMsg', (e) => e.textContent)), 'short refused locally');
      await page.fill('#memberPw', 'longenough1'); await page.evaluate(async () => { await memberCreate(); });
      const c = calls.find((x) => x.body.action === 'accept_new'); ok(c && c.body.token === 'k'.repeat(43) && c.body.password === 'longenough1' && !c.auth && !('email' in c.body), 'accept_new call ' + JSON.stringify(c));
      ok(/login is ready \(new\.tech@dealer\.test\)/.test(await page.$eval('#memberMsg', (e) => e.textContent)), 'confirmation'); ok(!(await page.evaluate(() => sessionStorage.getItem('hcps_member_invite'))), 'token cleared'); });
    await page.context().close();
  }
  await b.close(); console.log(`\ntechnicians (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
