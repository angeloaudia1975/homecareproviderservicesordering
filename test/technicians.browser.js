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
      if (body.action === 'create_member') { state.members = state.members.concat([{ uid: '55555555-5555-4555-8555-555555555555', email: body.email, role: body.role, active: true }]);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, member: { uid: '55555555-5555-4555-8555-555555555555', email: body.email, role: body.role }, emailed: !/nomail/.test(body.email) }) }); }
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
    await t(`${w}: dealer creates the login with a password; HCPS emails it; password cleared, never shown back`, async () => {
      await page.evaluate(() => techAddOpen()); ok(/Add a technician/.test(await page.$eval('#modal', (e) => e.innerText)), 'dialog');
      await page.fill('#techEmail', 'pw.tech@dealer.test'); await page.selectOption('#techRole', 'technician_service');
      await page.evaluate(async () => { document.getElementById('techPw').value = 'short'; await techCreate(); }); ok(!calls.some((c) => c.body.action === 'create_member'), 'short password sent'); ok(/10–72 characters/.test(await page.$eval('#acErr', (e) => e.textContent)), 'error shown in the dialog');
      await page.evaluate(async () => { document.getElementById('techPw').value = '1234567890'; await techCreate(); }); ok(!calls.some((c) => c.body.action === 'create_member'), 'digits-only password sent');
      await page.fill('#techPw', 'Blue-Wrench-2026'); const pwBox = await page.$eval('#techPw', (e) => ({ type: e.type, h: e.getBoundingClientRect().height, fs: getComputedStyle(e).fontSize })); ok(pwBox.type === 'password' && (w > 640 || (pwBox.h >= 44 && pwBox.fs === '16px')), JSON.stringify(pwBox));   // phone: 44 px / 16 px; larger: the same field style as Add a contact (checked below)
      const same = await page.evaluate(() => { const a = getComputedStyle(document.getElementById('techEmail')), b = getComputedStyle(document.getElementById('techPw')); return document.getElementById('techPw').parentElement.className === 'fld2' && ['fontSize', 'height', 'borderRadius', 'padding'].every((k) => a[k] === b[k]); }); ok(same, 'password field styled like the contact fields');
      await page.evaluate(async () => { await techCreate(); }); await page.waitForFunction(() => /emailed it the sign-in details/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      const c = calls.find((x) => x.body.action === 'create_member'); ok(c && c.body.email === 'pw.tech@dealer.test' && c.body.role === 'technician_service' && c.body.password === 'Blue-Wrench-2026' && c.auth === 'Bearer dealer-jwt', JSON.stringify(c));
      const txt = await page.$eval('#techCard', (e) => e.textContent + [...e.querySelectorAll('input')].map((i) => i.value).join('|')); ok(!txt.includes('Blue-Wrench-2026'), 'password shown back'); ok(/pw\.tech@dealer\.test/.test(txt), 'listed');
      ok(!/on/.test(await page.$eval('#modal', (e) => e.className)), 'dialog closed after success');
      await page.evaluate(() => techAddOpen()); await page.fill('#techEmail', 'nomail@dealer.test'); await page.fill('#techPw', 'Blue-Wrench-2027'); await page.evaluate(async () => { await techCreate(); });
      await page.waitForFunction(() => /could not be sent/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      state.members = state.members.filter((m) => !/pw\.tech|nomail/.test(m.email)); await page.evaluate(async () => { TECH_MSG = ''; await techCard(); }); });
    await t(`${w}: invitation — one-time link shown with its warning, copy button, then cancel`, async () => {
      await page.evaluate(() => techAddOpen()); await page.fill('#techEmail', 'new@dealer.test'); await page.selectOption('#techRole', 'viewer');
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
      await page.evaluate(() => { document.getElementById('p360wrap').style.display = 'none'; });   // signed out = portal hidden behind the login screen
      await page.evaluate(async () => { await memberInviteCheck(); }); ok(/Create login/.test(await page.$eval('#memberJoin', (e) => e.innerText)), 'create option');
      const box = await page.$eval('#memberPw', (e) => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, top: document.elementFromPoint(r.left + 5, r.top + 5) === e }; }); ok(box.h >= 44 && box.w > 100 && box.top, 'password box visible on top of the login screen ' + JSON.stringify(box));
      await page.fill('#memberPw', 'short'); await page.evaluate(async () => { await memberCreate(); }); ok(/at least 10/.test(await page.$eval('#memberMsg', (e) => e.textContent)), 'short refused locally');
      await page.fill('#memberPw', 'longenough1'); await page.evaluate(async () => { await memberCreate(); });
      const c = calls.find((x) => x.body.action === 'accept_new'); ok(c && c.body.token === 'k'.repeat(43) && c.body.password === 'longenough1' && !c.auth && !('email' in c.body), 'accept_new call ' + JSON.stringify(c));
      ok(/login is ready \(new\.tech@dealer\.test\)/.test(await page.$eval('#memberMsg', (e) => e.textContent)), 'confirmation'); ok(!(await page.evaluate(() => sessionStorage.getItem('hcps_member_invite'))), 'token cleared');
      await page.evaluate(() => { document.getElementById('memberJoin').remove(); document.getElementById('p360wrap').style.display = ''; });
    });
    await t(`${w}: a link pasted into an open tab (#fragment only, no reload) still opens the invitation`, async () => {
      await page.evaluate(() => { sessionStorage.removeItem('hcps_member_invite'); AUTH.session = null; document.getElementById('p360wrap').style.display = 'none'; location.hash = 'member_invite=' + 'p'.repeat(43); });
      await page.waitForTimeout(400); ok(await page.$('#memberJoin'), 'dialog opened'); ok(await page.evaluate(() => sessionStorage.getItem('hcps_member_invite')) === 'p'.repeat(43), 'token kept'); ok(!/member_invite/.test(await page.evaluate(() => location.href)), 'address bar cleaned');
      await page.evaluate(() => { document.getElementById('memberJoin').remove(); document.getElementById('p360wrap').style.display = ''; }); });
    await t(`${w}: a technician signing in on the login screen is let in (not told "no dealer account") — live pilot 2026-11-15`, async () => {
      const r = await page.evaluate(async () => {
        const box = document.createElement('div'); box.innerHTML = '<input id="si_email" value="tech@dealer.test"><input id="si_pass" value="Blue-Wrench-2026"><div id="si_msg"></div>'; document.body.appendChild(box);
        window.sbToken = async () => ({ access_token: 'tech-jwt', refresh_token: 'r', expires_in: 3600 }); window.authMe = async () => { AUTH.status = 'none'; };
        window.__nav = null; try { await doSignin(); } catch (e) { return 'threw ' + e.message; }
        const msg = document.getElementById('si_msg').textContent; box.remove(); return msg; });
      ok(/opening Golden Service/.test(r), 'message: ' + r + ' calls ' + JSON.stringify(calls.slice(-3).map((c) => [c.body.action, c.auth])) + ' on ' + state.on); ok(calls.some((c) => c.body.action === 'me' && c.auth === 'Bearer tech-jwt'), 'member check with the new login');
    });
    await page.context().close();
  }
  await b.close(); console.log(`\ntechnicians (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
