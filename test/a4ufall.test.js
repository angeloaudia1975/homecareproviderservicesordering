/* Access4U Fall 2026 catalog (owner decisions 2026-10-27) — checks on the PUBLIC file and the freight rule.
   Prices are private (catalog_file_commercial); a private verification of every figure runs outside this public
   repository. Here: the part numbers, the retirement of the superseded identifiers, no commercial field in the
   public file, and no free shipping. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {grabDecl}=require('./extract-picker.js');
const CC=require('../netlify/functions/_catalog_commercial.js');
const ROOT=path.join(__dirname,'..');
const F=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','access4u.json'),'utf8'));
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8'));
const H=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const norm=c=>String(c).toUpperCase().replace(/[^A-Z0-9]/g,'');
const count=c=>F.filter(r=>norm(r.code)===norm(c)).length;
t('exactly one active row per approved ramp-section and stair part number',()=>{
  const want=['RS3x48','RS4x48','RS5x48','RS6x48'].concat(['STP2','STP3','STP4','STP5','STP6','STP7M','STP8M','STP9M'].flatMap(s=>[s+'x36',s+'x48']));
  eq(want.map(count),want.map(()=>1),'one each');
  eq(F.filter(r=>/^STP/.test(r.code)).map(r=>r.code).sort(),want.filter(c=>/^STP/.test(c)).sort(),'no other stair identifier');
});
t('the superseded stair identifiers are gone from the active catalog (search, cart and reorder read this file)',()=>{
  eq(['STP2','STP3','STP4','STP5','STP6','STP7','STP8','STP9'].map(c=>F.filter(r=>r.code===c).length),[0,0,0,0,0,0,0,0]);
});
t('widths and families of the new identifiers are right',()=>{
  for(const r of F.filter(r=>/^(STP|RS\dx48)/.test(r.code))){ const w=/x48$/.test(r.code)?48:36; eq(r.width_in,w,r.code+' width'); }
  eq([...new Set(F.filter(r=>/^RS\dx48$/.test(r.code)).map(r=>r.family))],['RS'],'RS family');
  eq([...new Set(F.filter(r=>/^STP/.test(r.code)).map(r=>r.family))],['STP'],'STP family');
});
t('the Fall 2026 list is the whole active line: only PRK (= PRK36? open question) held; legacy-only items gone',()=>{
  eq(['AST24x30','SR3x36','SR3x48','PRK36','PRK48','RRS5x36','GP5x3.5','PS4x5','PS4x6','TRR3','TRR312'].map(count),[1,1,1,1,1,1,1,1,1,1,1]);
  eq(['PRK','SR3','STRA12x30','MR24x30','RR1x36','GRR R1','CP5x4','CR1x36','MRS2x36','Gate48','GP 5x3 1/2','RS8x36'].map(count),[0,0,0,0,0,0,0,0,0,0,0,0]);
  eq(F.length,125,'rows');
  const d={}; F.forEach(r=>{ d[norm(r.code)]=(d[norm(r.code)]||0)+1; }); eq(Object.keys(d).filter(k=>d[k]>1),[],'one row per part number');
});
t('three ramp categories with the listed widths (threshold and assist 30/36, portable 30 only)',()=>{
  const fam=re=>F.filter(r=>re.test(r.code));
  const cat=(re,c,s)=>{ for(const r of fam(re)){ eq([r.category,r.subcategory],[c,s],r.code); } };
  cat(/^STR\d/,'Threshold Ramps','Supported Threshold Ramp – Fixed Rise'); cat(/^TR\d/,'Threshold Ramps','Threshold Ramp');
  cat(/^ATR/,'Threshold Ramps','Adjustable Threshold Ramp'); cat(/^TRR/,'Threshold Ramps','Threshold Rubber Ramp');
  cat(/^AST\d/,'Assist Ramps','Assist Ramps with Handrails'); cat(/^ASTNR/,'Assist Ramps','Assist Ramps without Handrails');
  cat(/^PFR/,'Portable Ramps','Portable Folding Ramps');
  for(const [re,ws,n] of [[/^(STR|TR\d|ATR)/,[30,36],32],[/^AST\d/,[30,36],14],[/^ASTNR/,[30,36],14],[/^PFR/,[30],5]]){
    const rows=fam(re); eq(rows.length,n,String(re)); eq([...new Set(rows.map(r=>r.width_in))].sort(),ws,String(re)+' widths');
  }
  eq(fam(/^PFR.*x36$/).length,0,'no 36" portable (X on the list)');
});
t('a width-column row names its width and the printed list reference (no invented base code)',()=>{
  for(const r of F.filter(r=>/^(STR|TR\d|ATR|AST)/.test(r.code))){
    eq(new RegExp('x'+r.width_in+'$').test(r.code),true,r.code+' code width');
    eq(r.name.includes(r.width_in+'″ width'),true,r.code+' name');
    eq(/x3W$/.test(r.mfr_ref)&&r.code.replace(/x3\d$/,'')===r.mfr_ref.replace(/x3W$/,''),true,r.code+' ref '+r.mfr_ref);
  }
});
t('reorder matches a re-spelled part number only when exactly one product has it',()=>{
  eq(/nc\(x\.code\)===nc\(it\.code\)\); if\(m\.length===1\) same=m;/.test(H),true);
});
t('the modular ramp builder uses the Fall 2026 parts: SR3x<w> starter, RS sections, PRK<w> per platform',()=>{
  const ctx={state:{products:F.map(r=>Object.assign({},r,{manufacturer:'access4u'}))}}; vm.createContext(ctx);
  const names=['function a4uProd','function a4uFam','function a4uKey','function a4uIsRun','function a4uIsStarter','function a4uAddRamp','function a4uBom','function a4uAda','function a4uSetWidth'];
  vm.runInContext('const A4U={items:[],open:false,rise:0,width:36};let LEN=10;const $=()=>({value:LEN});const clampInt=(v,a,b)=>Math.max(a,Math.min(b,Math.round(Number(v))));const renderA4U=()=>{};'
    +names.map(n=>grabDecl(H,n)).join('\n')+';this.A4U=A4U;this.setLen=v=>{LEN=v};this.add=a4uAddRamp;this.bom=a4uBom;this.ada=a4uAda;this.w=a4uSetWidth;this.prod=a4uProd;',ctx);
  ctx.add(); eq(ctx.A4U.items.map(i=>i.code),['SR3x36','RS7x36'],'10 ft at 36"');
  eq(ctx.ada([ctx.prod('SR3x36','RS'),ctx.prod('RS7x36','RS')],10).state,'pass','10 ft run serves 10" rise');
  ctx.A4U.items=[]; ctx.w(48); ctx.setLen(10); ctx.add(); eq(ctx.A4U.items.map(i=>i.code),['SR3x48','RS6x48','RS1x48'],'10 ft at 48"');
  ctx.A4U.items.push({code:'PS5x5',fam:'PS',qty:2}); const b=ctx.bom();
  eq(b.filter(x=>x.auto).map(x=>[x.p.code,x.qty]),[['PRK48',2]],'one PRK48 per platform');
  eq(b.every(x=>!!x.p),true,'every part resolves');
  eq(/alumSur|Aluminum surcharge|FOB Access4U/.test(H),false,'no surcharge or FOB quote wording left (not on the Fall list)');
});
t('the public file carries no commercial field (prices and upgrade prices are private)',()=>{
  eq(CC.commercialKeysIn(F),[]); eq(CC.CATALOG_COMMERCIAL_KEYS.includes('upgrades'),true,'upgrades are commercial');
  eq(/"upgrades"/.test(fs.readFileSync(path.join(ROOT,'public','data','access4u.json'),'utf8')),false);
});
t('no free shipping on Access4U: freight is actual cost, confirmed by HCPS',()=>{
  const a=MF.find(m=>m.slug==='access4u'); const f=a.freight;
  eq([Array.isArray(f.groups)&&f.groups.length,f.elseActual],[0,true],'no free / flat group; everything actual');
  eq(/free/i.test(f.summary)&&/no free shipping/i.test(f.summary),true,'says so');
  const ctx={}; vm.createContext(ctx);
  vm.runInContext(['function linesSubtotal','function computeFreight'].map(n=>grabDecl(H,n)).join('\n')+';this.cf=computeFreight;',ctx);
  ctx.mfrInfo=()=>({slug:'access4u',freight:f}); ctx.unitPrice=()=>500;
  const r=ctx.cf('access4u',[{p:{brand:'Access4U',category:'Platforms'},qty:3}]);
  eq([r.fee,r.rows.map(x=>x.status)],[0,['actual']],'actual freight row, nothing quoted');
  eq(/actual cost/i.test(r.actualNote),true,'note');
  eq(/Estimated shipping/.test(H)||/estShip/.test(H),false,'no flat freight estimate left in the ramp builder');
});
t('the version-add SQL is fail-closed and keeps the deployed version (synthetic rows)',()=>{
  const L=require('../scripts/p0-seed-lib.js');
  const full=[{manufacturer:'x',code:'A',name:'A',dealer_price:10,base_price:8.5,msrp:15,map:10.5,upgrades:[{label:'Picket',price_add:1}]}];
  const pub=CC.splitCatalogFile(full).public; const p=L.planInitial('x',full,pub,'add-version/x'); eq(p.ok,true,p.problems.join(';'));
  const x=L.exportAddVersionSql(p.record,{}).sql;
  for(const must of ['RLS is off','a policy exists','anon or authenticated can read','no stored version of x','stored with DIFFERENT rows','where not exists','begin;','commit;'])
    eq(x.includes(must),true,'missing: '+must);
  eq(/delete\s+from/i.test(x),false,'never deletes a version');
  let threw=false; try{ L.exportAddVersionSql(Object.assign({},p.record,{rows_sha256:'0'.repeat(64)})); }catch(e){ threw=true; } eq(threw,true,'tampered rows refused');
});
console.log(`a4u fall 2026: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
