"use strict";
/* Hash-guarded, idempotent source preparation; no network or ref changes. */
(function prepareVictoriaProductSearch(){
  "use strict";
  const fs=require("node:fs"),crypto=require("node:crypto");
  const hash=s=>{const bytes=Buffer.from(s,"utf8");return crypto.createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex");};
  let src=fs.readFileSync("public/index.html","utf8"),panel=fs.readFileSync("public/assets/dealer-victoria-panel.js","utf8");
  const oldIndex=hash(src),oldPanel=hash(panel),newIndex="71720b3008f87b387a77debbbf7bcfd8bf57befe",newPanel="da2f727b5bec7ebc9deaba9721dda7e88da82b9e";
  if(!["835b811649dcd2b98416f4f8e582d233f1e41b00",newIndex].includes(oldIndex)||!["d1c037f64eb1edb9b39e0f5c480930c57d25911b",newPanel].includes(oldPanel))throw new Error("Source changed; refuse to overwrite another change.");
  function rep(before,after){const at=src.indexOf(before);if(at<0||at!==src.lastIndexOf(before))throw new Error("Replacement must match exactly once.");src=src.replace(before,()=>after);}
  if(oldIndex!==newIndex){
    rep("  let _gsAll=null,_gsTimer=null,_gsLoading=null,_gsQ='';","  let _gsAll=null,_gsTimer=null,_gsLoading=null,_gsQ='',_gsFailed=new Set();");
    rep("    ['bed','hospital bed','hi-low','hi low'],['mattress','overlay','pressure redistribution'],['cushion','seat cushion','pad'],","    ['bed','hospital bed','hi-low','hi low'],['mattress','overlay','pressure redistribution'],['cushion','seat cushion','pad'],\n    ['arm','armrest','arm rest'],['footrest','foot rest'],['legrest','leg rest'],['anti tipper','anti tipping','anti tip','antitipper'],");
    rep("  function gsTerms(q){\n    const n=gsDehyphen(gsNorm(q)); if(!n) return [];",String.raw`  /* Normalize spoken model names before filler removal ("K one" must not lose "one"). This is catalog
     model matching only; it never assigns a billing code or infers a wheelchair class from its weight. */
  const GS_K_WORDS={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
  const gsSpoken=q=>String(q==null?'':q).toLowerCase()
    .replace(/\b(?:k|kay)[\s-]+(one|two|three|four|five|six|seven|eight|nine|[1-9])\b/g,(_,n)=>'k'+(GS_K_WORDS[n]||n))
    .replace(/\bk([1-9])s\b/g,'k$1')
    .replace(/\bwheel\s+chairs?\b/g,'wheelchair');
  function gsTerms(q){
    const n=gsDehyphen(gsNorm(gsSpoken(q))); if(!n) return [];`);
    rep("'which','are','is','there','of','to','that','those','these','them']);","'which','are','is','there','of','to','that','those','these','them','with','and','can','could','would','am']);");
    rep("  function gsIndex(x){ const p=x.p; const n=gsNorm([p.name,groupDisplayName(p),p.code,p.category,p.subcategory,p.brand,x.mname].filter(Boolean).join(' ')); const d=gsDehyphen(n); return d===n?n:n+' | '+d; }",`  function gsIndex(x){ const p=x.p;
    /* Only the product facts already merged for this dealer: no extra catalog, price or draft-content fetch. */
    const features=Array.isArray(p._features)?p._features.filter(f=>typeof f==='string').join(' '):'';
    const n=gsNorm([p.name,groupDisplayName(p),p.code,p.category,p.subcategory,p.brand,x.mname,p.description,features].filter(Boolean).join(' '));
    const d=gsDehyphen(n); return d===n?n:n+' | '+d; }
  function gsMatches(x,a){
    /* K1 must not match the DK16 in a K2/K3 SKU; K3 must not match DK30 in a bariatric SKU.
       A model is named as a whole word or starts its item number (K01 is Dalton's K1 prefix). */
    if(/^k[1-9]$/.test(a)){
      const modelText=gsDehyphen(gsNorm([x.p.name,groupDisplayName(x.p)].filter(Boolean).join(' ')));
      return gsWord(modelText,a)||new RegExp('^k0?'+a.slice(1)+'(?=[a-z]|$)').test(gsNorm(x.p.code));
    }
    return x.ix.indexOf(a)>=0;
  }`);
    let a=src.indexOf("  function gsEnsure(onLine){"),b=src.indexOf("  function gsSearch(q){",a);
    rep(src.slice(a,b),String.raw`  function gsEnsure(onLine){
    const key=gsAuthKey();
    if(key!==_gsKey){ _gsKey=key; _gsAll=null; _gsLoading=null; _gsListeners=new Set(); _gsFailed=new Set(); }
    if(onLine) _gsListeners.add(onLine);
    if(_gsAll&&!_gsLoading&&!_gsFailed.size) return Promise.resolve(_gsAll);
    if(_gsLoading) return _gsLoading;
    const wanted=gsLines().filter(m=>!_gsAll||_gsFailed.has(m.slug));
    const all=_gsAll||[]; _gsAll=all; const listeners=_gsListeners;
    _gsFailed=new Set(wanted.map(m=>m.slug));
    const run=Promise.all(wanted.map(m=>Promise.resolve().then(()=>loadLine(m.slug)).then(prods=>{
        if(_gsAll!==all||_gsKey!==key||gsAuthKey()!==key) return; // superseded dealer / lines
        /* loadLine deliberately returns [] without caching a failed load. A genuine loaded-empty line
           has its own array in lineCache. Keep failed lines retryable instead of caching a false zero. */
        const cached=typeof DASH!=='undefined'&&DASH.lineCache&&Object.prototype.hasOwnProperty.call(DASH.lineCache,m.slug)&&Array.isArray(DASH.lineCache[m.slug]);
        if(!Array.isArray(prods)||(!prods.length&&!cached)) return;
        const rows=prods.filter(p=>p&&p.code).map(p=>{const x={p,slug:m.slug,mname:m.name};x.ix=gsIndex(x);return x;});
        all.push(...rows); _gsFailed.delete(m.slug);
        listeners.forEach(f=>{ try{ f(); }catch(e){} });
      }).catch(()=>{}))).then(()=>{ if(_gsLoading===run){ _gsLoading=null; _gsListeners=new Set(); } return all; });
    _gsLoading=run;
    return run;
  }
  function gsStatus(){
    const signedIn=typeof AUTH!=='undefined'&&AUTH&&AUTH.status==='approved';
    const current=signedIn&&_gsKey===gsAuthKey();
    const complete=!!(current&&_gsAll&&!_gsLoading&&!_gsFailed.size);
    return {complete,reason:complete?null:!signedIn?'sign_in_required':'catalog_unavailable',
      unavailable:current?gsLines().filter(m=>_gsFailed.has(m.slug)).map(m=>m.slug):[],
      message:complete?'':!signedIn?'Please sign in again to search your products.':'Your catalog could not be fully loaded. Please try the search again.'};
  }
  window.gsSearchStatus=gsStatus;
  window.gsReset=function(){ _gsAll=null; _gsLoading=null; _gsKey=''; _gsListeners=new Set(); _gsFailed=new Set(); };
  window.gsWarm=function(){ try{ return gsEnsure(); }catch(e){ return null; } };   // Victoria opening: the product index loads before she is asked to search
`);
    rep("      if(!sets.every(alts=>alts.some(a=>x.ix.indexOf(a)>=0))) return;","      if(!sets.every(alts=>alts.some(a=>gsMatches(x,a)))) return;");
    rep("    const allowed=new Set(gsLines().map(m=>m.slug)); let gOk=false; try{ gOk=goldenEntitled(); }catch(e){}\n    _gsAll.forEach(x=>{\n      if(!allowed.has(x.slug)||(isGoldenSlug(x.slug)&&!gOk)) return;","    const allowed=new Set(gsLines().map(m=>m.slug)); let gOk=false; try{ gOk=goldenEntitled(); }catch(e){}\n    const queryWords=gsDehyphen(gsNorm(gsSpoken(q)));\n    const namedLines=gsLines().filter(m=>[m.slug,m.name].filter(Boolean).some(v=>gsWord(queryWords,gsDehyphen(gsNorm(v))))).map(m=>m.slug);\n    _gsAll.forEach(x=>{\n      if(!allowed.has(x.slug)||(isGoldenSlug(x.slug)&&!gOk)||(namedLines.length&&!namedLines.includes(x.slug))) return;");
    rep("      if(!sets.every(alts=>alts.some(a=>gsMatches(x,a)))) return;\n      const code=gsNorm(x.p.code), name=gsNorm(groupDisplayName(x.p)||x.p.name), nm=gsDehyphen(name)+' '+gsDehyphen(gsNorm(x.p.name));","      if(!sets.every(alts=>alts.some(a=>gsMatches(x,a)))) return;\n      const code=gsNorm(x.p.code), name=gsNorm(groupDisplayName(x.p)||x.p.name), nm=gsDehyphen(name)+' '+gsDehyphen(gsNorm(x.p.name));\n      /* A full-electric bed's comparison to a semi-electric one does not change its configuration. */\n      const power=/\\b(semi|full) electric\\b/.exec(queryWords);\n      if(power&&gsWord(nm,(power[1]==='semi'?'full':'semi')+' electric')&&!gsWord(nm,power[0])) return;");
    rep("      const hits=gsSearch(q), loading=!!_gsLoading||!_gsAll;\n      box.innerHTML=(hits.length?hits.slice(0,8).map(gsRow).join(''):(loading?'':`<div class=\"gsr empty\">No matches for &ldquo;${esc(q)}&rdquo;</div>`))\n        +(loading?`<div class=\"gsr empty\">Searching your lines…</div>`:'')","      const hits=gsSearch(q), loading=!!_gsLoading||!_gsAll, status=gsStatus();\n      box.innerHTML=(hits.length?hits.slice(0,8).map(gsRow).join(''):(loading||!status.complete?'':`<div class=\"gsr empty\">No matches for &ldquo;${esc(q)}&rdquo;</div>`))\n        +(loading?`<div class=\"gsr empty\">Searching your lines…</div>`:!status.complete?`<div class=\"gsr empty\" role=\"status\">${esc(status.message)}</div>`:'')");
    rep("    if(!hits) return;\n    /* The global box searches","    if(!hits||!gsStatus().complete) return; // an unavailable line is not evidence of missing demand\n    /* The global box searches");
    a=src.indexOf("async function dvOpenSearch(q){");b=src.indexOf("/* one of the portal's screens",a);
    rep(src.slice(a,b),String.raw`async function dvOpenSearch(q){
  if(typeof showShopSearch!=="function"||typeof window.gsSearchAll!=="function") return {ok:false,reason:"search_unavailable"};
  q=String(q||"").trim().slice(0,80);
  let hits; try{ hits=await window.gsSearchAll(q); }catch(e){ return {ok:false,reason:"catalog_unavailable",message:"Your catalog could not be loaded. Please try the search again."}; }
  let status=typeof window.gsSearchStatus==="function"?window.gsSearchStatus():{complete:true};
  if(!status.complete) return {ok:false,reason:status.reason,message:status.message,query:q};
  const one=hits.length===1||(hits.length>1&&hits[0].score===0&&hits[1].score>0);
  if(one){ const x=hits[0].x; const r=await dvOpenProduct(x.slug,x.p.code); if(r&&r.ok) return {ok:true,count:hits.length,query:q,opened:r}; }
  try{ await showShopSearch(q); }catch(e){ return {ok:false,reason:"catalog_unavailable",message:"Your catalog could not be loaded. Please try the search again.",query:q}; }
  for(let i=0;i<60;i++){
    status=typeof window.gsSearchStatus==="function"?window.gsSearchStatus():{complete:true};
    if(!status.complete) return {ok:false,reason:status.reason,message:status.message,query:q};
    const h=document.querySelector(".sl-search .sl-shead h2"); if(h&&state.active===SHOPALL&&SL_Q===q){ const n=parseInt(h.textContent,10);
      if(!isFinite(n)) return {ok:false,reason:"search_unavailable",query:q};
      const names=[...document.querySelectorAll(".sl-search .gsr2 .gst b")].slice(0,3).map(b=>b.textContent.trim());
      return {ok:true,count:n,query:SL_Q,top:names}; } await new Promise(r=>setTimeout(r,150)); }
  return {ok:false,query:q};
}
`);
    a=src.indexOf("async function renderShopSearch(host,seq){");b=src.indexOf("function wireShopLanding(host){",a);const old=src.slice(a,b);let r=old;
    r=r.replace('  const hits=(typeof window.gsSearchAll==="function")?await window.gsSearchAll(q):[];',`  let hits=[], status={complete:false,message:"Your catalog could not be loaded. Please try the search again."};
  try{ if(typeof window.gsSearchAll==="function"){ hits=await window.gsSearchAll(q); status=typeof window.gsSearchStatus==="function"?window.gsSearchStatus():{complete:true}; } }catch(e){}`);
    r=r.replace('`<div><b>${hits.length}</b><span>Results</span></div>`','`<div><b>${status.complete?hits.length:"—"}</b><span>${status.complete?"Results":"Search incomplete"}</span></div>`');
    r=r.replace('${hits.length} result${hits.length===1?"":"s"} for &ldquo;','${status.complete?hits.length+" result"+(hits.length===1?"":"s"):"Search incomplete"} for &ldquo;');
    r=r.replace('      +(hits.length?','      +(!status.complete?`<div class="msg" role="status">${esc(status.message)} <button type="button" class="btn gh" data-sl-retry="1">Try again</button></div>`:"")\n      +(hits.length?');
    r=r.replace('        :`<div class="empty">','        :!status.complete?"":`<div class="empty">');rep(old,r);
    rep('    if(e.target.closest("[data-sl-more]")){ if(host.__slPaintMore) host.__slPaintMore(); return; }','    if(e.target.closest("[data-sl-more]")){ if(host.__slPaintMore) host.__slPaintMore(); return; }\n    if(e.target.closest("[data-sl-retry]")){ e.preventDefault(); selectManufacturer(SHOPALL); return; }');
  }
  if(oldPanel!==newPanel){
    const changes=[
      ["          const ok = !!(v && v.ok); const n = ok ? v.count : 0;           checked(ok, !ok ? 'The search for “' + x.query + '” didn\\'t open. Use the search bar at the top of the page.'","          const ok = !!(v && v.ok); const n = ok ? v.count : 0;\n          const searchFailure = v && v.message ? v.message : 'The search didn\\'t open. Please try the search bar at the top of the page.';\n          checked(ok, !ok ? searchFailure"],
      ["          said.push(!ok ? 'The search didn\\'t open. Use the search bar at the top of the page.'","          said.push(!ok ? searchFailure"]
    ];
    for(const [before,after] of changes){const at=panel.indexOf(before);if(at<0||at!==panel.lastIndexOf(before))throw new Error("Panel replacement does not match once");panel=panel.replace(before,()=>after);}
  }
  if(hash(src)!==newIndex||hash(panel)!==newPanel)throw new Error("Generated source differs from the reviewed bytes.");
  if(oldIndex!==newIndex)fs.writeFileSync("public/index.html",src);
  if(oldPanel!==newPanel)fs.writeFileSync("public/assets/dealer-victoria-panel.js",panel);
  console.log("Reviewed Victoria source verified: "+newIndex+" "+newPanel);
})();
