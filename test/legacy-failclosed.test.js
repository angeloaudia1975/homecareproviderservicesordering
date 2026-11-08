'use strict';
/* Admin 360 B0 (2026-11-08): the legacy ordering-site analytics.js and assign.js must FAIL CLOSED.
   Unset ANALYTICS_TOKEN → 503 before any database call; wrong/missing token → 401; the right token still works.
   The token itself is preserved (owner rule): only the fail-open path is removed. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; let chain = Promise.resolve();
const t = (n, f) => { chain = chain.then(async () => { try { await f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + '\n     ' + e.message); } }); };
const load = (f) => { const p = require.resolve(path.join(ROOT, 'netlify', 'functions', f)); delete require.cache[p]; return require(p); };
const TOK = 'tok-test-1234';
const withFetch = async (fn) => { const real = global.fetch; let calls = 0; global.fetch = async () => { calls++; return { ok: true, status: 200, json: async () => [], text: async () => '[]' }; }; try { await fn(() => calls); } finally { global.fetch = real; } };
process.env.SUPABASE_URL = 'https://sb.invalid'; process.env.SUPABASE_SERVICE_ROLE = 'x';

for (const [file, ev] of [['analytics.js', (h, q) => ({ httpMethod: 'GET', headers: h, queryStringParameters: q || {} })],
                          ['assign.js', (h) => ({ httpMethod: 'POST', headers: h, body: '{"dealer_name":"TEST"}' })]]) {
  t(file + ': unset token refuses every request with 503 and never reaches the database', () => withFetch(async (calls) => {
    delete process.env.ANALYTICS_TOKEN; const api = load(file);
    for (const h of [{}, { 'x-analytics-token': '' }, { 'x-analytics-token': 'anything' }]) {
      const r = await api.handler(ev(h)); if (r.statusCode !== 503) throw new Error('answered ' + r.statusCode);
    }
    if (calls()) throw new Error('reached the network ' + calls() + ' times');
  }));
  t(file + ': a set token refuses missing, shorter, longer and wrong tokens with 401', () => withFetch(async (calls) => {
    process.env.ANALYTICS_TOKEN = TOK; const api = load(file);
    for (const h of [{}, { 'x-analytics-token': 'tok-test-123' }, { 'x-analytics-token': 'tok-test-12345' }, { 'x-analytics-token': 'tok-test-1235' }]) {
      const r = await api.handler(ev(h)); if (r.statusCode !== 401) throw new Error(JSON.stringify(h) + ' answered ' + r.statusCode);
    }
    if (calls()) throw new Error('reached the network ' + calls() + ' times');
  }));
  t(file + ': the correct token is still accepted (existing passcode keeps working)', () => withFetch(async (calls) => {
    process.env.ANALYTICS_TOKEN = TOK; const api = load(file);
    const r = await api.handler(ev({ 'x-analytics-token': TOK }));
    if (r.statusCode === 401 || r.statusCode === 503) throw new Error('right token refused: ' + r.statusCode);
    if (!calls()) throw new Error('right token never reached the handler body');
  }));
}
t('analytics.js still honours ?token= for the old dashboard link (preserved behaviour)', () => withFetch(async () => {
  process.env.ANALYTICS_TOKEN = TOK; const api = load('analytics.js');
  const r = await api.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { token: TOK } });
  if (r.statusCode === 401 || r.statusCode === 503) throw new Error('query token refused: ' + r.statusCode);
}));
chain.then(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); });
