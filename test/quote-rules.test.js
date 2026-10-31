/* Customer MSRP Quotes rules (owner, 2026-10-31): only a manufacturer MSRP is shown — no 2x-dealer-cost estimate and
   never the dealer's price; a product without one reads "MSRP not provided" and stays out of the total; new quotes
   offer nothing from an inactive line (manufacturers.json quotable:false — Ohio Medical / GCE); an item already on a
   quote stays on it. Synthetic prices only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
const MF=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','manufacturers.json'),'utf8'));
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
function grab(name){ const i=H.indexOf('function '+name+'('); if(i<0) throw new Error('missing '+name);
  let d=0,j=H.indexOf('{',i); for(;j<H.length;j++){ if(H[j]==='{')d++; else if(H[j]==='}'){ d--; if(!d) break; } } return H.slice(i,j+1); }
const names=['quoteMsrp','quotableLine','quoteTotal','quoteMsrpHtml','quotePicked','quotePaperHtml','hashStr','renderQuotes','qPreview'];
const els={};
const ctx={ money:v=>'$'+Number(v).toFixed(2), esc:s=>String(s), brandLogoHtml:()=>'', PROFILE:{name:'Dealer X'}, QCUST:{name:'',valid:'30 days'},
  FAVS:new Set(), BRANDING:{logo_url:''}, $:sel=>els[sel]||(els[sel]={innerHTML:''}), Number, isFinite, String, Math };
vm.createContext(ctx);
vm.runInContext('var MFRLIST,PRICE,PRICELIST,QUOTE;\n'+names.map(grab).join('\n'),ctx);
ctx.MFRLIST=MF.map(m=>({slug:m.slug,name:m.name,quotable:m.quotable}));
ctx.PRICE={'access4u|A1':{name:'With MSRP',mfrName:'Access4U',msrp:120,cost:60},'access4u|A2':{name:'No MSRP',mfrName:'Access4U',msrp:null,cost:77.77},
  'access4u|A3':{name:'Zero MSRP',mfrName:'Access4U',msrp:0,cost:40},'gce|G1':{name:'Ohio item',mfrName:'Ohio Medical / GCE',msrp:300,cost:150}};
ctx.PRICELIST=Object.entries(ctx.PRICE).map(([k,p])=>({mfr:k.split('|')[0],code:k.split('|')[1],name:p.name,mfrName:p.mfrName,cost:p.cost,msrp:p.msrp}));
t('Ohio Medical / GCE is marked not quotable in manufacturers.json; every other line stays quotable',()=>{
  const g=MF.find(m=>m.slug==='gce'); if(!g||g.quotable!==false) throw new Error('gce not quotable:false');
  const other=MF.filter(m=>m.slug!=='gce'&&m.quotable===false); if(other.length) throw new Error('also off: '+other.map(m=>m.slug));
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
t('no 2x arithmetic left in the quote code',()=>{ const src=names.slice(0,6).map(grab).join('\n'); if(/\*\s*2\b/.test(src)) throw new Error('x2 found'); });
console.log(`quote rules: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
