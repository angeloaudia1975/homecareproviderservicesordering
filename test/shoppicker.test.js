/* 2.6 (shop) — the picker a product page opens is that product's SKUs, exactly the card's.
   Runs the shop's REAL picker functions (extracted verbatim) and checks openProductDetail keys
   its variant list the same way the card does (groupKeyOf), in code, not comments. */
const fs=require('fs'), path=require('path');
const SRC=process.argv[2]||path.join(__dirname,'..','public','index.html');
const html=fs.readFileSync(SRC,'utf8');
const ex=require(process.env.EXTRACT||path.join(__dirname,'extract-picker.js'));
const P=new Function(ex.extract(html)+';return {groupKeyOf,optionAxes,optionAxesOf,variantLabel,resolveVariant,sortVariants};')();
let fail=0; const ok=(c,m)=>{ console.log((c?'ok  ':'FAIL')+' '+m); if(!c) fail++; };
const i=html.indexOf('window.openProductDetail = async function'); const code=html.slice(i,i+3000).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const m=/const gk=([^;]+);\s*const variants=sortVariants\(\(state\.products\|\|\[\]\)\.filter\(x=>([^)]+(?:\)[^)]*)?)\)\);/.exec(code);
ok(!!m,'openProductDetail builds its variant list from a key');
const keyFn=new Function('p','groupKeyOf','return '+(m?m[1]:'null')+';');
const sameFn=new Function('x','gk','groupKeyOf','return '+(m?m[2]:'false')+';');
// Casting Tape, live shape: black rolls carry their own catalog groups, all on one page
const sz=['2" x 4 Yd','3" x 4 Yd','4" x 4 Yd','5" x 5 Yd'], col=['Black','Dark Blue','Pink','White'];
const prods=[]; sz.forEach((s,a)=>col.forEach((c,b)=>prods.push({code:'CF'+a+b,name:'Casting Tape – '+s+' '+c,_encPage:'Casting Tape',_pageKey:'casting-tape',group:c==='Black'?'black-'+a:'tape'})));
prods.push({code:'30014',name:'Hybrid Night Splint – Small to Medium',_encPage:'Hybrid Night Splint',_pageKey:'hybrid',group:'HNS'},
           {code:'30016',name:'Hybrid Night Splint – Large to X-Large',_encPage:'Hybrid Night Splint',_pageKey:'hybrid',group:'HNS'},
           {code:'30000S',name:'Hybrid Night Splint Accessory Strap',_encPage:'Hybrid Night Splint Accessory Strap',_pageKey:'strap',group:'HNS'});
const picker=p=>{ const gk=keyFn(p,P.groupKeyOf); return P.sortVariants(prods.filter(x=>sameFn(x,gk,P.groupKeyOf))); };
const tape=picker(prods.find(p=>p.code==='CF00')); const AX=P.optionAxes(tape);
ok(tape.length===16,'casting tape picker offers all 16 rolls (got '+tape.length+')');
ok((AX.varying.Color||[]).includes('Black') && (AX.varying.Size||[]).length===4,'black is a colour choice; four sizes');
ok(picker(prods.find(p=>p.code==='30014')).map(p=>p.code).join()==='30014,30016','the splint picker does not offer the strap');
ok(picker(prods.find(p=>p.code==='30000S')).length===1,'the strap opens on its own page');
console.log(fail?`\n${fail} FAILED`:'\nALL PASS'); process.exit(fail?1:0);
