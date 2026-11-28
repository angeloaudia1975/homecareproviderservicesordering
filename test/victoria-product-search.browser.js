"use strict";
/* Real portal page and published Dalton content; _shop-harness intercepts EVERY request.
   Synthetic dealer only, no prices, sends, orders or live service calls. */
const {chromium,open}=require("./_shop-harness.js");
const assert=require("node:assert/strict");
const {splitCatalogFile}=require("../netlify/functions/_catalog_commercial.js");
const fileOverlay=splitCatalogFile(require("../public/data/dalton.json")).overlay;
let passed=0;
async function check(name,fn){await fn();passed++;console.log("PASS "+name);}
(async()=>{
  const browser=await chromium.launch();
  try{
    for(const [width,height] of [[1280,900],[390,844]]){
      const {ctx,page,seen}=await open(browser,width,height,{
        access:{your_accounts:["dalton"],available:[],request_access:[],golden:"None"},
        realCatalog:true,
        html:source=>source.replace("Object.assign(window,{dvProbe});","Object.assign(window,{dvProbe,dvOpenSearch});")
      });
      try{
        await page.route("**/.netlify/functions/catalog-layers?**",route=>{
          const req=route.request(), query=new URL(req.url()).searchParams;
          if(query.get("manufacturer")!=="dalton") return route.fallback();
          assert.ok(req.headers()["x-hcps-preview"]||req.headers().authorization,"authenticated layer request");
          return route.fulfill({json:{ok:true,identity_sha256:query.get("identity"),file_overlay:fileOverlay,custom_products:[],product_overrides:[]}});
        });
        await page.evaluate(()=>{DASH.lineCache={};window.gsReset();});
        const search=q=>page.evaluate(q=>window.gsSearchAll(q).then(rows=>rows.map(r=>({
          code:r.x.p.code,slug:r.x.slug
        }))),q);
        await check(width+": K3 spoken forms return the same eight catalog models",async()=>{
          const expected=(await search("K3 wheelchair")).map(x=>x.code).sort();
          assert.equal(expected.length,8);
          for(const q of ["K three wheelchairs","K 3 wheelchair","K-3 wheelchair","Dalton K three wheel chairs"]){
            const rows=await search(q);
            assert.deepEqual(rows.map(x=>x.code).sort(),expected,q);
            assert.ok(rows.every(x=>x.slug==="dalton"),q);
          }
          assert.ok(!expected.includes("K07DK30LSPW"));
        });
        await check(width+": K one returns K1 without K2 or K3 substring matches",async()=>{
          const rows=(await search("K one wheelchair")).map(x=>x.code).sort();
          assert.equal(rows.length,8);
          assert.deepEqual(rows,(await search("K1 wheelchair")).map(x=>x.code).sort());
          assert.ok(!rows.includes("K2DK16F"));assert.ok(!rows.includes("K3DK16FTADJ"));
        });
        await check(width+": description and feature words identify the K3",async()=>{
          assert.ok((await search("lightweight wheelchair with adjustable height arms")).some(x=>x.code==="K3DK16FTADJ"));
          const rows=await search("Dalton K3 wheelchair with anti tippers");
          assert.equal(rows.length,6);
          assert.ok(rows.every(x=>/^K3DK(?:16|18|20)/.test(x.code)));
        });
        await check(width+": exact Dalton product references are searchable via the real public-content merge",async()=>{
          const refs=(await search("HCPCS K0001 wheelchair")).map(x=>x.code).sort();
          assert.deepEqual(refs,["K01DK18F15","K01DK18L15"]);
          assert.equal((await search("K0003 wheelchair")).length,0);
          assert.ok((await search("height-adjustable arm wheelchair")).some(x=>x.code==="K3DK16FTADJ"));
        });
        await check(width+": Victoria opens the real Shop results and confirms eight",async()=>{
          const result=await page.evaluate(()=>dvOpenSearch("Dalton K three wheelchairs"));
          assert.equal(result.ok,true);assert.equal(result.count,8);
          assert.ok((await page.locator(".sl-search .sl-shead h2").innerText()).includes("8 results"));
          assert.equal(await page.locator(".sl-search .gsr2").count(),8);
        });
        await check(width+": exact SKU opens and confirms its own product page",async()=>{
          const result=await page.evaluate(()=>dvOpenSearch("K3DK16FTADJ"));
          assert.equal(result.ok,true);assert.equal(result.opened.code,"K3DK16FTADJ");
          assert.equal(await page.locator("#content .pd").getAttribute("data-pd-code"),"K3DK16FTADJ");
        });
        await check(width+": temporary load failure is unavailable and the next search retries",async()=>{
          const result=await page.evaluate(async()=>{
            const original=window.loadLine;let calls=0;
            delete DASH.lineCache.dalton;window.gsReset();
            window.loadLine=async slug=>{
              if(slug==="dalton"&&++calls===1)return [];
              return original(slug);
            };
            try{
              const first=await dvOpenSearch("K3 wheelchair");
              const second=await dvOpenSearch("K3 wheelchair");
              return {first,second,calls};
            }finally{window.loadLine=original;}
          });
          assert.equal(result.first.ok,false);assert.equal(result.first.reason,"catalog_unavailable");
          assert.equal(result.first.count,undefined);
          assert.equal(result.second.ok,true);assert.equal(result.second.count,8);assert.equal(result.calls,2);
        });
        await check(width+": incomplete Shop search explains the failure and Retry recovers",async()=>{
          await page.evaluate(()=>{
            window.__searchOriginalLoad=window.loadLine;
            window.loadLine=async()=>[];DASH.lineCache={};window.gsReset();
          });
          try{
            await page.evaluate(()=>showShopSearch("K3 wheelchair"));
            assert.equal(await page.locator("[data-sl-retry]").count(),1);
            assert.ok((await page.locator(".sl-search .sl-shead h2").innerText()).includes("Search incomplete"));
            assert.equal(await page.locator(".sl-search .empty h3").count(),0);
          }finally{
            await page.evaluate(()=>{window.loadLine=window.__searchOriginalLoad;delete window.__searchOriginalLoad;});
          }
          await page.locator("[data-sl-retry]").click();
          await page.waitForFunction(()=>document.querySelector(".sl-search .sl-shead h2")?.textContent.startsWith("8 results"));
        });
        await check(width+": a real no-match remains a confirmed zero",async()=>{
          const result=await page.evaluate(()=>dvOpenSearch("nonexistentquartzmodel"));
          assert.equal(result.ok,true);assert.equal(result.count,0);
          assert.equal(await page.locator(".sl-search .empty h3").innerText(),"No matches");
        });
        await check(width+": losing manufacturer access removes its search results",async()=>{
          const count=await page.evaluate(async()=>{
            AUTH.access={your_accounts:[],available:[],request_access:[],golden:"None"};
            window.gsReset();return (await window.gsSearchAll("K3 wheelchair")).length;
          });
          assert.equal(count,0);
        });
        await check(width+": page fits the viewport and no order was submitted",async()=>{
          const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
          assert.ok(size.scroll<=size.width+1);
          assert.equal((seen.submits||[]).length,0);
          assert.ok(!(seen.fn||[]).some(x=>/orders-api|submit-order/.test(x.fn)&&x.body&&["create","submit"].includes(x.body.action)));
        });
      }finally{await ctx.close();}
    }
  }finally{await browser.close();}
  console.log(passed+" browser regression checks passed");
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
