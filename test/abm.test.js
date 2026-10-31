/* ABM Respiratory Care 2026 (new line, owner 2026-10-27) — checks on the PUBLIC file, the freight rule and the
   order rules printed on ABM's lists (MOQ = 20 on two filters; the BiWaze Clear extended warranty only with a
   BiWaze Clear system, max 2 per system). Prices are private (catalog_file_commercial) and verified privately. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {grabDecl}=require('./extract-picker.js');
const CC=require('../netlify/functions/_catalog_commercial.js');
const ROOT=path.join(__dirname,'..');
const F=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','abm-respiratory-care.json'),'utf8'));
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8'));
const H=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
t('42 products, one row per part number, all ABM',()=>{
  eq(F.length,42); eq(new Set(F.map(r=>r.code)).size,42,'unique');
  eq([...new Set(F.map(r=>r.manufacturer))],['abm-respiratory-care']);
});
t('the public file carries no commercial field',()=>{ eq(CC.commercialKeysIn(F),[]); });
t('order rules exactly as printed: MOQ 20 on BK281 and BC22480; BK536 only with BK367, max 2 each; air inlet filter is a 3-pack',()=>{
  eq(F.filter(r=>r.min_order_qty).map(r=>[r.code,r.min_order_qty]),[['BK281',20],['BC22480',20]]);
  eq(F.filter(r=>r.requires).map(r=>[r.code,r.requires]),[['BK536',{code:'BK367',max_per:2}]]);
  const f=F.find(r=>r.code==='BC21274'); eq([f.uom,f.case_qty],['3-pack',3]);
});
t('no MSRP is made up: rows without a printed MSRP say none',()=>{
  eq(F.filter(r=>r.msrp_auto===false).length,22);
});
t('actual shipping on every ABM order, with the owner wording; no free freight',()=>{
  const a=MF.find(m=>m.slug==='abm-respiratory-care'); eq(a.hasData,true);
  eq([a.freight.groups.length,a.freight.elseActual,a.freight.summary,a.freight.actualNote],[0,true,'Actual shipping charges apply to all orders.','Actual shipping charges apply to all orders.']);
});
t('B2B: no prescription / patient fields anywhere in the ABM data',()=>{
  eq(/prescri|patient_|upload/i.test(JSON.stringify(F.map(r=>Object.keys(r)))),false);
});
t('the cart refuses a line below its minimum and the warranty without its system (storefront rule)',()=>{
  const ctx={CART:new Map()}; vm.createContext(ctx);
  vm.runInContext(grabDecl(H,'function minOrderQty')+'\n'+grabDecl(H,'function cartRuleProblems')+';this.rp=cartRuleProblems;',ctx);
  const P=c=>Object.assign({manufacturer:'abm-respiratory-care'},F.find(r=>r.code===c));
  const set=(...xs)=>{ ctx.CART.clear(); xs.forEach(([c,q],i)=>ctx.CART.set(c+i,{p:P(c),qty:q})); return ctx.rp().map(x=>x.msg); };
  eq(set(['BK281',19]).length,1,'19 < MOQ'); eq(set(['BK281',20]).length,0,'20 ok');
  eq(set(['BK536',1]).length,1,'warranty alone'); eq(set(['BK367',1],['BK536',2]).length,0,'2 per system ok');
  eq(set(['BK367',1],['BK536',3]).length,1,'3 per system refused'); eq(set(['BK367',2],['BK536',4]).length,0,'2 systems, 4 years');
  eq(set(['BC20113',1],['BK536',1]).length,1,'the Cough system does not qualify the Clear warranty');
});
t('adding a minimum-quantity item adds the minimum; submit refuses a cart that breaks a rule',()=>{
  eq(/const m=minOrderQty\(p\); const nq=Math\.max\(\(cur\?cur\.qty:0\)\+qty, m\);/.test(H),true);
  eq(/const rp=cartRuleProblems\(\); if\(rp\.length\)\{ toast\(rp\[0\]\.msg\); return; \}/.test(H),true);
});
t('owner image library (2026-10-31): exact-part photos on their own SKUs only; no borrowed photo on lookalike parts',()=>{
  const C=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','content','abm-respiratory-care.json'),'utf8')).pages;
  const pg=c=>Object.values(C).find(p=>p.skus.some(s=>s.sku===c));
  const shown=c=>{ const p=pg(c), s=p.skus.find(x=>x.sku===c); return s.image||p.image||((p.images_gallery||[])[0]||{}).url||''; };
  for(const c of ['BC21274','BC22496','BK371','BC20116','BC21083','BC22506','BC21087','BC21092','BC21090']){
    const u=shown(c); eq(!!u,true,c+' photo'); eq(fs.existsSync(path.join(ROOT,'public',u)),true,c+' file '+u); }
  const ov=JSON.parse(fs.readFileSync(path.join(ROOT,'content-overrides','abm-respiratory-care.json'),'utf8'))._images;
  for(const c of ['BC21274','BC22496','BK371','BC21083','BC22506']) eq(/New folder\.zip.*sha256 [0-9a-f]{16}/.test(ov[c].slice(-1)[0].source),true,c+' provenance');
  // the USA cord photo never on the Swiss / Australian cords; the Cough manual never on the Clear manual; the Clear circuit never on Cough dual-lumen
  for(const c of ['BC2396','BC23966','BK381','BK291','BC23400','BC23406','BC23387','BC23394','BK389','BK281','BC22480']) eq(shown(c),'',c+' must have no photo yet');
});
t('shared pages describe every option they hold (not only the first size)',()=>{
  const C=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','content','abm-respiratory-care.json'),'utf8')).pages;
  for(const p of Object.values(C)) if(p.skus.length>1) for(const s of p.skus) eq(String(p.description).includes(s.sku),true,p.page_key+' names '+s.sku);
});
console.log(`abm: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
