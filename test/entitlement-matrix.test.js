/* RELEASE GATE (owner, 2026-10-31): two synthetic dealer permission configurations, every manufacturer the storefront
   lists. A dealer reaches a line's commercial layers (catalog-layers) and its master feed (catalog-feed) ONLY when the
   line is on its own active dealer_manufacturers list; the storefront shows exactly those lines; a pending dealer, no
   credential and a forged credential get nothing; HCPS staff below admin review through a preview, never directly.
   Synthetic dealers, tokens and records only — no network, no prices. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
process.env.SUPABASE_URL='https://synthetic.invalid'; process.env.SUPABASE_SERVICE_ROLE='synthetic-service-key';
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8')).map(m=>m.slug);
let pass=0,fail=0; const t=async(n,f)=>{ try{ await f(); pass++; console.log('ok   '+n);}catch(e){ fail++; console.log('FAIL '+n+'\n     '+e.message);} };
const CC=require(path.join(ROOT,'netlify','functions','_catalog_commercial.js'));
const SPLIT=CC.splitCatalogFile([{code:'SYN-1',name:'Synthetic item'}]);
const ID=CC.catalogIdentity(SPLIT.public);
const DEALERS={
  'dealer-A':{ status:'approved', lines:['access4u','abm-respiratory-care'] },
  'dealer-B':{ status:'approved', lines:['strongback-mobility','bemis','ovation-medical','climbing-steps','dalton','pedifix','corsicana','airavant-bongorx'] },
  'dealer-P':{ status:'pending',  lines:['access4u'] },
};
const TOKENS={ 'tok-A':{uid:'u-A'}, 'tok-B':{uid:'u-B'}, 'tok-P':{uid:'u-P'}, 'tok-rep':{uid:'u-rep',email:'rep@hcps.test'} };
const UID_DEALER={ 'u-A':'dealer-A','u-B':'dealer-B','u-P':'dealer-P' };
const rec=()=>[{manufacturer:'x',identity_sha256:ID,rows:SPLIT.overlay}];
global.fetch=async(url,opt)=>{
  const u=String(url); const res=(code,body)=>({ok:code<300,status:code,text:async()=>JSON.stringify(body),json:async()=>body});
  if(u.endsWith('/auth/v1/user')){ const tok=((opt&&opt.headers&&opt.headers.Authorization)||'').replace('Bearer ',''); const x=TOKENS[tok]; return x?res(200,{id:x.uid,email:x.email||''}):res(401,{}); }
  const q=decodeURIComponent(u.split('/rest/v1/')[1]||'');
  if(q.startsWith('staff_users?')) return res(200, /rep@hcps\.test/.test(q)?[{role:'rep',active:true}]:[]);
  if(q.startsWith('dealer_users?')){ const uid=(q.match(/uid=eq\.([^&]+)/)||[])[1]; const d=UID_DEALER[uid]; return res(200,d?[{status:DEALERS[d].status,dealer_id:d}]:[]); }
  if(q.startsWith('dealer_manufacturers?')){ const d=(q.match(/dealer_id=eq\.([^&]+)/)||[])[1]; return res(200,((DEALERS[d]||{}).lines||[]).map(m=>({manufacturer:m}))); }
  if(q.startsWith('dealer_preview_tokens?')) return res(200,[]);
  if(q.startsWith('catalog_file_commercial?')) return res(200,rec());
  if(q.startsWith('custom_products?')||q.startsWith('product_overrides?')||q.startsWith('product_skus?')||q.startsWith('manufacturer_meta?')) return res(200,[]);
  return res(404,{});
};
const L=require(path.join(ROOT,'netlify','functions','catalog-layers.js'));
const F=require(path.join(ROOT,'netlify','functions','catalog-feed.js'));
const ev=(slug,tok)=>({httpMethod:'GET',headers:tok?{authorization:'Bearer '+tok}:{},queryStringParameters:{manufacturer:slug,identity:ID}});
(async()=>{
  await t('the storefront lists the lines under test',()=>{ for(const s of ['access4u','abm-respiratory-care','dalton','bemis','gce']) if(!MF.includes(s)) throw new Error('missing '+s); });
  for(const [d,tok] of [['dealer-A','tok-A'],['dealer-B','tok-B']]){
    await t(`${d}: catalog-layers answers exactly its own lines, 403 for every other manufacturer`,async()=>{
      const bad=[]; for(const s of MF){ const r=await L.handler(ev(s,tok)); const want=DEALERS[d].lines.includes(s)?200:403; if(r.statusCode!==want) bad.push(s+':'+r.statusCode); } if(bad.length) throw new Error(bad.join(' ')); });
    await t(`${d}: catalog-feed answers exactly its own lines, 403 for every other manufacturer`,async()=>{
      const bad=[]; for(const s of MF){ const r=await F.handler(ev(s,tok)); const want=DEALERS[d].lines.includes(s)?200:403; if(r.statusCode!==want) bad.push(s+':'+r.statusCode); } if(bad.length) throw new Error(bad.join(' ')); });
  }
  await t('a pending dealer, no credential and a forged credential get 401 on every line, from both functions',async()=>{
    const bad=[]; for(const s of MF) for(const tok of ['tok-P',null,'forged.jwt.value']) for(const [n,h] of [['layers',L],['feed',F]]){ const r=await h.handler(ev(s,tok)); if(r.statusCode!==401) bad.push(n+' '+s+' '+tok+':'+r.statusCode); } if(bad.length) throw new Error(bad.slice(0,6).join(' ')); });
  await t('a staff rep is refused commercial layers on every line (review goes through a dealer preview)',async()=>{
    const bad=[]; for(const s of MF){ const r=await L.handler(ev(s,'tok-rep')); if(r.statusCode!==403) bad.push(s+':'+r.statusCode); } if(bad.length) throw new Error(bad.join(' ')); });
  await t('Ohio Medical / GCE: neither synthetic dealer reaches it; a dealer carrying "ohio-medical" does not reach the gce file',async()=>{
    for(const tok of ['tok-A','tok-B']) if((await L.handler(ev('gce',tok))).statusCode!==403) throw new Error('reached gce');
    DEALERS['dealer-A'].lines.push('ohio-medical'); try{ if((await L.handler(ev('gce','tok-A'))).statusCode!==403) throw new Error('ohio-medical opened gce'); } finally { DEALERS['dealer-A'].lines.pop(); } });
  /* storefront: the shop shows a dealer exactly the lines its access answer allows (never "all" by default) */
  const H=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
  const grab=n=>{ const i=H.indexOf('function '+n+'('); let d=0,j=H.indexOf('{',i); for(;j<H.length;j++){ if(H[j]==='{')d++; else if(H[j]==='}'){ d--; if(!d) break; } } return H.slice(i,j+1); };
  const ctx={CONFIG:{GOLDEN_ENABLED:false,GOLDEN_SLUG:'golden-technologies'},state:{manufacturers:MF.map(s=>({slug:s,hasData:true}))},AUTH:{}};
  vm.createContext(ctx); vm.runInContext(['entitledManufacturers','isGoldenSlug','goldenEntitled','goldenMfr','withGolden'].map(grab).join('\n'),ctx);
  for(const d of ['dealer-A','dealer-B']) await t(`${d}: the storefront shows exactly its lines`,()=>{
    ctx.AUTH={status:'approved',access:{your_accounts:DEALERS[d].lines,available:[]}};
    const got=ctx.entitledManufacturers().map(m=>m.slug).sort(), want=[...DEALERS[d].lines].sort();
    if(JSON.stringify(got)!==JSON.stringify(want)) throw new Error(got+' vs '+want); });
  await t('the storefront shows nothing to a guest or to an approved dealer with no lines',()=>{
    ctx.AUTH={status:'guest'}; if(ctx.entitledManufacturers().length) throw new Error('guest');
    ctx.AUTH={status:'approved',lines:[]}; if(ctx.entitledManufacturers().length) throw new Error('no lines'); });
  console.log(`entitlement matrix: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
