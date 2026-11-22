/* Consumer Victoria on the public storefront (owner 2026-11-22). Serves public/ locally under the LIVE /store/* CSP from
   netlify.toml and answers the storefront API with fixtures. Checks, at 390 and 1280 px:
   - the pilot store's product page shows "Ask Victoria about this product"; an answer appears; Listen plays her audio (data: URL
     allowed by media-src); the campaign link (utm_*) counts the visit as an ad visit; call and directions taps are counted;
   - a store the server does not offer it to (cv_status off) shows no panel, and browsing + Call + Request information stay;
   - at the cap the panel says to call, and the page keeps working.
   Run: node test/consumer-victoria.browser.js */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const toml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
const CSP = (toml.split('for = "/store/*"')[1] || '').match(/Content-Security-Policy = "([^"]+)"/)[1];
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const STORE = { ok: true, dealer: { name: 'James Medical Equipment Bowling Green', phone: '270-904-8521', email: 'x@example.com', hours: '', address: { street: '1010 Fairview Dr.', city: 'Bowling Green', state: 'KY', zip: '42101' }, design: { layout: 'standard' } },
  lines: [{ slug: 'golden-technologies', name: 'Golden Technologies' }], price_note: 'Prices may change.', privacy: 'p',
  products: [{ manufacturer: 'golden-technologies', code: 'GP309', family: 'GP309', name: 'Cricket LT Carbon', category: 'Power Wheelchairs', price: 3499, price_label: 'MSRP', description: 'Carbon-fiber side-fold power chair.', features: ['300 lbs max'], image: null }] };
const MP3 = Buffer.from('SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', 'base64').toString('base64');
function server() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (/^\/store\/[a-z0-9-]+\/?$/.test(p)) p = '/store.html';
    const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    const type = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, Object.assign({ 'content-type': type }, /store/.test(p) ? { 'content-security-policy': CSP } : {})); fs.createReadStream(f).pipe(res);
  });
}
(async () => {
  const srv = server(); await new Promise((r) => srv.listen(0, r)); const BASE = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const [w, h, label] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
      for (const mode of ['pilot', 'off', 'cap']) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 }); const page = await ctx.newPage();
        const posts = [], cspErr = [];
        page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) cspErr.push(m.text()); });
        await page.route('https://homecareproviderservices.netlify.app/**', async (route) => {
          const r = route.request(); const u = r.url();
          if (r.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/[?&]d=/.test(u) ? { ok: true, detail: { description: 'Carbon-fiber side-fold power chair.' } } : STORE) });
          const b = JSON.parse(r.postData() || '{}'); posts.push(b);
          const j = b.action === 'cv_status' ? (mode === 'off' ? { ok: false, off: 'not_offered' } : { ok: true, on: true })
            : b.action === 'cv_ask' ? (mode === 'cap' ? { ok: false, off: 'budget_reached', contact: { phone: '270-904-8521' } } : { ok: true, answer: 'It weighs 25.8 lbs.', speak: 'tok.x' })
            : b.action === 'cv_speak' ? { ok: true, audio: MP3, mime: 'audio/mpeg' } : { ok: true };
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) });
        });
        const url = BASE + '/store/jamesmedicalequipmentbowlinggreen' + (mode === 'pilot' ? '?utm_source=facebook&utm_medium=social&utm_campaign=hcps-victoria-gp309' : '') + '#product/golden-technologies%7CGP309//GP309';
        await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForSelector('.pdp');
        if (mode === 'off') {
          await page.waitForTimeout(600);
          await t(`${label} not offered: no Victoria panel; Call and Request information stay`, async () => {
            ok(!(await page.$('.cv')), 'panel shown'); ok(await page.$('.pdp a[href^="tel:"]'), 'call'); ok(await page.$('.pdp [data-ask]'), 'request');
            ok(!posts.some((p) => p.action === 'cv_event'), 'counted a non-pilot store'); });
        } else {
          await page.waitForSelector('.cv');
          await t(`${label} ${mode}: the panel is on the product page; ask → answer${mode === 'cap' ? ' says to call' : ''}`, async () => {
            await page.fill('#cvq', 'How much does it weigh?'); await page.click('#cvf button'); await page.waitForFunction(() => document.querySelectorAll('.cv-a').length > 0);
            const a = await page.textContent('.cv-a'); ok(mode === 'cap' ? /isn't available/.test(a) && /270-904-8521/.test(a) : /25\.8 lbs/.test(a), a);
            const q = posts.find((p) => p.action === 'cv_ask'); ok(q && q.d === 'golden-technologies|GP309' && q.src === (mode === 'pilot' ? 'ad' : 'organic'), JSON.stringify(q));
            const tgt = await page.evaluate(() => { const r = document.querySelector('#cvf button').getBoundingClientRect(); return r.height; }); ok(tgt >= 44, 'touch target ' + tgt);
            ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'horizontal scroll'); });
          if (mode === 'pilot') {
            await t(`${label}: "That didn't answer my question" is sent once, with the question only`, async () => {
              await page.click('.cv-fb'); await page.waitForTimeout(300); const f = posts.filter((p) => p.action === 'cv_feedback');
              ok(f.length === 1 && f[0].q === 'How much does it weigh?' && /improve Victoria/.test(await page.textContent('.cv-fb')), JSON.stringify(f));
              await page.click('.cv-fb').catch(() => {}); ok(posts.filter((p) => p.action === 'cv_feedback').length === 1, 'sent twice'); });
            await t(`${label}: Listen plays Victoria's audio under the live CSP`, async () => {
              await page.click('.cv-say'); await page.waitForFunction(() => /Playing|Listen|Tap to hear/.test((document.querySelector('.cv-say') || {}).textContent || ''), null, { timeout: 8000 });
              ok(posts.some((p) => p.action === 'cv_speak' && p.speak === 'tok.x'), 'speak not requested'); ok(!cspErr.some((e) => /media/i.test(e)), cspErr.join(' | ')); });
            await t(`${label}: ad visit, product view, call and directions taps are counted (counts only)`, async () => {
              await page.evaluate(() => { document.querySelectorAll('a[href^="tel:"]')[0].addEventListener('click', (e) => e.preventDefault()); const m = [...document.querySelectorAll('a[href*="google.com/maps"]')][0]; if (m) m.addEventListener('click', (e) => e.preventDefault()); });
              await page.click('.pdp a[href^="tel:"]'); const m = await page.$('a[href*="google.com/maps"]'); if (m) await m.click();
              await page.waitForTimeout(500); const ev = posts.filter((p) => p.action === 'cv_event').map((p) => p.ev + ':' + p.src);
              for (const x of ['visit:ad', 'product_view:ad', 'call_tap:ad']) ok(ev.includes(x), x + ' missing: ' + ev.join(','));
              ok(posts.filter((p) => p.action === 'cv_event').every((p) => Object.keys(p).sort().join() === 'action,ev,s,src'), 'an event carried more than counts'); });
          }
        }
        await ctx.close();
      }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(`\nconsumer-victoria (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
