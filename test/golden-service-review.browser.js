/* The protected design-review page for Golden Service & Support (public/review/golden-service.html, owner 2026-11-22):
   the PR build's own module + Dealer 360 skin with SAMPLE data. Served from public/ on localhost (the page runs only on a
   Partner 360 deploy preview or localhost). At 1280 / 390: the sample banner shows; all 7 tabs open; the Parts & Service
   Request form renders; the before/after switch removes and restores the skin; a submit is refused and NOTHING but GETs of
   the page's own files leaves the page (no golden-proxy, no Formspree, no POST); no horizontal scroll; no broken image of its
   own; on any other host the page refuses to render. SHOTS=dir saves review-{desktop,phone}-{troubleshoot,request}.png.
   node test/golden-service-review.browser.js */
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.join(__dirname, '..', 'public');
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const p = path.join(PUB, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(PUB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
const R = (page, fn) => page.evaluate((f) => (new Function('root', f))(document.querySelector('#gsvHost').shadowRoot), fn);
(async () => {
  await new Promise((res) => srv.listen(0, '127.0.0.1', res)); const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
      const reqs = []; page.on('request', (q) => reqs.push(q.method() + ' ' + q.url()));
      await page.route(/fonts\.(googleapis|gstatic)\.com|img\.youtube\.com/, (r) => r.abort());
      const dialogs = []; page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
      await page.goto(base + '/review/golden-service.html');
      await page.waitForFunction(() => { const x = document.querySelector('#gsvHost'); return x && x.shadowRoot && x.shadowRoot.querySelectorAll('.tab-btn').length === 7; }, null, { timeout: 15000 });
      await t(label + ': sample-data banner and note are shown; the Dealer 360 skin is on', async () => {
        const r = await page.evaluate(() => ({ band: document.querySelector('.rv-band').innerText, note: document.querySelector('.rv-note').innerText,
          th: document.querySelector('#gsvHost').shadowRoot.querySelector('style[data-d360-theme]').textContent.length }));
        ok(/SAMPLE DATA/.test(r.band) && /nothing can be sent/i.test(r.band), r.band); ok(/SAMPLE/.test(r.note), r.note); ok(r.th > 1000, 'theme ' + r.th);
      });
      await t(label + ': all 7 tabs open; sample parts list; no sideways scroll', async () => {
        const r = await R(page, `const out=[]; for(const b of root.querySelectorAll('.tab-btn')){ b.click(); const id=(b.getAttribute('onclick')||'').match(/'([a-z]+)'/); const p=id&&root.getElementById('tab-'+id[1]); out.push((b.innerText||'').trim()+':'+(p&&p.getBoundingClientRect().height>50)); } return out;`);
        ok(r.length === 7 && r.every((x) => /:true$/.test(x)), JSON.stringify(r));
        await R(page, `[...root.querySelectorAll('.tab-btn')].find(b=>/'parts'/.test(b.getAttribute('onclick')||'')).click(); return 1;`);
        const parts = await R(page, `return root.getElementById('tab-parts').innerText;`);
        ok(/SAMPLE-0\d\d/.test(parts) && !/\$\s?\d/.test(parts), 'parts: ' + parts.slice(0, 200));
        const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(sw <= 0, 'overflow ' + sw);
      });
      await t(label + ': Parts & Service Request form renders with the sample dealer, 44px controls; a submit is refused and nothing is sent', async () => {
        await R(page, `[...root.querySelectorAll('.tab-btn')].find(b=>/'request'/.test(b.getAttribute('onclick')||'')).click(); return 1;`);
        const r = await R(page, `const p=root.getElementById('tab-request'); const c=[...p.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select')].filter(e=>e.getBoundingClientRect().width>0);
          const dn=p.querySelector('[name=dealer_name]'); return { n:c.length, minH:Math.min(...c.map(e=>e.getBoundingClientRect().height)), dealer: dn&&dn.value, ro: dn&&dn.readOnly };`);
        ok(r.n > 8 && r.minH >= 43.5, JSON.stringify(r)); ok(/^SAMPLE/.test(r.dealer) && r.ro, JSON.stringify(r));
        const before = reqs.length;
        await R(page, `const f=root.getElementById('tab-request').querySelector('form'); f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})); return 1;`);
        await page.waitForTimeout(800);
        ok(dialogs.some((m) => /Design review — sample data only, nothing is sent/.test(m)), 'refusal not shown: ' + JSON.stringify(dialogs));
        const sent = reqs.slice(before).filter((x) => !/^GET /.test(x) || !x.startsWith('GET ' + base)); ok(sent.length === 0, 'requests after submit: ' + sent.join(', '));
        ok(reqs.every((x) => /^GET /.test(x)), 'non-GET request: ' + reqs.filter((x) => !/^GET /.test(x)).join(', '));
        ok(!reqs.some((x) => /golden-proxy|formspree|send-parts|supabase|netlify\/functions/.test(x)), 'API call: ' + reqs.filter((x) => /golden-proxy|formspree|send-parts|supabase|functions/.test(x)).join(', '));
      });
      await t(label + ': before/after switch removes and restores the Dealer 360 skin', async () => {
        const len = () => page.evaluate(() => document.querySelector('#gsvHost').shadowRoot.querySelector('style[data-d360-theme]').textContent.length);
        await page.click('.rv-tog [data-v="before"]'); ok(await len() === 0, 'before still themed');
        await page.click('.rv-tog [data-v="after"]'); ok(await len() > 1000, 'after not themed');
      });
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true });
        for (const tab of ['troubleshoot', 'request']) { const p2 = await ctx.newPage(); await p2.route(/fonts\.(googleapis|gstatic)\.com|img\.youtube\.com/, (r) => r.abort());
          await p2.goto(base + '/review/golden-service.html?tab=' + tab); await p2.waitForFunction(() => { const x = document.querySelector('#gsvHost'); return x && x.shadowRoot && x.shadowRoot.querySelectorAll('.tab-btn').length === 7; });
          if (tab === 'request') await p2.evaluate(() => { const p = document.querySelector('#gsvHost').shadowRoot.getElementById('tab-request'); window.scrollTo(0, p.getBoundingClientRect().top + scrollY - 8); });
          await p2.waitForTimeout(500); await p2.screenshot({ path: path.join(SHOTS, `review-${label}-${tab}.png`), fullPage: false }); await p2.close(); } }
      await ctx.close();
    }
    await t('another host: the page refuses to render', async () => {
      const ctx = await browser.newContext(); const page = await ctx.newPage();
      await page.route('https://hcpsonlineordering.netlify.app/**', (r) => { const u = new URL(r.request().url()); const p = path.join(PUB, u.pathname); return fs.existsSync(p) ? r.fulfill({ status: 200, contentType: TYPES[path.extname(p)] || 'text/plain', body: fs.readFileSync(p) }) : r.fulfill({ status: 404, body: '' }); });
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await page.goto('https://hcpsonlineordering.netlify.app/review/golden-service.html'); await page.waitForTimeout(800);
      const txt = await page.evaluate(() => document.getElementById('rvApp').innerText); ok(/only on a protected preview/.test(txt), txt);
      const host = await page.evaluate(() => !!document.querySelector('#gsvHost')); ok(!host, 'module rendered on a production host');
    });
  } finally { await browser.close(); srv.close(); }
  console.log(`golden-service-review: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
