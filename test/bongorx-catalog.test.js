/* AIRAVANT / BongoRx catalog completion (owner, 2026-11-02). 12 SKUs from AirAvant's 2026 provider price list (18023 Rev F)
   on 4 cards: Starter Kit, Annual Replenishment Pack (sizes XS–XL), Single Replenishment Unit (sizes XS–XL), Replacement
   Headgear. Words from AirAvant's brochure (18006 Rev D) with provenance; no efficacy, cost, insurance or coverage claims;
   every photo exists; freight rule unchanged. The public file carries no commercial field. Synthetic checks only. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const F=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','airavant-bongorx.json'),'utf8'));
const C=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','content','airavant-bongorx.json'),'utf8')).pages;
const O=JSON.parse(fs.readFileSync(path.join(ROOT,'content-overrides','airavant-bongorx.json'),'utf8'));
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8')).find(m=>m.slug==='airavant-bongorx');
const CC=require(path.join(ROOT,'netlify','functions','_catalog_commercial.js'));
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const live=Object.values(C).filter(p=>p.status==='published'&&!p.disabled&&(p.skus||[]).some(s=>!s.disabled&&s.status!=='hidden'));
t('12 AirAvant part numbers, the public file carries no commercial field',()=>{
  eq(F.map(r=>r.code),['BNG500','BNG501','BNG502','BNG503','BNG504','BNG505','BNG511','BNG512','BNG513','BNG514','BNG515','BNG530']); eq(CC.commercialKeysIn(F),[]); });
t('4 cards: Starter Kit, Annual Replenishment Pack, Single Replenishment Unit, Replacement Headgear; every SKU on exactly one',()=>{
  eq(live.map(p=>p.page_key).sort(),['bongo-rx-annual-replenishment-pack','bongo-rx-four-size-starter-kit','bongo-rx-replacement-headgear','bongo-rx-single-replenishment-unit']);
  const seen=live.flatMap(p=>p.skus.map(s=>s.sku)).sort(); eq(seen,F.map(r=>r.code).sort()); });
t('packs and single units: one Size choice XS–XL each, in size order, each its own part number with its exact contents',()=>{
  for(const [k,codes,n] of [['bongo-rx-annual-replenishment-pack',['BNG501','BNG502','BNG503','BNG504','BNG505'],'4 Bongo Rx devices'],['bongo-rx-single-replenishment-unit',['BNG511','BNG512','BNG513','BNG514','BNG515'],'1 Bongo Rx device']]){
    const p=C[k]; eq(p.skus.map(s=>s.sku),codes); eq(p.skus.map(s=>s.axes.Size),['Extra Small (XS)','Small (SM)','Medium (MD)','Large (LG)','Extra Large (XL)']);
    for(const s of p.skus){ const sp=Object.fromEntries(s.specs.map(r=>[r.label,r.value])); if(!sp.Contents.startsWith(n)) throw new Error(s.sku+' contents'); eq(sp['AirAvant part no.'],s.sku); } } });
t('packs and single units stay separate cards (different contents and ordering units); kit and headgear stand alone',()=>{
  eq(C['bongo-rx-four-size-starter-kit'].skus.map(s=>s.sku),['BNG500']); eq(C['bongo-rx-replacement-headgear'].skus.map(s=>s.sku),['BNG530']); });
t('words come from AirAvant with provenance; no efficacy, cost, insurance or coverage claim; the brochure is attached',()=>{
  const bad=/\b(effective|efficacy|proven|cure|AHI|reduc|insurance|insured|covered|reimburs|FSA|HSA|Medicare|VA\b|cost|afford|\d+\s?%)/i;
  for(const p of live){ const txt=[p.description,...(p.features||[])].join(' \n '); const m=txt.match(bad); if(m) throw new Error(p.page_key+': '+m[0]);
    if(!(p.documents||[]).some(d=>/bongorx-epap-brochure-2026\.pdf$/.test(d.url)&&/18006 Rev D/.test(d.title))) throw new Error(p.page_key+' brochure');
    if(!/18006 Rev D|18023 Rev F|patient page/.test(JSON.stringify(p.field_provenance||{}))) throw new Error(p.page_key+' provenance'); } });
t('XS is never claimed for the Starter Kit (AirAvant: SM, MD, LG, XL)',()=>{ if(/XS/.test(C['bongo-rx-four-size-starter-kit'].description)) throw new Error('XS in kit'); });
t('every photo exists in the storefront assets (no broken image)',()=>{
  for(const p of live) for(const u of [p.image,...(p.images_gallery||[]).map(g=>g.url)].filter(Boolean)) if(!fs.existsSync(path.join(ROOT,'public',u))) throw new Error(p.page_key+' '+u); });
t('the corrections are data: overrides hold the two family rules and the page words, so an enrichment re-run keeps them',()=>{
  eq(O._families.map(f=>f.key),['bongo-rx-annual-replenishment-pack','bongo-rx-single-replenishment-unit']);
  for(const k of ['bongo-rx-four-size-starter-kit','bongo-rx-replacement-headgear']) if(O[k].description!==C[k].description) throw new Error(k); });
t('freight rule unchanged: free standard shipping at 10 qualifying units, the headgear does not count',()=>{
  eq([MF.freight.mode,MF.freight.freeAtQty,MF.freight.qualifyingCodes.length,MF.freight.qualifyingCodes.includes('BNG530')],['qty_threshold',10,11,false]); });
console.log(`bongorx catalog: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
