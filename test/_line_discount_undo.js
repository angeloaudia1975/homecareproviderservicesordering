/* The dealer line-discount and railing-upgrade changes (owner policy, 2026-10-27) taken back out of a storefront page, exactly as written.
   Tests that prove "this code did not change since <base>" compare against the result, so the approved change is
   allowed and any other edit still fails. Each snippet must be present exactly once, or this throws. */
const SNIPPETS = [
  [/\n\/\* THE DEALER'S LINE DISCOUNT[\s\S]*?\nfunction lineRatePrice\(p\)\{[\s\S]*?\n\}/, ''],
  [/\n  if\(cp!=null\) return \(p&&p\._upgrade\) \? [^\n]*/, '\n  if(cp!=null) return cp;'],
  [/\n  \/\/ The dealer's own line discount off the standard list \(never stacked on a contract price\)\.\n  const lr=lineRatePrice\(p\);\n  if\(lr!=null\) return lr;/, ''],
  [/\n  const lr=\(cp==null && typeof lineRatePrice==='function'\)\?lineRatePrice\(p\):null;[^\n]*\n  const eff=\(cp!=null\)\?cp:\(lr!=null\?lr:Number\(p\.base_price\)\);/, '\n  const eff=(cp!=null)?cp:Number(p.base_price);'],
  [/\n    : \(lr!=null \? `<div class="pnote" style="color:#0a7f3f;font-weight:700">Your account price<\/div>` : ""\);/, '\n    : "";'],
  /* Corsicana per-item freight PENDING for a TBD item (owner 2026-10-27): taken back out the same way. */
  [/\n    \/\* An item whose delivery charge the manufacturer lists as TBD[\s\S]*?free or \$0 \(owner, 2026-10-27\)\. \*\/\n    let note = cfg\.summary\|\|""; if\(tbd\) note \+= " Freight for some items is pending[^\n]*\n    return \{rows:\[Object\.assign\(\{label,status:"peritem",fee\}, tbd\?\{pending:true\}:\{\}\)\], fee, itemsTotal, actualNote:note\};/,
   '\n    let note = cfg.summary||""; if(tbd) note += " Some items\' freight is confirmed by HCPS.";\n    return {rows:[{label,status:"peritem",fee}], fee, itemsTotal, actualNote:note};'],
  [/<span>\$\{r\.pending\?\(r\.fee>0\?money\(r\.fee\)\+" \+ pending":"pending"\):\(r\.fee>0\?money\(r\.fee\):"included"\)\}<\/span>/, '<span>${r.fee>0?money(r.fee):"included"}</span>'],
  /* Order rules printed on a manufacturer's list (ABM 2026 MOQ + extended-warranty rule, owner 2026-10-27). */
  [/\n  const m=minOrderQty\(p\); const nq=Math\.max\(\(cur\?cur\.qty:0\)\+qty, m\);\n  CART\.set\(k,\{p,qty:nq\}\);\n  updateCart\(\); toast\([^\n]*\);/,
   '\n  CART.set(k,{p,qty:(cur?cur.qty:0)+qty});\n  updateCart(); toast(`Added ${qty} × ${p.code}`);'],
  [/\n\/\* ORDER RULES PRINTED ON A MANUFACTURER'S LIST[\s\S]*?\nfunction cartRuleProblems\(\)\{[\s\S]*?\n  return out;\n\}/, ''],
  [/\n        \$\{\(typeof cartRuleProblems==="function"\?cartRuleProblems\(\):\[\]\)[^\n]*/, ''],
  /* BongoRx free standard shipping by qualifying order quantity (owner, 2026-10-27). */
  [/\n  if\(t\.mode==='qty_threshold'\) return [^\n]*/, ''],
  [/\n  \/\* FREE STANDARD SHIPPING BY ORDER QUANTITY[\s\S]*?\n  if\(cfg\.mode==="qty_threshold"\)\{[\s\S]*?\n  \}/, ''],
  [/\$\{r\.qtyRemaining>0\?` <span class="prog">· add \$\{r\.qtyRemaining\} more qualifying unit[^\n]*?\(\$\{r\.freeAtQty\}\+\)<\/span>`:""\}/, ''],
  /* Golden B2 (PR #17, merged by the owner 2026-11-02): Golden products are browse-only in Partner 360 until Golden
     ordering opens. Only a product the Golden catalog builds carries _golden, so no other line's cart behaviour moves. */
  [/\n  if\(p && p\._golden\)\{ toast\("Golden ordering in Partner 360 is not open yet\."\); return; \}/, ''],
  [/\n  if\(Array\.isArray\(\(p\|\|\{\}\)\.tiers\)&&p\.tiers\.some\(t=>t&&t\.until!=null&&t\.until!==''\)&&!tierLadder\(p\)\.some\(t=>t\.until\)\) return '';  \/\/ its time-limited special has ended \(2026-11-04\)/, ''],
  /* Time-limited quantity breaks (owner, 2026-11-04 — Yuwell SP-3 special ends Jan 1, 2027). */
  [/\n  const live=t=>!\(t&&t\.until!=null&&t\.until!==''\)\|\|[^\n]*\n  const LT=\(Array\.isArray\(p\.tiers\)\?p\.tiers:\[\]\)\.filter\(live\);\n  if\(LT\.length\)\{/, '\n  if(Array.isArray(p.tiers)&&p.tiers.length){'],
  [/\n    for\(const t of LT\)\{ const mq=/, '\n    for(const t of p.tiers){ const mq='],
  [/ \+ \(x\.until \? '~' \+ x\.until : ''\)\)/, ')'],
  /* Golden B6.1 unified cart (owner directive 2026-11-04): the Golden Technologies group is appended to the HCPS cart and
     wired on its own; HCPS rows/groups skip it. Taken back out exactly, so any other renderCart change still fails. */
  [/\n  const gHtml=goldenCartGroupHtml\(\);\n  if\(!groups\.size&&!gHtml\)\{/, '\n  if(!groups.size){'],
  [/\n  host\.innerHTML=html\+gHtml;\n  goldenCartGroupWire\(host\);\n  host\.querySelectorAll\("\.mgroup:not\(\.gmgroup\) \.citem"\)/, '\n  host.innerHTML=html;\n  host.querySelectorAll(".citem")'],
  [/\n  host\.querySelectorAll\("\.mgroup:not\(\.gmgroup\)"\)\.forEach\(g=>\{/, '\n  host.querySelectorAll(".mgroup").forEach(g=>{'],
];
function undoLineDiscount(html) {
  let s = String(html);
  for (const [re, to] of SNIPPETS) { const n = (s.match(new RegExp(re.source, 'g')) || []).length; if (n !== 1) throw new Error('line-discount snippet found ' + n + ' times: ' + re.source.slice(0, 60)); s = s.replace(re, to); }
  return s;
}
module.exports = { undoLineDiscount };
