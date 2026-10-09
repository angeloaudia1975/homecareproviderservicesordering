/* 2.4b — the storefront's image rule. Executes the REAL mergeCatalogEdits (and everything it
   calls through applyMasterPrices) lifted from the shop page, with Supabase answered by a stub. */
const fs=require('fs');
const SRC=process.argv[2]||process.env.SHOP||require('path').join(__dirname,'..','public','index.html');
const html=fs.readFileSync(SRC,'utf8');
const a1=html.indexOf('/* Pure. The same rule as images-api.js'), a1b=html.indexOf('async function mergeCatalogEdits(slug, prods){');
const start=a1>=0?a1:a1b, end=html.indexOf('async function loadProducts(slug){');
const c1=html.indexOf('const COLOR_SUFFIX='), c2=html.indexOf('/* ---------- render tabs');
if(start<0||end<0||c1<0||c2<0) { console.log('LIFT FAILED'); process.exit(2); }
const body=html.slice(start,end)+'\n'+html.slice(c1,c2);
function shop(tables){
  const calls=[];
  const fetchStub=async(url)=>{ url=String(url); calls.push(url);
    const m=/rest\/v1\/([a-z_]+)\?/.exec(url); const t=m&&m[1];
    return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify((tables||{})[t]||[]))}; };
  const f=new Function('fetch','window','console','document',
    `const CONFIG={SUPABASE_URL:'https://db.test',SUPABASE_ANON:'anon',CONTENT_APPROVED_ONLY:true};
     const state={manufacturers:[{slug:'ovation-medical'}]}; const AUTH={session:null,status:'anon'}; const PREVIEW=null;
     ${body}
     return {mergeCatalogEdits, pageImageFor:typeof pageImageFor==='function'?pageImageFor:null};`);
  return Object.assign(f(fetchStub,{},{warn(){},log(){}},{}),{calls});
}
let fail=0; const ok=(c,m)=>{ console.log((c?'ok  ':'FAIL')+' '+m); if(!c) fail++; };
const pg=(k,skus,x)=>Object.assign({page_key:k,status:'published',name:k,skus:skus.map(s=>typeof s==='string'?{sku:s}:s),image:null,images_gallery:[]},x||{});
(async()=>{
  const base=()=>[{code:'A1',name:'a',image:'/assets/a1.jpg',base_price:1},{code:'B1',base_price:1},{code:'B2',base_price:1},{code:'C1',image:'/assets/c1.jpg',base_price:1},{code:'D1',base_price:1},{code:'E1',base_price:1},{code:'E2',base_price:1},{code:'F1',image:'/assets/f1.jpg',base_price:1},{code:'G1',base_price:1}];
  const T={product_images:[{code:'A1',url:'LEGACY-A1.jpg'},{code:'C1',url:'LEGACY-C1.jpg'}],
    product_overrides:[{code:'D1',patch:{image:'OV-D1.jpg'}}],
    product_content:[pg('a',['A1'],{images_gallery:[{url:'g1.jpg'},{url:'PRIMARY.jpg',primary:true}],image:'PRIMARY.jpg'}),
                     pg('b',[{sku:'B1',image:'B1-OWN.jpg'},'B2'],{images_gallery:[{url:'b-x.jpg'},{url:'b-main.jpg'}],image:'b-main.jpg'}),
                     pg('e',[{sku:'E1',image:'E1-OWN.jpg'},'E2'],{image:'e-only.jpg'}),
                     pg('f',['F1'],{images_gallery:[{url:'f-g1.jpg'},{url:'f-g2.jpg'}],image:'f-page.jpg'}),
                     pg('g',['G1'],{images_gallery:[{url:'g-first.jpg'},{url:'g-second.jpg'}],image:null})]};
  const S=shop(T); const out=await S.mergeCatalogEdits('ovation-medical',base());
  const by=Object.fromEntries(out.map(p=>[p.code,p]));
  ok(!S.calls.some(u=>u.includes('product_images')),'the legacy image table is not read');
  ok(by.A1.image==='PRIMARY.jpg','page primary is the hero (not the legacy upload, not the file)');
  ok((by.A1.media||[]).map(m=>m.url).join()==='g1.jpg','the rest of the gallery are thumbnails');
  ok(by.B2.image==='b-main.jpg','gallery without a primary honours the page image');
  ok(by.F1.image==='f-page.jpg','no primary flagged: a page image outside the gallery is the photo (what dealers were shown)');
  ok(by.G1.image==='g-first.jpg','no primary flagged and no page image: the gallery\'s first photo');
  ok(by.B1.image==='B1-OWN.jpg','a SKU with its own photo shows it');
  ok((by.B1.media||[]).some(m=>m.url==='b-main.jpg'),'…and the product photo stays in its thumbnails');
  ok(by.E1.image==='E1-OWN.jpg' && (by.E1.media||[]).some(m=>m.url==='e-only.jpg'),'page with only an image: a SKU photo keeps the product photo as a thumbnail');
  ok(by.C1.image==='/assets/c1.jpg','no page: catalog file image (legacy upload ignored)');
  ok(by.D1.image==='OV-D1.jpg','no page: catalog override photo');
  console.log(fail?`\n${fail} FAILED`:'\nALL PASS'); process.exit(fail?1:0);
})();
