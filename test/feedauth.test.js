/* 2.1 — executes the REAL applyMasterPrices lifted from the shop page, inside a scope
   built the way a browser builds it: AUTH is a top-level const, window has no AUTH. */
const fs=require('fs');
const SRC=process.argv[2]||require('path').join(__dirname,'..','public','index.html');
const html=fs.readFileSync(SRC,'utf8');
const a=html.indexOf('const MASTER_PRICES_ENABLED'), b=html.indexOf('async function loadProducts(slug){');
if(a<0||b<0||b<a){ console.log('LIFT FAILED'); process.exit(2); }
const body=html.slice(a,b);
function build({auth, feed, httpStatus=200}){
  const calls=[];
  const fetchStub=async(url,opts)=>{ calls.push({url,headers:(opts&&opts.headers)||{}}); return {ok:httpStatus===200,status:httpStatus,json:async()=>feed}; };
  const window={};               // a browser window: a top-level const never lands here
  const f=new Function('window','fetch','console','AUTH_INIT',
    'const AUTH=AUTH_INIT; const PREVIEW=null;\n'+body+'\nreturn {applyMasterPrices, CATALOG_SOURCE};');
  const M=f(window,fetchStub,{warn(){}},auth);
  return Object.assign(M,{calls});
}
const prods=()=>[{code:'2001',base_price:100,msrp:200,map:null,tiers:null},{code:'2002',base_price:50,msrp:100}];
let fail=0; const ok=(c,m)=>{ console.log((c?'ok  ':'FAIL')+' '+m); if(!c) fail++; };
(async()=>{
  const signedIn={session:{access_token:'tok-123'},status:'approved'};
  // 1. a signed-in dealer reaches the feed, with their token
  let M=build({auth:signedIn, feed:{migrated:true,authoritative:false,authority_note:'legacy',skus:[{code:'2001',base_price:110},{code:'2002',base_price:50}]}});
  let p=prods(); await M.applyMasterPrices('climbing-steps',p);
  ok(M.calls.length===1,'signed-in session fetches the feed');
  ok(M.calls[0]&&M.calls[0].headers.authorization==='Bearer tok-123','sends the dealer token');
  const s=M.CATALOG_SOURCE['climbing-steps'];
  ok(s.compared===true && s.source==='layers','not authoritative: compared, layers stand');
  ok(p[0].base_price===100,'not authoritative: legacy price untouched');
  ok(s.differences===1 && s.diffs[0].record===110 && s.diffs[0].layers===100,'difference reported');
  // 2. authoritative line uses the record (behaviour preserved for Phase 3)
  M=build({auth:signedIn, feed:{migrated:true,authoritative:true,skus:[{code:'2001',base_price:110}]}});
  p=prods(); await M.applyMasterPrices('x',p);
  ok(p[0].base_price===110 && M.CATALOG_SOURCE.x.source==='record','authoritative line uses the record');
  // 3. not migrated
  M=build({auth:signedIn, feed:{migrated:false,skus:[]}});
  p=prods(); await M.applyMasterPrices('strongback-mobility',p);
  ok(/not been migrated/.test(M.CATALOG_SOURCE['strongback-mobility'].reason) && p[0].base_price===100,'unmigrated line says so, prices untouched');
  // 4. anonymous visitor never calls the feed
  M=build({auth:{session:null,status:'anon'}, feed:{}});
  p=prods(); await M.applyMasterPrices('y',p);
  ok(M.calls.length===0 && /no dealer session/.test(M.CATALOG_SOURCE.y.reason),'anonymous: no feed call');
  // 5. feed error leaves the layers
  M=build({auth:signedIn, feed:{}, httpStatus:403});
  p=prods(); await M.applyMasterPrices('z',p);
  ok(/HTTP 403/.test(M.CATALOG_SOURCE.z.reason) && p[0].base_price===100,'feed refusal falls back to layers');
  console.log(fail?`\n${fail} FAILED`:'\nALL PASS'); process.exit(fail?1:0);
})();
