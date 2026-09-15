/* Per-line price authority — behaviour suite.
   Loads the real catalog-feed.js and exercises its exported recordAuthority.

   This is the decision that says a manufacturer's prices now come from the master
   record instead of the legacy layers. Getting it wrong in the permissive
   direction serves prices that stopped being updated, and nothing about the
   storefront looks broken while it happens. */
const fs = require('fs');
const path = require('path');

const FEED = process.env.CATALOG_FEED
  || path.join(__dirname, '..', 'netlify', 'functions', 'catalog-feed.js');

function load(src){
  const js = src !== undefined ? src : fs.readFileSync(FEED, 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', 'process', 'fetch', js)(
    mod, mod.exports, require, { env: {} }, () => {});
  return mod.exports;
}

let pass = 0, fail = 0;
const out = [];
function t(name, fn){
  try { fn(); pass++; out.push('  ok   ' + name); }
  catch(e){ fail++; out.push('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, what){
  if(JSON.stringify(a) !== JSON.stringify(b))
    throw new Error((what || 'value') + ': got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
}
function ok(v, msg){ if(!v) throw new Error(msg || 'expected truthy'); }

function run(src){
  const { recordAuthority } = load(src);
  const A = rows => recordAuthority(rows).authoritative;
  const N = rows => recordAuthority(rows).note;
  pass = 0; fail = 0; out.length = 0;

  /* ---- the one way to get authority -------------------------------------- */
  t('a line switched on with a healthy mirror is authoritative', () => {
    eq(recordAuthority([{ record_authoritative: true, record_resync_error: null }]),
       { authoritative: true, note: null }, 'result');
  });

  /* ---- every way to lose it ---------------------------------------------- */
  t('a line that was never switched on prices from the layers', () => {
    eq(A([{ record_authoritative: false, record_resync_error: null }]), false, 'false');
    eq(A([{ record_resync_error: null }]), false, 'column absent');
    ok(/legacy layers/.test(N([{ record_authoritative: false }])), 'says why');
  });

  t('a broken mirror takes authority away even while the flag is on', () => {
    /* The safety property. catalog-api stamps this when it cannot bring the record
       up to date with the layers; from that moment the rows are frozen, and the
       line has to fall back on its own rather than wait for someone to notice. */
    const r = recordAuthority([{ record_authoritative: true, record_resync_error: 'Supabase 503: upstream' }]);
    eq(r.authoritative, false, 'refused');
    ok(/behind the layers/.test(r.note), 'note explains');
    ok(/503/.test(r.note), 'and carries the underlying error');
  });

  t('a missing or unreadable meta row is not permission', () => {
    // sb(...).catch(() => null) hands null straight in when the read fails.
    eq(A(null), false, 'read failed');
    eq(A([]), false, 'no row');
    eq(A(undefined), false, 'undefined');
    eq(A('not an array'), false, 'nonsense');
    ok(/no manufacturer_meta row/.test(N([])), 'says why');
  });

  t('only an exact true grants authority', () => {
    /* Postgres gives a real boolean, but this value also arrives through JSON from
       a column that might one day be text. Anything truthy-but-not-true is a
       configuration mistake, and the safe reading of a mistake is "no". */
    eq(A([{ record_authoritative: 'true' }]), false, 'string');
    eq(A([{ record_authoritative: 1 }]), false, 'number');
    eq(A([{ record_authoritative: 'yes' }]), false, 'yes');
  });

  t('an empty-string error is not an error', () => {
    // PostgREST can return '' for a nullable text column that was cleared.
    eq(A([{ record_authoritative: true, record_resync_error: '' }]), true, 'still authoritative');
  });

  t('the error is checked before the flag, so a broken mirror is always the reason given', () => {
    // Both wrong at once: the actionable one is that the mirror is broken.
    const r = recordAuthority([{ record_authoritative: false, record_resync_error: 'boom' }]);
    eq(r.authoritative, false, 'refused');
    ok(/behind the layers/.test(r.note), 'mirror failure reported, not the flag');
  });

  t('every refusal carries a note, and a grant carries none', () => {
    [null, [], [{}], [{ record_authoritative: false }], [{ record_resync_error: 'x' }]]
      .forEach((rows, i) => {
        const r = recordAuthority(rows);
        eq(r.authoritative, false, 'case ' + i + ' refused');
        ok(typeof r.note === 'string' && r.note.length > 0, 'case ' + i + ' has a note');
      });
    eq(recordAuthority([{ record_authoritative: true }]).note, null, 'grant has no note');
  });

  t('extra columns on the row are ignored', () => {
    eq(A([{ record_authoritative: true, record_resync_at: '2026-09-14T00:00:00Z',
            slug: 'bemis', logo_url: 'x' }]), true, 'authoritative');
  });

  t('the first row is the answer', () => {
    eq(A([{ record_authoritative: true }, { record_authoritative: false }]), true, 'first wins');
  });

  return { pass, fail, report: out.join('\n') };
}

module.exports = { run, load, FEED };

if(require.main === module){
  const r = run();
  console.log(r.report);
  console.log('\n' + r.pass + ' passed, ' + r.fail + ' failed');
  process.exit(r.fail ? 1 : 0);
}
