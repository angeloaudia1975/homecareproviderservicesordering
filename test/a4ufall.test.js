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
t('items held for the owner are not added; SR3 and PRK keep both their ramp families',()=>{
  eq(['AST24x30','SR3x36','SR3x48','PRK36','PRK48','RRS5x36','GP5x3.5','PS4x5','PS4x6','TRR3','TRR312'].map(count),[0,0,0,0,0,0,0,0,0,0,0]);
  eq(F.filter(r=>r.code==='SR3').map(r=>r.family),['RS','RR']); eq(F.filter(r=>r.code==='PRK').map(r=>r.family),['RS','RR']);
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
