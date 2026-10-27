/* Access4U dealer pricing policy (owner decision 2026-10-27) on the storefront page itself.
   Dealers with different line discounts see different PURCHASE prices on the card, in the cart engine and in the
   dashboard tools — and the same MSRP and MAP. A contract price is never discounted again. Synthetic figures only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {grabDecl}=require('./extract-picker.js');
const H=fs.readFileSync(process.env.SHOP_HTML||path.join(__dirname,'..','public','index.html'),'utf8');
const D=fs.readFileSync(path.join(__dirname,'..','public','dashboard.html'),'utf8');
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const NAMES=['const money','const esc = ','function packOf','function packNote','function msrpIsEach','function mapIsEach','function dealerPriceNote',
  'function familyQty','function tierQty','function tierLadder','function tierRangeLabel','function tierSummary','function nextTierGain','function contractPrice','function lineRatePrice','function withUpgrade','function upgradeAddPurchase','function unitPrice','function priceHtml','function dealerCostOf','function upgradeSelectHtml'];
function page(AUTH){
  const ctx={AUTH,CART:new Map(),state:{dealer:{id:'d'}},console,esc:s=>String(s==null?'':s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';')}; vm.createContext(ctx);
  const src=NAMES.map(n=>{ try{ return grabDecl(H,n); }catch(e){ return ''; } }).join('\n');
  vm.runInContext(src+';this.api={unitPrice,priceHtml,dealerCostOf,lineRatePrice,withUpgrade,upgradeSelectHtml};',ctx);
  return ctx.api;
}
const L='access4u';
const P=()=>({manufacturer:L,code:'RR4x36',name:'Ramp',dealer_price:1000,base_price:850,msrp:1500,map:1050});
const strip=h=>String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
t('cards: three dealers, three purchase prices, one MSRP and one MAP',()=>{
  const out=[[{},'850.00'],[{[L]:10},'900.00'],[{[L]:20},'800.00']].map(([rates,want])=>{
    const html=page({prices:{},rates}).priceHtml(P()); const txt=strip(html);
    if(!txt.includes('$ '+want.split('.')[0]+' .'+want.split('.')[1]) && !txt.includes(want)) throw new Error('card shows '+txt+' — expected '+want);
    return [txt.match(/MSRP \$[\d,.]+/)[0], txt.match(/MAP \$[\d,.]+/)[0]]; });
  eq(new Set(out.map(o=>o[0])).size,1,'MSRP identical'); eq(new Set(out.map(o=>o[1])).size,1,'MAP identical');
  eq(out[0],['MSRP $1,500.00','MAP $1,050.00'],'standard-price MSRP/MAP');
});
t('a rated dealer\'s card says it is his account price; a contract card keeps its own tag and price',()=>{
  eq(/Your account price/.test(page({prices:{},rates:{[L]:20}}).priceHtml(P())),true,'account price tag');
  eq(/Your account price/.test(page({prices:{},rates:{}}).priceHtml(P())),false,'no tag at the default');
  const c=strip(page({prices:{[L+'::RR4x36']:700},rates:{[L]:20}}).priceHtml(P()));
  eq(/700/.test(c)&&/Your contract price/.test(c)&&!/account price/.test(c),true,'contract wins, no double discount: '+c);
});
t('the cart engine and the dashboard tools charge the same purchase price',()=>{
  const a=page({prices:{},rates:{[L]:20}}); eq([a.unitPrice(P(),1),a.dealerCostOf(Object.assign(P(),{manufacturer:undefined}),L)],[800,800]);
  const b=page({prices:{[L+'::RR4x36']:700},rates:{[L]:20}}); eq(b.unitPrice(P(),3),700,'contract');
});
t('the dashboard page prices the same way (contract → rate → default)',()=>{
  const ctx={}; vm.createContext(ctx);
  vm.runInContext(grabDecl(D,'function dealerCostOf')+';this.f=dealerCostOf;',Object.assign(ctx,{ME_PRICES:{},ME_RATES:{}}));
  const q={code:'RR4x36',dealer_price:1000,base_price:850};
  eq(ctx.f(q,L),850,'default'); ctx.ME_RATES={[L]:12.5}; eq(ctx.f(q,L),875,'12.5%'); ctx.ME_PRICES={[L+'::RR4x36']:700}; eq(ctx.f(q,L),700,'contract');
  eq(/ME_RATES=\(me\.rates&&typeof me\.rates==='object'\)\?me\.rates:\{\}/.test(D),true,'boot reads the rates');
});
t('sign-in and server re-pricing keep AUTH.rates current; unreadable keeps the last known',()=>{
  const a=H.indexOf('function applyContractPrices('), b=H.indexOf('function showPricesNotice');
  const ctx={AUTH:{prices:{}},showPricesNotice(){}}; vm.createContext(ctx); vm.runInContext(H.slice(a,b)+';this.ap=applyContractPrices;',ctx);
  ctx.ap({prices:{},rates:{[L]:15}}); eq(ctx.AUTH.rates,{[L]:15}); ctx.ap({prices:null,rates:null,prices_unavailable:true}); eq(ctx.AUTH.rates,{[L]:15},'kept');
  const s=grabDecl(H,'function applyServerPrices');
  eq(/if\("rate" in it\)/.test(s)&&/"dealer_price"/.test(s),true,'server answer refreshes the rate and the standard list');
});
t('the ramp builder totals and options use this dealer\'s price, never a hard-coded 15%',()=>{
  eq(/Your Price \(15%\)/.test(H),false,'label'); eq(/y\+=\(Number\(unitPrice\(p,qty\)\)\|\|0\)\*qty/.test(H),true,'your total');
  eq(/\(\$\{money\(p\.base_price\)\}\)<\/option>/.test(H),false,'options');
});
t('railing upgrades: the choice shows THIS dealer\'s add-on; the configured line keeps its own MSRP/MAP',()=>{
  const U=()=>Object.assign(P(),{code:'RS1',dealer_price:200,base_price:170,msrp:300,map:210,upgrades:[{label:'Picket',price_add:40},{label:'Guardrail',price_add:20}]});
  const a=page({prices:{},rates:{}}), b=page({prices:{},rates:{[L]:20}});
  const ha=a.upgradeSelectHtml(U()), hb=b.upgradeSelectHtml(U());
  eq([/Picket \(\+\$34\.00\)/.test(ha),/Guardrail \(\+\$17\.00\)/.test(ha)],[true,true],'default dealer adds 85%: '+ha);
  eq([/Picket \(\+\$32\.00\)/.test(hb)],[true],'20% dealer adds 80%: '+hb);
  const q=a.withUpgrade(U(),'Picket'); eq([q._upgrade,q.dealer_price,q.base_price,q.msrp,q.map,q.code],['Picket',240,204,360,252,'RS1']);
  eq([a.unitPrice(q,1),b.unitPrice(b.withUpgrade(U(),'Picket'),1)],[204,192],'purchase differs by dealer');
  eq(a.withUpgrade(U(),'Nope'),null,'only listed upgrades'); eq(a.upgradeSelectHtml(P()),'','no upgrades, no choice');
});
t('cart, server re-pricing, checkout and reorder carry the upgrade',()=>{
  eq(/const cartKey=p=>`\$\{p\.manufacturer\}::\$\{p\.code\}`\+\(p\.family!=null&&p\.family!==""\?`::\$\{p\.family\}`:""\)\+\(p\._upgrade\?`::u=\$\{p\._upgrade\}`:""\);/.test(H),true,'cart key');
  eq((H.match(/upgrade:p\._upgrade\|\|undefined/g)||[]).length,2,'price check + order payloads');
  eq(/\+\(it\.upgrade\?"::u="\+it\.upgrade:""\)/.test(grabDecl(H,'function applyServerPrices')),true,'server answer maps back');
  eq(/ — \(\.\+\) upgrade\$/.test(H.slice(H.indexOf('async function reorder('),H.indexOf('function orderCardHtml('))),true,'reorder rebuilds the configured line from the stored name');
  const w=grabDecl(H,'function wireAdd'); eq(/data-family/.test(w)&&/withUpgrade\(p,lab\)/.test(w),true,'add button: family + upgrade');
});
console.log(`shop line discount: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
