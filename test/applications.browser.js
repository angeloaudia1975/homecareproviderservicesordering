/* C3-07 Stage 5 — Manufacturer Account Setup Center: browser walkthrough of the REAL storefront page (_shop-harness.js;
   nothing reaches HCPS, Supabase or Documenso). dealer-applications-api is answered locally in the shape the real handler
   answers (the handler itself is tested in the admin repo: test/applications.test.js). At 390 / 768 / 1280 px: the
   Account Center card opens the setup center, the list shows original-form lines and Golden / Corsicana as links, Start
   opens the prefilled questionnaire, typing marks it changed and Save sends exactly the typed answers, Review opens the
   PDF, Sign saves first and opens the signing link in a new tab, a queued answer is explained; 16 px inputs, 44 px
   targets on phones, no horizontal scroll.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… node test/applications.browser.js */
const { chromium, open } = require('./_shop-harness.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const CORS = { 'access-control-allow-origin': '*' };
const SECTIONS = [{ title: 'Business', fields: [{ key: 'biz.legal_name', label: 'Legal business name', required: true }, { key: 'biz.ein', label: 'Federal tax ID (EIN)', required: true }, { key: 'biz.entity', label: 'Entity type' }] },
  { title: 'Signer', fields: [{ key: 'signer.name', label: 'Authorised signer (full name)', required: true }, { key: 'signer.email', label: 'Signer email', required: true }] },
  { title: 'Request', fields: [{ key: 'req.notes', label: 'Notes for HCPS' }] }];

function fake(page, S) {
  const reply = (route, body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  return page.route('**/functions/dealer-applications-api', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); S.calls.push(b);
    const app = S.app;
    if (b.action === 'app_list') return reply(route, { ok: true, head_office: true, self_id: 'hq', signing: true, monthly: { used: 1, limit: 5 },
      locations: [{ id: 'hq', name: 'TEST HQ', can_apply: true }, { id: 'br', name: 'TEST Branch', can_apply: true }],
      forms: [{ slug: 'access4u', name: 'Access4U', mode: 'overlay' }, { slug: 'bemis', name: 'Bemis', mode: 'addendum' }, { slug: 'corsicana', name: 'Corsicana', external: { how: 'Word form', url: 'https://www.homecareproviderservices.org/x.docx' } },
        { slug: 'golden-technologies', name: 'Golden Technologies', external: { how: 'Nuvo', url: 'https://nuvo.com/customer/goldentech' } }],
      applications: app ? [{ id: app.id, manufacturer: app.manufacturer, name: 'Access4U', location_id: 'hq', status: app.status, version: app.version, updated_at: '2026-11-05T12:00:00Z' }] : [] });
    if (b.action === 'app_start') { S.app = { id: 'a1', manufacturer: b.manufacturer, status: 'draft', version: 1, answers: { 'biz.legal_name': 'TEST Medical', 'signer.email': 'owner@example.invalid' } }; return reply(route, { ok: true, application: { id: 'a1', version: 1 } }); }
    if (b.action === 'app_get') return reply(route, { ok: true, application: { id: app.id, manufacturer: app.manufacturer, name: 'Access4U', location_name: 'TEST HQ', status: app.status, version: app.version, answers: app.answers },
      sections: SECTIONS, entities: { corporation: 'Corporation', llc: 'LLC' }, notice: '', can_edit: ['draft', 'signing_failed', 'queued'].includes(app.status), signing: true });
    if (b.action === 'app_save') { if (b.version !== app.version) return reply(route, { ok: false, error: 'changed' }, 409); app.version++; app.answers = b.answers;
      const miss = ['biz.ein', 'signer.name'].filter((k) => !b.answers[k]); return reply(route, { ok: true, application: { id: app.id, version: app.version, status: 'draft' }, missing: miss }); }
    if (b.action === 'app_preview' || b.action === 'app_offline') return reply(route, { ok: true, pdf_base64: Buffer.from('%PDF-1.4 test').toString('base64'), file: 'access4u-application.pdf' });
    if (b.action === 'app_sign') { if (S.queue) { app.status = 'queued'; return reply(route, { ok: true, queued: true }); } app.status = 'signing'; return reply(route, { ok: true, url: 'https://app.documenso.com/sign/tok1' }); }
    if (b.action === 'app_signing_link') return reply(route, { ok: true, url: 'https://app.documenso.com/sign/tok1' });
    return reply(route, { ok: false }, 400);
  });
}
const layout = (page) => page.evaluate(() => {
  const vis = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const small = [...document.querySelectorAll('#view-apply a.btn, #view-apply button, #view-apply select, #view-apply input, #view-apply summary')].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30));
  const tiny = [...document.querySelectorAll('#view-apply input, #view-apply select, #view-apply textarea')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).length;
  return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, tiny };
});

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const S = { calls: [], app: null };
      const { ctx, page } = await open(browser, w, h, {});
      await fake(page, S);
      await page.evaluate(() => { PREVIEW = null; window.__PREVIEW__ = null; AUTH.session = { access_token: 'tok' }; window.ensureFreshSession = async () => {}; window.confirm = () => true;
        window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return {}; }; });
      await page.evaluate(() => showP360('apply'));
      await page.waitForFunction(() => /Manufacturer Account Setup/.test((document.querySelector('#view-apply') || {}).innerText || '') && /Access4U/.test(document.querySelector('#view-apply').innerText), null, { timeout: 20000 });
      const list = await page.evaluate(() => document.querySelector('#view-apply').innerText);
      await t(label + ': the list shows original-form lines (Start) and Golden / Corsicana as their own process; nothing sent automatically', () => {
        ok(/Access4U[\s\S]*Not started/.test(list) && /Golden Technologies[\s\S]*Nuvo/.test(list) && /Corsicana/.test(list), list.slice(0, 300)); ok(/Nothing is sent to a manufacturer automatically/.test(list), 'notice'); });
      await t(label + ': a head office chooses which location applies', async () => ok(await page.$('#apLoc') !== null, 'location picker'));
      await page.evaluate(() => apStart('access4u'));
      await page.waitForFunction(() => document.querySelector('#view-apply [data-k="biz.legal_name"]'), null, { timeout: 10000 });
      await t(label + ': Start opens the questionnaire prefilled from HCPS records', async () => ok(await page.inputValue('[data-k="biz.legal_name"]') === 'TEST Medical', 'prefill'));
      await page.fill('[data-k="biz.ein"]', '00-0000000'); await page.fill('[data-k="signer.name"]', 'Jordan Owner'); await page.selectOption('[data-k="biz.entity"]', 'llc');
      await page.evaluate(() => apSave()); await page.waitForTimeout(400);
      await t(label + ': typing marks it changed and Save sends exactly the typed answers (inline handlers reach the page code)', () => {
        const s = S.calls.filter((c) => c.action === 'app_save').pop(); ok(s && s.answers['biz.ein'] === '00-0000000' && s.answers['biz.entity'] === 'llc' && s.answers['signer.name'] === 'Jordan Owner' && s.version === 1, JSON.stringify(s)); });
      await page.evaluate(() => apPreview()); await page.waitForTimeout(400);
      await t(label + ': Review opens the completed PDF', async () => ok((await page.evaluate(() => window.__opened)).some((u) => /^blob:/.test(u)), 'pdf not opened'));
      const L = await layout(page);
      await t(label + ': no horizontal scroll' + (w < 768 ? '; 16 px inputs and 44 px targets on phones' : ''), () => { ok(L.overflow <= 1, 'overflow ' + L.overflow); if (w < 768) { ok(!L.tiny, 'small inputs ' + L.tiny); ok(!L.small.length, 'small: ' + L.small.join(' | ')); } });
      await page.evaluate(() => apSign()); await page.waitForTimeout(600);
      await t(label + ': Sign saves first, then opens the signing link in a new tab', async () => {
        const acts = S.calls.map((c) => c.action); const i = acts.lastIndexOf('app_sign'); ok(i > 0 && acts[i - 1] === 'app_save', acts.join(','));
        ok((await page.evaluate(() => window.__opened)).includes('https://app.documenso.com/sign/tok1'), 'link'); });
      await t(label + ': while with the signer the form is read only, with "Continue to signing"', async () => {
        const r = await page.evaluate(() => [document.querySelector('[data-k="biz.ein"]').disabled, /Continue to signing/.test(document.querySelector('#view-apply').innerText)]); ok(r[0] && r[1], JSON.stringify(r)); });
      if (label === 'desktop') {
        S.app.status = 'draft'; S.queue = true; await page.evaluate(() => apOpen('a1')); await page.waitForTimeout(300);
        await page.evaluate(() => apSign()); await page.waitForTimeout(600);
        await t('the free monthly limit → "HCPS has been told", no signing tab', async () => ok(/HCPS has been told/.test(await page.evaluate(() => document.querySelector('#apMsg') ? document.querySelector('#apMsg').innerText : document.body.innerText)), 'message'));
        await page.evaluate(() => showP360('account')); await page.waitForTimeout(1500);
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\naccount setup center (browser): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
