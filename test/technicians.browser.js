/* Service technicians (Golden Service 360 Stage 5) in the REAL page: the Account Center card, adding a technician (email twice, explicit access, dealer-set password never shown back), remove,
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
      if (body.action === 'create_member') { const emailed = !/nomail/.test(body.email); state.members = state.members.concat([{ uid: '55555555-5555-4555-8555-555555555555', email: body.email, role: body.role, active: true }]);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, member: { uid: '55555555-5555-4555-8555-555555555555', email: body.email, role: body.role }, emailed, email_reason: emailed ? null : 'email_failed' }) }); }
      if (['invite', 'resend_invite', 'accept', 'accept_new'].includes(body.action)) return route.fulfill({ status: 410, contentType: 'application/json', body: '{"ok":false,"error":"retired"}' });
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
    await t(`${w}: add a technician — address twice, explicit access (no default), the DEALER sets the password; never shown back; no link`, async () => {
      await page.evaluate(() => techAddOpen()); const dlg = await page.$eval('#modal', (e) => e.innerText); ok(/Add a technician/.test(dlg) && /emails the technician their Golden Tech Service Portal sign-in link, email and this password/.test(dlg), 'dialog: ' + dlg.slice(0, 300));
      ok(await page.evaluate(() => [...document.querySelectorAll('input[name="techRole"]')].every((r) => !r.checked)), 'no access chosen by default');
      const send = async () => page.evaluate(async () => { await techCreate(); }); const errTxt = () => page.$eval('#acErr', (e) => e.textContent);
      await page.fill('#techEmail', 'pw.tech@dealer.test'); await page.fill('#techEmail2', 'pw.tech@dealer.tst'); await send(); ok(/don't match/.test(await errTxt()), 'mismatch');
      await page.fill('#techEmail2', 'PW.tech@dealer.test'); await send(); ok(/Choose the access/.test(await errTxt()), 'access required');
      await page.check('input[name="techRole"][value="technician_service"]');
      for (const p of ['short', '1234567890', 'pw.tech-2026xx']) { await page.fill('#techPw', p); await send(); ok(/10–72 characters|email name/.test(await errTxt()), p + ' refused'); }
      ok(!calls.some((c) => c.body.action === 'create_member'), 'nothing sent before the form is valid');
      const pwBox = await page.$eval('#techPw', (e) => ({ type: e.type, h: e.getBoundingClientRect().height, fs: getComputedStyle(e).fontSize })); ok(pwBox.type === 'password' && (w > 640 || (pwBox.h >= 44 && pwBox.fs === '16px')), JSON.stringify(pwBox));
      await page.fill('#techPw', 'Blue-Wrench-2026'); await send();
      await page.waitForFunction(() => /Login ready for pw\.tech@dealer\.test/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      const c = calls.find((x) => x.body.action === 'create_member'); ok(c && c.body.email === 'pw.tech@dealer.test' && c.body.confirm_email === 'pw.tech@dealer.test' && c.body.role === 'technician_service' && c.body.password === 'Blue-Wrench-2026' && c.auth === 'Bearer dealer-jwt', JSON.stringify(c));
      const txt = await page.$eval('#techCard', (e) => e.textContent + [...e.querySelectorAll('input')].map((i) => i.value).join('|')); ok(!txt.includes('Blue-Wrench-2026') && !/member_invite/.test(txt), 'password or link shown back');
      ok(/emailed them the Golden Tech Service Portal link and their password/.test(txt), 'says the password was emailed'); ok(!/on/.test(await page.$eval('#modal', (e) => e.className)), 'dialog closed');
      state.members = state.members.filter((m) => !/pw\.tech/.test(m.email)); await page.evaluate(async () => { TECH_MSG = ''; await techCard(); }); });
    await t(`${w}: email not sent — the login still works and the dealer is told how the technician signs in`, async () => {
      await page.evaluate(() => techAddOpen()); await page.fill('#techEmail', 'nomail@dealer.test'); await page.fill('#techEmail2', 'nomail@dealer.test'); await page.check('input[name="techRole"][value="viewer"]'); await page.fill('#techPw', 'Blue-Wrench-2027');
      await page.evaluate(async () => { await techCreate(); }); await page.waitForFunction(() => /could not be sent/.test((document.getElementById('techCard') || {}).textContent || ''), null, { timeout: 5000 });
      ok(/\/service/.test(await page.$eval('#techCard', (e) => e.textContent)), 'tells where to sign in');
      state.members = state.members.filter((m) => !/nomail/.test(m.email)); await page.evaluate(async () => { TECH_MSG = ''; await techCard(); }); });
    await t(`${w}: server switched off — no card`, async () => { state.on = false; await page.evaluate(async () => { await techCard(); }); ok(!(await page.$('#techCard .card'))); state.on = true; });
    await t(`${w}: an old emailed invitation link explains the change and points to the Golden Tech Service Portal (nothing is accepted)`, async () => {
      await page.evaluate(() => { sessionStorage.removeItem('hcps_member_invite'); AUTH.session = null; document.getElementById('p360wrap').style.display = 'none'; location.hash = 'member_invite=' + 'p'.repeat(43); });
      await page.waitForTimeout(400); const txt = await page.$eval('#memberJoin', (e) => e.innerText); ok(/no longer used/.test(txt) && /Golden Tech Service Portal/.test(txt), txt);
      ok(await page.$eval('#memberJoin a[href="/service"]', (e) => !!e), 'link to /service'); ok(!(await page.evaluate(() => sessionStorage.getItem('hcps_member_invite'))), 'token dropped');
      ok(!/member_invite/.test(await page.evaluate(() => location.href)), 'address bar cleaned'); ok(!calls.some((c) => ['accept', 'accept_new'].includes(c.body.action)), 'nothing accepted');
      await page.evaluate(() => { document.getElementById('memberJoin').remove(); document.getElementById('p360wrap').style.display = ''; }); });
    await t(`${w}: a technician signing in on the login screen is let in (not told "no dealer account") — live pilot 2026-11-15`, async () => {
      const r = await page.evaluate(async () => {
        const box = document.createElement('div'); box.innerHTML = '<input id="si_email" value="tech@dealer.test"><input id="si_pass" value="Blue-Wrench-2026"><div id="si_msg"></div>'; document.body.appendChild(box);
        window.sbToken = async () => ({ access_token: 'tech-jwt', refresh_token: 'r', expires_in: 3600 }); window.authMe = async () => { AUTH.status = 'none'; };
        window.__nav = null; try { await doSignin(); } catch (e) { return 'threw ' + e.message; }
        const msg = document.getElementById('si_msg').textContent; box.remove(); return msg; });
      ok(/opening the Golden Tech Service Portal/.test(r), 'message: ' + r + ' calls ' + JSON.stringify(calls.slice(-3).map((c) => [c.body.action, c.auth])) + ' on ' + state.on); ok(calls.some((c) => c.body.action === 'me' && c.auth === 'Bearer tech-jwt'), 'member check with the new login');
    });
    await page.context().close();
  }
  await b.close(); console.log(`\ntechnicians (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
