const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const SRC=process.env.SHOP||path.join(__dirname,'..','public','index.html'), src=fs.readFileSync(SRC,'utf8');
const M=[
 ['added product loses its line', "      const row={manufacturer:slug,code:c.code,", "      const row={code:c.code,"],
 ['catalog text wins again', "          if(pg.description) p.description=pg.description;", "          if(!p.description && pg.description) p.description=pg.description;"],
 ['note only with a table', "          if(pg.sizing_note) p._sizingNote=pg.sizing_note;", ""],
 ['Off ignored', "          if(!pageBySku[c] && sx && (sx.disabled===true ||", "          if(false && sx && (sx.disabled===true ||"],
 ['Off SKUs not filtered', "      prods=prods.filter(p=>!skuOff[String(p.code||'').trim().toUpperCase()]);\n", "\n"],
 ['note-only section not rendered', ":(p._sizingNote?`<div class=\"pd-sect\"><h2>Sizing</h2>", ":(false?`<div class=\"pd-sect\"><h2>Sizing</h2>"],
];
let surv=0; const tmp=path.join(os.tmpdir(),'shopcontent-mut.html');
for(const [n,f,t] of M){ const c=src.split(f).length-1; if(c!==1){console.log(`BAD ANCHOR(${c}) ${n}`);surv++;continue;}
  fs.writeFileSync(tmp,src.replace(f,t));
  let k=false; try{execFileSync('node',[path.join(__dirname,process.env.SC_TEST||'shopcontent.test.js'),tmp],{stdio:'pipe'});}catch(e){k=true;}
  console.log((k?'killed  ':'SURVIVED')+' '+n); if(!k)surv++; }
console.log(surv?`${surv} survived`:'all mutants killed'); process.exit(surv?1:0);
