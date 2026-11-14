#!/usr/bin/env node
/* Golden Service & Support 360 — ORIGINAL PORTAL PARITY (owner 2026-11-14).

   The owner's approved design is the standalone Golden Dealer Service & Support Portal
   (golden-dealer-portal/repo/portals/support/index.html → goldentechsupport.netlify.app). Dealer 360 shows THAT portal —
   its own markup, CSS and JavaScript — inside a shadow root, not a simplified rewrite. This script turns the original
   file into three assets, mechanically, so the two can never drift apart by hand:

     public/golden-support/gsv.css   the original <style>, scoped to the shadow root (:root → :host, body → .gsv-body)
     public/golden-support/gsv.html  the original header, tab navigation and all six tab panels, verbatim
     public/golden-support/gsv.js    the original scripts, wrapped in window.GSV_MOUNT(root, data, ctx)

   The ONLY changes made to the original (each one is listed in the output's header and checked by
   test/golden-support-parity.test.js):
     1. PARTS_DATA is not copied (the original embeds every dealer price in public). It is filled at mount time from
        Golden's /v1/service/catalog for the signed-in dealer — dealer prices only when Golden's verified link allows.
     2. document.getElementById / querySelector(All) read the shadow root; DOMContentLoaded handlers run at mount.
     3. Inline handlers call window.GSV.<name> (the original's globals would collide with Dealer 360's own).
     4. The three submit buttons send through Dealer 360's secure case submission (golden-proxy service_submit →
        Golden /v1/service/submit: signed delegation, idempotency key, Golden's own department routing) instead of the
        open send-parts endpoint. The original's validation, messages and success / failure screens are kept.
     5. Service documents link to the files Golden's support site already hosts (absolute URLs, same manifest).
     6. "MSRP" beside a part is the original's dealer price × 2, so it is labelled "Calc. retail" — Golden does not
        publish an MSRP for these parts (owner rule: a derived figure is never called MSRP).
     7. The #hash deep-link script is not used (Dealer 360 has its own navigation).

   Usage:  node scripts/build-golden-support.js <path to golden-dealer-portal/repo/portals/support>
   The source file's SHA-256 is written into every output so the parity test can tell which original it came from. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SRC_DIR = process.argv[2];
if (!SRC_DIR) { console.error('usage: node scripts/build-golden-support.js <golden support portal dir>'); process.exit(2); }
const SITE = 'https://goldentechsupport.netlify.app';
const OUT = process.env.GSV_OUT || path.join(__dirname, '..', 'public', 'golden-support');
const raw = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
const docsManifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'docs.json'), 'utf8'));
const SHA = crypto.createHash('sha256').update(raw).digest('hex');
const must = (cond, what) => { if (!cond) { console.error('build-golden-support: the original changed shape — ' + what); process.exit(1); } };

/* ---------- CSS ---------- */
const css0 = raw.slice(raw.indexOf('<style>') + 7, raw.indexOf('</style>'));
must(/:root\s*\{/.test(css0) && /\n\s*body\s*\{/.test(css0), ':root / body rules');
let css = css0.replace(/:root\s*\{/, ':host {').replace(/(\n\s*)body\s*\{/, '$1.gsv-body {');
/* the original's phone breakpoint follows the portal's OWN width inside Dealer 360 (its side gutters make it narrower
   than the window), so the portal lays out exactly as the original does at that width */
must((css.match(/@media \(max-width: 700px\)/g) || []).length >= 1, 'phone breakpoint');
css = css.replace(/@media \(max-width: 700px\)/g, '@container gsv (max-width: 700px)');
/* Inside Dealer 360 the page already has its own sticky top bar: the portal header scrolls with the page */
css += `
  /* Dealer 360 shell (build-golden-support.js): the portal header scrolls with the page under Dealer 360's own bar */
  :host { all: initial; display: block; container: gsv / inline-size; }   /* nothing of Dealer 360's page styles is inherited */
  .gsv-body { min-height: 0; }
  .site-header { position: relative; top: auto; z-index: 1; }
  .tab-nav { position: relative; top: auto; }   /* Dealer 360's own bar stays on top; the tabs scroll with the page */
  .gsv-d360-note { background: var(--blue-bg); color: var(--blue); border: 1px solid #c9dbf2; border-radius: var(--radius);
    padding: 10px 14px; font-size: 13px; margin: 0 0 16px; }
  .gsv-d360-note b { color: var(--black); }
  .gsv-ro { background: var(--mist) !important; color: var(--slate) !important; }
  .case-table { width:100%; border-collapse: collapse; font-size: 13.5px; }
  .case-table th, .case-table td { text-align:left; padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  .case-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--slate); }
  .case-status { display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11.5px; font-weight: 700; }
  .case-status.sent { background: var(--green-bg); color: var(--green); }
  .case-status.failed, .case-status.send_failed { background: var(--red-bg); color: var(--red); }
  .case-status.received, .case-status.sending { background: var(--amber-bg); color: var(--amber); }
  /* RULE 10: inputs are 16px on phones and tablets (no iOS focus zoom) */
  @media (max-width: 980px) { input, select, textarea { font-size: 16px !important; } }
  @media (max-width: 700px) { .case-table thead { display:none } .case-table tr { display:block; border-bottom:1px solid var(--border); padding:6px 0 }
    .case-table td { display:block; border:0; padding:3px 10px } .case-table td[data-l]::before { content: attr(data-l) ": "; font-weight:700; color: var(--slate) } }
`;

/* ---------- HTML ---------- */
const bodyStart = raw.indexOf('<header class="site-header">'), mainEnd = raw.indexOf('</main>');
must(bodyStart > 0 && mainEnd > bodyStart, 'header … </main>');
let html = raw.slice(bodyStart, mainEnd + '</main>'.length);
/* Dealer 360 additions: a "My requests" tab (Golden case history) after the original six */
must(/<\/nav>/.test(html), 'tab nav');
html = html.replace(/<\/nav>/, `  <button class="tab-btn" onclick="showTab('history', this)">
    <span class="tab-icon">🗂️</span> My Requests
  </button>
</nav>`);
html = html.replace(/<\/main>$/, `  <div class="tab-panel" id="tab-history">
    <div class="section-header"><h2>My Golden Requests</h2><p>Every parts order, service / RMA request and labor claim sent from Dealer 360, with Golden's case number. Golden replies to the contact email on the request.</p></div>
    <div class="card"><div id="gsvHistory"></div></div>
  </div>
</main>`);

/* ---------- JS ---------- */
const scripts = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
must(scripts.length === 6, 'six scripts (found ' + scripts.length + ')');
let [main, send, svcSearch, docs, labor] = scripts;   // scripts[5] = the #hash deep link — not used inside Dealer 360
must(/const PARTS_DATA = \{/.test(main), 'PARTS_DATA literal');
const pdStart = main.indexOf('const PARTS_DATA = {');
const pdEnd = main.indexOf('\n};', pdStart); must(pdEnd > pdStart, 'PARTS_DATA end');
main = main.slice(0, pdStart) + 'let PARTS_DATA = DATA.parts;   /* from Golden /v1/service/catalog at mount (build-golden-support.js) */' + main.slice(pdEnd + 3);
/* calculated retail is labelled as such (owner rule) */
must(/'Dealer ' \+ dealerText \+ ' · MSRP ' \+ msrpText/.test(main), 'formatDealerMsrp text');
main = main.replace(/'Dealer ' \+ dealerText \+ ' · MSRP ' \+ msrpText/g, "'Dealer ' + dealerText + ' · Calc. retail ' + msrpText");
/* the original's plain-function globals, exported to window.GSV for the inline handlers (later window.X = assignments win) */
const mainFns = [...main.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);

/* send: the three submissions go through Dealer 360's secure case submission */
const FETCH_RE = /fetch\(SEND_URL, \{ method: 'POST', headers: \{ 'Content-Type': 'application\/json' \}, body: JSON\.stringify\(data\) \}\)\s*\.then\(function \(r\) \{ return r\.json\(\); \}\)/g;
const nFetch = (send.match(FETCH_RE) || []).length; must(nFetch === 3, 'three send-parts calls (found ' + nFetch + ')');
send = send.replace(/var SEND_URL = '[^']*';/, "var SEND_URL = null;   /* Dealer 360: never the open send-parts endpoint (build-golden-support.js) */")
  .replace(FETCH_RE, 'CTX.send(data, form)');

/* docs: the manifest is built in, files are the ones Golden's support site hosts */
must(/fetch\('\/docs\.json'\)/.test(docs) && /a\.href = '\/docs\/' \+ encodedFile;/.test(docs), 'docs manifest fetch');
docs = docs.replace(/fetch\('\/docs\.json'\)\s*\.then\(function \(r\) \{[^}]*\}\)/, 'Promise.resolve(' + JSON.stringify(docsManifest) + ')')
  .replace("a.href = '/docs/' + encodedFile;", `a.href = '${SITE}/docs/' + encodedFile; a.target = '_blank'; a.rel = 'noopener';`);

let js = [main, '\n/* ---- export for inline handlers ---- */\nObject.assign(GSV, {' + mainFns.join(', ') + '});\n', send, svcSearch, docs, labor].join('\n');
/* every `window.name =` the original sets for its handlers becomes GSV.name (Dealer 360 has its own globals) */
js = js.replace(/window\.([A-Za-z_$][\w$]*)\s*=\s*function/g, 'GSV.$1 = function');
/* the shadow root, not the page */
js = js.replace(/document\.getElementById\(/g, 'ROOT.getElementById(')
  .replace(/document\.querySelectorAll\(/g, 'ROOT.querySelectorAll(')
  .replace(/document\.querySelector\(/g, 'ROOT.querySelector(')
  .replace(/document\.addEventListener\('DOMContentLoaded',\s*/g, 'READY(')
  .replace(/document\.addEventListener\('click',/g, "ROOT.addEventListener('click',");
must(!/document\.(?!createElement)/.test(js), 'no other document.* use: ' + (js.match(/document\.(?!createElement)\w+/) || [''])[0]);

/* inline handlers (in the markup and in the original's own template strings) call GSV.<name> */
const handlerNames = new Set(mainFns.concat([...js.matchAll(/GSV\.([A-Za-z_$][\w$]*) = function/g)].map((m) => m[1])));
const HANDLER_RE = /(\bon(?:click|change|input|submit|keyup|keydown|focus|blur)=(["']))(\s*(?:return\s+)?)([A-Za-z_$][\w$]*)\(/g;
const rewire = (s) => s.replace(HANDLER_RE, (m, a, q, sp, fn) => handlerNames.has(fn) ? `${a}${sp}GSV.${fn}(` : m);
html = rewire(html); js = rewire(js);
const leftover = [...(html + js).matchAll(HANDLER_RE)].filter((m) => !/^GSV$/.test(m[4]) && handlerNames.has(m[4]));
must(!leftover.length, 'handler not rewired: ' + (leftover[0] || [])[0]);

const header = (kind) => `/* GENERATED by scripts/build-golden-support.js — do not edit by hand (${kind}).
   Source: golden-dealer-portal portals/support/index.html  sha256 ${SHA} */\n`;
const jsOut = header('js') + `window.GSV_MOUNT = function (ROOT, DATA, CTX) {
'use strict';
var GSV = window.GSV = {};
var READY = function (f) { try { f(); } catch (e) { console.error('[gsv]', e); } };
GSV.__source = ${JSON.stringify(SHA)};
${js}
return GSV;
};
`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'gsv.css'), header('css') + css);
fs.writeFileSync(path.join(OUT, 'gsv.html'), `<!-- GENERATED by scripts/build-golden-support.js — source sha256 ${SHA} -->\n<div class="gsv-body">\n${html}\n</div>\n`);
fs.writeFileSync(path.join(OUT, 'gsv.js'), jsOut);
fs.writeFileSync(path.join(OUT, 'source.json'), JSON.stringify({ source: 'golden-dealer-portal/repo/portals/support/index.html', sha256: SHA, handlers: [...handlerNames].sort() }, null, 2) + '\n');
console.log('golden support parity build: ' + SHA.slice(0, 16) + ' — ' + mainFns.length + ' functions, ' + handlerNames.size + ' handlers');
