/* Mutants for the per-page content rule: each must make test/per-page-content.test.js fail. */
const fs=require('fs'), path=require('path'), os=require('os'), {execFileSync}=require('child_process');
const SRC=path.join(__dirname,'..','public','index.html'); const html=fs.readFileSync(SRC,'utf8');
const M=[
  ['no SKU conflict check', "if((Array.isArray(st.skus)?st.skus:[]).some(sx=>claimed.has(NC(sx)))) continue;", ""],
  ['no variant-group conflict check', "if(String(st.variant_group||'').split('|').some(g=>g.trim()&&groups.has(g.trim()))) continue;", ""],
  ['no page_key conflict check', "if(!st||pages[k]||st.disabled===true) continue;", "if(!st||st.disabled===true) continue;"],
  ['switched-off static page added', "if(!st||pages[k]||st.disabled===true) continue;", "if(!st||pages[k]) continue;"],
  ['invisible static page added', "if(CONFIG.CONTENT_APPROVED_ONLY && !VISIBLE_STATUSES.includes(st.status)) continue;", ""],
  ['per-page merge off', "if(pages&&_fromDb){ try{", "if(false){ try{"],
];
let killed=0;
for(const [n,a,b] of M){ if(html.split(a).length!==2){ console.log('ANCHOR MISSING '+n); continue; }
  const f=path.join(os.tmpdir(),'ppc-'+process.pid+'.html'); fs.writeFileSync(f,html.replace(a,b));
  let dead=false; try{ execFileSync('node',[path.join(__dirname,'per-page-content.test.js'),f],{stdio:'ignore'}); }catch(e){ dead=true; }
  console.log((dead?'killed  ':'SURVIVED ')+n); if(dead) killed++; fs.unlinkSync(f); }
console.log(`${killed}/${M.length} killed`); process.exit(killed===M.length?0:1);
