/* AirAvant / BongoRx (Bongo Rx Price List 2026, 18023 Rev F; owner decisions 2026-10-27).
   Public file checks + the shipping rule + section-scoped mix-and-match pooling. Prices are private: the tier
   cases below use SYNTHETIC prices on the real part numbers; the real figures are verified privately. */
const fs=require('fs'),path=require('path');
const {engine}=require('./_engine.js');
const CC=require('../netlify/functions/_catalog_commercial.js');
const ROOT=path.join(__dirname,'..');
const H=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
const F=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','airavant-bongorx.json'),'utf8'));
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8'));
const M=MF.find(m=>m.slug==='airavant-bongorx');
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const P=c=>Object.assign({},F.find(r=>r.code===c),{manufacturer:'airavant-bongorx'});
t('every listed part number, once: kit, 5 annual packs (XS–XL), 5 single units incl. BNG511–BNG515, headgear',()=>{
  eq(F.map(r=>r.code),['BNG500','BNG501','BNG502','BNG503','BNG504','BNG505','BNG511','BNG512','BNG513','BNG514','BNG515','BNG530']);
  eq(F.filter(r=>/\(XS\)/.test(r.name)).map(r=>r.code),['BNG501','BNG511'],'XS offered');
  eq([...new Set(F.filter(r=>/^BNG50[1-5]$/.test(r.code)).map(r=>r.uom))],['Pack of 4'],'a pack of 4 is one order unit');
  eq(CC.commercialKeysIn(F),[],'no commercial field in the public file');
  eq(F.every(r=>r.image&&fs.existsSync(path.join(ROOT,'public',r.image))),true,'every image file exists');
});
const run=(lines)=>{ const e=engine(H,{mfr:M}); return e.computeFreight('airavant-bongorx',lines.map(([c,q])=>({p:Object.assign(P(c),{base_price:1}),qty:q}))); };
t('shipping: 9 qualifying units → actual, 10 → free standard shipping',()=>{
  const a=run([['BNG501',4],['BNG512',5]]); eq([a.fee,a.rows[0].status,a.rows[0].qtyRemaining],[0,'actual',1]);
  const b=run([['BNG501',5],['BNG512',5]]); eq([b.fee,b.rows[0].status,b.actualNote],[0,'free','']);
});
t('shipping: 8 qualifying + 2 headgear → actual; 10 qualifying + 2 headgear → whole order free',()=>{
  eq(run([['BNG500',8],['BNG530',2]]).rows[0].status,'actual');
  const r=run([['BNG500',10],['BNG530',2]]); eq([r.rows.length,r.rows[0].status,r.fee],[1,'free',0]);
});
t('shipping: headgear only (even 10 or more) → actual; never a flat amount',()=>{
  const r=run([['BNG530',12]]); eq([r.rows[0].status,r.fee,r.rows[0].qualifyingQty],['actual',0,0]);
  eq(/actual standard shipping/i.test(r.actualNote),true,'note');
});
t('shipping counts order units, not devices in a pack (3 packs of 4 = 3)',()=>{ eq(run([['BNG503',3]]).rows[0].qualifyingQty,3); });
t('the rule touches no other manufacturer: their freight entries carry no qty_threshold mode',()=>{
  eq(MF.filter(m=>m.freight&&m.freight.mode==='qty_threshold').map(m=>m.slug),['airavant-bongorx']);
});
/* Synthetic tiers: section pools exactly as the private file names them. */
const syn=(c,pool)=>Object.assign(P(c),{base_price:10,tiers:[{minQty:1,price:10},{minQty:10,price:9,...(pool?{pool}:{})},{minQty:20,price:8,...(pool?{pool}:{})}]});
const price=(lines,code)=>{ const cart=new Map(); lines.forEach(([p,q],i)=>cart.set('k'+i,{p,qty:q})); const e=engine(H,{mfr:M,cart}); const l=lines.find(([p])=>p.code===code); return e.unitPrice(l[0],l[1]); };
t('breaks at 9/10 and 19/20; sizes mix and match within a section',()=>{
  const A='bongo-annual-packs';
  eq(price([[syn('BNG501',A),9]],'BNG501'),10); eq(price([[syn('BNG501',A),10]],'BNG501'),9);
  eq(price([[syn('BNG501',A),19]],'BNG501'),9); eq(price([[syn('BNG501',A),20]],'BNG501'),8);
  eq(price([[syn('BNG501',A),5],[syn('BNG505',A),5]],'BNG501'),9,'XS + XL packs reach 10 together');
});
t('sections never pool together, and the kit / headgear break per SKU',()=>{
  eq(price([[syn('BNG501','bongo-annual-packs'),5],[syn('BNG511','bongo-single-units'),5]],'BNG501'),10,'packs + singles do not mix');
  eq(price([[syn('BNG500',null),5],[syn('BNG530',null),5]],'BNG500'),10,'kit alone');
});
console.log(`bongorx: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
