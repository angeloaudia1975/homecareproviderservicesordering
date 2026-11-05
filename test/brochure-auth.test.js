/* C3-07 stage 0: the brochure EMAIL action is no longer an open relay. Runs the real function with a stubbed network.
     node test/brochure-auth.test.js */
const path=require('path');
let pass=0,fail=0; const t=async(n,f)=>{ try{ await f(); pass++; console.log('ok  ',n); }catch(e){ fail++; console.log('FAIL',n,'\n    ',e.message); } };
const ok=(c,m)=>{ if(!c) throw new Error(m||'assertion'); };
process.env.SUPABASE_URL='https://sb.test'; process.env.SUPABASE_SERVICE_ROLE='svc'; process.env.RESEND_API_KEY='re';
const sent=[]; global.SENDS=[];
global.fetch=async(url,o)=>{ const u=String(url);
  if(u==='https://sb.test/auth/v1/user'){ const tok=String(o.headers.Authorization||'').replace(/^Bearer\s+/,''); return tok==='good'||tok==='pending'?{ok:true,json:async()=>({id:tok==='good'?'u1':'u2',email:'x@y.com'})}:{ok:false,json:async()=>({})}; }
  if(u.startsWith('https://sb.test/rest/v1/dealer_users')){ const approved=/u1/.test(u); return {ok:true,json:async()=>[{status:approved?'approved':'pending',dealer_id:'d1',email:'dealer@shop.com'}]}; }
  if(u.startsWith('https://sb.test/rest/v1/dealer_document_sends')){
    if(global.SENDS_MISSING) return {ok:false,status:404,text:async()=>'{"code":"PGRST205","message":"Could not find the table"}'};
    if(global.SENDS_DOWN) return {ok:false,status:500,text:async()=>'boom'};
    const m=(o&&o.method)||'GET';
    if(m==='GET'){ const since=decodeURIComponent((u.match(/created_at=gte\.([^&]+)/)||[])[1]||''); return {ok:true,text:async()=>JSON.stringify(SENDS.filter(x=>x.status==='sent'&&x.created_at>=since))}; }
    if(m==='POST'){ const row=Object.assign({id:SENDS.length+1,created_at:new Date().toISOString()},JSON.parse(o.body)); SENDS.push(row); return {ok:true,text:async()=>JSON.stringify([row])}; }
    if(m==='PATCH'){ const id=Number((u.match(/id=eq\.(\d+)/)||[])[1]); const r=SENDS.find(x=>x.id===id); if(r) Object.assign(r,JSON.parse(o.body)); return {ok:true,text:async()=>''}; } }
  if(u==='https://api.resend.com/emails'){ if(global.RESEND_DOWN) return {ok:false,status:500,text:async()=>'down'}; sent.push(JSON.parse(o.body)); return {ok:true,text:async()=>''}; }
  throw new Error('unexpected '+u); };
const B=require(path.join(__dirname,'..','netlify','functions','brochure.js'));
const ev=(body,tok)=>({httpMethod:'POST',headers:tok?{authorization:'Bearer '+tok}:{},body:JSON.stringify(body)});
const P={name:'Walker',code:'W1'};
(async()=>{
await t('email without a sign-in is refused and nothing is sent',async()=>{ const r=await B.handler(ev({action:'email',product:P,to:'victim@x.com'})); ok(r.statusCode===401,r.statusCode); ok(sent.length===0); });
await t('email with a bad token is refused',async()=>{ const r=await B.handler(ev({action:'email',product:P,to:'v@x.com'},'bad')); ok(r.statusCode===401); ok(sent.length===0); });
await t('email from a dealer whose access is pending is refused',async()=>{ const r=await B.handler(ev({action:'email',product:P,to:'v@x.com'},'pending')); ok(r.statusCode===401); ok(sent.length===0); });
await t('an approved dealer sends ONE message; reply-to is the dealer, never a caller-chosen address',async()=>{
  const r=await B.handler(ev({action:'email',product:P,to:'customer@x.com',reply_to:'attacker@evil.com'},'good'));
  ok(r.statusCode===200,r.body); ok(sent.length===1); ok(sent[0].to.length===1&&sent[0].to[0]==='customer@x.com'); ok(sent[0].reply_to==='dealer@shop.com',sent[0].reply_to); });
await t('printing (html) still needs no sign-in and sends nothing',async()=>{ const n=sent.length; const r=await B.handler(ev({action:'html',product:P})); ok(r.statusCode===200&&JSON.parse(r.body).html.includes('Walker')); ok(sent.length===n); });
await t('CORS no longer allows every origin',async()=>{ const r=await B.handler({httpMethod:'OPTIONS',headers:{}}); ok(r.headers['Access-Control-Allow-Origin']!=='*',r.headers['Access-Control-Allow-Origin']); });
await t('the storefront sends the dealer sign-in with brochure calls',async()=>{ const s=require('fs').readFileSync(path.join(__dirname,'..','public','index.html'),'utf8'); ok(/hdr\.authorization='Bearer '\+AUTH\.session\.access_token;   \/\/ email needs the dealer's sign-in/.test(s)); });
/* ---- C3-07 Stage 4: send limits ---- */
await t('each send is recorded first (domain + hash, never the address)',async()=>{ const row=SENDS[SENDS.length-1]; ok(row&&row.kind==='brochure'&&row.to_domain==='x.com'&&/^[0-9a-f]{64}$/.test(row.to_hash)&&!JSON.stringify(row).includes('customer@'),JSON.stringify(row)); });
await t('the same recipient: at most 5 a day',async()=>{ SENDS.length=0; let last; for(let i=0;i<6;i++) last=await B.handler(ev({action:'email',product:P,to:'Same@X.com'},'good')); ok(last.statusCode===429,last.statusCode); ok(SENDS.length===5); });
await t('per dealer: at most 10 an hour',async()=>{ SENDS.length=0; let last; for(let i=0;i<11;i++) last=await B.handler(ev({action:'email',product:P,to:'c'+i+'@x.com'},'good')); ok(last.statusCode===429,last.statusCode); ok(SENDS.length===10); });
await t('per dealer: at most 40 a day (older sends in the day count)',async()=>{ SENDS.length=0; const old=new Date(Date.now()-5*36e5).toISOString(); for(let i=0;i<40;i++) SENDS.push({id:i+1,status:'sent',to_hash:'h'+i,created_at:old}); const r=await B.handler(ev({action:'email',product:P,to:'new@x.com'},'good')); ok(r.statusCode===429,r.statusCode); });
await t('a send the provider refused is marked failed and does not count',async()=>{ SENDS.length=0; global.RESEND_DOWN=true; const n=sent.length; const r=await B.handler(ev({action:'email',product:P,to:'f@x.com'},'good')); global.RESEND_DOWN=false; ok(r.statusCode===502); ok(SENDS[0].status==='failed'); ok(sent.length===n); });
await t('an unreadable limit store refuses the send (fail closed); before the SQL the send goes through',async()=>{ SENDS.length=0; const n=sent.length; global.SENDS_DOWN=true; const r=await B.handler(ev({action:'email',product:P,to:'g@x.com'},'good')); global.SENDS_DOWN=false; ok(r.statusCode===503&&sent.length===n,r.statusCode);
  global.SENDS_MISSING=true; const r2=await B.handler(ev({action:'email',product:P,to:'g@x.com'},'good')); global.SENDS_MISSING=false; ok(r2.statusCode===200&&sent.length===n+1,r2.statusCode); });
console.log(`brochure auth: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
