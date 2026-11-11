/* The Director must actually choose and render the premium scenes; static regression guard
   alongside existing browser tests which exercise canvas pixels. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/assets/ad-builder.js'),'utf8');
for(const id of ['st-ai-premium','st-ai-lifestyle','st-ai-features']){
  assert(src.includes("'"+id+"'(G)"),'missing layout '+id);
}
assert(src.includes("single: [['st-ai-premium', 'st-ai-lifestyle', 'st-ai-features']"),'Director does not offer premium set first');
assert(src.includes("ED.cdRun == null ? 0 : ED.cdRun + 1"),'first AI Director run skips premium set');
assert(src.includes("action: 'ad_scene'"),'scenes not requested through the authenticated server');
assert(src.includes("action: 'ad_brand_logo'"),'manufacturer logo not requested from official HCPS assets');
assert(src.includes("drawEl(ctx, el, W, H, u, cur, imgs, logo, sceneImgs, brands, cuts)"),'scenes not drawn on canvas');
assert(src.includes("tpl === 'st-ai-lifestyle'"),'lifestyle scene not selected per product');
assert(src.includes("premiumFooter(G)"),'premium layouts have no protected dealer footer');
console.log('AI Director premium scene pipeline: PASS');
