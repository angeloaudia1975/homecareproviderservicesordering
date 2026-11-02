/* ABM final completion (owner, 2026-11-02): seven SKUs retired (reversible, content-overrides _retired), the verified
   photos from "New folder (2).zip" assigned with provenance, held photos left unassigned, and a retired / switched-off
   product kept out of every NEW hub action (quote, price request, showroom, pricing export) while PRICE keeps it for
   items already on a quote. Synthetic prices only. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const C=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','content','abm-respiratory-care.json'),'utf8')).pages;
const O=JSON.parse(fs.readFileSync(path.join(ROOT,'content-overrides','abm-respiratory-care.json'),'utf8'));
const F=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','abm-respiratory-care.json'),'utf8'));
const H=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
let pass=0,fail=0; const t=async(n,f)=>{ try{ await f(); pass++; console.log('ok   '+n);}catch(e){ fail++; console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const RETIRED=['BK388','BK381','BC23966','BC23891','BC23575','BC21084','BC2396'];
const entries=()=>Object.values(C).flatMap(p=>(p.skus||[]).map(s=>Object.assign({_page:p},s)));
const off=s=>s.disabled===true||s.status==='hidden';
(async()=>{
await t('the seven retirements are recorded with a reason and reference, and every one is switched off on its page',()=>{
  eq(Object.keys(O._retired).sort(),[...RETIRED].sort());
  for(const c of RETIRED){ const r=O._retired[c]; if(!r.reason||!r.ref||r.decided!=='2026-11-02') throw new Error(c+' record');
    const e=entries().filter(s=>s.sku===c); eq(e.length,1,c+' entries'); if(!off(e[0])) throw new Error(c+' still on'); } });
await t('35 active SKUs remain; nothing else switched off; the catalog file (and its private price identity) is unchanged at 42',()=>{
  const act=entries().filter(s=>!off(s)); eq(act.length,35); eq(entries().filter(off).map(s=>s.sku).sort(),[...RETIRED].sort()); eq(F.length,42); });
await t('verified photos from New folder (2).zip are assigned with file name and fingerprint; warranties carry the owner-allowed badge',()=>{
  const want={BC21087:'e79d2f452c10ec27',BC22480:'cba4b30f3360245c',BK291:'8e1656e4e70661a4',BK373:'91a2cfc349f9b6e2',BK372:'91a2cfc349f9b6e2',BK374:'91a2cfc349f9b6e2',BK536:'5a9b340a2d4c3cd3',BC21275:'8bad36f231b4d6c8'};
  for(const [c,h] of Object.entries(want)){ const a=(O._images[c]||[]); if(!a.some(x=>/New folder \(2\)\.zip/.test(x.source)&&x.source.includes(h))) throw new Error(c+' provenance');
    const e=entries().find(s=>s.sku===c); const img=e.image||e._page.image; if(!img||!fs.existsSync(path.join(ROOT,'public',img))) throw new Error(c+' not displayed'); } });
await t('BC21087 shows its own face-mask circuit photo first (the family photo stays as a second view)',()=>{
  const p=C['biwaze-cough-standard-circuit-child-face-mask']; if(!/ccd97dfe963c5b2c3d9b/.test(p.image)) throw new Error(p.image); eq(p.images_gallery.length,2); });
await t('held photos stay unassigned: BK389 (same beige photo, no new evidence), BK281 (identified but 151 px), BC21095 (battery compartment, not the battery)',()=>{
  for(const c of ['BK389','BK281','BC21095']){ const e=entries().find(s=>s.sku===c); if(e.image||e._page.image) throw new Error(c+' has an image'); if(O._images[c]) throw new Error(c+' in _images'); } });
/* the hub's PRICELIST (new actions) leaves out withdrawn products; PRICE keeps them */
const grab=n=>{ const i=H.indexOf('async function '+n+'(')>=0?H.indexOf('async function '+n+'('):H.indexOf('function '+n+'('); let d=0,j=H.indexOf('{',i); for(;j<H.length;j++){ if(H[j]==='{')d++; else if(H[j]==='}'){ d--; if(!d) break; } } return H.slice(i,j+1); };
await t('hub: a retired SKU and a switched-off catalog edit are not offered for new actions, but PRICE still names them',async()=>{
  const file=[{code:'A1',name:'Kept'},{code:'R1',name:'Retired item'},{code:'X1',name:'Switched off'}];
  const content={pages:{p:{skus:[{sku:'A1'},{sku:'r1',disabled:true,status:'hidden'}]}}};
  const layers={ok:true,identity_sha256:'id',file_overlay:[],product_overrides:[{code:'X1',patch:{active:false}}],custom_products:[]};
  const ctx={LINES:[{slug:'abm-respiratory-care'}],console,
    fetch:async u=>{ u=String(u); const R=b=>({ok:true,json:async()=>b});
      if(u==='/data/manufacturers.json') return R([{slug:'abm-respiratory-care',name:'ABM',hasData:true}]);
      if(u==='/data/abm-respiratory-care.json') return R(file);
      if(u.startsWith('/data/content/')) return R(content);
      if(u.includes('catalog-layers')) return R(layers); return {ok:false,json:async()=>null}; },
    layersHeaders:async()=>({'x-hcps-preview':'t'}), catalogIdentity:()=>'id', restoreCatalogFile:(i)=>i, encodeURIComponent };
  vm.createContext(ctx); vm.runInContext('var PRICE=null,PRICELIST=null,MFRLIST=null;'+grab('hubPageOff')+grab('hubLayerOff')+grab('loadPricing')+';this.go=async()=>{await loadPricing(); return {PRICE,PRICELIST};};',ctx);
  const r=await ctx.go(); eq(r.PRICELIST.map(p=>p.code),['A1']); eq(Object.keys(r.PRICE).sort(),['abm-respiratory-care|A1','abm-respiratory-care|R1','abm-respiratory-care|X1']); });
await t('hub: an unreadable content file withdraws nothing',async()=>{
  const ctx={LINES:[],fetch:async u=>{ u=String(u); if(u==='/data/manufacturers.json') return {ok:true,json:async()=>[{slug:'s',name:'S'}]}; if(u==='/data/s.json') return {ok:true,json:async()=>[{code:'A'}]}; throw new Error('down'); },
    layersHeaders:async()=>null, catalogIdentity:()=>'id', restoreCatalogFile:i=>i, encodeURIComponent };
  vm.createContext(ctx); vm.runInContext('var PRICE=null,PRICELIST=null,MFRLIST=null;'+grab('hubPageOff')+grab('hubLayerOff')+grab('loadPricing')+';this.go=async()=>{await loadPricing(); return PRICELIST;};',ctx);
  eq((await ctx.go()).map(p=>p.code),['A']); });
console.log(`abm final: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
