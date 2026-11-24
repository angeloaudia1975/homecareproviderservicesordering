/* DEALER SIGN-OUT (owner 2026-11-20: "signing out leaves me on the portal"). On the REAL public/index.html, at desktop and phone:
   a signed-in dealer signs out → the token is revoked at Supabase, the page is replaced and opens on the login, nothing protected
   (dealer name, cart, Victoria) is on screen or in storage, Victoria's audio stops, browser Back and refresh show no dealer, and
   a request still pending at sign-out cannot paint anything. A staff dealer preview keeps its distinction: its header button
   reads "Exit dealer view" and never calls the dealer sign-out. Synthetic dealer; nothing leaves the page.
   ADMIN_REPO=<admin repo> node test/signout.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 600)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const SESSION = { access_token: 'tok-dealer-1', refresh_token: 'r1', expires_at: Date.now() + 3600e3 };
const DEALER = 'TEST — Landing Sandbox';

(async () => {
  const b = await chromium.launch();
  for (const [label, w, h] of [['desktop', 1280, 800], ['phone', 390, 844]]) {
    const { ctx, page } = await open(b, w, h, { session: SESSION });
    const logout = []; let slowAnswered = false;
    await page.route('**/auth/v1/logout*', (r) => { logout.push((r.request().headers()['authorization'] || '') + (/scope=local/.test(r.request().url()) ? ' local' : ' GLOBAL')); return r.fulfill({ status: 204, body: '' }); });
    /* a protected request that is still pending when the dealer signs out */
    await page.route('**/functions/order-history-api', async (r) => { await new Promise((res) => setTimeout(res, 2500)); slowAnswered = true; try { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, orders: [{ id: 'SECRET-ORDER-777', total: 999 }] }) }); } catch (e) {} });
    const before = await page.evaluate(() => ({ status: AUTH.status, name: document.body.innerText.includes('TEST — Landing Sandbox'), out: !!document.getElementById('outBtn'), btn: (document.getElementById('outBtn') || {}).textContent }));
    await t(`${label}: signed in as the dealer (the header shows the dealer and Sign out)`, () => ok(before.status === 'approved' && before.name && before.out && before.btn === 'Sign out', JSON.stringify(before)));
    /* an extra history entry of the signed-in page, so browser Back after sign-out targets the old document */
    await page.evaluate(() => { history.pushState(null, '', '/?tab=orders'); history.pushState(null, '', '/?tab=dash'); });
    /* Victoria speaking + a pending protected request at the moment of sign-out */
    await page.evaluate(() => { const a = document.createElement('audio'); a.id = 'vSpeak'; a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; a.loop = true; document.body.appendChild(a); try { a.play(); } catch (e) {} window.__played = true;
      fetch('/.netlify/functions/order-history-api', { method: 'POST', body: '{}' }).then((r) => r.json()).then((j) => { document.body.insertAdjacentHTML('beforeend', '<div id="leak">' + JSON.stringify(j) + '</div>'); }).catch(() => {}); });
    const nav = page.waitForURL(/\/(\?.*)?$/, { timeout: 15000 }).catch(() => null);
    await page.click('#outBtn'); await nav; await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof AUTH !== 'undefined' && document.getElementById('bootcover') == null, null, { timeout: 30000 });
    await page.waitForTimeout(3200);   // the slow protected answer arrives (or not) in this time
    const after = await page.evaluate(() => ({ status: AUTH.status, url: location.pathname + location.search, stored: localStorage.getItem('hcps_session'), name: document.body.innerText.includes('TEST — Landing Sandbox'),
      leak: !!document.getElementById('leak') || document.body.innerText.includes('SECRET-ORDER-777'), login: !!document.querySelector('#content input[type=password], #content input[type=email], .authbox, [data-auth-tab], #authForm, .lk-auth'),
      out: !!document.getElementById('outBtn'), victoria: !!document.getElementById('dvPanelHost') || !!document.getElementById('dvOrbHost'), audio: !!document.getElementById('vSpeak'), msg: document.body.innerText.includes("You're signed out") }));
    await t(`${label}: Sign out revokes THIS browser's session at Supabase (scope=local — other devices on the login stay signed in)`, () => ok(logout.length === 1 && logout[0] === 'Bearer tok-dealer-1 local', JSON.stringify(logout)));
    await t(`${label}: the page is replaced — signed out, no stored session, no dealer name, no Sign out button, on the login, address clean`, () => ok(after.status === 'anon' && after.stored == null && !after.name && !after.out && after.login && after.url === '/', JSON.stringify(after)));
    await t(`${label}: Victoria is gone and her audio stopped with the old page; the login says "You're signed out."`, () => ok(!after.victoria && !after.audio && after.msg, JSON.stringify(after)));
    await t(`${label}: a protected request pending at sign-out paints nothing`, () => ok(!after.leak, JSON.stringify({ leak: after.leak, slowAnswered })));
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(2500);
    const back = await page.evaluate(() => { let stored = null; try { stored = localStorage.getItem('hcps_session'); } catch (e) {} return { url: location.href.replace(location.origin, ''), status: typeof AUTH !== 'undefined' ? AUTH.status : 'none', name: document.body.innerText.includes('TEST — Landing Sandbox'), stored }; });
    await t(`${label}: browser Back (to the signed-in page's own history) shows no dealer information`, () => ok(/tab=orders/.test(back.url) && back.status !== 'approved' && !back.name && back.stored == null, JSON.stringify(back)));
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
    const re = await page.evaluate(() => ({ status: AUTH.status, name: document.body.innerText.includes('TEST — Landing Sandbox') }));
    await t(`${label}: refresh stays signed out`, () => ok(re.status !== 'approved' && !re.name, JSON.stringify(re)));
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await t(`${label}: no sideways scroll on the login`, () => ok(sw[0] <= sw[1] + 1, JSON.stringify(sw)));
    await ctx.close();
  }
  /* staff dealer preview: the header button exits the dealer view; the dealer sign-out never runs */
  {
    const { ctx, page } = await open(b, 1280, 800, {});
    const logout = []; await page.route('**/auth/v1/logout*', (r) => { logout.push(1); return r.fulfill({ status: 204, body: '' }); });
    const btn = await page.evaluate(() => (document.getElementById('outBtn') || {}).textContent || null);
    await page.evaluate(() => { window.__exited = 0; window.exitPreview = () => { window.__exited++; }; window.close = () => {}; });
    if (btn) await page.click('#outBtn'); await page.waitForTimeout(600);
    const st = await page.evaluate(() => ({ exited: window.__exited, url: location.search, status: AUTH.status }));
    await t('preview: the header button reads "Exit dealer view" and exits the preview — no dealer sign-out, no token revoke', () => ok(btn === 'Exit dealer view' && st.exited === 1 && logout.length === 0 && /preview=/.test(st.url), JSON.stringify({ btn, st, logout })));
    await ctx.close();
  }
  await b.close();
  console.log(`\nsign-out: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
