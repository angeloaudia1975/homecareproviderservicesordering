/* START HERE on the REAL portal page (owner milestone 2026-11-22 §3), at 1280 / 768 / 390:
   - Dealer Overview shows "Start here" with the tour video, the one-page guide and the walkthroughs; Hide keeps it only in
     Help & Training, where it can be shown again;
   - the video opens in a dialog with captions + chapters tracks, a chapter list that seeks, and a transcript built from the
     captions; Esc closes it and returns focus;
   - "product → customer quote": every step outlines a control on screen; Show me does the step; Next is refused until the
     step is done; it ends on Customer Quotes with nothing saved or sent;
   - "find local referral sources" appears only when the referral feature answers enabled, and walks to the results screen;
   - no sideways scroll; buttons ≥ 44 px on the phone. */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0; const t = async (n, f) => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const J = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(b) });
const SUMMARY = { ok: true, ytd: { spend: 100, units: 1, orders: 1, year: 2026 }, allTime: { spend: 100, orders: 1, sinceYear: '2025' }, byManufacturer: [], monthly: [], recent: [] };

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h, label] of [[1280, 900, 'desktop'], [768, 1000, 'tablet'], [390, 844, 'phone']]) {
      for (const refOn of [true, false]) {
        if (!refOn && label !== 'desktop') continue;
        const { ctx, page } = await open(b, w, h, { access: { your_accounts: ['dalton'], available: [], request_access: [], golden: 'None' }, prices: { dalton: 109 } });
        const writes = [];
        await page.route('**/order-history-api', (r) => J(r, SUMMARY));
        await page.route('**/featured-month-api*', (r) => J(r, { ok: true, month: '2026-11', items: [], alternates: [] }));
        await page.route('**/referral-sources-api', (r) => { const x = JSON.parse(r.request().postData() || '{}');
          if (x.action === 'meta') return J(r, refOn ? { ok: true, enabled: true, release: { data_year: 2024, label: 'claims year 2024' }, location: { id: 'L', name: 'X', zip: '42101', state: 'KY' }, locations: [{ id: 'L', name: 'X', zip: '42101', state: 'KY' }] } : { ok: true, enabled: false });
          if (x.action === 'codes') return J(r, { ok: true, enabled: true, codes: [] }); return J(r, { ok: true }); });
        await page.route('**/dealer-quotes-api', (r) => { const x = JSON.parse(r.request().postData() || '{}'); if (/save|email|delete/.test(x.action || '')) writes.push(x.action); return J(r, { ok: true, quotes: [], rows: [] }); });
        await page.route('**/dealer-support-api', (r) => J(r, { ok: true, location: { id: 'L', name: 'X' }, locations: [], lines: [], contact: {} }));
        /* reload so the boot-time reads (referral switch, dashboard) come from the answers above, not the harness defaults */
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'approved' && (state.manufacturers || []).length > 5, null, { timeout: 30000 });
        await page.evaluate(() => { window.needsAccess = () => false; window.mergeCatalogEdits = async (slug, prods) => (prods || []).map((p) => Object.assign({}, p, slug === 'dalton' ? { base_price: 109, tiers: [] } : {})); if (window.DASH) DASH.lineCache = {}; showP360('dash'); });
        const tag = label + (refOn ? '' : ' (referrals off)');
        await page.waitForSelector('#shCard', { timeout: 20000 });
        await t(`${tag}: Dealer Overview shows Start here with the tour, the guide and the walkthroughs`, async () => {
          const tx = await page.innerText('#shCard');
          ok(/Watch the 4-minute tour/.test(tx) && /One-page guide/.test(tx) && /product → customer quote/.test(tx), tx);
          await page.waitForTimeout(800); const ref = /find local referral sources/.test(await page.innerText('#shCard')); ok(ref === refOn, 'referral walkthrough shown=' + ref);
          if (w < 768) { const small = await page.$$eval('#shCard [data-sh]', (a) => a.filter((x) => x.getBoundingClientRect().height < 44).length); ok(!small, small + ' small targets'); }
          ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'overflow'); });
        if (!refOn) { await t(`${tag}: the referral walkthrough refuses when the feature is off`, async () => { const r = await page.evaluate(() => shOpen('referrals').catch(() => ({}))); ok(r && r.ok === false, JSON.stringify(r)); await page.evaluate(() => { const c = document.getElementById('wtCoach'); if (c) throw new Error('coach shown'); }); }); await ctx.close(); continue; }
        await t(`${tag}: the tour opens with captions + chapters tracks, a chapter list that seeks, and a transcript; Esc closes it`, async () => {
          await page.click('#shCard [data-sh=video]'); await page.waitForSelector('#shModal', { timeout: 10000 }); await page.waitForTimeout(800);
          const m = await page.evaluate(() => { const v = document.querySelector('#shModal video'); return { cap: !!document.querySelector('#shModal track[kind=captions][srclang=en]'), chap: !!document.querySelector('#shModal track[kind=chapters]'),
            ch: document.querySelectorAll('#shModal .sh-ch button').length, tr: document.querySelectorAll('#shModal .sh-tr p').length, trtext: (document.querySelector('#shModal .sh-tr') || {}).textContent || '', guide: !!document.querySelector('#shModal a[href="/start-here/guide.html"]'), focus: document.activeElement && document.activeElement.className }; });
          ok(m.cap && m.chap, 'tracks'); ok(m.ch >= 6 && m.tr === m.ch && /Shop Products/.test(m.trtext), JSON.stringify(m).slice(0, 300)); ok(m.guide && m.focus === 'sh-x', 'guide/focus');
          const before = await page.evaluate(() => { const v = document.querySelector('#shModal video'); return v ? v.currentTime : -1; });
          await page.click('#shModal .sh-ch button >> nth=2'); await page.waitForTimeout(300);
          ok((await page.evaluate(() => { const v = document.querySelector('#shModal video'); return v ? v.currentTime : -1; })) !== before || before < 0, 'did not seek');
          ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'overflow');
          await page.keyboard.press('Escape'); await page.waitForTimeout(200); ok(!(await page.$('#shModal')), 'not closed');
          ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.sh === 'video'), 'focus not returned'); });
        await t(`${tag}: walkthrough "product → customer quote" outlines each control, Show me does the step, Next waits for it, ends on Customer Quotes`, async () => {
          await page.click('#shCard [data-sh=quote]'); await page.waitForSelector('#wtCoach', { timeout: 10000 });
          const step = () => page.$eval('#wtCoach h3', (e) => e.textContent);
          const hl = () => page.evaluate(() => { const e = document.querySelector('.wt-hl'); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
          ok(/Open a line/.test(await step()), await step()); await page.waitForTimeout(700); ok(await hl(), 'step 1 not outlined');
          await page.click('#wtCoach button.pri'); await page.waitForTimeout(200); ok(/Do this step first/.test(await page.innerText('#wtCoach')), 'Next allowed early');
          await page.click('#wtCoach button:text-is("Show me")'); await page.waitForFunction(() => document.querySelector('#content [data-open]'), null, { timeout: 15000 }); await page.waitForTimeout(700);
          await page.click('#wtCoach button.pri'); ok(/Open a product/.test(await step()), await step());
          await page.click('#wtCoach button:text-is("Show me")'); await page.waitForSelector('#content .pd[data-pd-code]', { timeout: 15000 }); await page.waitForTimeout(700);
          await page.click('#wtCoach button.pri'); ok(/Your price/.test(await step())); await page.waitForTimeout(700); ok(await hl(), 'step 3 not outlined');
          await page.click('#wtCoach button.pri'); ok(/Add it to a customer quote/.test(await step())); await page.waitForTimeout(700); ok(await hl(), 'quote button not outlined');
          await page.click('#wtCoach button:text-is("Show me")'); await page.waitForSelector('#view-quotes .qacts', { timeout: 15000 }); await page.waitForTimeout(700);
          await page.click('#wtCoach button.pri'); ok(/Choose the customer's price/.test(await step()));
          const small = w < 768 ? await page.$$eval('#wtCoach button', (a) => a.filter((x) => x.getBoundingClientRect().height < 44).length) : 0; ok(!small, 'small coach buttons');
          ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'overflow');
          await page.click('#wtCoach button.pri'); ok(!(await page.$('#wtCoach')) && !(await page.$('.wt-hl')), 'coach not finished'); ok(!writes.length, 'wrote: ' + writes); });
        await t(`${tag}: walkthrough "find local referral sources" walks to the referral screen`, async () => {
          await page.evaluate(() => { showP360('dash'); }); await page.waitForSelector('#shCard [data-sh=referrals]', { timeout: 10000 });
          await page.click('#shCard [data-sh=referrals]'); await page.waitForSelector('#wtCoach'); await page.click('#wtCoach button:text-is("Show me")');
          await page.waitForFunction(() => document.querySelector('#rsRef a'), null, { timeout: 15000 }); await page.waitForTimeout(700); await page.click('#wtCoach button.pri');
          await page.click('#wtCoach button:text-is("Show me")'); await page.waitForSelector('#view-referrals .rf', { timeout: 15000 }); await page.waitForTimeout(700);
          await page.click('#wtCoach button.pri'); ok(/Pick the product code/.test(await page.$eval('#wtCoach h3', (e) => e.textContent)));
          await page.click('#wtCoach button:text-is("End walkthrough")'); ok(!(await page.$('#wtCoach')), 'not ended'); });
        await t(`${tag}: Hide keeps Start here only in Help & Training, where it can be shown again`, async () => {
          await page.evaluate(() => showP360('dash')); await page.waitForSelector('#shCard'); await page.$eval('#shCard .seelink', (e) => e.click()); await page.waitForTimeout(200);
          ok(!(await page.$('#shCard')), 'still shown');
          await page.evaluate(() => showP360('help')); await page.waitForSelector('#view-help .ph', { timeout: 15000 }); await page.evaluate(() => helpTab('start')); await page.waitForSelector('#shStart');
          const again = await page.waitForFunction(() => { const e = document.getElementById('shStart'); return e && /Show Start here on Dealer Overview again/.test(e.innerText); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
          ok(again, 'no "show again" link: ' + await page.evaluate(() => ({ ls: Object.keys(localStorage), id: AUTH.dealer && AUTH.dealer.id, t: (document.getElementById('shStart') || {}).innerText })).then(JSON.stringify));
          await page.$eval('#shStart a[onclick*="shHide(false)"]', (e) => e.click()); await page.waitForSelector('#shCard', { timeout: 10000 }); });
        await ctx.close();
      }
    }
  } finally { await b.close(); }
  console.log(`start-here: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
