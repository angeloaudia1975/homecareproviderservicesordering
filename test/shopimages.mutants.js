const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const SRC=process.env.SHOP||path.join(__dirname,'..','public','index.html'), src=fs.readFileSync(SRC,'utf8');
const M=[
 ['sku photo ignored', "  const hero=(sx&&s(sx.image))||primary;", "  const hero=primary;"],
 ['no-primary ignores page image', "  if(i<0) i=g.findIndex(x=>s(x.url)===s(pg&&pg.image));", "  if(i<0) i=g.length?0:-1;"],
 ['page image outside gallery ignored', "(s(pg&&pg.image)||(g.length?s(g[0].url):''))", "((g.length?s(g[0].url):'')||s(pg&&pg.image))"],
 ['product photo dropped from a SKU-photo page', "  if(primary && primary!==hero && !thumbs.some(t=>t.url===primary)) thumbs.unshift({url:primary,caption:''});", ""],
 ['hero not applied', "            if(pi.hero) p.image=pi.hero;", ""],
 ['legacy overlay back', "    prods=prods.map(p=>{ const pa=om[p.code]; if(!pa) return p; const merged={...p};", "    try{ const li=await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/product_images?manufacturer=eq.x&select=code,url`).then(x=>x.json()); li.forEach(r=>{ const q=prods.find(p=>p.code===r.code); if(q) q.image=r.url; }); }catch(e){}\n    prods=prods.map(p=>{ const pa=om[p.code]; if(!pa) return p; const merged={...p};"],
];
let surv=0; const tmp=path.join(os.tmpdir(),'shopimg-mut.html');
for(const [n,f,t] of M){ const c=src.split(f).length-1; if(c!==1){console.log(`BAD ANCHOR(${c}) ${n}`);surv++;continue;}
  fs.writeFileSync(tmp,src.replace(f,t));
  let k=false; try{execFileSync('node',[path.join(__dirname,process.env.SHOPIMG_TEST||'shopimages.test.js'),tmp],{stdio:'pipe'});}catch(e){k=true;}
  console.log((k?'killed  ':'SURVIVED')+' '+n); if(!k)surv++; }
console.log(surv?`${surv} survived`:'all mutants killed'); process.exit(surv?1:0);
