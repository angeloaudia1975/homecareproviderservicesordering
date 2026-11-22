/* Start Here → Meet Victoria + Victoria's narration (owner 2026-11-22), on the REAL portal page at 1280 / 390:
   - with Dealer Victoria on, Dealer Overview's Start here shows Meet Victoria: her globe, Ask Victoria, three questions that fit
     THIS account (a suggested question is asked as typed text in her panel), and "Meet Victoria — 1 minute";
   - the one-minute guide plays part 1 in her voice (narration set "meet"), shows its words, and goes on to part 2 when it ends;
   - the tour video: playing asks for the cue under the playhead (set "tour"), a CHAPTER JUMP plays that chapter's first cue,
     pause pauses her, the volume / mute follow the video; with narration unavailable the captioned video still plays;
   - Resources & Support links the written guide, which has the Victoria section.
   The test video is a silent 4-minute WebM (Chromium in CI has no H.264); narration audio is a 2-second test tone. */
const { chromium, open } = require('./_shop-harness.js');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), os = require('os');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const J = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(b) });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shv-'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x36:r=5', '-t', '240', '-c:v', 'libvpx', '-b:v', '20k', path.join(tmp, 't.webm')]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ac', '1', '-ar', '16000', path.join(tmp, 'b.wav')]);
const WEBM = fs.readFileSync(path.join(tmp, 't.webm')), TONE = fs.readFileSync(path.join(tmp, 'b.wav')).toString('base64');
const SUMMARY = { ok: true, ytd: { spend: 100, units: 1, orders: 1, year: 2026 }, allTime: { spend: 100, orders: 1, sinceYear: '2025' }, byManufacturer: [], monthly: [], recent: [] };

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
      for (const narrOn of [true, false]) {
        if (!narrOn && label !== 'desktop') continue;
        const { ctx, page } = await open(b, w, h, { access: { your_accounts: ['dalton', 'golden-technologies'], available: [], request_access: [], golden: 'Account' }, prices: { dalton: 109 } });
        const nar = [], asks = [];
        await page.route('**/order-history-api', (r) => J(r, SUMMARY));
        await page.route('**/featured-month-api*', (r) => J(r, { ok: true, month: '2026-11', items: [], alternates: [] }));
        await page.route('**/start-here/tour.mp4', (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: WEBM }));
        await page.route('**/dealer-victoria-api', async (r) => { const x = JSON.parse(r.request().postData() || '{}'); let body = { ok: true };
          if (x.action === 'status') body = { ok: true, enabled: true, first_name: 'Ann', voice: { id: 'aura-2-thalia-en', available: true }, ai: { available: true }, conversation: { available: false }, greeting: 'Hello, Ann.', greeting_again: 'Hi, Ann.', support: { phone: '(888) 626-3140', phone_tel: '+18886263140', email: 'info@homecareproviderservices.us' } };
          else if (x.action === 'narration') { nar.push(x.set + ':' + x.i); body = narrOn ? { ok: true, mime: 'audio/wav', audio: TONE } : { ok: false, error: 'voice_unavailable' }; }
          else if (x.action === 'ask') { asks.push(x.question); body = { ok: true, answer: 'Here are your recent orders.', speech_parts: [], cards: [], actions: [] }; }
          else if (x.action === 'hello') body = { ok: true, enabled: true, greeting: 'Hi, Ann.' };
          return J(r, body); });
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'approved', null, { timeout: 30000 });
        await page.evaluate(() => { window.__PREVIEW__ = null; if (!AUTH.session) AUTH.session = { access_token: 'tok' }; window.needsAccess = () => false; });
        await page.evaluate(() => { window.__DV_LOADED__ = false; return window.dvProbe(); });
        await page.evaluate(() => showP360('dash'));
        const tag = label + (narrOn ? '' : ' (narration unavailable)');
        if (narrOn) {
          await t(`${tag}: Start here shows Meet Victoria — globe, Ask Victoria, three questions for this account, the 1-minute guide`, async () => {
            await page.waitForSelector('#startHere .sh-vic-box', { timeout: 15000 });
            const r = await page.evaluate(() => { const v = document.querySelector('#startHere .sh-vic-box'); return { img: !!v.querySelector('img[src*="orb-still"]'), text: v.textContent, qs: [...v.querySelectorAll('[data-vq]')].map((x) => x.dataset.vq),
              small: [...v.querySelectorAll('a,button')].filter((x) => x.getBoundingClientRect().height < 44).length, over: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
            ok(r.img && /Ask Victoria/.test(r.text) && /Meet Victoria — 1 minute/.test(r.text), r.text);
            const golden = await page.evaluate(() => entitledManufacturers().some((m) => m.slug === 'golden-technologies'));
            ok(r.qs.length === 3 && r.qs[0] === (golden ? 'Where is my latest Golden order?' : 'Show me my recent orders') && /Dalton/.test(r.qs[1]) && /Medicare/.test(r.qs[2]), JSON.stringify(r.qs));
            ok(r.small === 0 && !r.over, 'touch targets / sideways scroll'); });
          await t(`${tag}: a suggested question is asked as typed text in her panel`, async () => {
            await page.click('#startHere [data-vq]'); await page.waitForFunction(() => { const hh = document.getElementById('dvPanelHost'); return hh && !hh.shadowRoot.querySelector('.p').hidden; }, null, { timeout: 10000 });
            for (let i = 0; i < 40 && !asks.length; i++) await page.waitForTimeout(150);
            ok(asks.length === 1 && /order/.test(asks[0]), JSON.stringify(asks));
            await page.evaluate(() => { const hh = document.getElementById('dvPanelHost'); const x = hh && hh.shadowRoot.querySelector('.x'); if (x) x.click(); }); });
          await t(`${tag}: Meet Victoria plays part 1 in her voice with its words, then part 2`, async () => {
            await page.evaluate(() => shOpen('meet')); await page.waitForSelector('#shModal .mv-cap');
            await page.click('#shModal .mv-b .btn.pri');
            await page.waitForFunction(() => window.HCPSStart._narration && document.querySelector('#shModal .mv-cap'), null);
            for (let i = 0; i < 60 && !nar.includes('meet:1'); i++) await page.waitForTimeout(150);
            const s1 = await page.evaluate(() => ({ cap: document.querySelector('#shModal .mv-cap').textContent, prog: document.querySelector('#shModal .mv-prog').textContent }));
            ok(nar.includes('meet:0') && /^Hi, I am Victoria/.test(s1.cap), JSON.stringify({ nar, s1 }));
            await page.waitForFunction(() => /Part 2 of 6/.test(document.querySelector('#shModal .mv-prog').textContent), null, { timeout: 8000 });
            await page.keyboard.press('Escape'); ok(!(await page.$('#shModal')), 'closed'); });
        }
        await t(`${tag}: the tour narrates the cue under the playhead; a chapter jump plays that chapter's first cue; pause pauses her`, async () => {
          nar.length = 0; await page.evaluate(() => shOpen('video')); await page.waitForSelector('#shModal video');
          /* a blob URL is seekable (a routed response has no byte ranges) */
          const r0 = await page.evaluate(async () => { const v = document.querySelector('#shModal video'); const bl = await (await fetch('/start-here/tour.mp4')).blob();
            v.src = URL.createObjectURL(bl); v.load(); await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true })); v.muted = false; await v.play().catch(() => {}); return !v.paused; });
          ok(r0, 'video did not play');
          for (let i = 0; i < 40 && !nar.includes('tour:0'); i++) await page.waitForTimeout(150);
          ok(nar.includes('tour:0'), 'cue 0 not requested: ' + nar.join());
          if (narrOn) {
            await page.click('#shModal .sh-ch [data-ch="2"]');   // "A product page" (0:59) → its first cue is #8
            for (let i = 0; i < 60 && !nar.includes('tour:8'); i++) await page.waitForTimeout(150);
            const st = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 600)); const v = document.querySelector('#shModal video'); const a = [...document.querySelectorAll('audio')]; return { t: v.currentTime, paused: v.paused }; });
            ok(nar.includes('tour:8') && st.t >= 59 && !st.paused, JSON.stringify({ nar, st }));
            const n = await page.evaluate(() => window.__shTourNarr && { cue: window.__shTourNarr.cue, playing: window.__shTourNarr.playing });
            ok(n && n.cue === 8 && n.playing, 'narration after the jump: ' + JSON.stringify(n));
            await page.evaluate(() => document.querySelector('#shModal video').pause()); await page.waitForTimeout(200);
            ok(!(await page.evaluate(() => window.__shTourNarr.playing)), 'still speaking after pause');
            await page.evaluate(() => { const v = document.querySelector('#shModal video'); v.muted = true; }); await page.waitForTimeout(100);
            ok(await page.evaluate(() => window.__shTourNarr.audio.muted), 'mute did not follow the video');
          } else {
            await page.waitForFunction(() => /narration isn't available/.test(document.querySelector('#shModal .sh-nnote').textContent), null, { timeout: 8000 });
            ok(await page.evaluate(() => !document.querySelector('#shModal video').paused), 'the captioned video should keep playing');
          }
          await page.keyboard.press('Escape'); });
        if (narrOn) await t(`${tag}: Resources & Support links the written guide, which has the Victoria section`, async () => {
          await page.evaluate(() => showP360('resources')); await page.waitForSelector('a.rs-nav[href="/start-here/guide.html"]', { timeout: 10000 });
          const g = await page.evaluate(() => fetch('/start-here/guide.html').then((r) => r.text())); ok(/id="victoria"/.test(g) && /never places orders/.test(g), 'guide section'); });
        await ctx.close();
      }
    }
  } finally { await b.close(); }
  console.log(`\nstart-here victoria (browser): ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
