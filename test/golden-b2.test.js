// Golden ⇄ Partner 360 — B2 (O2): Golden in the catalog-v2 storefront, read through golden-proxy. No network.
//   node test/golden-b2.test.js
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
let pass=0, fail=0;
const t=async(n,f)=>{ try{ await f(); pass++; console.log('ok  ',n); }catch(e){ fail++; console.log('FAIL',n,'\n    ',e&&e.message); } };
const ok=(c,m)=>{ if(!c) throw new Error(m||'assertion failed'); };
const grabFn=n=>{ const i=H.indexOf('function '+n+'('); if(i<0) throw new Error('missing '+n); const st=H.lastIndexOf('\n',i)+1; let d=0,j=H.indexOf('{',i); for(;j<H.length;j++){ if(H[j]==='{')d++; else if(H[j]==='}'){ d--; if(!d) break; } } return H.slice(st,j+1); };
const grabLine=a=>{ const i=H.indexOf(a); if(i<0) throw new Error('missing '+a); return H.slice(i,H.indexOf('\n',i)); };
const GFNS=['goldenPreviewEnv','goldenCall','goldenInit','goldenEntitled','goldenToProduct','goldenCatalogProducts','goldenStockHtml','goldenPriceHtml','goldenCardNote','gckOrderingOpen','goldenCardHtml'];

function sandbox(o){
  o=o||{};
  const calls=[];
  const ctx={ CONFIG:{ GOLDEN_ENABLED:!!o.enabled, GOLDEN_SLUG:'golden-technologies', GOLDEN_PROXY_ENDPOINT:'https://homecareproviderservices.netlify.app/.netlify/functions/golden-proxy' },
    STAGING:!!o.staging, AUTH:{ session:o.jwt?{access_token:'jwt'}:null }, window:{ __PREVIEW__:o.preview?{token:'p'.repeat(48)}:null },
    ensureFreshSession:async()=>{}, esc:s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
    money:n=>'$'+Number(n).toFixed(2), variantSummary:v=>v.length+' sizes', calls, console, Promise, JSON, Object, Array, Number, String, Math, Date };
  ctx.fetch=async(url,init)=>{ calls.push({url,init}); const b=JSON.parse(init.body); const r=(o.answers||{})[b.action]; return { ok:true, json:async()=>r }; };
  vm.createContext(ctx);
  vm.runInContext(grabLine('const GOLDEN={')+'\n'+GFNS.map(grabFn).join('\n').replace(/^const GOLDEN=/m,'var GOLDEN=')+'\nthis.GOLDEN=GOLDEN;', ctx);
  return ctx;
}
const ELIG=(over)=>Object.assign({ ok:true, enabled:true, available:true, state:'browse_only', capabilities:{ see_prices:false } }, over||{});
const PROD=(over)=>Object.assign({ sku:'PR535-MED', family:'PR535', family_name:'MaxiComforter™', name:'MaxiComforter™', category:'Lift Chairs', subcategory:'2-Zone',
  size_code:'MED', size_label:'Medium', description:'Desc', specs:['375 lbs max'], zones:'2-Zone', class_ii:true, ribbon:null, color_note:null, badges:{}, brochure_url:null,
  action:'configure', image:'https://cdn.example.invalid/a.webp', msrp:2326, emap:1793, sort:1 }, over||{});

(async()=>{
  await t('the live site never asks Golden while the master switch is off', async()=>{
    const c=sandbox({ jwt:true, answers:{ eligibility:ELIG() } });
    await c.goldenInit(); ok(c.calls.length===0,'no call'); ok(c.goldenEntitled()===false);
  });
  await t('switch on: Golden decides — account/browse_only show, none does not', async()=>{
    for(const [state,on] of [['account',true],['browse_only',true],['none',false]]){
      const c=sandbox({ enabled:true, jwt:true, answers:{ eligibility:ELIG({ state }) } });
      await c.goldenInit(); ok(c.goldenEntitled()===on, state);
      ok(c.calls[0].url===c.CONFIG.GOLDEN_PROXY_ENDPOINT,'through golden-proxy'); ok(c.calls[0].init.headers.authorization==='Bearer jwt');
      ok(!('x-hcps-golden-env' in c.calls[0].init.headers),'live site never asks for the preview environment');
    }
    const c2=sandbox({ enabled:true, jwt:true, answers:{ eligibility:{ ok:true, enabled:false, reason:'switched_off' } } });
    await c2.goldenInit(); ok(c2.goldenEntitled()===false);
  });
  await t('deploy preview + staff view-as: asks Golden\'s preview environment and shows Golden for review', async()=>{
    const c=sandbox({ staging:true, preview:true, answers:{ eligibility:ELIG({ state:'none', preview:true }) } });
    await c.goldenInit(); ok(c.goldenEntitled()===true);
    const h=c.calls[0].init.headers; ok(h['x-hcps-golden-env']==='preview' && h['x-hcps-preview'].length===48);
    const c2=sandbox({ staging:true, preview:false, jwt:true, answers:{ eligibility:ELIG() } });
    // B6 (2026-11-04): a real dealer sign-in on a deploy preview ASKS Golden's preview environment with its own bearer;
    // golden-proxy allows it only for a TEST dealership behind golden_p360_preview_orders (test/golden-integration-b6 in HCPS).
    await c2.goldenInit(); const h2=c2.calls[0]&&c2.calls[0].init.headers;
    ok(h2&&h2['x-hcps-golden-env']==='preview'&&h2.authorization==='Bearer jwt'&&!('x-hcps-preview' in h2),'a real dealer on a preview host asks the preview environment with its own sign-in');
  });
  await t('Golden product → catalog shape: family card, size axis, Golden prices untouched, stock attached', async()=>{
    const c=sandbox({ enabled:true, jwt:true, answers:{ eligibility:ELIG({ state:'account', capabilities:{ see_prices:true } }),
      catalog:{ ok:true, enabled:true, available:true, prices_visible:true, products:[PROD({ dealer_price:922 }), PROD({ sku:'PR535-LAR', size_code:'LAR', size_label:'Large', dealer_price:982, sort:2 }), PROD({ sku:'GB107B', family:'GB107B', size_code:null, size_label:null, category:'Scooters', action:'add', dealer_price:632, sort:3 })] },
      inventory:{ ok:true, enabled:true, available:true, as_of:'2026-11-02T08:00:00Z', stale:false, items:[{ sku:'PR535-MED', status:'in', qty:120 },{ sku:'GB107B', status:'out', qty:0 }] } } });
    await c.goldenInit();
    const list=await c.goldenCatalogProducts();
    ok(list.length===3);
    const m=list[0]; ok(m._golden===true && m._pageKey==='golden:PR535' && m._encPage==='MaxiComforter™' && m._axes.Size==='Medium');
    ok(m.base_price===922 && m.map===1793 && m.msrp===2326 && m._goldenStock.status==='in');
    ok(list[2]._axes===undefined && list[2]._goldenStock.status==='out');
    ok(c.calls.every(x=>x.url===c.CONFIG.GOLDEN_PROXY_ENDPOINT),'only golden-proxy');
  });
  await t('card: catalog-v2 card, Golden price or the link note, stock "as of", never an add-to-cart or a Golden link', async()=>{
    const c=sandbox({ enabled:true, jwt:true });
    c.GOLDEN.cat={ prices:true }; c.GOLDEN.inv={ as_of:'2026-11-02T08:00:00Z', stale:true };
    const a=c.goldenToProduct(PROD({ dealer_price:922 }),{ 'PR535-MED':{ sku:'PR535-MED', status:'low', qty:7 } });
    const b=c.goldenToProduct(PROD({ sku:'PR535-LAR', dealer_price:982 }),{});
    const lead=Object.assign({},a,{ _variants:[a,b], _gname:'MaxiComforter™' });
    const html=c.goldenCardHtml(lead);
    ok(/class="card cv2-card gcard"/.test(html),'catalog-v2 card');
    ok(html.includes('From </span>$922.00'),'lowest Golden price'); ok(html.includes('eMAP'),'eMAP shown');
    ok(html.includes('Low stock · 7') && html.includes('may be out of date'),'stock as of, stale flagged');
    ok(!/addbtn|qtyin/.test(html),'no add to cart'); ok(!/goldenonlineordering|href="http/.test(html),'no link to the Golden platform');
    c.GOLDEN.cat={ prices:false };
    const u=c.goldenToProduct(PROD({}),{}); const h2=c.goldenCardHtml(Object.assign({},u,{ _variants:[u] }));
    ok(h2.includes('Dealer price shows once your Golden account is linked') && !h2.includes('$922'));
    // ordering note: a configurable lift chair has none once ordering is open; anything else is Browse only; never "being finished"
    c.CONFIG.GOLDEN_ORDERING_ENABLED=true;
    ok(c.goldenCardNote({ _goldenAction:'configure', code:'PR535-MED' })==='', 'orderable lift chair: no note');
    ok(/Browse only/.test(c.goldenCardNote({ _goldenAction:'view', code:'GB116' })), 'scooter / bed: browse only');
    c.CONFIG.GOLDEN_ORDERING_ENABLED=false; c.GOLDEN.preview=false;
    ok(/Browse only/.test(c.goldenCardNote({ _goldenAction:'configure', code:'PR535-MED' })), 'ordering closed: browse only');
    ok(!/being finished/.test(html), 'no stale "being finished" copy');
  });
  await t('storefront wiring: loadProducts reads Golden live (no file, no HCPS layers), cart refuses Golden, no redirect', ()=>{
    const lp=grabFn('loadProducts');
    const gb=lp.slice(lp.indexOf('if(isGoldenSlug(slug)){'), lp.indexOf('const mfr = state.manufacturers')).replace(/\/\*[\s\S]*?\*\//g,'');
    ok(/goldenCatalogProducts\(\)/.test(gb) && !/mergeCatalogEdits|\.\/data\//.test(gb),'Golden bypasses files and catalog layers');
    ok(/if\(p && p\._golden\)\{ toast\(/.test(grabFn('addToCart')),'cart refuses Golden');
    ok(/if\(p&&p\._golden\) return goldenCardHtml\(p\);/.test(grabFn('cardHtml')));
    const sec=grabFn('goldenSectionHtml'); const inPl=sec.slice(sec.indexOf('const btn=inPlatform'), sec.indexOf(': (url'));
    ok(!/href=/.test(inPl),'in-platform: no link out to the Golden platform');
    ok(!/goldenonlineordering\.netlify\.app\/(v1|\.netlify)/.test(H),'the browser never calls Golden');
    // Owner go-live (2026-11-05): Golden is shown, cart + ordering open on the live site; the server still decides.
    ok(/GOLDEN_ENABLED:\s*true,/.test(H) && /GOLDEN_CHECKOUT_ENABLED:\s*true,/.test(H) && /GOLDEN_ORDERING_ENABLED:\s*true,/.test(H),'Golden switched on on the live site (owner go-live)');
  });
  await t('Golden prices never pass through HCPS pricing: showroom designer and featured tiles skip Golden; photos only from Golden hosts', ()=>{
    const sd=H.slice(H.indexOf('window.sdPreloadCatalog'), H.indexOf('window.sdPreloadCatalog')+1200);
    ok(/!\(typeof isGoldenSlug==='function'&&isGoldenSlug\(m\.slug\)\)/.test(sd),'showroom designer skips Golden (behaviour proven in test/showroom-speed.test.js)');
    ok(/loadFeatured\(\)\)\.filter\(f=>allowed\.has\(f\.manufacturer\)&&!\(typeof isGoldenSlug==='function'&&isGoldenSlug\(f\.manufacturer\)\)\)/.test(H),'featured tiles skip Golden');
    const re=new Function(H.match(/const GOLDEN_IMG_URL=(\/.*\/);/)[0]+' return GOLDEN_IMG_URL;')();
    ok(re.test('https://d3325uqufdmhie.cloudfront.net/wp-content/uploads/a.jpg')&&!re.test("https://d3325uqufdmhie.cloudfront.net/x');alert(1);//.jpg")&&!re.test('https://evil.example/a.jpg'),'host allow-list');
  });
  console.log(`golden b2: ${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
