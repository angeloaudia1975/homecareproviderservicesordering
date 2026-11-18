const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
const source = html.slice(html.indexOf('  window.sdRefreshHostGlobals='), html.indexOf('  /* ---------- mount from the SHOWROOM'));
test('locations start empty and reopen independently across browsers', async () => {
  const database = new Map();
  function browser(location, preview = false) {
    const ctx = { AUTH:{status:'approved',dealer:{id:location},session:{access_token:location}},
      PREVIEW:preview ? {token:location} : null, CONFIG:{AUTH_ENDPOINT:'/dealer-auth'},
      ensureFreshSession:async()=>{}, mgBearer:()=>'', window:{},
      localStorage:{getItem(){throw Error('Cannot adopt unowned local plans');}},
      fetch:async(url, opts)=>{
        const {action,layout,location_id}=JSON.parse(opts.body);
        assert.equal(location_id,location);
        if(action==='showroom_save' && !preview) database.set(location,layout);
        const ok=action==='showroom_get'||!preview;
        return {ok,json:async()=>({ok,layout:database.get(location)})};
      }};
    vm.runInNewContext(source+';plannerLocation=sdDealerId();',ctx);
    return async (query,opts)=> (await ctx.window.fetch('dealer-showroom-design'+query,opts)).json();
  }
  for(const id of ['James','Washington','Henderson']){
    const call=browser(id);
    assert.equal((await call('?action=designs')).designs.length,0);
    await call('',{method:'POST',body:JSON.stringify({name:id,grid_width:5,grid_height:3,floor_cells:[]})});
  }
  for(const id of database.keys()){
    const view=browser(id,true);
    const designs=(await view('?action=designs')).designs;
    assert.equal(designs.length,1); assert.equal(designs[0].name,id);
    await assert.rejects(view('?action=rename',{method:'POST',body:JSON.stringify({design_id:'d1',name:'wrong'})}));
  }
});
