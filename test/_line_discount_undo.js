/* The dealer line-discount and railing-upgrade changes (owner policy, 2026-10-27) taken back out of a storefront page, exactly as written.
   Tests that prove "this code did not change since <base>" compare against the result, so the approved change is
   allowed and any other edit still fails. Each snippet must be present exactly once, or this throws. */
const SNIPPETS = [
  [/\n\/\* THE DEALER'S LINE DISCOUNT[\s\S]*?\nfunction lineRatePrice\(p\)\{[\s\S]*?\n\}/, ''],
  [/\n  if\(cp!=null\) return \(p&&p\._upgrade\) \? [^\n]*/, '\n  if(cp!=null) return cp;'],
  [/\n  \/\/ The dealer's own line discount off the standard list \(never stacked on a contract price\)\.\n  const lr=lineRatePrice\(p\);\n  if\(lr!=null\) return lr;/, ''],
  [/\n  const lr=\(cp==null && typeof lineRatePrice==='function'\)\?lineRatePrice\(p\):null;[^\n]*\n  const eff=\(cp!=null\)\?cp:\(lr!=null\?lr:Number\(p\.base_price\)\);/, '\n  const eff=(cp!=null)?cp:Number(p.base_price);'],
  [/\n    : \(lr!=null \? `<div class="pnote" style="color:#0a7f3f;font-weight:700">Your account price<\/div>` : ""\);/, '\n    : "";'],
  /* Order rules printed on a manufacturer's list (ABM 2026 MOQ + extended-warranty rule, owner 2026-10-27). */
  [/\n  const m=minOrderQty\(p\); const nq=Math\.max\(\(cur\?cur\.qty:0\)\+qty, m\);\n  CART\.set\(k,\{p,qty:nq\}\);\n  updateCart\(\); toast\([^\n]*\);/,
   '\n  CART.set(k,{p,qty:(cur?cur.qty:0)+qty});\n  updateCart(); toast(`Added ${qty} × ${p.code}`);'],
  [/\n\/\* ORDER RULES PRINTED ON A MANUFACTURER'S LIST[\s\S]*?\nfunction cartRuleProblems\(\)\{[\s\S]*?\n  return out;\n\}/, ''],
  [/\n        \$\{cartRuleProblems\(\)[^\n]*/, ''],
];
function undoLineDiscount(html) {
  let s = String(html);
  for (const [re, to] of SNIPPETS) { const n = (s.match(new RegExp(re.source, 'g')) || []).length; if (n !== 1) throw new Error('line-discount snippet found ' + n + ' times: ' + re.source.slice(0, 60)); s = s.replace(re, to); }
  return s;
}
module.exports = { undoLineDiscount };
