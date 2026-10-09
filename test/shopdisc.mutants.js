const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const SRC=process.env.SHOP||path.join(__dirname,'..','public','index.html'), src=fs.readFileSync(SRC,'utf8');
const M=[
 ['discontinued pages not loaded', "status=in.(${VISIBLE_STATUSES.join(',')})&select=page_key,status,skus,", "status=in.(${LIVE_STATUSES.join(',')})&select=page_key,status,skus,"],
 ['discontinued page orderable', "if(pg && (pg.status==='discontinued' || skuDisc[", "if(pg && (false || skuDisc["],
 ['discontinued SKU orderable', "if(!pageBySku[c] && sx && String(sx.status||'')==='discontinued') skuDisc[c]=true;", ""],
 ['discontinued SKU hidden again', "(sx.disabled===true || String(sx.status||'')==='hidden')) skuOff[c]=true;", "(sx.disabled===true || ['hidden','discontinued'].includes(String(sx.status||'')))) skuOff[c]=true;"],
 ['hidden SKU shown', "(sx.disabled===true || String(sx.status||'')==='hidden')) skuOff[c]=true;", "(sx.disabled===true)) skuOff[c]=true;"],
 ['add-to-cart guard removed', "  if(p && p._discontinued){ toast(", "  if(false){ toast("],
];
let surv=0; const tmp=path.join(os.tmpdir(),'shopdisc-mut.html');
for(const [n,f,t] of M){ const c=src.split(f).length-1; if(c!==1){console.log(`BAD ANCHOR(${c}) ${n}`);surv++;continue;}
  fs.writeFileSync(tmp,src.replace(f,t));
  let k=false; try{execFileSync('node',[path.join(__dirname,process.env.SHOPDISC_TEST||'shopdisc.test.js'),tmp],{stdio:'pipe'});}catch(e){k=true;}
  console.log((k?'killed  ':'SURVIVED')+' '+n); if(!k)surv++; }
console.log(surv?`${surv} survived`:'all mutants killed'); process.exit(surv?1:0);
