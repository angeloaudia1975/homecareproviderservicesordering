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
  if(u.startsWith('https://sb.test/rest/v1/rpc/dealer_document_send_reserve')){
    if(global.SENDS_MISSING) return {ok:false,status:404,text:async()=>'{"code":"PGRST202","message":"Could not find the function public.dealer_document_send_reserve"}'};
    if(global.SENDS_DOWN) return {ok:false,status:500,text:async()=>'boom'};
    if(global.SENDS_COLMISS) return {ok:false,status:400,text:async()=>'{"code":"42703","message":"column x does not exist"}'};
    /* same rules as the SQL function (whose atomicity is proven on Postgres; see the PR) */
    const a=JSON.parse(o.body); const since=Date.now()-864e5, hour=Date.now()-36e5;
    const rows=SENDS.filter(x=>x.status==='sent'&&Date.parse(x.created_at)>=since);
    if(rows.filter(x=>Date.parse(x.created_at)>=hour).length>=a.p_hour) return {ok:true,text:async()=>JSON.stringify({ok:false,reason:'hour'})};
    if(rows.length>=a.p_day) return {ok:true,text:async()=>JSON.stringify({ok:false,reason:'day'})};
    if(rows.filter(x=>x.to_hash===a.p_hash).length>=a.p_recipient) return {ok:true,text:async()=>JSON.stringify({ok:false,reason:'recipient'})};
    const row={id:SENDS.length+1,created_at:new Date().toISOString(),dealer_id:a.p_dealer,kind:a.p_kind,to_domain:a.p_domain,to_hash:a.p_hash,status:'sent'}; SENDS.push(row);
    return {ok:true,text:async()=>JSON.stringify({ok:true,id:row.id})}; }
  if(u.startsWith('https://sb.test/rest/v1/dealer_document_sends')){ const m=(o&&o.method)||'GET';
    if(m==='PATCH'){ const id=Number((u.match(/id=eq\.(\d+)/)||[])[1]); const r=SENDS.find(x=>x.id===id); if(r) Object.assign(r,JSON.parse(o.body)); return {ok:true,text:async()=>''}; } }
  if(u==='https://api.resend.com/emails'){ if(global.RESEND_DOWN) return {ok:false,status:500,text:async()=>'down'}; sent.push(JSON.parse(o.body)); return {ok:true,text:async()=>''}; }
  if(u.startsWith('https://sb.test/rest/v1/dealers')){ if(global.DEALERS_DOWN) return {ok:false,status:500,json:async()=>({})};
    const D={d1:{id:'d1',parent_id:'hq',business_name:'Acme <Branch>',address:'2 Side St',city:'Xenia',state:'OH',zip:'45385',phone:'555-0200',email:'br@acme.test',website:null,logo_url:null},hq:{id:'hq',logo_url:'https://cdn.acme.test/logo.png'}};
    if(global.EVIL_LOGO) D.hq.logo_url=global.EVIL_LOGO; else D.hq.logo_url='https://cdn.acme.test/logo.png';
    const id=(u.match(/id=eq\.([^&]+)/)||[])[1]; const row=D[id]; if(!row) return {ok:true,json:async()=>[]};
    const cols=((u.match(/select=([^&]+)/)||[])[1]||'').split(','); const o2={}; for(const c of cols) o2[c]=row[c]; return {ok:true,json:async()=>[o2]}; }
  if(u.startsWith('https://sb.test/rest/v1/product_skus')) return {ok:true,json:async()=>(/code=eq\.REC1/.test(u)?[{msrp:199.99}]:/code=eq\.RECNONE/.test(u)?[{msrp:null}]:[])};
  if(u.startsWith('https://sb.test/rest/v1/product_overrides')) return {ok:true,json:async()=>(/code=eq\.OV1/.test(u)?[{patch:{msrp:88}}]:[])};
  if(u.startsWith('https://sb.test/rest/v1/custom_products')) return {ok:true,json:async()=>[]};
  if(u==='https://homecareproviderservices.netlify.app/.netlify/functions/dealer-quotes-api'){ global.DQ=(global.DQ||[]).concat([{h:o.headers,b:JSON.parse(o.body)}]);
    const b=JSON.parse(o.body); const ans=b.code==='CALC1'?{ok:true,price:80,label:'Price',source:'calculated'}:b.code==='REC1'?{ok:true,price:199.99,label:'MSRP',source:'msrp'}:{ok:true,price:null,label:null,source:'none'};
    return {ok:true,json:async()=>ans}; }
  if(u==='https://homecareproviderservices.netlify.app/.netlify/functions/golden-proxy'){ global.GPROXY=(global.GPROXY||[]).concat([{h:o.headers,b:JSON.parse(o.body)}]);
    const b=JSON.parse(o.body); const ans=b.code==='PR501-SMA'?{ok:true,price:2499,label:'MSRP',source:'msrp'}:b.code==='GB121'?{ok:true,price:1400,label:'Price',source:'calculated'}:{ok:true,price:null,label:null,source:'none'};
    return {ok:true,json:async()=>ans}; }
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
await t('the same recipient: at most 5 a day (case, spaces and +tags count as the same person)',async()=>{ SENDS.length=0; let last; const v=['Same@X.com',' same@x.com','same+a@x.com','SAME+b@X.COM','same@x.com','same+z@x.com']; for(const a of v) last=await B.handler(ev({action:'email',product:P,to:a},'good')); ok(last.statusCode===429,last.statusCode); ok(SENDS.length===5); });
await t('a missing COLUMN (or any other database error) never lets a send through',async()=>{ SENDS.length=0; const n=sent.length; global.SENDS_COLMISS=true; const r=await B.handler(ev({action:'email',product:P,to:'k@x.com'},'good')); global.SENDS_COLMISS=false; ok(r.statusCode===503&&sent.length===n,r.statusCode); });
await t('per dealer: at most 10 an hour',async()=>{ SENDS.length=0; let last; for(let i=0;i<11;i++) last=await B.handler(ev({action:'email',product:P,to:'c'+i+'@x.com'},'good')); ok(last.statusCode===429,last.statusCode); ok(SENDS.length===10); });
await t('per dealer: at most 40 a day (older sends in the day count)',async()=>{ SENDS.length=0; const old=new Date(Date.now()-5*36e5).toISOString(); for(let i=0;i<40;i++) SENDS.push({id:i+1,status:'sent',to_hash:'h'+i,created_at:old}); const r=await B.handler(ev({action:'email',product:P,to:'new@x.com'},'good')); ok(r.statusCode===429,r.statusCode); });
await t('a send the provider refused is marked failed and does not count',async()=>{ SENDS.length=0; global.RESEND_DOWN=true; const n=sent.length; const r=await B.handler(ev({action:'email',product:P,to:'f@x.com'},'good')); global.RESEND_DOWN=false; ok(r.statusCode===502); ok(SENDS[0].status==='failed'); ok(sent.length===n); });
await t('an unreadable limit store refuses the send (fail closed); with the SQL installed a missing function also refuses',async()=>{ SENDS.length=0; const n=sent.length; global.SENDS_DOWN=true; const r=await B.handler(ev({action:'email',product:P,to:'g@x.com'},'good')); global.SENDS_DOWN=false; ok(r.statusCode===503&&sent.length===n,r.statusCode);
  global.SENDS_MISSING=true; const r2=await B.handler(ev({action:'email',product:P,to:'g@x.com'},'good')); global.SENDS_MISSING=false; ok(r2.statusCode===503&&sent.length===n,r2.statusCode); });
/* ---- verified MSRP is decided by the server ---- */
const html=async pr=>JSON.parse((await B.handler(ev({action:'html',product:pr,include_msrp:true}))).body).html;
await t('MSRP comes from the master record, never the request (a posted dealer cost is not printed)',async()=>{ const h=await html({name:'W',code:'REC1',_mfrSlug:'bemis',msrp:12.34}); ok(h.includes('$199.99')&&!h.includes('12.34'),'msrp'); });
await t('a record with no MSRP prints none, whatever was posted',async()=>{ const h=await html({name:'W',code:'RECNONE',_mfrSlug:'bemis',msrp:500}); ok(!h.includes('500.00')&&!/suggested retail/i.test(h)); });
await t('a saved override MSRP counts when the line has no record for the SKU',async()=>{ const h=await html({name:'W',code:'OV1',_mfrSlug:'yuwell',msrp:5}); ok(h.includes('$88.00')&&!h.includes('$5.00')); });
await t('no manufacturer named, or an upgraded configuration → no MSRP printed',async()=>{ ok(!(await html({name:'W',code:'REC1',msrp:70})).includes('70.00')); ok(!(await html({name:'W',code:'REC1',_mfrSlug:'bemis',_upgrade:true,msrp:70})).includes('199.99')); });
/* ---- dealer-branded brochures (Stage 4) ---- */
await t('signed in: branded from HCPS\'s dealer record (escaped; branch uses its head office logo); the request cannot brand it',async()=>{
  const r=await B.handler(ev({action:'html',product:Object.assign({},P,{dealer:{business_name:'Evil'}}),dealer:{business_name:'Evil'}},'good')); const h=JSON.parse(r.body).html;
  ok(h.includes('Presented by <b>Acme &lt;Branch&gt;</b>')&&h.includes('https://cdn.acme.test/logo.png')&&h.includes('555-0200')&&h.includes('Xenia, OH 45385'),'brand'); ok(!h.includes('Evil'),'request branded it');
  ok(h.includes('supplied through HomeCare Provider Services'),'HCPS credit'); });
await t('signed out / pending / brand unreadable → the plain HCPS handout',async()=>{
  for(const tok of [null,'pending']){ const h=JSON.parse((await B.handler(ev({action:'html',product:P},tok))).body).html; ok(!h.includes('Presented by')&&h.includes('Provided by HomeCare Provider Services'),String(tok)); }
  global.DEALERS_DOWN=true; const h=JSON.parse((await B.handler(ev({action:'html',product:P},'good'))).body).html; global.DEALERS_DOWN=false; ok(!h.includes('Presented by'),'down'); });
await t('a branded email names the dealer in the sender, still from HCPS\'s address',async()=>{ SENDS.length=0; const n=sent.length; const r=await B.handler(ev({action:'email',product:P,to:'brand@x.com'},'good')); ok(r.statusCode===200&&sent.length===n+1,r.statusCode);
  const m=sent[sent.length-1]; ok(/^"Acme Branch via HCPS" <[^<>]+@[^<>]+>$/.test(m.from),m.from); ok(m.html.includes('Presented by'),'body'); });
await t('review fix: a dealer logo cannot break out of its attribute (stored XSS) and must be https / raster data',async()=>{
  for(const evil of ['https://x/a.png" onerror="alert(1)','http://x/a.png','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','/relative.png']){
    global.EVIL_LOGO=evil; const h=JSON.parse((await B.handler(ev({action:'html',product:P},'good'))).body).html; global.EVIL_LOGO=null;
    ok(!/onerror="alert/.test(h)&&!h.includes('javascript:')&&!h.includes('svg+xml')&&!h.includes('http://x/')&&!h.includes('/relative.png'),evil); ok(h.includes('Presented by'),'brand kept'); } });
await t('review fix: one plain address only (no display name / brackets), so one person cannot count as many',async()=>{ SENDS.length=0; const n=sent.length;
  for(const bad of ['foo<v@x.com>','"V" <v@x.com>','v@x.com (x)']){ const r=await B.handler(ev({action:'email',product:P,to:bad},'good')); ok(r.statusCode===400,bad+' '+r.statusCode); }
  ok(sent.length===n&&SENDS.length===0,'reached the limiter'); });
await t('review fix: the From display name is quoted; "$" in a message is text; limits count against the company',async()=>{ SENDS.length=0;
  const r=await B.handler(ev({action:'email',product:P,to:'q@x.com',message:"price $' ok"},'good')); ok(r.statusCode===200,r.statusCode);
  const m=sent[sent.length-1]; ok(/^"Acme Branch via HCPS" <[^<>]+>$/.test(m.from),m.from); ok(m.html.includes("price $' ok")&&(m.html.match(/class="sheet"/g)||[]).length===1,'message / duplicated body');
  ok(SENDS[0].dealer_id==='hq',SENDS[0].dealer_id); });
/* ---- C3-07 P4: Golden's brochure price is read from Golden on the server, never the page's ---- */
const ghtml=async(pr,tok,hd)=>JSON.parse((await B.handler({httpMethod:'POST',headers:Object.assign(tok?{authorization:'Bearer '+tok}:{},hd||{}),body:JSON.stringify({action:'html',product:pr,include_msrp:true})})).body).html;
await t('Golden: Golden\'s MSRP read through golden-proxy with the dealer\'s own sign-in; the page\'s figure ignored',async()=>{ global.GPROXY=[];
  const h=await ghtml({name:'Cloud',code:'PR501-SMA',_mfrSlug:'golden-technologies',msrp:1.23},'good'); ok(h.includes('$2,499.00')&&!h.includes('1.23')&&/suggested retail/i.test(h),'msrp');
  ok(GPROXY.length===1&&GPROXY[0].b.action==='retail'&&GPROXY[0].b.code==='PR501-SMA'&&GPROXY[0].h.authorization==='Bearer good','proxy call'); });
await t('Golden: no MSRP → HCPS calculated retail, printed as "Retail price", never as MSRP',async()=>{ const h=await ghtml({name:'Buzz',code:'GB121',_mfrSlug:'golden-technologies',msrp:null},'good');
  ok(h.includes('$1,400.00')&&/Retail price/.test(h)&&!/suggested retail/i.test(h),'calculated'); });
await t('Golden: a configured chair is priced by its configuration key; signed out → no price; a posted "calculated" flag is ignored',async()=>{ global.GPROXY=[];
  await ghtml({name:'Cloud',code:'PR501-SMA',_goldenKey:'PR501-SMA|xover|ABC|irheat|1',_mfrSlug:'golden-technologies'},'good'); ok(GPROXY[0].b.code==='PR501-SMA|xover|ABC|irheat|1','key');
  const n=GPROXY.length; const h=await ghtml({name:'Cloud',code:'PR501-SMA',_mfrSlug:'golden-technologies',msrp:2499}); ok(GPROXY.length===n&&!h.includes('2,499'),'signed out');
  const h2=await ghtml({name:'W',code:'REC1',_mfrSlug:'bemis',msrp_calculated:true}); ok(/suggested retail/i.test(h2)&&!/Retail price/.test(h2),'flag from request');
  const h3=await ghtml({name:'Cloud',code:'PR501-SMA',_mfrSlug:'golden-technologies'},null,{'x-hcps-preview':'a'.repeat(48)}); ok(h3.includes('$2,499.00')&&GPROXY[GPROXY.length-1].h['x-hcps-preview']==='a'.repeat(48),'staff view-as'); });
await t('signed in: any line\'s default price from the server — official MSRP, else HCPS calculated retail labelled "Retail price"; the page\'s figure ignored',async()=>{ global.DQ=[];
  const h=await ghtml({name:'W',code:'CALC1',_mfrSlug:'ovation-medical',msrp:1.11},'good'); ok(h.includes('$80.00')&&/Retail price/.test(h)&&!/suggested retail/i.test(h)&&!h.includes('1.11'),'calculated');
  ok(DQ[0].b.action==='default_retail'&&DQ[0].b.manufacturer==='ovation-medical'&&DQ[0].h.authorization==='Bearer good','server call with the dealer sign-in');
  const h2=await ghtml({name:'W',code:'REC1',_mfrSlug:'bemis'},'good'); ok(h2.includes('$199.99')&&/suggested retail/i.test(h2),'official MSRP');
  const h3=await ghtml({name:'W',code:'NONE1',_mfrSlug:'bemis',msrp:50},'good'); ok(!h3.includes('50.00'),'nothing printed when there is no price'); });
console.log(`brochure auth: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
