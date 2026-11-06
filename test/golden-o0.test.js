// Golden ⇄ Partner 360 batch B0 (O0): the storefront never invents a Golden order and never records one.
//   node test/golden-o0.test.js            (SHOP_FILE overrides the page under test)
// - Golden inside Partner 360 is ON since the owner's go-live (2026-11-05); every price and order is still Golden's (server switches + links).
// - Golden account holders get the working link to the Golden platform instead of an empty in-platform catalog.
// - Checkout never submits Golden lines from the browser, never fabricates a "G-…" id, never sends Golden orders
//   to orders-api; Golden lines stay in the cart.
const fs=require('fs'), path=require('path'), vm=require('vm');
const SHOP=process.env.SHOP_FILE||path.join(__dirname,'..','public','index.html');
const src=fs.readFileSync(SHOP,'utf8');
let pass=0, fail=0;
const t=(n,f)=>{ try{ f(); pass++; console.log('ok  ',n); }catch(e){ fail++; console.log('FAIL',n,'\n   ',e.message); } };
const ok=(c,m)=>{ if(!c) throw new Error(m||'assertion failed'); };
const grab=(start,end)=>{ const i=src.indexOf(start); if(i<0) throw new Error('missing '+start); const j=src.indexOf(end,i); if(j<0) throw new Error('missing end '+end); return src.slice(i,j); };

t('Golden in-platform shopping is ON (owner go-live 2026-11-05)', ()=>{ ok(/GOLDEN_ENABLED:\s*true,/.test(src), 'CONFIG.GOLDEN_ENABLED must be true'); });
t('Golden base is the Golden platform', ()=>{ ok(/GOLDEN_BASE:\s*"https:\/\/goldenonlineordering\.netlify\.app"/.test(src)); });
t('no fabricated Golden order id anywhere', ()=>{ ok(!/'G-'\s*\+\s*Date\.now/.test(src) && !/"G-"\s*\+\s*Date\.now/.test(src), 'found G-<time> id'); });
t('browser never calls a Golden order endpoint', ()=>{ ok(!/fetch\(\s*CONFIG\.GOLDEN_ORDER_ENDPOINT/.test(src)); ok(!/async function submitGoldenOrder/.test(src)); });
t('Golden orders never sent to orders-api create', ()=>{
  const fn=grab('async function submitOrder','/* ---- Golden orders');
  ok(!/orders:goldenOrders/.test(fn), 'goldenOrders posted somewhere');
  ok(/if\(goldenOrders\.length && !hcpsOrders\.length\)\{[\s\S]{0,200}return;/.test(fn), 'Golden-only cart returns before submitting');
  ok(/const payload=\{dealer, orders:hcpsOrders/.test(fn), 'only HCPS orders in the submit payload');
  ok(/goldenKept/.test(fn), 'Golden lines kept in the cart');
  ok(/if\(isGoldenSlug\(slug\)\) continue;/.test(fn), 'no PO demanded for Golden lines');
  ok(/filter\(sl=>!goldenKept\.has\(sl\)\)/.test(fn), 'a failed HCPS order is never reported as a Golden failure');
});
t('Golden account card: link to the Golden platform, no in-platform shop button', ()=>{
  const fn=grab('function goldenSectionHtml(){','function abmSectionHtml(){');
  const cfg=grab('const CONFIG = {','\n};')+'\n};';
  const ctx={ AUTH:{ access:{ golden:'Account', golden_url:'/portal/test-dealer' }, dealer:{ name:'Test' } }, esc:s=>String(s), toast:()=>{}, goldenEntitled:()=>false };
  vm.createContext(ctx); vm.runInContext(cfg.replace('const CONFIG','var CONFIG')+'\n'+fn+'\nthis.out=goldenSectionHtml();', ctx);
  ok(ctx.out.includes('href="https://goldenonlineordering.netlify.app/portal/test-dealer"'), 'link to the dealer portal');
  ok(!ctx.out.includes('Shop Golden in the 360 Dealer Portal'), 'no in-platform shop button while off');
  ok(!ctx.out.includes('Order Golden Technologies right here in the 360 Dealer Portal'), 'no in-platform claim while off');
});
console.log(`golden o0: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
