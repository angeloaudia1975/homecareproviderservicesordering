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
  if(u.startsWith('https://sb.test/rest/v1/dealer_preview_tokens')){ const tk=(u.match(/token=eq\.([0-9a-f]+)/)||[])[1]||''; const rows={['c'.repeat(48)]:{dealer_id:'d1',expires_at:new Date(Date.now()+36e5).toISOString()},['e'.repeat(48)]:{dealer_id:'d1',expires_at:new Date(Date.now()-1e3).toISOString()}}; return {ok:true,json:async()=>rows[tk]?[rows[tk]]:[]}; }
  if(u.startsWith('https://sb.test/rest/v1/dealers')){ if(global.DEALERS_DOWN) return {ok:false,status:500,json:async()=>({})};
    const D={d1:{id:'d1',parent_id:'hq',business_name:'Acme <Branch>',address:'2 Side St',city:'Xenia',state:'OH',zip:'45385',phone:'555-0200',email:'br@acme.test',website:null,logo_url:null},hq:{id:'hq',logo_url:'https://cdn.acme.test/logo.png'}};
    if(global.EVIL_LOGO) D.hq.logo_url=global.EVIL_LOGO; else D.hq.logo_url='https://cdn.acme.test/logo.png'; D.hq.phone='555-0100'; D.hq.email='hq@acme.test'; D.hq.website='acme.test'; if(global.D_PATCH) for(const k in global.D_PATCH) Object.assign(D[k],global.D_PATCH[k]);
    const id=(u.match(/id=eq\.([^&]+)/)||[])[1]; const row=D[id]; if(!row) return {ok:true,json:async()=>[]};
    const cols=((u.match(/select=([^&]+)/)||[])[1]||'').split(','); const o2={}; for(const c of cols) o2[c]=row[c]; return {ok:true,json:async()=>[o2]}; }
  if(u.startsWith('https://sb.test/rest/v1/manufacturer_meta')){ if(global.META_DOWN) return {ok:false,status:500,json:async()=>({})}; return {ok:true,json:async()=>(/slug=eq\.bemis/.test(u)?[{record_authoritative:true}]:[{record_authoritative:false}])}; }
  if(u.startsWith('https://sb.test/rest/v1/catalog_file_commercial')){ const sl=(u.match(/manufacturer=eq\.([^&]+)/)||[])[1]; return {ok:true,json:async()=>(FILES[sl]?[{manufacturer:sl,identity_sha256:FILES[sl].identity,rows:FILES[sl].overlay}]:[])}; }
  if(u.startsWith('https://hcpsonlineordering.netlify.app/data/')){ const sl=decodeURIComponent(u.split('/data/')[1].replace(/\.json$/,'')); if(global.FILE_DOWN) return {ok:false,status:500,json:async()=>({})}; return FILES[sl]?{ok:true,status:200,json:async()=>FILES[sl].public}:{ok:false,status:404,json:async()=>({})}; }
  if(u.startsWith('https://sb.test/rest/v1/product_skus')) return {ok:true,json:async()=>(/code=eq\.REC1/.test(u)?[{msrp:199.99}]:/code=eq\.RECNONE/.test(u)?[{msrp:null}]:[])};
  if(u.startsWith('https://sb.test/rest/v1/product_overrides')) return {ok:true,json:async()=>(/code=eq\.OV1/.test(u)?[{patch:{msrp:88}}]:[])};
  if(u.startsWith('https://sb.test/rest/v1/custom_products')) return {ok:true,json:async()=>[]};
  if(u==='https://homecareproviderservices.netlify.app/.netlify/functions/dealer-quotes-api'){ global.DQ=(global.DQ||[]).concat([{h:o.headers,b:JSON.parse(o.body)}]);
    const b=JSON.parse(o.body);
    /* owner 2026-11-12 fixtures — the admin site's answer shape (RP.offerRule / RP.savings run there) */
    if(b.code==='ES0001'){ const of=Number(b.offer); return {ok:true,json:async()=>({ok:true,price:null,source:'request',reference:null,map:399.95,policy:'map',active:true,offer_check:of>0?(of<399.95?{ok:false,flag:'below_map',map:399.95}:{ok:true,flag:null,map:null}):null,saving:null})}; }
    if(b.code==='SAV1'){ const of=Number(b.offer); const sv=of>0&&of<399.99?{reference:399.99,offer:of,dollars:Math.round((399.99-of)*100)/100,percent:Math.floor((399.99-of)/399.99*100)}:null;
      return {ok:true,json:async()=>({ok:true,price:399.99,label:'MSRP',source:'msrp',reference:399.99,map:null,policy:'open',active:true,offer_check:of>0?{ok:true}:null,saving:sv})}; }
    const ans=b.code==='CALC1'?{ok:true,price:80,label:'Price',source:'calculated'}:b.code==='REC1'?{ok:true,price:199.99,label:'MSRP',source:'msrp'}:{ok:true,price:null,label:null,source:'none'};
    return {ok:true,json:async()=>ans}; }
  if(u==='https://homecareproviderservices.netlify.app/.netlify/functions/dealer-auth'){ const b=JSON.parse(o.body); (global.MAUTH=global.MAUTH||[]).push(b);
    const live=b.token==='e'.repeat(64);
    if(b.action==='manage_info') return {ok:true,json:async()=>(live?{ok:true,staff:{email:'angelo@homecareproviderservices.us'},location:{id:'d1',name:'Acme <Branch>'},actions:[{key:'brochure_email'}].concat(global.NO_EMAIL_PERM?[]:[])}:{ok:false,message:'This Manage Dealer session has ended.'})};
    if(b.action==='manage_audit'){ if(global.AUDIT_DOWN) return {ok:true,json:async()=>({ok:false,code:'not_recorded'})}; return {ok:true,json:async()=>({ok:live})}; } }
  if(u==='https://homecareproviderservices.netlify.app/.netlify/functions/golden-proxy'){ global.GPROXY=(global.GPROXY||[]).concat([{h:o.headers,b:JSON.parse(o.body)}]);
    const b=JSON.parse(o.body); const ans=b.code==='PR501-SMA'?{ok:true,price:2499,label:'MSRP',source:'msrp'}:b.code==='GB121'?{ok:true,price:1400,label:'Price',source:'calculated'}:{ok:true,price:null,label:null,source:'none'};
    return {ok:true,json:async()=>ans}; }
  throw new Error('unexpected '+u); };
const CC=require(path.join(__dirname,'..','netlify','functions','_catalog_commercial.js'));
/* catalog files split exactly as the P0 price move did: public half on the site, commercial half in catalog_file_commercial */
const mkFile=rows=>{ const sp=CC.splitCatalogFile(rows); return {public:sp.public,overlay:sp.overlay,identity:CC.catalogSha256(sp.overlay.map(o=>o.h).join('\n'))}; };
global.FILES={ 'ohio-medical':mkFile([{code:'RS-00501',name:'Concentrator',base_price:150,msrp:297.08},{code:'RS-00599',name:'No MSRP part',base_price:20},{code:'RS-00777',name:'MAP only',base_price:60,map:129.95}]) };
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
/* ---- owner 2026-11-12: reference price, dealer offer, savings, MAP enforcement ---- */
const H=async(body,tok)=>{ const r=await B.handler(ev(body,tok)); return {code:r.statusCode,j:JSON.parse(r.body)}; };
const SBP={name:'ErgoSteel Comfort 18"',code:'ES0001',_mfrSlug:'strongback-mobility',manufacturer:'Strongback Mobility'};
const SVP={name:'Saver',code:'SAV1',_mfrSlug:'ovation-medical'};
await t('ES0001: the manufacturer advertised price (MAP $399.95) can be the brochure price — labelled MAP (owner 2026-11-13), never MSRP, no savings',async()=>{
  const r=await H({action:'html',product:SBP,price_basis:'map'},'good'); ok(r.code===200,JSON.stringify(r.j));
  ok(r.j.html.includes('$399.95')&&/advertised price \(MAP\)/.test(r.j.html)&&!/suggested retail/.test(r.j.html)&&!/You save/.test(r.j.html),'map basis'); });
await t('ES0001: an offer below MAP is refused (print and email); at or above MAP it prints with no savings claim',async()=>{
  let r=await H({action:'html',product:Object.assign({},SBP,{quote_price:350}),price_basis:'once'},'good'); ok(r.code===422&&/\$399\.95/.test(r.j.error),JSON.stringify(r.j));
  const n=sent.length; r=await H({action:'email',to:'c1@x.com',product:Object.assign({},SBP,{quote_price:350}),price_basis:'once'},'good'); ok(r.code===422&&sent.length===n,'email refused too');
  r=await H({action:'html',product:Object.assign({},SBP,{quote_price:450}),price_basis:'once'},'good'); ok(r.code===200&&r.j.html.includes('$450.00')&&!/You save/.test(r.j.html)); });
await t('verified MSRP + lower offer: reference, offer, $ and % savings, expiry; compare off hides them; the page cannot fake MSRP',async()=>{
  let r=await H({action:'html',product:Object.assign({},SVP,{quote_price:349.99,msrp:9999}),price_basis:'once',offer_expires:'2026-12-31'},'good'); const h=r.j.html;
  ok(h.includes('$399.99')&&h.includes('$349.99')&&h.includes('$50.00')&&h.includes('12% off MSRP')&&h.includes('Offer valid through December 31, 2026')&&!h.includes('9,999'),h.slice(h.indexOf('class="price"'),h.indexOf('class="price"')+900));
  r=await H({action:'html',product:Object.assign({},SVP,{quote_price:349.99}),price_basis:'once',compare:false},'good'); ok(!/You save/.test(r.j.html)&&!r.j.html.includes('$399.99'),'compare off');
  r=await H({action:'html',product:Object.assign({},SVP,{quote_price:399.99}),price_basis:'once'},'good'); ok(!/You save/.test(r.j.html),'equal → no discount');
  r=await H({action:'html',product:Object.assign({},SVP,{quote_price:450}),price_basis:'once'},'good'); ok(!/You save/.test(r.j.html),'higher → no discount');
  r=await H({action:'html',product:SVP,price_basis:'msrp'},'good'); ok(r.j.html.includes('$399.99')&&!/You save/.test(r.j.html),'MSRP only'); });
await t('an offer that cannot be checked (not signed in) is never printed',async()=>{ const r=await H({action:'html',product:Object.assign({},SVP,{quote_price:300}),price_basis:'once'}); ok(r.code===401,r.code); });
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
const res=async(pr,body,tok,hd)=>{ const r=await B.handler({httpMethod:'POST',headers:Object.assign(tok?{authorization:'Bearer '+tok}:{},hd||{}),body:JSON.stringify(Object.assign({action:'html',product:pr},body||{include_msrp:true}))}); return {code:r.statusCode,j:JSON.parse(r.body)}; };
const PV={'x-hcps-preview':'b'.repeat(48)};
await t('MSRP comes from the master record of a record-authoritative line, never the request (a posted dealer cost is not printed)',async()=>{ const h=await html({name:'W',code:'REC1',_mfrSlug:'bemis',msrp:12.34}); ok(h.includes('$199.99')&&!h.includes('12.34'),'msrp'); });
await t('owner 2026-11-13: Show MSRP with no verified MSRP → a clear message (422 no_msrp), never a silently missing price',async()=>{
  const r=await res({name:'W',code:'RECNONE',_mfrSlug:'bemis',msrp:500}); ok(r.code===422&&r.j.code==='no_msrp'&&/No verified manufacturer MSRP/.test(r.j.error)&&!r.j.html,JSON.stringify(r)); });
await t('a saved override MSRP counts on a line that is not record-authoritative',async()=>{ const h=await html({name:'W',code:'OV1',_mfrSlug:'yuwell',msrp:5}); ok(h.includes('$88.00')&&!h.includes('$5.00')); });
await t('no manufacturer named, or an upgraded configuration → no MSRP (clear message)',async()=>{ ok((await res({name:'W',code:'REC1',msrp:70})).code===422); ok((await res({name:'W',code:'REC1',_mfrSlug:'bemis',_upgrade:true,msrp:70})).code===422); });
/* ---- owner 2026-11-13: the Ohio Medical brochure printed no MSRP (root cause: the catalog file's commercial half was never read here) ---- */
await t('Ohio Medical, staff view-as: the verified MSRP held in the catalog file\'s commercial record prints as MSRP',async()=>{
  const r=await res({name:'Concentrator',code:'RS-00501',_mfrSlug:'ohio-medical',msrp:1},{action:'html',price_basis:'msrp',include_msrp:true},null,PV);
  ok(r.code===200&&r.j.html.includes('$297.08')&&/suggested retail/i.test(r.j.html)&&!r.j.html.includes('$1.00'),JSON.stringify(r).slice(0,300)); });
await t('legacy slug "gce" reads the same Ohio Medical record',async()=>{ const r=await res({name:'C',code:'RS-00501',_mfrSlug:'gce'},{action:'html',price_basis:'msrp'},null,PV); ok(r.code===200&&r.j.html.includes('$297.08'),r.code); });
await t('Ohio Medical part with no MSRP in the record → clear message, nothing derived from dealer cost',async()=>{ const r=await res({name:'X',code:'RS-00599',_mfrSlug:'ohio-medical',msrp:40},{action:'html',price_basis:'msrp'},null,PV); ok(r.code===422&&r.j.code==='no_msrp'&&!JSON.stringify(r.j).includes('40.00'),JSON.stringify(r)); });
await t('MAP-only product: never shown as MSRP (Show MSRP → clear message)',async()=>{ const r=await res({name:'M',code:'RS-00777',_mfrSlug:'ohio-medical'},{action:'html',price_basis:'msrp'},null,PV); ok(r.code===422&&!/129\.95/.test(JSON.stringify(r.j)),JSON.stringify(r)); });
await t('No price chosen → no price block, even when an MSRP exists',async()=>{ const r=await res({name:'C',code:'RS-00501',_mfrSlug:'ohio-medical'},{action:'html',price_basis:'none'},null,PV); ok(r.code===200&&!r.j.html.includes('297.08')&&!/class="price"/.test(r.j.html)); });
await t('a pricing layer that cannot be read → 503 for Show MSRP (fail closed, no guess); other choices still print',async()=>{
  global.FILE_DOWN=true; let r=await res({name:'C',code:'RS-00501',_mfrSlug:'ohio-medical'},{action:'html',price_basis:'msrp'},null,PV); global.FILE_DOWN=false; ok(r.code===503,r.code);
  global.META_DOWN=true; r=await res({name:'C',code:'RS-00501',_mfrSlug:'ohio-medical'},{action:'html',price_basis:'none'},null,PV); global.META_DOWN=false; ok(r.code===200,r.code); });
await t('a catalog file whose commercial record does not match is not priced (503, never a stale figure)',async()=>{
  const keep=FILES['ohio-medical']; FILES['ohio-medical']=Object.assign({},keep,{identity:'0'.repeat(64)}); const r=await res({name:'C',code:'RS-00501',_mfrSlug:'ohio-medical'},{action:'html',price_basis:'msrp'},null,PV); FILES['ohio-medical']=keep; ok(r.code===503,r.code); });
await t('the printed brochure keeps its layout: name, item number and the MSRP sit in the price block of one HTML page',async()=>{
  const r=await res({name:'Concentrator',code:'RS-00501',_mfrSlug:'ohio-medical'},{action:'html',price_basis:'msrp'},null,PV); const h=r.j.html;
  ok(/^<!doctype html>/i.test(h)&&h.includes('Concentrator')&&/<div class="price">[\s\S]*\$297\.08/.test(h)&&/@media print|@page/.test(h),'print document'); });
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
  const n=GPROXY.length; const so=await res({name:'Cloud',code:'PR501-SMA',_mfrSlug:'golden-technologies',msrp:2499}); ok(GPROXY.length===n&&so.code===422&&!JSON.stringify(so.j).includes('2,499'),'signed out → clear message');
  const h2=await ghtml({name:'W',code:'REC1',_mfrSlug:'bemis',msrp_calculated:true}); ok(/suggested retail/i.test(h2)&&!/Retail price/.test(h2),'flag from request');
  const h3=await ghtml({name:'Cloud',code:'PR501-SMA',_mfrSlug:'golden-technologies'},null,{'x-hcps-preview':'a'.repeat(48)}); ok(h3.includes('$2,499.00')&&GPROXY[GPROXY.length-1].h['x-hcps-preview']==='a'.repeat(48),'staff view-as'); });
await t('signed in: Show MSRP prints the official MSRP read on the server; never calculated retail; the page\'s figure ignored',async()=>{ global.DQ=[];
  /* owner 2026-11-13: "Show MSRP" never prints a figure derived from dealer cost on a non-Golden line — clear message instead */
  const c=await res({name:'W',code:'CALC1',_mfrSlug:'ovation-medical',msrp:1.11},null,'good'); ok(c.code===422&&c.j.code==='no_msrp'&&!JSON.stringify(c.j).includes('80.00'),'calculated is not an MSRP');
  ok(DQ[0].b.action==='default_retail'&&DQ[0].b.manufacturer==='ovation-medical'&&DQ[0].h.authorization==='Bearer good','server call with the dealer sign-in');
  const h2=await ghtml({name:'W',code:'REC1',_mfrSlug:'bemis'},'good'); ok(h2.includes('$199.99')&&/suggested retail/i.test(h2),'official MSRP');
  const n3=await res({name:'W',code:'NONE1',_mfrSlug:'bemis',msrp:50},null,'good'); ok(n3.code===422&&!JSON.stringify(n3.j).includes('50.00'),'clear message when there is no price'); });
/* ---- Manage Dealer (owner 2026-11-13): branded for the managed location, MAP via the session, email confirmed + recorded ---- */
const MG='Bearer manage:'+'e'.repeat(64);
const mres=async(body,auth)=>{ const r=await B.handler({httpMethod:'POST',headers:{authorization:auth||MG},body:JSON.stringify(body)}); return {code:r.statusCode,j:JSON.parse(r.body)}; };
await t('manage: the brochure is branded for the managed location; MAP / MSRP come through the session (server reads, never the page)',async()=>{ global.DQ=[];
  const r=await mres({action:'html',product:SBP,price_basis:'map'}); ok(r.code===200&&r.j.html.includes('$399.95')&&r.j.html.includes('Acme &lt;Branch&gt;'),JSON.stringify(r.j).slice(0,200));
  ok(DQ[0]&&DQ[0].h.authorization===MG,'default_retail asked with the session'); });
await t('manage: an ended session is refused (401), nothing rendered for it',async()=>{ const r=await mres({action:'html',product:P},'Bearer manage:'+'f'.repeat(64)); ok(r.code===401,r.code); });
await t('manage: email needs its own confirmation (428); then begin recorded → sent → done; replies go to the DEALER, never staff',async()=>{ SENDS.length=0; global.MAUTH=[]; const n=sent.length;
  let r=await mres({action:'email',product:P,to:'cust@x.com'}); ok(r.code===428&&sent.length===n,'unconfirmed');
  r=await mres({action:'email',product:P,to:'cust@x.com',manage_confirm:'email'}); ok(r.code===200&&sent.length===n+1,JSON.stringify(r));
  const m=sent[sent.length-1]; ok(m.reply_to==='br@acme.test'&&!/angelo/.test(JSON.stringify(m)),'reply-to the dealer: '+m.reply_to);
  ok(MAUTH.filter(x=>x.action==='manage_audit').map(x=>x.audit.phase).join(',')==='begin,done',MAUTH.map(x=>x.action+':'+(x.audit&&x.audit.phase)).join(',')); });
await t('manage: no begin record → no email (503)',async()=>{ SENDS.length=0; const n=sent.length; global.AUDIT_DOWN=true; const r=await mres({action:'email',product:P,to:'cust2@x.com',manage_confirm:'email'}); global.AUDIT_DOWN=false; ok(r.code===503&&sent.length===n,r.code); });
await t('staff View as Dealer: the MAP choice works — read through the preview token (default_retail only), labelled MAP',async()=>{ global.DQ=[];
  const r=await res(SBP,{action:'html',price_basis:'map'},null,{'x-hcps-preview':'c'.repeat(48)}); ok(r.code===200&&r.j.html.includes('$399.95')&&/advertised price \(MAP\)/.test(r.j.html),JSON.stringify(r.j).slice(0,160));
  ok(DQ[0]&&DQ[0].h.authorization==='Bearer preview:'+'c'.repeat(48),'asked with the preview token'); });
/* ---- owner 2026-11-14: the dealer is the seller on every dealer brochure ---- */
await t('View as Dealer: the brochure is branded for the previewed location (logo, name, address, phone) — never HCPS as seller',async()=>{
  const r=await B.handler(Object.assign(ev({action:'html',product:P},null),{headers:{'x-hcps-preview':'c'.repeat(48)}})); const h=JSON.parse(r.body).html;
  ok(h.includes('Presented by <b>Acme &lt;Branch&gt;</b>')&&h.includes('https://cdn.acme.test/logo.png')&&h.includes('2 Side St')&&h.includes('Xenia, OH 45385')&&h.includes('555-0200'),'brand: '+h.slice(-900));
  ok(!h.includes('Provided by HomeCare Provider Services'),'HCPS not the seller'); });
await t('View as Dealer: an expired or unknown preview token is not a dealer (HCPS handout), and a preview can never email',async()=>{
  for(const pv of ['e'.repeat(48),'f'.repeat(48)]){ const h=JSON.parse((await B.handler(Object.assign(ev({action:'html',product:P},null),{headers:{'x-hcps-preview':pv}}))).body).html; ok(!h.includes('Presented by'),pv[0]); }
  const n=sent.length; const r=await B.handler(Object.assign(ev({action:'email',product:P,to:'c@x.com'},null),{headers:{'x-hcps-preview':'c'.repeat(48)}})); ok(r.statusCode===401&&sent.length===n,'no email '+r.statusCode); });
await t('a branch that has not filled in its phone / email / website / logo uses its head office\'s — its own name and address stay',async()=>{
  global.D_PATCH={d1:{phone:null,email:null}}; const h=JSON.parse((await B.handler(ev({action:'html',product:P},'good'))).body).html; global.D_PATCH=null;
  ok(h.includes('555-0100')&&h.includes('hq@acme.test')&&h.includes('acme.test')&&h.includes('2 Side St')&&h.includes('Acme &lt;Branch&gt;'),'fallback'); });
await t('a dealer with no logo anywhere: a clear text identity, no HCPS logo as the seller',async()=>{
  global.D_PATCH={hq:{logo_url:null}}; const h=JSON.parse((await B.handler(ev({action:'html',product:Object.assign({},P,{hcps_logo:'https://hcps.test/logo.png'})},'good'))).body).html; global.D_PATCH=null;
  ok(h.includes('Presented by <b>Acme &lt;Branch&gt;</b>')&&!h.includes('class="dlogo"')&&!h.includes('https://hcps.test/logo.png'),'text identity'); });
await t('the user\'s own offer wording, price, savings and expiry are printed as entered (branding changes nothing else)',async()=>{
  const plain=JSON.parse((await B.handler(ev({action:'html',product:P},null))).body).html, br=JSON.parse((await B.handler(ev({action:'html',product:P},'good'))).body).html;
  const body=x=>x.replace(/<title>[^<]*<\/title>/,'').replace(/<div class="mhead">[\s\S]*?<\/div>\s*<\/div>/,'').replace(/<div class="foot[\s\S]*$/,'').replace(/<div class="spacer">[\s\S]*?<\/div>/,'');
  ok(body(plain)===body(br),'only the header / footer differ'); });
console.log(`brochure auth: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
