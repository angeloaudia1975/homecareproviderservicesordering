/* ONE CATALOG FOR QUOTES AND THE STOREFRONT (owner, 2026-11-02). The Customer MSRP Quote builder offers exactly what the
   storefront sells this dealer: the storefront's own merge (mergeCatalogEdits) for every line the dealer may order — no
   discontinued, retired, hidden or switched-off product, no inactive line, no Golden — each SKU named with its family and
   exact options, a railing upgrade as its own choice; manufacturer MSRP only (a storefront-derived 2x MSRP is "not
   provided"); no dealer cost on the customer quote; items already on a quote keep their names after a retirement.
   Synthetic data only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {extract,grabDecl,retiredDecls}=require('./extract-picker.js');
const H=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
let pass=0,fail=0; const t=async(n,f)=>{ try{ await f(); pass++; console.log('ok   '+n);}catch(e){ fail++; console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const grab=n=>{ const k=H.indexOf('async function '+n+'(')>=0?H.indexOf('async function '+n+'('):H.indexOf('function '+n+'('); if(k<0) throw new Error('missing '+n); let d=0,j=H.indexOf('{',k); for(;j<H.length;j++){ if(H[j]==='{')d++; else if(H[j]==='}'){ d--; if(!d) break; } } return H.slice(k,j+1); };
/* a synthetic storefront: what mergeCatalogEdits returns for each line */
const MERGED={
  'line-a':[ {code:'A1',name:'Walker – Small',group:'line-a::Walker',_encPage:'Walker',_axes:{Size:'Small'},base_price:50,msrp:120,category:'Mobility'},
             {code:'A2',name:'Walker – Large',group:'line-a::Walker',_encPage:'Walker',_axes:{Size:'Large'},base_price:55,msrp:null,category:'Mobility'},
             {code:'A3',name:'Derived MSRP item',base_price:40,msrp:80,_msrp_suggested:true,category:'Parts'},
             {code:'A4',name:'Old reference item',base_price:30,msrp:70,_discontinued:true},
             {code:'A5',name:'Ramp 4 ft',base_price:400,msrp:600,dealer_price:400,upgrades:[{label:"Handrail 'Pro'",price_add:50}]},
             {code:'BC1',name:'Seat',base_price:100,msrp:30,uom:'Case',case_qty:2,msrp_each:true} ],
  'line-b':[ {code:'B1',name:'Brace',base_price:20,msrp:45} ],
  'line-off':[ {code:'X1',name:'Inactive line item',base_price:10,msrp:20} ],
  'line-noprice':[ {code:'N1',name:'Unpriced',base_price:null,msrp:null} ],
};
function world(entitled){
  const files={'line-a':[{code:'A1'},{code:'A2'},{code:'A3'},{code:'A4'},{code:'A5'},{code:'BC1'},{code:'R9',name:'Retired since'}],'line-b':[{code:'B1'}],'line-off':[{code:'X1'}],'line-noprice':[{code:'N1'}],'line-c':[{code:'C1',name:'Not entitled'}]};
  const ctx={console, LINES:[], MFR:[{slug:'line-a',name:'Line A',hasData:true},{slug:'line-b',name:'Line B',hasData:true},{slug:'line-off',name:'Line Off',hasData:true,quotable:false},{slug:'line-noprice',name:'Line N',hasData:true},{slug:'line-c',name:'Line C',hasData:true},{slug:'golden',name:'Golden',hasData:true}],
    fetch:async u=>{ u=String(u); const R=b=>({ok:true,json:async()=>b});
      if(u==='/data/manufacturers.json') return R(ctx.MFR);
      const m=u.match(/data\/([a-z-]+)\.json/); if(m&&files[m[1]]) return R(JSON.parse(JSON.stringify(files[m[1]])));
      return {ok:false,json:async()=>null}; },
    layersHeaders:async()=>null, catalogIdentity:()=>'id', restoreCatalogFile:i=>i,
    entitledManufacturers:()=>ctx.MFR.filter(m=>ctx.ent.includes(m.slug)), isGoldenSlug:s=>s==='golden',
    mergeCatalogEdits:async(slug)=>JSON.parse(JSON.stringify(MERGED[slug]||[])),
    unitPrice:(p)=>Number(p.base_price)||null,
    withUpgrade:(p,l)=>{ const u=(p.upgrades||[]).find(x=>x.label===l); return u?Object.assign({},p,{_upgrade:l,base_price:p.base_price+u.price_add,msrp:Math.round((p.msrp*(p.base_price+u.price_add)/p.base_price)*100)/100}):null; },
    msrpIsEach:p=>!!(p&&p.case_qty>1&&p.msrp_each===true),
    money:v=>'$'+Number(v).toFixed(2), esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
    brandLogoHtml:()=>'', quotesCall:async()=>({ok:false}), PROFILE:{name:'Dealer X'}, QCUST:{name:'',valid:'30 days'}, FAVS:new Set(), BRANDING:{}, encodeURIComponent, location:{origin:'https://p360.test'} };
  const els={}; ctx.$=sel=>els[sel]||(els[sel]={innerHTML:'',value:''}); ctx.els=els;
  vm.createContext(ctx);
  vm.runInContext('var QMETA={},QSNAP={},QSAVED=null,QLIST=[],QDIRTY=false,RETAIL=null,AC=null,QLOCRETAIL=null; const qIsUpgrade=k=>/\\|u=/.test(k); function qLoadList(){}\nvar GQUOTE={},PRICE=null,PRICELIST=null,QUOTELIST=null,MFRLIST=null,QUOTE=[],QSEARCH="",QUOTE_UNAVAILABLE=[],_quoteSig=null,_quoteBuild=null;'+
    retiredDecls(H)+'\n'+extract(H)+'\n'+grabDecl(H,'function axesOf')+'\n'+['quotableLine','quoteOptionText','quoteEntry','hubStoreCatalog','ensureQuoteCatalog','buildQuoteCatalog','applyDefaultRetail','loadPricing','quoteMsrp','quoteTotal','quoteMsrpHtml','quoteItemHtml','quotePicked','quotePaperHtml','hashStr','quoteOptionsHtml','renderQuotes','qPreview','qDelAt','qFilter','quoteImg','qSaved','qMsrpOk','qMeta','qUnit','qMoney','qLineHtml','qListHtml','qAdd','goldenQuoteRecord'].map(grab).join('\n')+
    ';this.S=()=>({PRICE,PRICELIST,QUOTELIST,QUOTE_UNAVAILABLE,QUOTE,GQUOTE}); this.setQ=q=>{QUOTE=q;};',ctx);
  ctx.ent=entitled; return ctx;
}
(async()=>{
await t('quote choices = the storefront merge for the dealer\'s lines: no discontinued, no inactive line, no Golden, no line he cannot order',async()=>{
  const w=world(['line-a','line-b','line-off','golden']); await w.loadPricing(); const S=w.S();
  eq(S.QUOTELIST.map(p=>p.mfr+'|'+p.code).sort(),["line-a|A1","line-a|A2","line-a|A3","line-a|A5","line-a|A5|u=Handrail 'Pro'","line-a|BC1","line-b|B1"]);
  eq(S.PRICELIST.map(p=>p.code).sort(),['A1','A2','A3','A5','B1','BC1'],'price request / showroom / export: no upgrade entries'); });
await t('a line whose catalog or pricing cannot load is reported, never silently empty',async()=>{
  const w=world(['line-a','line-noprice']); await w.loadPricing(); eq(w.S().QUOTE_UNAVAILABLE,['Line N']); });
await t('each SKU carries its family, exact options and part number; the upgrade is named',async()=>{
  const w=world(['line-a']); await w.loadPricing(); const P=w.S().PRICE;
  eq([P['line-a|A1'].name,P['line-a|A1'].option,P['line-a|A1'].sku],['Walker','Small','A1']);
  eq(P["line-a|A5|u=Handrail 'Pro'"].option,"Upgrade: Handrail 'Pro'"); eq(P["line-a|A5|u=Handrail 'Pro'"].sku,'A5'); });
await t('manufacturer MSRP only: a storefront-derived 2x MSRP and a missing MSRP are "not provided"; a per-piece MSRP says "each"',async()=>{
  const w=world(['line-a']); await w.loadPricing(); const P=w.S().PRICE;
  eq([P['line-a|A1'].msrp,P['line-a|A2'].msrp,P['line-a|A3'].msrp,P['line-a|BC1'].msrp,P['line-a|BC1'].msrpEach],[120,null,null,30,true]); });
await t('the customer quote shows name, options, part #, MSRP or "Price on Request" — never the dealer cost — and totals manufacturer MSRP only',async()=>{
  const w=world(['line-a']); await w.loadPricing(); w.setQ(['line-a|A1','line-a|A2','line-a|A3',"line-a|A5|u=Handrail 'Pro'",'line-a|BC1']);
  w.renderQuotes(); const paper=w.els['#view-quotes'].innerHTML;
  for(const s of ['Walker','Small','#A1','Large','#A2','Upgrade: Handrail &#39;Pro&#39;','$30.00 each','Price on Request']) if(!paper.includes(s)) throw new Error('missing '+s);
  for(const s of ['$50.00','$55.00','$40.00','$80.00','$400.00','$450.00','$100.00']) if(paper.includes(s)) throw new Error('dealer cost or derived MSRP shown: '+s);
  const picked=w.quotePicked(); /* C3-07 Stage 4 review: an upgraded configuration has no verified manufacturer MSRP (the storefront's scaled figure is
     not the manufacturer's), so it is "Price on Request" and out of the total — as the server-rendered quote prints it. */
  eq(w.quoteTotal(picked),120+30,'A1 + BC1 each (upgrade: no verified MSRP)');
  if(!/Handrail[\s\S]{0,600}Price on Request/.test(paper)) throw new Error('upgrade line not "Price on Request"'); });
await t('search narrows by name, option or part number; Remove takes out exactly that line (upgrades included)',async()=>{
  const w=world(['line-a','line-b']); await w.loadPricing(); w.renderQuotes();
  w.qFilter('walker large'); eq((w.els['#qsel'].innerHTML.match(/<option /g)||[]).length,1); if(!/value="line-a\|A2"/.test(w.els['#qsel'].innerHTML)) throw new Error('A2 not found');
  w.qFilter('B1'); if(!/value="line-b\|B1"/.test(w.els['#qsel'].innerHTML)) throw new Error('part number search');
  w.qFilter(''); w.setQ(['line-a|A5',"line-a|A5|u=Handrail 'Pro'",'line-b|B1']); w.qDelAt(1); eq(w.S().QUOTE,['line-a|A5','line-b|B1']); });
await t('an item already on a quote keeps its name after it leaves the catalog (history), but is not offered again',async()=>{
  const w=world(['line-a']); await w.loadPricing(); const S=w.S();
  eq(S.PRICE['line-a|R9'].name,'Retired since'); if(S.QUOTELIST.some(p=>p.code==='R9')) throw new Error('retired offered');
  w.setQ(['line-a|R9']); w.renderQuotes(); if(!w.els['#view-quotes'].innerHTML.includes('Retired since')) throw new Error('name lost'); });
await t('the hub can start before the dealer\'s lines are known: an empty list never sticks — it is rebuilt when the lines arrive',async()=>{
  const w=world([]); w.ent=[]; await w.loadPricing(); eq(w.S().QUOTELIST.length,0,'no lines yet');
  w.ent=['line-b']; await w.ensureQuoteCatalog(); eq(w.S().QUOTELIST.map(p=>p.code),['B1']);
  w.ent=['line-b','line-a']; await w.ensureQuoteCatalog(); eq(w.S().QUOTELIST.length,7,'a newly granted line arrives too');
  const a=w.ensureQuoteCatalog(), b=w.ensureQuoteCatalog(); await Promise.all([a,b]); eq(w.S().QUOTELIST.length,7); });
await t('EVERY REPRESENTED LINE (owner 2026-11-12): a listed line the dealer has no account for is offered without any price; the server\'s official MSRP is applied, a product the shop does not list is removed; an unanswered check reports the line',async()=>{
  const w=world(['line-a']); w.state={manufacturers:w.MFR.filter(m=>m.slug!=='golden')}; w.AUTH={status:'approved'};
  const asked=[];
  w.quotesCall=async b=>{ if(b.action!=='default_retail') return {ok:false}; asked.push(...b.items);
    return {ok:true,items:b.items.map(x=>x.manufacturer==='line-c'?{manufacturer:'line-c',code:x.code,price:x.code==='C1'?99:null,label:'MSRP',source:'msrp',active:true,account:false}:{manufacturer:x.manufacturer,code:x.code,price:null,source:'none',active:true,account:true})}; };
  await w.loadPricing(); const S=w.S();
  const c=S.QUOTELIST.find(p=>p.mfr==='line-c'); if(!c) throw new Error('line without an account not offered');
  eq([c.code,c.account,c.cost,c.msrp],['C1',false,null,99]);
  if(!asked.some(x=>x.manufacturer==='line-c')) throw new Error('server never asked about the no-account line');
  if(S.QUOTELIST.some(p=>p.mfr==='line-off')) throw new Error('a line marked not quotable was offered');
  /* no price from the public file ever reaches the page: the file had none; a synthetic one would be stripped */
  const w2=world([]); w2.state={manufacturers:[{slug:'line-c',name:'Line C',hasData:true}]}; w2.AUTH={status:'approved'};
  w2.fetch=async u=>({ok:true,json:async()=>[{code:'C1',name:'Priced file',base_price:500,dealer_price:400,msrp:999,tiers:[{minQty:1,price:400}]},{code:'C2',name:'Hidden'}]});
  w2.quotesCall=async b=>({ok:true,items:b.items.map(x=>({manufacturer:x.manufacturer,code:x.code,price:null,source:x.code==='C2'?'call':'request',active:x.code!=='C2',account:false}))});
  await w2.loadPricing(); const S2=w2.S();
  eq(S2.QUOTELIST.map(p=>[p.code,p.cost,p.msrp]),[['C1',null,null]],'file prices stripped; hidden product removed');
  if(JSON.stringify(S2.PRICE).match(/500|400|999/)) throw new Error('a file price reached PRICE');
  const w3=world([]); w3.state={manufacturers:[{slug:'line-c',name:'Line C',hasData:true}]}; w3.AUTH={status:'approved'}; w3.quotesCall=async()=>({ok:false});
  await w3.loadPricing(); eq([w3.S().QUOTELIST.length,w3.S().QUOTE_UNAVAILABLE],[0,['Line C']],'unchecked → reported, not shown'); });
await t('GOLDEN in Customer Quotes: every Golden product Golden lets the dealer browse is offered at Golden\'s retail; a configurable lift chair opens its Shop page instead of a bare add',async()=>{
  const w=world(['line-b']); w.CONFIG={GOLDEN_SLUG:'golden-technologies'}; w.goldenEntitled=()=>true;
  w.goldenCatalogProducts=async()=>[{code:'PR501-SMA',name:'Cloud',_encPage:'Cloud',_axes:{Size:'Small'},msrp:2499,_goldenAction:'configure',_golden:true,category:'Lift Chairs'},{code:'GB121',name:'Buzzaround',msrp:null,_goldenAction:'order',_golden:true,category:'Scooters'}];
  let opened=null, shop=null; w.showShop=s=>{shop=s;}; w.openProductDetail=c=>{opened=c;}; w.toast=()=>{}; w.qToast=()=>{}; w.setTimeout=f=>f();
  await w.loadPricing(); const S=w.S();
  const g=S.QUOTELIST.filter(p=>p.mfr==='golden'); eq(g.map(p=>[p.code,p.msrp,p.configure]),[['PR501-SMA',2499,true],['GB121',null,false]]);
  if(S.PRICELIST.some(p=>p.mfr==='golden')) throw new Error('Golden in the HCPS price list');
  w.renderQuotes(); if(!/optgroup label="Golden Technologies"/.test(w.els['#view-quotes'].innerHTML)) throw new Error('Golden group missing');
  w.$('#qsel').value='golden|GB121'; w.qAdd(); eq(w.S().QUOTE,['golden|GB121']); eq(w.S().GQUOTE['golden|GB121'].name,'Buzzaround');
  w.$('#qsel').value='golden|PR501-SMA'; w.qAdd(); eq([w.S().QUOTE,shop,opened],[['golden|GB121'],'golden-technologies','PR501-SMA'],'configure in the Shop');
  const w2=world(['line-b']); w2.CONFIG={GOLDEN_SLUG:'golden-technologies'}; w2.goldenEntitled=()=>false; w2.goldenCatalogProducts=async()=>{ throw new Error('Golden asked without eligibility'); };
  await w2.loadPricing(); if(w2.S().QUOTELIST.some(p=>p.mfr==='golden')) throw new Error('Golden offered without Golden eligibility'); });
await t('a customer quote prints as the quote page alone',()=>{
  if(!/@media print\{#p360wrap #view-quotes\.on \.ph,#p360wrap #view-quotes\.on \.qbuild>\.card,#p360wrap #view-quotes\.on \.qprevlbl\{display:none!important\}/.test(H)) throw new Error('print rule'); });
console.log(`quote catalog: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
