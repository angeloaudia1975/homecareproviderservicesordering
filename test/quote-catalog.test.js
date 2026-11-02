/* ONE CATALOG FOR QUOTES AND THE STOREFRONT (owner, 2026-11-02). The Customer MSRP Quote builder offers exactly what the
   storefront sells this dealer: the storefront's own merge (mergeCatalogEdits) for every line the dealer may order — no
   discontinued, retired, hidden or switched-off product, no inactive line, no Golden — each SKU named with its family and
   exact options, a railing upgrade as its own choice; manufacturer MSRP only (a storefront-derived 2x MSRP is "not
   provided"); no dealer cost on the customer quote; items already on a quote keep their names after a retirement.
   Synthetic data only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {extract,grabDecl}=require('./extract-picker.js');
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
    entitledManufacturers:()=>ctx.MFR.filter(m=>entitled.includes(m.slug)), isGoldenSlug:s=>s==='golden',
    mergeCatalogEdits:async(slug)=>JSON.parse(JSON.stringify(MERGED[slug]||[])),
    unitPrice:(p)=>Number(p.base_price)||null,
    withUpgrade:(p,l)=>{ const u=(p.upgrades||[]).find(x=>x.label===l); return u?Object.assign({},p,{_upgrade:l,base_price:p.base_price+u.price_add,msrp:Math.round((p.msrp*(p.base_price+u.price_add)/p.base_price)*100)/100}):null; },
    msrpIsEach:p=>!!(p&&p.case_qty>1&&p.msrp_each===true),
    money:v=>'$'+Number(v).toFixed(2), esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
    brandLogoHtml:()=>'', PROFILE:{name:'Dealer X'}, QCUST:{name:'',valid:'30 days'}, FAVS:new Set(), BRANDING:{}, encodeURIComponent };
  const els={}; ctx.$=sel=>els[sel]||(els[sel]={innerHTML:'',value:''}); ctx.els=els;
  vm.createContext(ctx);
  vm.runInContext('var PRICE=null,PRICELIST=null,QUOTELIST=null,MFRLIST=null,QUOTE=[],QSEARCH="",QUOTE_UNAVAILABLE=[];'+
    extract(H)+'\n'+grabDecl(H,'function axesOf')+'\n'+['quotableLine','quoteOptionText','quoteEntry','hubStoreCatalog','loadPricing','quoteMsrp','quoteTotal','quoteMsrpHtml','quoteItemHtml','quotePicked','quotePaperHtml','hashStr','quoteOptionsHtml','renderQuotes','qPreview','qDelAt','qFilter'].map(grab).join('\n')+
    ';this.S=()=>({PRICE,PRICELIST,QUOTELIST,QUOTE_UNAVAILABLE,QUOTE}); this.setQ=q=>{QUOTE=q;};',ctx);
  return ctx;
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
await t('the customer quote shows name, options, part #, MSRP or "MSRP not provided" — never the dealer cost — and totals manufacturer MSRP only',async()=>{
  const w=world(['line-a']); await w.loadPricing(); w.setQ(['line-a|A1','line-a|A2','line-a|A3',"line-a|A5|u=Handrail 'Pro'",'line-a|BC1']);
  w.renderQuotes(); const paper=w.els['#view-quotes'].innerHTML;
  for(const s of ['Walker','Small','#A1','Large','#A2','Upgrade: Handrail &#39;Pro&#39;','$30.00 each','MSRP not provided']) if(!paper.includes(s)) throw new Error('missing '+s);
  for(const s of ['$50.00','$55.00','$40.00','$80.00','$400.00','$450.00','$100.00']) if(paper.includes(s)) throw new Error('dealer cost or derived MSRP shown: '+s);
  const picked=w.quotePicked(); eq(w.quoteTotal(picked),120+675+30,'A1 + upgraded A5 + BC1 each'); });
await t('search narrows by name, option or part number; Remove takes out exactly that line (upgrades included)',async()=>{
  const w=world(['line-a','line-b']); await w.loadPricing(); w.renderQuotes();
  w.qFilter('walker large'); eq((w.els['#qsel'].innerHTML.match(/<option /g)||[]).length,1); if(!/value="line-a\|A2"/.test(w.els['#qsel'].innerHTML)) throw new Error('A2 not found');
  w.qFilter('B1'); if(!/value="line-b\|B1"/.test(w.els['#qsel'].innerHTML)) throw new Error('part number search');
  w.qFilter(''); w.setQ(['line-a|A5',"line-a|A5|u=Handrail 'Pro'",'line-b|B1']); w.qDelAt(1); eq(w.S().QUOTE,['line-a|A5','line-b|B1']); });
await t('an item already on a quote keeps its name after it leaves the catalog (history), but is not offered again',async()=>{
  const w=world(['line-a']); await w.loadPricing(); const S=w.S();
  eq(S.PRICE['line-a|R9'].name,'Retired since'); if(S.QUOTELIST.some(p=>p.code==='R9')) throw new Error('retired offered');
  w.setQ(['line-a|R9']); w.renderQuotes(); if(!w.els['#view-quotes'].innerHTML.includes('Retired since')) throw new Error('name lost'); });
await t('a customer quote prints as the quote page alone',()=>{
  if(!/@media print\{#p360wrap #view-quotes\.on \.ph,#p360wrap #view-quotes\.on \.qbuild>\.card,#p360wrap #view-quotes\.on \.qprevlbl\{display:none!important\}/.test(H)) throw new Error('print rule'); });
console.log(`quote catalog: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
