/* Customer MSRP Quotes rules (owner, 2026-10-31): only a manufacturer MSRP is shown — no 2x-dealer-cost estimate and
   never the dealer's price; a product without one reads "MSRP not provided" and stays out of the total; new quotes
   offer nothing from an inactive line (manufacturers.json quotable:false) or a retired line (Ohio Medical / GCE); an item already on a
   quote stays on it. Synthetic prices only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
const MF=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','manufacturers.json'),'utf8'));
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
function grab(name){ const i=H.indexOf('function '+name+'('); if(i<0) throw new Error('missing '+name);
  let d=0,j=H.indexOf('{',i); for(;j<H.length;j++){ if(H[j]==='{')d++; else if(H[j]==='}'){ d--; if(!d) break; } } return H.slice(i,j+1); }
const names=['quoteMsrp','quotableLine','quoteTotal','quoteMsrpHtml','quoteItemHtml','quotePicked','quotePaperHtml','hashStr','quoteOptionsHtml','renderQuotes','qPreview','qSaved','qMsrpOk','qMeta','qUnit','qMoney','qLineHtml','qListHtml'];
const els={};
const ctx={ money:v=>'$'+Number(v).toFixed(2), esc:s=>String(s), brandLogoHtml:()=>'', PROFILE:{name:'Dealer X'}, QCUST:{name:'',valid:'30 days'},
  FAVS:new Set(), BRANDING:{logo_url:''}, $:sel=>els[sel]||(els[sel]={innerHTML:''}), Number, isFinite, String, Math };
vm.createContext(ctx);
vm.runInContext(require('./extract-picker.js').retiredDecls(H)+'\nvar MFRLIST,PRICE,PRICELIST,QUOTELIST,QUOTE,QSEARCH="",QUOTE_UNAVAILABLE=[];\nvar QMETA={},QSNAP={},QSAVED=null,QLIST=[],QDIRTY=false,RETAIL=null,AC=null,QLOCRETAIL=null; const qIsUpgrade=k=>/\\|u=/.test(k); function qLoadList(){}\n'+names.map(grab).join('\n'),ctx);
ctx.MFRLIST=MF.map(m=>({slug:m.slug,name:m.name,quotable:m.quotable}));
ctx.PRICE={'access4u|A1':{name:'With MSRP',mfrName:'Access4U',msrp:120,cost:60},'access4u|A2':{name:'No MSRP',mfrName:'Access4U',msrp:null,cost:77.77},
  'access4u|A3':{name:'Zero MSRP',mfrName:'Access4U',msrp:0,cost:40},'gce|G1':{name:'Ohio item',mfrName:'Ohio Medical / GCE',msrp:300,cost:150}};
ctx.QUOTELIST=Object.entries(ctx.PRICE).map(([k,p])=>({mfr:k.split('|')[0],code:k.split('|')[1],name:p.name,mfrName:p.mfrName,cost:p.cost,msrp:p.msrp}));
t('Ohio Medical / GCE is retired: not listed in manufacturers.json, refused by quotableLine under either identifier; no live line is quotable:false',()=>{
  if(MF.some(m=>['gce','ohio-medical'].includes(m.slug))) throw new Error('Ohio Medical still listed');
  if(ctx.quotableLine('gce')||ctx.quotableLine('ohio-medical')||ctx.quotableLine('OHIO-MEDICAL')) throw new Error('retired line quotable');
  const off=MF.filter(m=>m.quotable===false); if(off.length) throw new Error('also off: '+off.map(m=>m.slug));
  if(!ctx.quotableLine('access4u')) throw new Error('a live line refused');
});
t('no 2x estimate: a product without a manufacturer MSRP reads "MSRP not provided" and is not in the total',()=>{
  ctx.QUOTE=['access4u|A1','access4u|A2','access4u|A3']; const p=ctx.quotePicked();
  if(p[0].msrp!==120||p[1].msrp!==null||p[2].msrp!==null) throw new Error(JSON.stringify(p));
  if(ctx.quoteTotal(p)!==120) throw new Error('total '+ctx.quoteTotal(p));
  const html=ctx.quotePaperHtml(p,ctx.quoteTotal(p));
  if((html.match(/MSRP not provided/g)||[]).length<2) throw new Error('label missing');
  if(/155\.54|\$80\.00|77\.77|40\.00/.test(html)) throw new Error('a dealer cost or 2x estimate leaked: '+html);
  if(/\best\b<|Estimated MSRP/.test(html)) throw new Error('estimate wording left');
});
t('the builder: Ohio Medical not offered for a new quote; an item already on the quote stays on it',()=>{
  ctx.QUOTE=['gce|G1']; ctx.renderQuotes(); const h=els['#view-quotes'].innerHTML;
  if(/<option value="gce\|/.test(h)) throw new Error('gce offered'); if(!/<option value="access4u\|A2"/.test(h)) throw new Error('access4u missing');
  if(!/Ohio item/.test(h)) throw new Error('existing gce item dropped from the quote');
  if(/2× dealer-cost|est<\/span>|" est"/.test(h)) throw new Error('estimate wording in the builder');
  if(/77\.77|155\.54/.test(h)) throw new Error('dealer cost shown');
});
t('every quotable product is offered — no cap: 1,200 products across lines all appear, grouped by manufacturer',()=>{
  const save=[ctx.QUOTELIST,ctx.QUOTE]; ctx.QUOTE=[];
  ctx.QUOTELIST=Array.from({length:1200},(_,i)=>({mfr:i<1100?'pedifix':'abm-respiratory-care',code:'C'+i,name:'Item '+i,mfrName:i<1100?'PediFix':'ABM Respiratory Care'}));
  ctx.renderQuotes(); const h=els['#view-quotes'].innerHTML;
  const n=(h.match(/<option value=/g)||[]).length; ctx.QUOTELIST=save[0]; ctx.QUOTE=save[1];
  if(n!==1200) throw new Error('offered '+n);
  if(!/<optgroup label="ABM Respiratory Care">[\s\S]*value="abm-respiratory-care\|C1199"/.test(h)) throw new Error('ABM group missing');
});
t('no 2x arithmetic left in the quote code',()=>{ const src=names.slice(0,6).map(grab).join('\n'); if(/\*\s*2\b/.test(src)) throw new Error('x2 found'); });
console.log(`quote rules: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
