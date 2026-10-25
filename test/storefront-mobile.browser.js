/* Partner 360 storefront — anonymous layout check at phone, tablet and desktop widths (RULE 10 of the admin
   repo's CLAUDE.md). Loads the storefront (default: the live site; STOREFRONT_URL overrides) as an anonymous
   visitor and, at 360 / 390 / 768 / 1280 px, checks: no horizontal page scroll, no visible broken image, no
   dealer price text shown to an anonymous visitor, and nothing on the page carrying a commercial field.
   Read-only (GET + rendering only); no sign-in, no form, no order. Needs Playwright + Chromium. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.STOREFRONT_URL || 'https://hcpsonlineordering.netlify.app').replace(/\/$/, '');
const WIDTHS = [[360, 740, 'phone-sm'], [390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']];
const PATHS = ['/', '/#shop'];

let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(name, fn) { try { await fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + String(e && e.message).slice(0, 300)); } }

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of WIDTHS) {
      for (const p of PATHS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
        const page = await ctx.newPage();
        const commercial = [];
        page.on('response', async r => {
          const u = r.url();
          if (/\/data\/[a-z0-9-]+\.json$/.test(u) && r.ok()) {
            try { const txt = await r.text(); if (/"(base_price|tiers|dealer_price|tier_prices|unit_cost)"\s*:/.test(txt)) commercial.push(u); } catch (e) {}
          }
        });
        await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => {
          const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && vis(i) && i.getAttribute('src')).map(i => i.getAttribute('src'));
          const wide = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && vis(el))
            .slice(0, 3).map(el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
          return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, broken, wide,
            dealerPrice: /Dealer (price|cost)\s*\$\d|Your price\s*\$\d/i.test(document.body.innerText) };
        });
        await t(`${label} ${w}px ${p}: no horizontal scroll`, () => ok(r.scrollW <= r.clientW + 1, `scrollWidth ${r.scrollW} > ${r.clientW}; widest: ${r.wide.join(', ')}`));
        await t(`${label} ${w}px ${p}: no visible broken image`, () => ok(!r.broken.length, r.broken.slice(0, 3).join(', ')));
        await t(`${label} ${w}px ${p}: anonymous sees no dealer price`, () => ok(!r.dealerPrice, 'dealer price text on an anonymous page'));
        await t(`${label} ${w}px ${p}: no catalog file served with a commercial field`, () => ok(!commercial.length, commercial.join(', ')));
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(`\nstorefront mobile (${BASE}): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
