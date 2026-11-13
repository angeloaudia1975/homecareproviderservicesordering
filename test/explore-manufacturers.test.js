'use strict';
/* EXPLORE MORE MANUFACTURERS (owner 2026-11-12, James Medical): the dashboard recommends only lines the access engine says
   are AVAILABLE to this dealer — never every line in HCPS's catalog (ABM / Ovation were shown to James Medical). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const grab = n => { const k = H.indexOf('function ' + n + '('); if (k < 0) throw new Error('missing ' + n); let d = 0, j = H.indexOf('{', k); for (;; j++) { if (H[j] === '{') d++; else if (H[j] === '}') { d--; if (!d) break; } } return H.slice(k, j + 1); };
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
const ALL = ['abm-respiratory', 'access4u', 'airavant-bongorx', 'bemis', 'climbing-steps', 'corsicana', 'golden-technologies', 'ovation-medical', 'pedifix', 'strongback-mobility', 'yuwell', 'complete-medical-supplies'].map(s => ({ slug: s, name: s.toUpperCase() }));
function world(access, lines) {
  const ctx = { AUTH: { access }, LINES: lines || [], MFRLIST: ALL, state: { manufacturers: ALL.filter(m => m.slug !== 'complete-medical-supplies') },
    isRetiredSlug: s => s === 'complete-medical-supplies', isHeldSlug: () => false, isGoldenSlug: s => /^golden/.test(s) };
  vm.createContext(ctx); vm.runInContext(grab('whitespaceLines') + ';this.ws=whitespaceLines;', ctx); return ctx.ws;
}
t('James Medical: only the available lines — never ABM or Ovation from the global catalog', () => {
  const ws = world({ your_accounts: ['bemis', 'strongback-mobility'], available: ['access4u', 'airavant-bongorx', 'climbing-steps', 'corsicana', 'pedifix', 'yuwell'] }, [{ slug: 'bemis' }, { slug: 'strongback-mobility' }]);
  eq(ws().map(m => m.slug), ['access4u', 'airavant-bongorx', 'climbing-steps', 'corsicana', 'pedifix', 'yuwell']);
});
t('a line with an account number is not a recommendation; retired / Golden / not on the shop never are; an approved line without an account is', () => {
  const ws = world({ your_accounts: ['yuwell'], available: ['yuwell', 'pedifix', 'complete-medical-supplies', 'golden-technologies', 'unknown-line'], account_setup_needed: ['pedifix'] }, [{ slug: 'pedifix' }]);
  eq(ws(), [{ slug: 'pedifix', name: 'PEDIFIX', approved: true }]);
});
t('no access answer → nothing guessed (null), not the whole catalog', () => { eq(world(null)(), null); eq(world({ your_accounts: [] })(), null); });
t('the section is "Explore More Manufacturers" with View products / Open an account actions and an empty state', () => {
  if (!/Explore More Manufacturers/.test(H) || !/Discover additional product lines available to your business\./.test(H)) throw new Error('title / subtitle');
  if (/Lines you don't carry yet/.test(H)) throw new Error('old whitespace section still present');
  if (!/onclick="showShop\(this\.dataset\.slug\)">View products/.test(H) || !/sfReqAcct\(this\.dataset\.slug,this\.dataset\.name,null\)/.test(H)) throw new Error('actions');
  if (!/You already carry every manufacturer line available to your business\./.test(H)) throw new Error('empty state');
});
console.log(`\nexplore manufacturers: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
