/* Contract prices that could not be read are UNKNOWN, not "none" (agreed 2026-10-09).
   Runs the page's own applyContractPrices / showPricesNotice in a sandbox. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const HTML=process.env.SHOP_HTML||path.join(__dirname,'..','public','index.html');
const h=fs.readFileSync(HTML,'utf8');
const a=h.indexOf('function applyContractPrices('), b=h.indexOf('async function authMe(){');
if(a<0||b<0){ console.log('FAIL applyContractPrices missing'); process.exit(1); }
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
function sandbox(){
  const els={}; const body={firstChild:null,inserted:[]};
  const document={getElementById:id=>els[id]||null,
    createElement:()=>{ const el={style:{},setAttribute(){},remove(){ delete els[el.id]; }}; return el; },
    body:{get firstChild(){return null;}, insertBefore(el){ els[el.id]=el; body.inserted.push(el); }}};
  const ctx={document,AUTH:{prices:{}},location:{reload(){}}}; vm.createContext(ctx);
  vm.runInContext(h.slice(a,b)+';this.apply=applyContractPrices;',ctx);
  return {ctx,els};
}
t('loaded prices replace the old ones and no notice shows',()=>{ const {ctx,els}=sandbox();
  ctx.apply({prices:{'x::1':5}}); eq(ctx.AUTH.prices,{'x::1':5}); eq(!!els.pricesUnavailable,false); eq(ctx.AUTH.pricesUnavailable,false); });
t('unreadable prices keep the last known prices and show the notice',()=>{ const {ctx,els}=sandbox();
  ctx.apply({prices:{'x::1':5}}); ctx.apply({prices:null,prices_unavailable:true});
  eq(ctx.AUTH.prices,{'x::1':5},'kept'); eq(!!els.pricesUnavailable,true,'notice'); eq(ctx.AUTH.pricesUnavailable,true); });
t('the notice goes away once prices load again',()=>{ const {ctx,els}=sandbox();
  ctx.apply({prices:null,prices_unavailable:true}); ctx.apply({prices:{}}); eq(!!els.pricesUnavailable,false); });
t('the session and the preview both go through it',()=>{
  const n=(h.match(/applyContractPrices\(j\);/g)||[]).length; eq(n,2,'callers');
  eq(/AUTH\.prices=\(j\.prices&&typeof j\.prices==='object'\)\?j\.prices:\{\}/.test(h),false,'old lenient assignment back'); });
console.log(`shop contract prices: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
