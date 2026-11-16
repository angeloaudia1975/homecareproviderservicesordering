/* HCPS Test Line (owner 2026-11-16 15:10 CT): a manufacturers.json line marked testOnly is seen only by a dealer whose access
   answer includes it; every list that goes beyond the dealer's own entitlement (partner list, customer quotes, price list)
   filters it out for everyone else. */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const mfrs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'manufacturers.json'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
const i = html.indexOf('function testLineVisible(m){'); const j = html.indexOf('\n}\n', i);
ok(i > 0 && j > i, 'testLineVisible is defined');
const fn = (AUTH) => new Function('AUTH', html.slice(i, j + 2) + '; return testLineVisible;')(AUTH);
const T = { slug: 'hcps-test-line', testOnly: true }, R = { slug: 'yuwell' };
ok(fn({ status: 'anon' })(T) === false, 'signed out: hidden');
ok(fn({ status: 'approved', access: { your_accounts: ['yuwell'], available: ['access4u'] } })(T) === false, 'an ordinary dealer: hidden');
ok(fn({ status: 'approved', access: { your_accounts: [], available: ['hcps-test-line'] } })(T) === true, 'the granted TEST dealer: shown');
ok(fn({ status: 'approved', lines: ['hcps-test-line'] })(T) === true, 'no access answer: falls back to granted lines');
ok(fn({ status: 'anon' })(R) === true && fn({ status: 'approved', access: { your_accounts: [], available: [] } })(R) === true, 'a normal line is never affected');
const n = (html.match(/testLineVisible\(m\)/g) || []).length;
ok(n >= 3, 'partner list, customer quotes and price list all filter it (' + n + ' call sites)');
const t = mfrs.find(m => m.slug === 'hcps-test-line');
ok(!!t && t.testOnly === true && t.hasData === true && !t.freight, 'manufacturers.json lists the test line, testOnly');
ok(mfrs.filter(m => m.testOnly).length === 1, 'exactly one testOnly line');
const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'hcps-test-line.json'), 'utf8'));
ok(Array.isArray(cat) && cat.length === 0, 'its public catalog file is empty (products come from Product Catalog → Add product)');
console.log(fail ? `\n${fail} FAILED` : '\ntest-line: ALL PASS'); process.exit(fail ? 1 : 0);
