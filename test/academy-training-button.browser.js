/* Partner 360 dashboard — the HCPS Academy Training button: hidden unless academy-handoff status (asked with the dealer's own
   token) says enabled; a click mints a single-use link and opens the Academy with the code in the URL fragment.
   PLAYWRIGHT_MODULE=… node test/academy-training-button.browser.js   (run from the repo root) */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const path = require('path'), fs = require('fs');
const html = fs.readFileSync(path.join(process.cwd(), 'public/dashboard.html'), 'utf8');
(async () => {
  const b = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
  for (const enabled of [false, true]) {
    const p = await b.newPage(); const calls = [];
    await p.route('**/*', async route => {
      const u = route.request().url();
      if (u === 'https://hcpsonlineordering.netlify.app/dashboard.html') return route.fulfill({ body: html, contentType: 'text/html' });
      if (u.includes('/academy-handoff')) { const body = JSON.parse(route.request().postData() || '{}'); calls.push({ action: body.action, auth: route.request().headers().authorization });
        return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://hcpsonlineordering.netlify.app', 'access-control-allow-headers': 'content-type, authorization' },
          body: JSON.stringify(body.action === 'status' ? { enabled } : { ok: true, url: 'https://www.homecareproviderservices.org/academy/#handoff=' + 'x'.repeat(43) }) }); }
      if (u.includes('/academy/')) return route.fulfill({ body: '<h1>academy</h1>', contentType: 'text/html' });
      if (u.includes('/dealer-auth')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'approved', dealer: { name: 'TEST — Golden Sandbox' }, lines: [] }) });
      if (u.includes('/order-history-api')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, ytd: {}, allTime: {}, byManufacturer: [] }) });
      return route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    await p.addInitScript(() => localStorage.setItem('hcps_session', JSON.stringify({ access_token: 'tok-abc', expires_at: Date.now() + 3600e3 })));
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('https://hcpsonlineordering.netlify.app/dashboard.html'); await p.waitForTimeout(1200);
    const vis = await p.isVisible('#academyLink');
    ok(vis === enabled, `Training button ${enabled ? 'shown' : 'hidden'} when status says enabled:${enabled}`);
    ok(calls[0] && calls[0].action === 'status' && calls[0].auth === 'Bearer tok-abc', 'status is asked with the dealer\'s own token');
    if (enabled) { await p.click('#academyLink'); await p.waitForURL(/academy\/#handoff=/); ok(/#handoff=x{43}$/.test(p.url()), 'click mints a link and opens the Academy with the code in the fragment'); }
    ok(!errs.length, 'no page errors ' + errs.join(';'));
    await p.close();
  }
  await b.close(); console.log(`p360-training: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
