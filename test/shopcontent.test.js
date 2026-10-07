/* 2.5 (shop) — identity/content rules. Runs the REAL mergeCatalogEdits (through applyMasterPrices)
   lifted from the shop page with Supabase answered by a stub. */
const fs=require('fs');
const SRC=process.argv[2]||process.env.SHOP||require('path').join(__dirname,'..','public','index.html');
const html=fs.readFileSync(SRC,'utf8');
const a1=html.indexOf('/* Pure. The same rule as images-api.js'), a1b=html.indexOf('async function mergeCatalogEdits(slug, prods){');
const start=a1>=0?a1:a1b, end=html.indexOf('async function loadProducts(slug){');
const c1=html.indexOf('const COLOR_SUFFIX='), c2=html.indexOf('/* ---------- render tabs');
const body=html.slice(start,end)+'\n'+html.slice(c1,c2);
function shop(tables, mfr){
  const f=new Function('fetch','window','console','document',
    `const CONFIG={SUPABASE_URL:'https://db.test',SUPABASE_ANON:'anon',CONTENT_APPROVED_ONLY:true};
     const state={manufacturers:[${JSON.stringify(mfr||{slug:'L'})}]}; const AUTH={session:null,status:'anon'}; const PREVIEW=null;
     ${body}
     return {mergeCatalogEdits};`);
  const fetchStub=async(url)=>{ const m=/rest\/v1\/([a-z_]+)\?/.exec(String(url)); const t=m&&m[1];
    return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify((tables||{})[t]||[]))}; };
  return f(fetchStub,{},{warn(){},log(){}},{});
}
let fail=0; const ok=(c,m)=>{ console.log((c?'ok  ':'FAIL')+' '+m); if(!c) fail++; };
const pg=(k,skus,x)=>Object.assign({page_key:k,status:'published',name:k,skus,image:null,images_gallery:[]},x||{});
(async()=>{
  const base=()=>[{code:'A1',name:'a',description:'CATALOG TEXT',base_price:1},{code:'A2',name:'a2',description:'',base_price:1},{code:'B1',base_price:1},{code:'B2',base_price:1},{code:'Z9',description:'ONLY CATALOG',base_price:1}];
  const T={custom_products:[{code:'ADD1',name:'Added',base_price:5,active:true}],product_content:[pg('a',[{sku:'A1'},{sku:'A2'}],{description:'APPROVED TEXT',sizing_note:'Measure the calf.'}),
                            pg('b',[{sku:'B1'},{sku:'B2',disabled:true}],{description:'B'}),
                            pg('c',[{sku:'Z8',status:'discontinued'}])]};
  const out=await shop(T).mergeCatalogEdits('L',base()); const by=Object.fromEntries(out.map(p=>[p.code,p]));
  ok(by.ADD1 && by.ADD1.manufacturer==='L','an added product carries its line');
  ok(by.A1.description==='APPROVED TEXT','the enrichment description replaces the catalog text');
  ok(by.A2.description==='APPROVED TEXT','…and fills a blank');
  ok(by.Z9.description==='ONLY CATALOG','a SKU no page describes keeps the catalog text');
  ok(by.A1._sizingNote==='Measure the calf.','a sizing note travels without a table');
  ok(!by.B2 && !!by.B1,'a SKU switched Off on its page is not offered; its siblings are');
  const html2=html.slice(html.indexOf('    const sizingHtml=')); const line=html2.slice(0,html2.indexOf('\n'));
  ok(/p\._sizingNote\?`<div class="pd-sect"><h2>Sizing<\/h2>/.test(line),'the product page renders a note-only sizing section');
  console.log(fail?`\n${fail} FAILED`:'\nALL PASS'); process.exit(fail?1:0);
})();
