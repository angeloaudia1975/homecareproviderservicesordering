const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const SRC=path.join(__dirname,'..','public','index.html'), src=fs.readFileSync(SRC,'utf8');
const M=[
 ['unknown wiped to none', "    if(!AUTH.prices||typeof AUTH.prices!=='object') AUTH.prices={};\n  } else {", "    AUTH.prices={};\n  } else {"],
 ['flag ignored', "  if(j && j.prices_unavailable){", "  if(false){"],
 ['notice never shown', "  showPricesNotice(!!AUTH.pricesUnavailable);\n}", "}"],
 ['notice never cleared', "  if(!on){ if(el) el.remove(); return; }", "  if(!on){ return; }"],
 ['session bypasses it', "    applyContractPrices(j);   // {\"slug::code\": contractPrice}", "    AUTH.prices=(j.prices&&typeof j.prices==='object')?j.prices:{};   // {\"slug::code\": contractPrice}"],
];
let surv=0; const tmp=path.join(os.tmpdir(),'shopcontract-mut.html');
for(const [n,f,t] of M){ const c=src.split(f).length-1; if(c!==1){console.log(`BAD ANCHOR(${c}) ${n}`);surv++;continue;}
  fs.writeFileSync(tmp,src.replace(f,t));
  let k=false; try{execFileSync('node',[path.join(__dirname,'shopcontract.test.js')],{stdio:'pipe',env:Object.assign({},process.env,{SHOP_HTML:tmp})});}catch(e){k=true;}
  console.log((k?'killed  ':'SURVIVED')+' '+n); if(!k)surv++; }
console.log(surv?`${surv} survived`:'all mutants killed'); process.exit(surv?1:0);
