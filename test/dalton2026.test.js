/* Dalton Medical — Dealer Price List Nov 2026 REVa (owner decisions, tracker #42). Public-file checks only: prices are
   private (catalog_file_commercial); a private verification of every printed price runs outside this public repository. */
const fs=require('fs'),path=require('path');
const CC=require('../netlify/functions/_catalog_commercial.js');
const ROOT=path.join(__dirname,'..');
const F=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','dalton.json'),'utf8'));
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8'));
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
t('the line is the 339 rows of the list, one row per part number',()=>{
  eq(F.length,339); eq(new Set(F.map(r=>r.code)).size,339,'unique codes');
});
t('the public file carries no commercial field',()=>{ eq(CC.commercialKeysIn(F),[]); });
t('every row states its selling unit; a case/pack row states how many it holds',()=>{
  eq(F.filter(r=>!r.uom).map(r=>r.code),[],'no unit');
  eq(F.filter(r=>/(\d+)\s*(Pcs|Sets|Prs)?\s*\/\s*(CS|Case|Ctn|Carton|Pk)\b/i.test(r.name)&&!(r.case_qty>1)).map(r=>r.code),[],'pack text without case_qty');
  eq(F.filter(r=>r.uom==='Each'&&r.case_qty).map(r=>r.code),[],'Each with a case_qty');
});
t('IN-AWP100 is one case of 12 packs x 48 wipes (576)',()=>{
  const r=F.find(x=>x.code==='IN-AWP100'); eq([r.uom,r.case_qty],['Case (12 packs × 48)',576]);
});
t('no MSRP is invented (the list states none)',()=>{ eq(F.filter(r=>r.msrp_auto!==false).length,0); });
t('freight: actual, from Dalton\'s confirmation, with the Nov 1 LTL policy stated; nothing quoted',()=>{
  const f=MF.find(m=>m.slug==='dalton').freight;
  eq([f.groups.length,f.elseActual],[0,true]);
  eq(/25%/.test(f.summary)&&/15%/.test(f.summary)&&/\$2,000/.test(f.summary)&&/Lift gate \$45/.test(f.summary)&&/\$50/.test(f.summary),true,'policy words');
});
t('every image the file names exists in the site',()=>{
  const miss=F.filter(r=>r.image&&!fs.existsSync(path.join(ROOT,'public',r.image))).map(r=>r.code); eq(miss,[]);
});
console.log(`dalton 2026: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
