/* Visible ≠ sellable (agreed 2026-10-08), shop side. Runs the REAL mergeCatalogEdits and
   addToCart lifted from the shop page with Supabase answered by a stub. */
const fs=require('fs');
const SRC=process.argv[2]||process.env.SHOP||require('path').join(__dirname,'..','public','index.html');
const html=fs.readFileSync(SRC,'utf8');
const a1=html.indexOf('/* Pure. The same rule as images-api.js'), a1b=html.indexOf('async function mergeCatalogEdits(slug, prods){');
const start=a1>=0?a1:a1b, end=html.indexOf('async function loadProducts(slug){');
const c1=html.indexOf('const COLOR_SUFFIX='), c2=html.indexOf('/* ---------- render tabs');
const add=html.slice(html.indexOf('function addToCart(p,qty){'), html.indexOf('function cartCount(){'));
const body=html.slice(start,end)+'\n'+html.slice(c1,c2)+'\nconst cartKey=p=>`${p.manufacturer}::${p.code}`;\n'+add;
function shop(tables, mfr){
  const toasts=[], CART=new Map();
  const f=new Function('fetch','window','console','document','toast','CART','updateCart','track',
    `const CONFIG={SUPABASE_URL:'https://db.test',SUPABASE_ANON:'anon',CONTENT_APPROVED_ONLY:true};
     const state={manufacturers:[${JSON.stringify(mfr||{slug:'L'})}]}; const AUTH={session:null,status:'anon'}; const PREVIEW=null;
     ${body}
     return {mergeCatalogEdits, addToCart};`);
  const asked=[];
  const fetchStub=async(url)=>{ const u=String(url); asked.push(u); const m=/rest\/v1\/([a-z_]+)\?/.exec(u); const t=m&&m[1];
    let rows=JSON.parse(JSON.stringify((tables||{})[t]||[]));
    const st=/status=in\.\(([^)]*)\)/.exec(u); if(t==='product_content' && st){ const ok=st[1].split(','); rows=rows.filter(r=>ok.includes(r.status)); }
    return {ok:true,status:200,json:async()=>rows}; };
  const S=f(fetchStub,{},{warn(){},log(){}},{},m=>toasts.push(m),CART,()=>{},()=>{});
  return Object.assign(S,{toasts,CART,asked});
}
let fail=0; const ok=(c,m)=>{ console.log((c?'ok  ':'FAIL')+' '+m); if(!c) fail++; };
const pg=(k,status,skus,x)=>Object.assign({page_key:k,status,name:k,skus,image:null,images_gallery:[]},x||{});
(async()=>{
  const base=()=>['A1','A2','B1','B2','B3','C1'].map(c=>({manufacturer:'L',code:c,name:c,base_price:10}));
  const T={product_content:[pg('a','discontinued',[{sku:'A1'},{sku:'A2'}],{description:'Still documented'}),
                            pg('b','published',[{sku:'B1'},{sku:'B2',status:'discontinued'},{sku:'B3',status:'hidden'}]),
                            pg('c','hidden',[{sku:'C1'}])]};
  const S=shop(T,{slug:'L',enrichedOnly:true}); const out=await S.mergeCatalogEdits('L',base()); const by=Object.fromEntries(out.map(p=>[p.code,p]));
  ok(S.asked.some(u=>/status=in\.\(published,active,discontinued\)/.test(u)),'discontinued pages are loaded (visible)');
  ok(by.A1 && by.A1._discontinued && by.A2._discontinued,'every SKU on a discontinued page is visible and marked not orderable');
  ok(by.A1 && by.A1.description==='Still documented','a discontinued page keeps its content for reference');
  ok(by.B1 && !by.B1._discontinued,'a current SKU stays orderable');
  ok(by.B2 && by.B2._discontinued,'a SKU marked discontinued on a live page is visible, not orderable');
  ok(!by.B3,'a SKU marked hidden is not shown');
  ok(!by.C1,'a hidden page removes its products (enriched-only line)');
  S.addToCart(by.A1,1); ok(S.CART.size===0 && S.toasts.some(m=>/discontinued/.test(m)),'Add to cart refuses a discontinued product');
  S.addToCart(by.B1,1); ok(S.CART.size===1,'a current product can still be added');
  console.log(fail?`\n${fail} FAILED`:'\nALL PASS'); process.exitCode=fail?1:0;
})();
