'use strict';
/* Feature batch planner: fills only empty features on exactly-matched, unheld, dealer-active pages. */
const assert = require('assert');
const { plan, apply, CLAIM } = require('../scripts/apply-content-features.js');
const pg = (k, skus, extra) => Object.assign({ page_key: k, status: 'published', features: [], source_url: 'https://www.pedifix.com/products/' + k, skus: skus.map((s) => ({ sku: s, status: 'active' })), field_provenance: {} }, extra || {});
const content = { pages: {
  a: pg('a', ['P1']), b: pg('b', ['P2', 'P3']), c: pg('c', ['P4'], { features: ['x'] }), d: pg('d', ['P5']), e: pg('e', ['P6']), f: pg('f', ['P7']),
  g: pg('g', ['P8'], { status: 'hidden' }), h: pg('h', ['P9']), i: pg('i', ['P10']) } };
const fam = (k, codes) => ({ product_url: 'https://www.pedifix.com/products/' + k, codes });
const research = { families: [fam('a', ['P1']), fam('b', ['P2']), fam('c', ['P4']), fam('d', ['P5']), fam('e', ['P6']), fam('h', ['P9']), fam('i', ['P10'])] };
const page = (k, feats) => ({ source: { url: 'https://www.pedifix.com/products/' + k }, draft: { features: feats } });
const review = { line: { pages: ['a', 'b', 'c', 'd', 'e', 'i'].map((k) => page(k, ['Self-Adhesive'])).concat([page('h', ['Relieve Plantar Fasciitis Pain'])]),
  skus: [{ sku: 'P5', reasons: [{ code: 'otc_drug_facts' }] }, { sku: 'P1', reasons: [] }] } };
const p = plan({ content, research, review, retired: ['P6'], today: '2026-11-14' });
const by = Object.fromEntries(p.rows.map((r) => [r.page_key, r.reason || 'eligible']));
assert.deepStrictEqual(by, { a: 'eligible', b: 'sku_not_exact_match', c: 'has_features', d: 'held_in_review', e: 'no_dealer_active_sku', f: 'source_page_not_harvested', g: 'page_not_published', h: 'health_claim_wording', i: 'eligible' });
assert.strictEqual(p.skus, 2);
const out = apply(content, p);
assert.deepStrictEqual(out.pages.a.features, ['Self-Adhesive']);
assert.match(out.pages.a.field_provenance.features, /pedifix\.com product page .* verbatim; owner-approved/);
assert.deepStrictEqual(out.pages.c.features, ['x'], 'existing features untouched');
assert.deepStrictEqual(content.pages.a.features, [], 'input not mutated');
for(const k of Object.keys(content.pages)) for(const f of Object.keys(content.pages[k])) if(!['features', 'field_provenance'].includes(f)) assert.deepStrictEqual(out.pages[k][f], content.pages[k][f], k + '.' + f + ' unchanged');
assert(!CLAIM.test('Relieves Pressure on Toe Tips') && !CLAIM.test('Gel Heel Cushion') && CLAIM.test('Speeds Healing') && CLAIM.test('Proven Effective'));
console.log('apply-content-features: ok');
