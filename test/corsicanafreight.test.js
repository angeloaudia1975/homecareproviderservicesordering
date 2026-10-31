/* Corsicana per-item delivery (owner, tracker #42, 2026-10-27): merchandise under $2,500 → each item's listed
   UPS/FedEx charge; $2,500 or more → each item's LTL charge; an item's own included charge stands; a TBD item
   (SBKDB-30) is orderable with its freight PENDING — never shown as included, free or $0. Synthetic figures only
   (real delivery charges are private commercial data). */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {grabDecl}=require('./extract-picker.js');
const ROOT=path.join(__dirname,'..');
const H=fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8');
const MF=JSON.parse(fs.readFileSync(path.join(ROOT,'public','data','manufacturers.json'),'utf8'));
const SO=require('../netlify/functions/submit-order.js');
let pass=0,fail=0; const t=(n,f)=>{ try{f();pass++;console.log('ok   '+n);}catch(e){fail++;console.log('FAIL '+n+'\n     '+e.message);} };
const eq=(x,y,w)=>{ if(JSON.stringify(x)!==JSON.stringify(y)) throw new Error((w||'')+' got '+JSON.stringify(x)+' expected '+JSON.stringify(y)); };
const ctx={esc:s=>String(s),money:n=>'$'+Number(n).toFixed(2)}; vm.createContext(ctx);
vm.runInContext(['function linesSubtotal','function computeFreight','function freightRowsHtml'].map(n=>grabDecl(H,n)).join('\n')+';this.cf=computeFreight;this.rows=freightRowsHtml;',ctx);
const cfg=MF.find(m=>m.slug==='corsicana').freight;
ctx.mfrInfo=()=>({slug:'corsicana',freight:cfg}); ctx.unitPrice=p=>p.price;
const P=(code,price,ups,ltl)=>({code,price,shipping:{white_glove:null,ups,ltl}});
const A=P('A',100,30,10), B=P('B',2499.99,30,10), TBD=P('SBKDB-30',100,'tbd','tbd'), INC=P('BED',100,null,'included'), LTLONLY=P('BASE',100,null,40);
t('$2,499.99 of merchandise ships UPS/FedEx at each item\'s listed charge',()=>{
  const r=ctx.cf('corsicana',[{p:B,qty:1}]); eq([r.fee,r.rows[0].label,!!r.rows[0].pending],[30,'UPS/FedEx (order under $2,500)',false]); });
t('$2,500.00 of merchandise ships LTL at each item\'s LTL charge (per unit)',()=>{
  const r=ctx.cf('corsicana',[{p:B,qty:1},{p:P('C',0.01,30,10),qty:1}]); eq([r.itemsTotal,r.fee,r.rows[0].label],[2500,20,'LTL freight (order $2,500+)']);
  eq(ctx.cf('corsicana',[{p:A,qty:3}]).fee,90,'per unit below threshold'); });
t('an item\'s own charge wins: included stays included, no parcel option falls to its listed LTL charge',()=>{
  eq(ctx.cf('corsicana',[{p:INC,qty:2}]).fee,0); eq(ctx.cf('corsicana',[{p:LTLONLY,qty:1}]).fee,40); });
t('SBKDB-30 alone: freight PENDING, never "included" or free',()=>{
  const r=ctx.cf('corsicana',[{p:TBD,qty:1}]); eq([r.fee,r.rows[0].pending],[0,true]);
  const fr=ctx.rows(r).split('<div class="fnote">')[0]; eq(/pending/.test(fr)&&!/included/.test(fr),true,'cart row'); eq(/pending/.test(r.actualNote),true,'note');
  const o={freight_fee:0,freight_lines:r.rows,freight_note:r.actualNote,items:[],items_subtotal:100,estimated_total:100,items_count:1,manufacturer_name:'Corsicana Healthcare'};
  const e=SO._buildEmail({business:'x'},o); eq(/pending/.test(e.text)&&!/FREE/.test(e.text),true,'HCPS email text'); eq(/>pending</.test(e.html),true,'HCPS email html'); });
t('SBKDB-30 with other items: their charges + pending',()=>{
  const r=ctx.cf('corsicana',[{p:TBD,qty:1},{p:A,qty:1}]); eq([r.fee,r.rows[0].pending],[30,true]); eq(/\$30\.00 \+ pending/.test(ctx.rows(r)),true); });
t('no TBD item → the row carries no pending flag (unchanged shape)',()=>{ eq(Object.keys(ctx.cf('corsicana',[{p:A,qty:1}]).rows[0]),['label','status','fee']); });
console.log(`corsicana freight: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
