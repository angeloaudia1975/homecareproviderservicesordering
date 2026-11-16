/* Service technicians (Golden Service 360 Stage 5) in the REAL page: the Account Center card, an emailed invitation (typed twice, explicit access, no password), resend / cancel / remove,
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
      if (body.action === 'invite') { const emailed = !/nomail/.test(body.email); state.invites = [{ id: '44444444-4444-4444-8444-444444444444', email: body.email, role: body.role, status: 'pending', expires_at: '2026-11-22T00:00:00Z', delivery: emailed ? 'sent' : 'failed', last_sent_at: '2026-11-15T03:00:00Z', sends: 1 }];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invite: { id: state.invites[0].id, email: body.email, role: body.role, expires_at: '2026-11-22T00:00:00Z' }, emailed, email_reason: emailed ? null : 'email_failed' }) }); }
      if (body.action === 'resend_invite') { state.invites = state.invites.map((i) => Object.assign({}, i, { delivery: 'sent', sends: i.sends + 1 })); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"emailed":true}' }); }
      if (body.action === 'create_member') return route.fulfill({ status: 410, contentType: 'application/json', body: '{"ok":false,"error":"retired"}' });
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
    await t(`${w}: invite — address typed twice, access chosen explicitly (no default), no password anywhere; HCPS emails it; the link is never shown`, async () => {
      await page.evaluate(() => techAddOpen()); const dlg = await page.$eval('#modal', (e) => e.innerText); ok(/Invite a technician/.test(dlg) && !/password/i.test(dlg.replace(/choose(s)? their own password|never see or send a password/gi, '')), 'dialog: ' + dlg.slice(0, 300));
      ok(!(await page.$('#techPw')) && !(await page.$('#techRole')), 'no password field, no pre-selected access dropdown');
      ok(await page.evaluate(() => [...document.querySelectorAll('input[name="techRole"]')].every((r) => !r.checked)), 'no access chosen by default');
      const send = async () => page.evaluate(async () => { await techInvite(); }); const errTxt = () => page.$eval('#acErr', (e) => e.textContent);
      await page.fill('#techEmail', 'new@dealer.test'); await page.fill('#techEmail2', 'new@dealer.tst'); await send(); ok(/don't match/.test(await errTxt()), 'mismatch');
      await page.fill('#techEmail2', 'NEW@dealer.test'); await send(); ok(/Choose the access/.test(await errTxt()), 'access required');
      await page.check('input[name="techRole"][value="viewer"]'); await send(); ok(/reads email at this address/.test(await errTxt()), 'ownership confirmation required');
      ok(!calls.some((c) => c.body.action === 'invite'), 'nothing sent before the form is complete');
      if (w <= 640) { const hs = await page.evaluate(() => ['techEmail', 'techEmail2'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return [r.height, getComputedStyle(e).fontSize]; }).concat([...document.querySelectorAll('#modal label')].filter((l) => l.querySelector('input[type=radio],input[type=checkbox]')).map((l) => [l.getBoundingClientRect().height, '16px']))); ok(hs.every(([h, f]) => h >= 44 && f === '16px'), 'phone targets ' + JSON.stringify(hs)); }
      await page.check('#techOwns'); await send();
      await page.waitForFunction(() => /Invitation emailed to new@dealer\.test/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      const c = calls.find((x) => x.body.action === 'invite'); ok(c && c.body.email === 'new@dealer.test' && c.body.confirm_email === 'new@dealer.test' && c.body.role === 'viewer' && !('password' in c.body) && c.auth === 'Bearer dealer-jwt', JSON.stringify(c));
      const txt = await page.$eval('#techCard', (e) => e.textContent); ok(!/member_invite/.test(txt) && !(await page.$('#techLinkText')), 'no link shown'); ok(/Invitation emailed/.test(txt) && /Resend/.test(txt), txt.slice(0, 400));
      await page.evaluate(async () => { await techRevokeInvite('44444444-4444-4444-8444-444444444444'); }); ok(!/new@dealer\.test/.test(await page.$eval('#techCard', (e) => e.textContent)), 'cancelled'); });
    await t(`${w}: delivery failed — said plainly, Resend sends a new invitation`, async () => {
      await page.evaluate(() => techAddOpen()); await page.fill('#techEmail', 'nomail@dealer.test'); await page.fill('#techEmail2', 'nomail@dealer.test'); await page.check('input[name="techRole"][value="technician_service"]'); await page.check('#techOwns');
      await page.evaluate(async () => { await techInvite(); }); await page.waitForFunction(() => /could not be sent/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      ok(/Email not sent/.test(await page.$eval('#techCard', (e) => e.textContent)), 'row says the email was not sent');
      await page.click('#techCard a[onclick^="techResend"]'); await page.waitForFunction(() => /emailed again/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      ok(calls.some((x) => x.body.action === 'resend_invite' && x.body.id === '44444444-4444-4444-8444-444444444444'), 'resend call');
      state.invites = []; await page.evaluate(async () => { TECH_MSG = ''; await techCard(); }); });
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
      for (const p of ['short', '1234567890', 'has space 12']) { await page.fill('#memberPw', p); await page.evaluate(async () => { await memberCreate(); }); ok(/10–72 characters/.test(await page.$eval('#memberMsg', (e) => e.textContent)), p + ' refused locally'); }
      ok(!calls.some((x) => x.body.action === 'accept_new'), 'nothing sent for a weak password');
      const si = await page.evaluate(() => { const box = document.createElement('div'); box.id = 'siBox'; box.innerHTML = '<input id="si_email"><input id="si_pass"><div id="si_msg"></div>'; document.body.appendChild(box); return true; });
      await page.fill('#memberPw', 'Blue-Wrench-2026'); await page.evaluate(async () => { await memberCreate(); });
      const c = calls.find((x) => x.body.action === 'accept_new'); ok(si && c && c.body.token === 'k'.repeat(43) && c.body.password === 'Blue-Wrench-2026' && !c.auth && !('email' in c.body), 'accept_new call ' + JSON.stringify(c));
      ok(!(await page.$('#memberJoin')), 'dialog closed'); ok(await page.$eval('#si_email', (e) => e.value) === 'new.tech@dealer.test', 'sign-in email filled in');
      ok(/login is ready \(new\.tech@dealer\.test\)/.test(await page.$eval('#si_msg', (e) => e.textContent)), 'confirmation'); ok(!(await page.evaluate(() => sessionStorage.getItem('hcps_member_invite'))), 'token cleared');
      await page.evaluate(() => { document.getElementById('siBox').remove(); document.getElementById('p360wrap').style.display = ''; });
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
