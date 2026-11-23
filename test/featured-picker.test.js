/* Featured picker (builder tab): a catalog code is data, never script — it travels only in an escaped data attribute. No browser needed. */
const fs = require('fs'), path = require('path'); const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const grab = (re, n) => { const m = re.exec(src); if (!m) throw new Error('not found: ' + n); return m[0]; };
const escSrc = grab(/(?:const esc\s*=|function esc\()[^\n]*\n?/, 'esc');
const fnSrc = grab(/function sfFeatHtml\(ed\)\{[\s\S]*?\n(?=function sfFeatAdd)/, 'sfFeatHtml');
const mk = new Function(escSrc + '\n' + fnSrc + '\nreturn {sfFeatHtml, esc};'); const { sfFeatHtml } = mk(); const E = {}; 
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
const evil = [{ manufacturer: 'bemis', code: `A'B"C\\D`, name: 'Odd <b>seat</b>', price: 5 }, { manufacturer: 'm', code: 'X1', name: 'Plain', price: null }];
const html = new Function('E', 'sfFeatHtml', 'return sfFeatHtml(true)');
global.SFE = { feat: [], prods: evil, fq: '' };
const out = new Function('SFE', escSrc + '\n' + fnSrc + '\nreturn sfFeatHtml(true);')(global.SFE);
const attrs = [...out.matchAll(/data-k="([^"]*)"/g)].map((m) => m[1].replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
ok(attrs.includes(`bemis|A'B"C\\D`), 'the odd code round-trips through the escaped data attribute: ' + JSON.stringify(attrs));
ok(![...out.matchAll(/onclick="([^"]*)"/g)].some((m) => /A&#39;B|A'B/.test(m[1])), 'no onclick contains the code');
ok(!/<b>seat<\/b>/.test(out), 'names are escaped');
console.log(fail ? '\nFAILED' : '\nfeatured picker: all passed'); process.exit(fail ? 1 : 0);
