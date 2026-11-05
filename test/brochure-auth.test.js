/* C3-07 stage 0: the brochure EMAIL action is no longer an open relay. Runs the real function with a stubbed network.
     node test/brochure-auth.test.js */
const path=require('path');
let pass=0,fail=0; const t=async(n,f)=>{ try{ await f(); pass++; console.log('ok  ',n); }catch(e){ fail++; console.log('FAIL',n,'\n    ',e.message); } };
const ok=(c,m)=>{ if(!c) throw new Error(m||'assertion'); };
process.env.SUPABASE_URL='https://sb.test'; process.env.SUPABASE_SERVICE_ROLE='svc'; process.env.RESEND_API_KEY='re';
const sent=[];
global.fetch=async(url,o)=>{ const u=String(url);
  if(u==='https://sb.test/auth/v1/user'){ const tok=String(o.headers.Authorization||'').replace(/^Bearer\s+/,''); return tok==='good'||tok==='pending'?{ok:true,json:async()=>({id:tok==='good'?'u1':'u2',email:'x@y.com'})}:{ok:false,json:async()=>({})}; }
  if(u.startsWith('https://sb.test/rest/v1/dealer_users')){ const approved=/u1/.test(u); return {ok:true,json:async()=>[{status:approved?'approved':'pending',dealer_id:'d1',email:'dealer@shop.com'}]}; }
  if(u==='https://api.resend.com/emails'){ sent.push(JSON.parse(o.body)); return {ok:true,text:async()=>''}; }
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
console.log(`brochure auth: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
