/* Every inline handler in the Partner 360 hub's views (onclick="qAdd()" …) must reach a function on window — the hub's
   code lives inside an IIFE, so a function it never exports does nothing when clicked (found 2026-10-31: Customer MSRP
   Quotes "+ Add" was dead). Also: the hub never takes over a storefront global (swClear belongs to the wall builder). */
const fs=require('fs'),path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const start=H.indexOf('const AUTH_ENDPOINT=API_BASE+"/dealer-auth";'); const end=H.indexOf('window.P360={boot:boot',start);
const blk=H.slice(start,end);
const calls=new Set([...blk.matchAll(/on(?:click|change|input|submit)="([A-Za-z_$][\w$]*)\(/g)].map(m=>m[1]));
const exported=new Set([...H.matchAll(/window\.([\w$]+)\s*=/g)].map(m=>m[1]));
const assign=(blk.match(/Object\.assign\(window,\{([\s\S]*?)\}\)/)||[])[1]||'';
assign.split(',').map(s=>s.trim().split(':')[0]).filter(Boolean).forEach(n=>exported.add(n));
const outside=H.slice(0,start)+H.slice(end);
const topGlobal=n=>new RegExp('\\n(async\\s+)?function\\s+'+n+'\\s*\\(').test(H.slice(0,H.indexOf('<script>\n(function(){\n\n/* ---- config'))||'');
t('every handler the hub views call is reachable on window',()=>{
  const dead=[...calls].filter(n=>n!=='alert'&&!exported.has(n)&&!topGlobal(n));
  if(dead.length) throw new Error('not reachable: '+dead.join(', '));
});
t('the hub does not overwrite the storefront wall builder\'s swClear',()=>{
  if(/\bswClear\s*[,}]/.test(assign)&&!/p360SwClear:swClear/.test(assign)) throw new Error('swClear exported over the global');
  if(/onclick="swClear\(\$\{i\}\)"/.test(blk)) throw new Error('hub zone still calls the global swClear');
});
console.log(`p360 handlers: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
