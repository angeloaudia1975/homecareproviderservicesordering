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
];
function undoLineDiscount(html) {
  let s = String(html);
  for (const [re, to] of SNIPPETS) { const n = (s.match(new RegExp(re.source, 'g')) || []).length; if (n !== 1) throw new Error('line-discount snippet found ' + n + ' times: ' + re.source.slice(0, 60)); s = s.replace(re, to); }
  return s;
}
module.exports = { undoLineDiscount };
