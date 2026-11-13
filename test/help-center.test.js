/* Help & Training Center + releases (owner 2026-11-13 §5/§6) — the completion gate for dealer-facing features.
   1. Every article: known area, steps, a view that exists on this page, and every ui_check label present on the page.
   2. Every dealer-facing release item names an existing article updated on or after the release date.
   3. Versions are dated, newest first, unique. Releases never carry send / audience settings (emails are approved in
      Connect 360 only).
   4. Browser (390 / 1280): Help opens, searches, filters, What's New links to the article, no horizontal scroll.
   ADMIN_REPO=… PLAYWRIGHT_MODULE=… node test/help-center.test.js   (SKIP_BROWSER=1 for the content checks only) */
const path = require('path'), fs = require('fs');
const PUB = path.join(__dirname, '..', 'public');
const H = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'help.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'releases.json'), 'utf8'));
const PAGE = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 400)); } }

(async () => {
  await t('articles: unique ids, known areas, steps, an existing page, every ui_check label present on the page', () => {
    const areas = new Set(H.areas.map(a => a.key)), ids = new Set(), bad = [];
    for (const a of H.articles) {
      ok(!ids.has(a.id), 'duplicate ' + a.id); ids.add(a.id);
      ok(areas.has(a.area), a.id + ' area'); ok(Array.isArray(a.steps) && a.steps.length >= 2, a.id + ' steps');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(a.updated), a.id + ' updated');
      ok(a.open === 'shop' || PAGE.includes(`id="view-${a.open}"`), a.id + ' opens a page that exists: ' + a.open);
      ok((a.ui_checks || []).length >= 2, a.id + ' needs ui_checks');
      for (const l of a.ui_checks) if (!PAGE.includes(l)) bad.push(a.id + ': "' + l + '"');
    }
    ok(!bad.length, 'labels not on the page: ' + bad.join(', '));
  });
  await t('priority topics are covered: ordering, manufacturer accounts, quotes, reports, tracking (+ Golden service)', () => {
    for (const k of ['ordering', 'accounts', 'quotes', 'reports', 'tracking', 'golden-service']) ok(H.articles.some(a => a.area === k), k);
  });
  await t('releases: newest first, unique versions; every dealer-facing item names an article updated on/after the release', () => {
    const v = R.releases.map(r => r.version); ok(new Set(v).size === v.length, 'unique');
    for (let i = 1; i < R.releases.length; i++) ok(R.releases[i - 1].date >= R.releases[i].date, 'newest first');
    for (const r of R.releases) for (const it of r.items) if (it.dealer_facing) {
      const a = H.articles.find(x => x.id === it.help); ok(a, r.version + ': "' + it.text.slice(0, 40) + '" has no help article');
      ok(a.updated >= r.date, r.version + ': article ' + a.id + ' not updated for this release');
    }
    ok(!/"(send|audience|recipients|send_at|mailing)"/i.test(JSON.stringify(R)), 'no email settings in releases.json');
  });
  if (process.env.SKIP_BROWSER) { console.log(`\nhelp center: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const { chromium, open } = require('./_shop-harness.js');
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [1280, 900, 'desktop']]) {
      const { ctx, page } = await open(browser, w, h, {});
      await page.evaluate(() => showP360('help'));
      await page.waitForFunction(() => /Help & Training Center/.test((document.querySelector('#view-help') || {}).textContent || ''), null, { timeout: 15000 });
      await t(label + ': help lists every article, version shown, search + topic filter, no horizontal scroll', async () => {
        const n = await page.$$eval('#helpList .card', c => c.length); ok(n === H.articles.length, 'articles ' + n);
        ok((await page.textContent('#view-help')).includes('version ' + R.releases[0].version), 'version');
        await page.fill('#view-help input[type=search]', 'carrier'); ok((await page.$$eval('#helpList .card', c => c.length)) >= 1, 'search');
        await page.fill('#view-help input[type=search]', ''); await page.selectOption('#view-help select', 'quotes');
        ok((await page.$$eval('#helpList .card h3', c => c.map(x => x.textContent))).every(x => /quote|brochure/i.test(x)), 'filter');
        ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'overflow');
      });
      await t(label + ': What\'s New shows dealer-facing items and "How it works" jumps to the article', async () => {
        await page.evaluate(() => helpTab('new')); const txt = await page.textContent('#view-help');
        ok(txt.includes(R.releases[0].title), 'release title');
        await page.click('#view-help a:has-text("How it works")'); await page.waitForTimeout(150);
        ok(await page.$('#help-' + R.releases[0].items[0].help), 'article shown');
      });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\nhelp center: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
