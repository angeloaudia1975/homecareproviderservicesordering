/* Mutation check for catalog-display.test.js: each mutant breaks one behaviour of the shop page; the suite must fail on
   every one and pass on the unmutated page (control). Run: node test/catalog-display.mutants.js */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const M = [
  ['card order ignored in the card sort', 'const oa=cvCardOrder(a), ob=cvCardOrder(b); if(', 'const oa=null, ob=null; if('],
  ['card order reversed', '||(oa-ob); })()', '||(ob-oa); })()'],
  ['ordered cards no longer before unordered in a shared category', 'return oa!=null?-1:1; if(oa==null) return 0;', 'return 0; if(oa==null) return 0;'],
  ['card order ignored in the subcategory list', 'const o=cvCardOrder(p); if(o!=null&&(m==null||o<m)) m=o;', 'const o=null;'],
  ['ordered subcategories no longer before unordered', '(ca!=null?-1:1)', '(String(a).localeCompare(String(b)))'],
  ['card order applied to every line', 'const list=m&&Array.isArray(m.card_order)?m.card_order:null; if(!list||!p._pageKey) return null;', 'return 0;'],
  ['exact search no longer first', 'const ex=leads.filter(exact); if(ex.length) return ex.concat(leads.filter(L=>!exact(L)));', ''],
  ['related keyed by group||code again', 'const xg=groupKeyOf(x); if(relSeen.has(xg)) return false;', 'const xg=(x.group||x.code); if(relSeen.has(xg)) return false;'],
  ['related keyed by code', 'const xg=groupKeyOf(x); if(relSeen.has(xg)) return false;', 'const xg=x.code; if(relSeen.has(xg)) return false;'],
  ['chooseBtn back to 42px', '.cv2-act .chooseBtn{display:block;width:100%;border:0;cursor:pointer;min-height:44px;', '.cv2-act .chooseBtn{display:block;width:100%;border:0;cursor:pointer;min-height:42px;'],
  ['add to cart min height only on phones', '\n.cv2-act .buy .addbtn,.cv2-act .buy .qtyin{min-height:44px;}', ''],
  ['tablet chips/select/ghost rule removed', '  .cv2-chip,.cv2-sort select,.cv2-ghost,.cv2-active button{min-height:44px;}\n', ''],
  ['tablet view toggles / chip arrows rule removed', '  .cv2-view button,.cv2-chipnext{width:44px;height:44px;}\n', ''],
];
const run = file => spawnSync(process.execPath, [path.join(__dirname, 'catalog-display.test.js')], { env: Object.assign({}, process.env, { CATALOG_DISPLAY_HTML: file }), encoding: 'utf8' }).status;
const tmp = path.join(os.tmpdir(), 'catalog-display-mutant.html');
fs.writeFileSync(tmp, H); const control = run(tmp);
let killed = 0;
for (const [name, a, b] of M) {
  const n = H.split(a).length - 1; if (n !== 1) { console.log('BAD  ' + name + ' (anchor found ' + n + ' times)'); continue; }
  fs.writeFileSync(tmp, H.replace(a, b)); const st = run(tmp);
  if (st !== 0) { killed++; console.log('killed   ' + name); } else console.log('SURVIVED ' + name);
}
fs.unlinkSync(tmp);
console.log(`\ncontrol ${control === 0 ? 'passes' : 'FAILS'}; mutants killed ${killed}/${M.length}`);
process.exit(control === 0 && killed === M.length ? 0 : 1);
