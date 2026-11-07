/* C3-07 Stages 3–4 — Customer Quotes, My Retail Prices and per-location change requests: browser walkthrough of the REAL
   storefront page (see _shop-harness.js; nothing reaches HCPS, Supabase or a mail provider). dealer-quotes-api and
   dealer-retail-api are answered locally, shaped as the real handlers answer (those are tested against the real code in
   the admin repo: test/quotes.test.js, test/retail-prices.test.js, test/account-center.test.js). The quote document is
   rendered by the admin repo's REAL _quote_doc.js. Checks at 390 / 768 / 1280 px: the three price choices per line, the
   live preview, Save → numbered quote, reopen, Print (render), Email (saved first, one recipient), "Save as my retail
   price", Add to a quote from a product page; the retail editor's bulk MSRP / markup, CSV import, save and history; a head
   office requesting a change FOR a branch; the dealer's cost never on the quote, its preview, the payload or the document;
   no horizontal scroll; 44 px touch targets on phones.
   PLAYWRIGHT_MODULE=… ADMIN_REPO=… node test/quotes-retail.browser.js */
const { chromium, open, path, fs } = require('./_shop-harness.js');
const ADM = process.env.ADMIN_REPO || path.join(__dirname, '..', '..', 'homecareproviderservices');
const DOC = require(path.join(ADM, 'netlify', 'functions', '_quote_doc.js'));
const SHOTS = process.env.SHOTS || '/tmp/quotes-retail-shots'; fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
async function t(n, f) { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + String(e && e.message).slice(0, 300)); } }
const CORS = { 'access-control-allow-origin': '*' };
const COST = 54.99;   // the dealer's synthetic cost — must never reach a quote
const LIST = [
  { mfr: 'bemis', code: 'BE-1', name: 'Raised Seat', mfrName: 'Bemis', cost: COST, msrp: 159.99 },
  { mfr: 'bemis', code: 'BE-2', name: 'Grab Bar', mfrName: 'Bemis', cost: 20, msrp: null },
  { mfr: 'pedifix', code: 'PF-1', name: 'Gel Insole', mfrName: 'PediFix', cost: 8, msrp: 24.5 }];

function fakeApis(page, S) {
  const reply = (route, body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  page.route('**/functions/dealer-retail-api', async route => {
    const b = JSON.parse(route.request().postData() || '{}'); S.retail.push(b);
    if (b.action === 'retail_list') return reply(route, { ok: true, head_office: true, self_id: 'hq', locations: [{ id: 'hq', name: 'TEST HQ' }, { id: 'br', name: 'TEST Branch' }], prices: S.prices });
    if (b.action === 'retail_set') { b.rows.forEach(r => { S.prices = S.prices.filter(p => !(p.manufacturer === r.manufacturer && p.code === r.code && String(p.location_id || '') === String(r.location_id || '')));
      if (r.price != null) S.prices.push({ manufacturer: r.manufacturer, code: r.code, location_id: r.location_id || null, price: r.price }); }); return reply(route, { ok: true, saved: b.rows.length }); }
    if (b.action === 'retail_history') return reply(route, { ok: true, history: [{ changed_at: '2026-11-05T15:00:00Z', location_id: null, old_price: 150, new_price: 149.5, changed_by: 'hq@acme.test' }] });
    return reply(route, { ok: false }, 400);
  });
  page.route('**/functions/dealer-quotes-api', async route => {
    const b = JSON.parse(route.request().postData() || '{}'); S.quotes.push(b);
    const now = () => new Date(Date.now() + S.quotes.length).toISOString();
    if (b.action === 'quote_list') return reply(route, { ok: true, quotes: S.saved.map(q => Object.assign({}, q, { lines: undefined, line_count: q.lines.length })) });
    if (b.action === 'quote_get') { const q = S.saved.find(x => x.id === b.id); return q ? reply(route, Object.assign({ ok: true, quote: q, can_edit: true }, S.atBranch ? { own_location: false, retail_at_location: { 'pedifix|PF-1': 30 } } : { own_location: true, retail_at_location: {} })) : reply(route, { ok: false, error: "That quote isn't available." }, 404); }
    if (b.action === 'quote_save') {
      const c = DOC.cleanLines(b.lines); if (c.error) return reply(route, { ok: false, error: c.error }, 400);
      if (b.id) { const q = S.saved.find(x => x.id === b.id); if (!q || q.updated_at !== b.updated_at) return reply(route, { ok: false, error: 'changed' }, 409);
        Object.assign(q, b.header, { lines: c.lines, updated_at: now() }); return reply(route, { ok: true, quote: q }); }
      const q = Object.assign({ id: 'q' + (S.saved.length + 1), quote_no: 'Q261105-AB' + String(S.saved.length + 1).padStart(2, '0'), status: 'draft', sent_count: 0, location_name: 'TEST HQ' }, b.header, { lines: c.lines, updated_at: now() });
      S.saved.push(q); return reply(route, { ok: true, quote: q });
    }
    if (b.action === 'quote_render') {
      const src = b.id ? S.saved.find(x => x.id === b.id) : null; const c = DOC.cleanLines(src ? src.lines : b.lines); const h = DOC.cleanHeader(src || b.header);
      const priced = await DOC.resolvePrices(c.lines, { msrp: async (m, k) => (LIST.find(p => p.mfr === m && p.code === k) || {}).msrp || null, retail: async (m, k) => { const x = S.prices.find(p => p.manufacturer === m && p.code === k); return x ? x.price : null; } });
      const html = DOC.renderQuote({ dealer: { business_name: 'TEST — Landing Sandbox', phone: '555-111-2222' }, header: h.header, lines: priced, quote_no: src ? src.quote_no : '', date: 'November 5, 2026', forEmail: false });
      S.rendered.push(html); return reply(route, { ok: true, html });
    }
    if (b.action === 'quote_email') { const q = S.saved.find(x => x.id === b.id); if (!q) return reply(route, { ok: false }, 404); q.status = 'sent'; q.sent_count++; q.updated_at = now(); return reply(route, { ok: true, sent_to: b.to }); }
    if (b.action === 'quote_delete') { S.saved = S.saved.filter(x => x.id !== b.id); return reply(route, { ok: true }); }
    return reply(route, { ok: false }, 400);
  });
}
/* The quote / retail code lives inside the page's script scope; the TEST copy of the page gets one probe (__T) so the test
   can read and seed that scope. The shipped page is unchanged. */
const PROBE = h => { const a = 'window.P360={boot:boot'; if (!h.includes(a)) throw new Error('probe anchor missing'); return h.replace(a, 'window.__T=function(src){return eval(src)};' + a); };
const signIn = page => page.evaluate(list => { PREVIEW = null; window.__PREVIEW__ = null; AUTH.session = { access_token: 'tok' }; window.ensureFreshSession = async () => {};
  window.confirm = () => true; window.__LIST = list;
  __T(`ensureCatalogFav=async()=>{}; PRICELIST=window.__LIST; QUOTELIST=window.__LIST.map(p=>({mfr:p.mfr,code:p.code,name:p.name,mfrName:p.mfrName}));
    PRICE={}; window.__LIST.forEach(p=>{ PRICE[p.mfr+'|'+p.code]={name:p.name,sku:p.code,mfrName:p.mfrName,msrp:p.msrp,cost:p.cost,image:''}; });`); }, LIST);
const layout = page => page.evaluate(() => {
  const vis = el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const small = [...document.querySelectorAll('.view.on a.btn, .view.on button, .view.on select, .view.on input:not([type=checkbox]):not([type=file])')].filter(vis).filter(e => e.getBoundingClientRect().height < 43.5).map(e => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30));
  const broken = [...document.querySelectorAll('.view.on img')].filter(i => vis(i) && i.complete && i.naturalWidth === 0).length;
  return { overflow: document.documentElement.scrollWidth - window.innerWidth, small, broken };
});

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [w, h, label] of [[390, 844, 'iphone'], [768, 1024, 'tablet'], [1280, 900, 'desktop']]) {
      const S = { retail: [], quotes: [], saved: [], prices: [{ manufacturer: 'pedifix', code: 'PF-1', location_id: null, price: 22 }], rendered: [] };
      const { ctx, page } = await open(browser, w, h, { html: PROBE });
      await fakeApis(page, S); await signIn(page);
      /* ---------- quotes ---------- */
      await page.evaluate(() => __T(`{ P360Quote.add('bemis|BE-1', { name: 'Raised Seat', sku: 'BE-1', mfrName: 'Bemis', image: 'javascript:alert(1)' }); P360Quote.add('bemis|BE-2'); P360Quote.add('pedifix|PF-1'); showP360('quotes'); }`));
      await page.waitForFunction(() => __T(`/Customer Quotes/.test((document.querySelector('#view-quotes') || {}).innerText || '') && /No saved quotes|Saved quotes/.test(document.querySelector('#view-quotes').innerText)`), null, { timeout: 20000 });
      await page.waitForTimeout(300);
      const lines = await page.evaluate(() => __T(`quotePicked().map(r => [r.key, qMeta(r).basis])`));
      await t(label + ': default price per line — saved retail, else verified MSRP, else one-time', () => ok(JSON.stringify(lines) === JSON.stringify([['bemis|BE-1', 'msrp'], ['bemis|BE-2', 'once'], ['pedifix|PF-1', 'retail']]), JSON.stringify(lines)));
      await t(label + ': a product with no MSRP cannot choose MSRP; none saved cannot choose My retail', async () => {
        const d = await page.evaluate(() => __T(`[...document.querySelectorAll('.qline select')].map(s => [...s.options].map(o => o.disabled ? 0 : 1).join(''))`));
        ok(JSON.stringify(d) === JSON.stringify(['101', '001', '111']), JSON.stringify(d)); });
      await page.fill('.qline:nth-of-type(2) .qonce', '$80'); await page.dispatchEvent('.qline:nth-of-type(2) .qonce', 'change');
      await page.fill('.qline:nth-of-type(1) input[type=number]', '2'); await page.dispatchEvent('.qline:nth-of-type(1) input[type=number]', 'change');
      await page.fill('#qcn', 'Pat Lee'); await page.fill('#qce', 'pat@cust.example');
      await t(label + ': customer fields reach the quote and its preview', async () => ok(await page.evaluate(() => __T(`QCUST.name + '|' + QDIRTY + '|' + /Prepared for Pat Lee/.test(document.querySelector('#qpaper').innerText)`)) === 'Pat Lee|true|true', 'customer'));
      const paper = await page.evaluate(() => __T(`document.querySelector('#qpaper').innerText`));
      await t(label + ': live preview — amounts and total ($319.98 + $80 + $22 = $421.98), never the dealer cost', () => { ok(/\$319\.98/.test(paper) && /\$80\.00/.test(paper) && /Total: \$421\.98/.test(paper), paper.slice(0, 300)); ok(!paper.includes('54.99') && !paper.includes('$20.00'), 'cost'); });
      await page.evaluate(() => __T(`qSaveRetail(1)`)); await page.waitForTimeout(500);
      await t(label + ': "Save as my retail price" saves the one-time price and switches the line to My retail', async () => {
        ok(S.prices.some(p => p.code === 'BE-2' && p.price === 80), JSON.stringify(S.prices)); ok(await page.evaluate(() => __T(`qMeta(quotePicked()[1]).basis`)) === 'retail', 'basis'); });
      await page.evaluate(() => __T(`qSave()`)); await page.waitForFunction(() => __T(`QSAVED && QSAVED.quote_no`), null, { timeout: 10000 });
      const sv = S.quotes.find(x => x.action === 'quote_save');
      await t(label + ': Save sends quantities and bases, no cost and no unsafe image; the quote gets its number', async () => {
        ok(sv.lines.map(l => l.basis + l.qty).join() === 'msrp2,retail1,retail1', JSON.stringify(sv.lines.map(l => [l.basis, l.qty])));
        ok(!JSON.stringify(sv).includes('54.99') && !JSON.stringify(sv).includes('javascript:'), 'payload'); ok(sv.header.customer_name === 'Pat Lee', 'header');
        ok(/Q261105-AB01/.test(await page.evaluate(() => __T(`document.querySelector('#view-quotes').innerText`))), 'number shown'); });
      await page.evaluate(() => __T(`qPrint()`)); await page.waitForTimeout(700);
      await t(label + ': Print renders the saved quote (by id) — the document has the prices and never the cost', () => {
        const r = S.quotes.filter(x => x.action === 'quote_render').pop(); ok(r && r.id === 'q1' && !r.lines, JSON.stringify(r));
        const d = S.rendered.pop(); ok(d.includes('$319.98') && d.includes('$80.00') && d.includes('$421.98') && !d.includes('54.99'), 'document'); });
      await page.evaluate(() => __T(`qEmailOpen()`)); await page.waitForSelector('#qTo');
      await t(label + ': Email opens with the customer\'s address; on phones the email field is 16 px (no iOS zoom)', async () => ok(await page.evaluate(() => __T(`[document.querySelector('#qTo').value, getComputedStyle(document.querySelector('#qTo')).fontSize].join()`)) === 'pat@cust.example,' + (w < 768 ? '16px' : await page.evaluate(() => getComputedStyle(document.querySelector('#qTo')).fontSize)), 'field'));
      await page.click('#qSend'); await page.waitForFunction(() => __T(`!document.querySelector('#modal.on')`), null, { timeout: 10000 });
      await t(label + ': Email sends the SAVED quote to one recipient and marks it sent', () => { const e = S.quotes.find(x => x.action === 'quote_email'); ok(e && e.id === 'q1' && e.to === 'pat@cust.example' && !e.lines, JSON.stringify(e)); ok(S.saved[0].status === 'sent', 'status'); });
      await page.evaluate(() => __T(`qNew()`)); await page.evaluate(() => __T(`{ QLIST = null; renderQuotes(); }`)); await page.waitForTimeout(500);
      await page.evaluate(() => __T(`qOpen('q1')`)); await page.waitForFunction(() => __T(`QSAVED && QSAVED.id === 'q1' && QUOTE.length === 3`), null, { timeout: 10000 });
      await t(label + ': reopening a saved quote restores its lines, quantities and customer', async () => ok(await page.evaluate(() => __T(`[QUOTE.join(), qMeta(quotePicked()[0]).qty, QCUST.name].join('/')`)) === 'bemis|BE-1,bemis|BE-2,pedifix|PF-1/2/Pat Lee', 'restored'));
      S.atBranch = true; await page.evaluate(() => __T(`QDIRTY=false; qOpen('q1')`)); await page.waitForTimeout(600);
      await t(label + ': a head office opening a BRANCH quote previews that branch\'s retail ($30), never its own company price; Save-as-retail is off there', async () => {
        const r = await page.evaluate(() => __T(`[document.querySelector('#qpaper').innerText.includes('$30.00'), document.querySelector('#qpaper').innerText.includes('$22.00')]`)); ok(r[0] && !r[1], JSON.stringify(r)); });
      S.atBranch = false; await page.evaluate(() => __T(`QDIRTY=false; qOpen('q1')`)); await page.waitForTimeout(600);
      await t(label + ': an inactive / retired line is never added to a new quote', async () => ok(await page.evaluate(() => __T(`P360Quote.add('ohio-medical|X1',{name:'X'}); QUOTE.includes('ohio-medical|X1')`)) === false, 'added'));
      const L1 = await layout(page); await page.screenshot({ path: path.join(SHOTS, label + '-quotes.png'), fullPage: false });
      await t(label + ': quotes — no horizontal scroll, no broken image' + (w < 768 ? ', 44 px touch targets' : ''), () => { ok(L1.overflow <= 1, 'overflow ' + L1.overflow); ok(!L1.broken, 'broken'); if (w < 768) ok(!L1.small.length, 'small: ' + L1.small.join(' | ')); });
      /* ---------- Add to a quote from a product page ---------- */
      await page.evaluate(() => __T(`{ state.products = [{ code: 'PF-9', name: 'Toe Cap', manufacturer: 'pedifix', image: '/assets/x.png' }]; state.manufacturers = state.manufacturers || []; pdAddQuote('PF-9'); }`));
      await page.waitForTimeout(400);
      await t(label + ': "Add to a quote" on a product page adds it (with its picture) and opens Customer Quotes', async () => {
        const r = await page.evaluate(() => __T(`[QUOTE.includes('pedifix|PF-9'), (QSNAP['pedifix|PF-9'] || {}).image, document.querySelector('#view-quotes').classList.contains('on')]`));
        ok(r[0] && /^https:\/\/.+\/assets\/x\.png$/.test(r[1]) && r[2], JSON.stringify(r)); });
      /* ---------- retail prices ---------- */
      await page.evaluate(() => __T(`showP360('retail')`)); await page.waitForFunction(() => __T(`document.querySelector('#rpTable .rp-tbl')`), null, { timeout: 15000 });
      await page.evaluate(() => __T(`rpBulk('msrp')`));
      await t(label + ': "Set to MSRP" fills only verified MSRPs where empty (no MSRP → skipped)', async () => { const e = await page.evaluate(() => __T(`RP.edits`)); ok(JSON.stringify(e) === JSON.stringify({ 'bemis|BE-1': 159.99 }), JSON.stringify(e)); });
      await page.evaluate(() => __T(`{ RP.edits = {}; document.querySelector('#rpOnlyEmpty').checked = false; document.querySelector('#rpMk').value = '2'; rpBulk('markup'); }`));
      await t(label + ': markup on cost × 2 sets every listed price (review before saving)', async () => { const e = await page.evaluate(() => __T(`RP.edits`)); ok(e['bemis|BE-1'] === 109.98 && e['bemis|BE-2'] === 40 && e['pedifix|PF-1'] === 16, JSON.stringify(e)); });
      await page.evaluate(() => __T(`{ RP.edits = {}; renderRetailView(); }`));
      const csv = path.join(SHOTS, 'prices.csv'); fs.writeFileSync(csv, 'Manufacturer,Item,Retail price\nbemis,be-1,"$1,199.00"\nbemis,NOPE,5\npedifix,PF-1,abc\n');
      await page.setInputFiles('.rp-bulk input[type=file]', csv); await page.waitForTimeout(400);
      await t(label + ': CSV import fills the editor only (matched / unknown / bad listed, nothing saved yet)', async () => {
        const r = await page.evaluate(() => __T(`[JSON.stringify(RP.edits), document.querySelector('#rpMsg').innerText]`));
        ok(r[0] === JSON.stringify({ 'bemis|BE-1': 1199 }), r[0]); ok(/NOPE/.test(r[1]) && /PF-1/.test(r[1]), r[1]); ok(!S.retail.some(x => x.action === 'retail_set' && x.rows.some(y => y.code === 'BE-1' && y.price === 1199)), 'saved early'); });
      await page.evaluate(() => __T(`rpSave()`)); await page.waitForTimeout(600);
      await t(label + ': Save changes sends the company price', () => { const s = S.retail.filter(x => x.action === 'retail_set').pop(); ok(s && s.rows.length === 1 && !s.rows[0].location_id && s.rows[0].price === 1199, JSON.stringify(s)); });
      await page.evaluate(() => __T(`rpSetTarget('br')`)); await page.waitForTimeout(200);
      await page.fill('input.rp-in[data-k="pedifix|PF-1"]', '25'); await page.dispatchEvent('input.rp-in[data-k="pedifix|PF-1"]', 'change');
      await page.evaluate(() => __T(`rpSave()`)); await page.waitForTimeout(600);
      await t(label + ': a head office sets a branch\'s own price (the company price shown in grey)', () => { const s = S.retail.filter(x => x.action === 'retail_set').pop(); ok(s && s.rows[0].location_id === 'br' && s.rows[0].price === 25, JSON.stringify(s)); });
      await page.evaluate(() => __T(`rpHistory('bemis', 'BE-1', 'Raised Seat')`)); await page.waitForTimeout(500);
      await t(label + ': price history opens with old → new and who', async () => { const tx = await page.evaluate(() => __T(`document.querySelector('#modal').innerText`)); ok(/150\.00/.test(tx) && /149\.50/.test(tx) && /hq@acme\.test/.test(tx), tx.slice(0, 200)); });
      await page.evaluate(() => __T(`closeModal()`));
      const L2 = await layout(page); await page.screenshot({ path: path.join(SHOTS, label + '-retail.png'), fullPage: false });
      await t(label + ': retail prices — no horizontal page scroll, nothing broken' + (w < 768 ? ', 44 px touch targets' : ''), () => { ok(L2.overflow <= 1, 'overflow ' + L2.overflow); ok(!L2.broken, 'broken'); if (w < 768) ok(!L2.small.length, 'small: ' + L2.small.join(' | ')); });
      if (label === 'desktop') await t('default retail (owner 2026-11-06): the server decides it — a product without an official MSRP gets the server\'s HCPS calculated retail, flagged; official MSRP untouched; nothing invented when the server has none', async () => {
        const r = await page.evaluate(() => __T(`(async()=>{ const saved=quotesCall, sent=[]; quotesCall=async(b)=>{ sent.push(b); return {ok:true,items:[{manufacturer:'yuwell',code:'X1',price:20,label:'Price',source:'calculated'}]}; };
          const list=[{mfr:'yuwell',code:'X1',msrp:null},{mfr:'yuwell',code:'X2',msrp:35},{mfr:'yuwell',code:'X3',msrp:null},{mfr:'yuwell',code:'X4|u=Heavy',msrp:null}];
          try{ await applyDefaultRetail(list); } finally { quotesCall=saved; }
          return [list[0].msrp,list[0].msrpCalc,list[1].msrp,list[1].msrpCalc,list[2].msrp,sent[0].items.map(i=>i.code).join(',')]; })()`));
        ok(JSON.stringify(r) === JSON.stringify([20, true, 35, undefined, null, 'X1,X3']), JSON.stringify(r)); });
      await ctx.close();
    }
    /* ---------- a head office requests a change FOR a branch (Account Center) ---------- */
    const reqs = [];
    const center = { ok: true, company: { business_name: 'TEST HQ', head_office: true }, contacts: [], addresses: [], pending: [], scope: 'company',
      locations: [{ id: 'hq', name: 'TEST HQ', is_self: true, can_request: true, accounts: [] }, { id: 'br', name: 'TEST Branch', city: 'Xenia', state: 'OH', address: '2 Side St', zip: '45385', contact_name: 'Bea', phone: '555-0200', email: 'br@acme.test', is_self: false, can_request: true, accounts: [] }] };
    const { ctx, page } = await open(browser, 390, 844, { html: PROBE, tools: b => { if (b.action === 'account_center') return JSON.parse(JSON.stringify(center)); if (b.action === 'account_change_request') { reqs.push(b); return { ok: true, message: 'Sent to HCPS for approval.' }; } return { ok: true }; } });
    await page.evaluate(() => __T(`{ window.__PREVIEW__ = null; showP360('account'); }`));
    await page.waitForFunction(() => __T(`/TEST Branch/.test((document.querySelector('#view-account') || {}).textContent || '')`), null, { timeout: 20000 });
    await t('branch card shows its address and contact', async () => { const tx = await page.evaluate(() => __T(`document.querySelector('#view-account').textContent`)); ok(/2 Side St/.test(tx) && /Bea/.test(tx) && /555-0200/.test(tx), tx.slice(0, 400)); });
    await page.evaluate(() => __T(`acLocOpen('br')`)); await page.waitForSelector('#modal.on input');
    const ins = await page.$$('#modal.on input'); await ins[1].fill('555-0299');
    await page.evaluate(() => __T(`{ const b = [...document.querySelectorAll('#modal.on a.btn, #modal.on button')].find(x => /send|request/i.test(x.textContent)); b && b.click(); }`)); await page.waitForTimeout(600);
    await t('the request names the branch (location_id) and only the edited field', () => { const r = reqs[0]; ok(r && r.location_id === 'br' && JSON.stringify(r.changes).includes('555-0299') && !JSON.stringify(r.changes).includes('Bea'), JSON.stringify(r)); });
    await ctx.close();
  } finally { await browser.close(); }
  console.log(`\nquotes + retail (browser): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
