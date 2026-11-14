/* The Golden support assets in public/golden-support/ are exactly what scripts/build-golden-support.js makes from the
   owner's original portal (no hand edits, no drift), and they never carry what must not be public or must not happen:
   no embedded dealer prices, no open send-parts endpoint, every inline handler wired.
   GOLDEN_REPO=… node test/golden-support-build.test.js */
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const GOLDEN = process.env.GOLDEN_REPO || path.join(__dirname, '..', '..', 'golden-dealer-portal');
const SRC = path.join(GOLDEN, 'repo', 'portals', 'support'), PUB = path.join(__dirname, '..', 'public', 'golden-support');
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok  ', n); } catch (e) { fail++; console.log('FAIL', n, '\n    ', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion'); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsv-'));
execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-golden-support.js'), SRC], { env: Object.assign({}, process.env, { GSV_OUT: tmp }) });
const read = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
t('the committed assets are byte-for-byte the build of the current original portal', () => {
  for (const f of ['gsv.css', 'gsv.html', 'gsv.js', 'source.json']) ok(read(tmp, f) === read(PUB, f), f + ' differs — run node scripts/build-golden-support.js ' + SRC); });
const js = read(PUB, 'gsv.js'), html = read(PUB, 'gsv.html'), css = read(PUB, 'gsv.css');
t('no dealer price is embedded (the original\'s PARTS_DATA is not copied)', () => { ok(!/"price"\s*:/.test(js) && !/PARTS_DATA = \{/.test(js), 'prices'); ok(/let PARTS_DATA = DATA\.parts/.test(js), 'from Golden'); });
t('nothing can reach the open send-parts endpoint; the three submissions use Dealer 360\'s case submission', () => {
  ok(!/send-parts/.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/var SEND_URL = null;/, '')), 'send-parts'); ok((js.match(/CTX\.send\(data, form\)/g) || []).length === 3, 'three sends'); });
t('every inline handler calls window.GSV (no clash with Dealer 360 globals)', () => {
  const bad = [...(html + js).matchAll(/\bon(?:click|change|input|submit)=(["'])\s*(?:return\s+)?([A-Za-z_$][\w$]*)\(/g)].filter((m) => m[2] !== 'GSV' && m[2] !== 'event');
  ok(!bad.length, bad.map((m) => m[0]).join(' ')); });
t('the page reads only its own shadow root', () => ok(!/document\.(getElementById|querySelector|addEventListener)/.test(js), 'document access'));
t('derived retail is labelled "Calc. retail", never MSRP', () => ok(/Calc\. retail/.test(js) && !/' · MSRP '/.test(js), 'label'));
t('styles are scoped (:host, the portal\'s own breakpoint, 16px inputs on phones)', () => ok(/:host \{/.test(css) && !/:root/.test(css) && /@container gsv/.test(css) && /font-size: 16px !important/.test(css), 'css'));
console.log(`golden support build: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
