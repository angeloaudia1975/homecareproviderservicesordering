/* 2.8 — the old Partner 360 admin is contained, not deleted.
   Every page in public/admin is redirected to the main HCPS admin; the new redirects are
   temporary (302) and forced; the backend functions they called are still present. */
const fs=require('fs'), path=require('path');
const ROOT=process.env.SHOP_ROOT||path.join(__dirname,'..');
const toml=fs.readFileSync(path.join(ROOT,'netlify.toml'),'utf8').replace(/\r\n/g,'\n');
const blocks=toml.split('[[redirects]]').slice(1).map(b=>({
  from:(/from\s*=\s*"([^"]+)"/.exec(b)||[])[1], to:(/to\s*=\s*"([^"]+)"/.exec(b)||[])[1],
  status:Number((/status\s*=\s*(\d+)/.exec(b)||[])[1]), force:/force\s*=\s*true/.test(b)}));
const by={}; blocks.forEach(r=>{ by[r.from]=r; });
let fail=0; const ok=(c,m)=>{ console.log((c?'ok  ':'FAIL')+' '+m); if(!c) fail++; };
const pages=fs.readdirSync(path.join(ROOT,'public','admin'));
pages.forEach(p=>{ const r=by['/admin/'+p];
  ok(!!r && r.force && /^https:\/\/homecareproviderservices\.netlify\.app\/admin\//.test(r.to),'/admin/'+p+' → main admin'); });
['/admin','/admin/'].forEach(f=>ok(by[f]&&by[f].force&&by[f].status===302,f+' → main admin (302)'));
blocks.filter(r=>/^\/admin\//.test(r.from) && !/product-content-review/.test(r.from)).forEach(r=>ok(r.status===302,r.from+' is temporary (302)'));
['catalog-api.js','product-content.js','content-scrape.js','home-api.js','dealers-api.js'].forEach(f=>
  ok(fs.existsSync(path.join(ROOT,'netlify','functions',f)),'function kept: '+f));
console.log(fail?`\n${fail} FAILED`:'\nALL PASS'); process.exit(fail?1:0);
