const fs=require('fs'),{execFileSync}=require('child_process');
const path=require('path'),os=require('os'); const SRC=path.join(__dirname,'..','public','index.html'), src=fs.readFileSync(SRC,'utf8');
const M=[
 ['back to window.AUTH',"const tok = (typeof AUTH !== 'undefined' && AUTH && AUTH.session","const tok = (window.AUTH && AUTH.session"],
 ['token dropped from header',"const headers = tok ? { authorization: 'Bearer ' + tok }","const headers = tok ? { authorization: 'Bearer ' }"],
 ['authority ignores the line flag',"const authoritative = MASTER_PRICES_ENABLED === true && feed.authoritative === true;","const authoritative = MASTER_PRICES_ENABLED === true;"],
 ['layers overwritten when not authoritative',"        if(authoritative) p[k] = m[k];\n","        p[k] = m[k];\n"],
 ['unmigrated line not detected',"if(!feed || feed.migrated !== true)","if(!feed)"],
];
let surv=0;
for(const [n,f,t] of M){ const c=src.split(f).length-1; if(c!==1){console.log(`BAD ANCHOR(${c}) ${n}`);surv++;continue;}
  fs.writeFileSync(path.join(os.tmpdir(),'feedauth-mut.html'),src.replace(f,t));
  let k=false; try{execFileSync('node',[path.join(__dirname,'feedauth.test.js'),path.join(os.tmpdir(),'feedauth-mut.html')],{stdio:'pipe'});}catch(e){k=true;}
  console.log((k?'killed  ':'SURVIVED')+' '+n); if(!k)surv++; }
console.log(surv?`${surv} survived`:'all mutants killed'); process.exit(surv?1:0);
