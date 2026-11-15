#!/usr/bin/env node
/* Owner-approved FEATURE batch onto a line's dealer content file (public/data/content/<line>.json) — dry run by default.
   Fills ONLY an empty `features` list on a published page, with the manufacturer's own bullets from a reviewed
   enrichment harvest (admin repo scripts/enrichment-harvest.js → scripts/content-review.js). A page qualifies only when:
     · it is published and not switched off, its features are empty and no owner/earlier provenance names features;
     · its manufacturer source page is the harvested product page (same URL), and EVERY dealer-active SKU on the page is
       one of that product's exactly-matched SKUs;
     · none of its SKUs is held in review (Drug Facts, ingredient/regulatory, health-claim wording, not found);
     · it has at least one dealer-active SKU (retired SKUs never count).
   Nothing else on the page changes (description, images, options, SKUs, status); the catalog file and every price are
   untouched. Writes a private before/after + rollback record to --evidence (outside the repo).
     node scripts/apply-content-features.js --line pedifix --research <dir> --review <dir> --retired <file> --evidence <file> [--apply] */
'use strict';
const fs = require('fs'), path = require('path');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const HOLD_KINDS = new Set(['otc_drug_facts', 'regulatory_check', 'claim_attribution', 'not_found', 'capacity_conflict', 'warranty_conflict', 'spec_conflict', 'unsupported_claim', 'catalog_fact_unconfirmed']);
/* Health-claim wording the owner keeps out of this batch (2026-11-14): a named condition, healing, proven efficacy,
   antimicrobial / antifungal action, treatment or a diabetic-care claim. Plain comfort / protection wording
   ("Relieves pressure on toe tips", "Helps prevent blisters") is not held. A page with any such bullet is held whole. */
const CLAIM = /\b(plantar fasci\w*|neuroma|metatarsalgia|plantar plate|injur\w*|heal(ing|s)?\b|proven|clinical\w*|doctor|podiatrist\w*|diabet\w*|anti-?microbial|anti-?fungal\w*|antibacterial|bacteri\w*|fung\w*|infection|treat(ment|s)?\b|cure\w*|medicat\w*|arthritis|tendonitis|bursitis|sciatica|gout)/i;
const urlKey = (u) => { try{ return decodeURIComponent(String(u || '')).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); }catch(e){ return String(u || '').toLowerCase(); } };
const up = (s) => String(s || '').trim().toUpperCase();

function plan({ content, research, review, retired, today }){
  const fams = new Map(research.families.map((f) => [urlKey(f.product_url), f]));
  const draftBySrc = new Map(review.line.pages.map((p) => [urlKey(p.source && p.source.url), p]));
  const held = new Map(); for(const s of review.line.skus){ const k = s.reasons.map((r) => r.code).filter((c) => HOLD_KINDS.has(c)); if(k.length) held.set(up(s.sku), k); }
  const ret = new Set(retired.map(up));
  const rows = [], counts = {};
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  for(const [key, pg] of Object.entries(content.pages)){
    const active = (pg.skus || []).filter((s) => s && s.status !== 'retired' && s.disabled !== true && !ret.has(up(s.sku))).map((s) => up(s.sku));
    let why = null, fam = null, draft = null;
    if(pg.status !== 'published' || pg.disabled === true) why = 'page_not_published';
    else if(!active.length) why = 'no_dealer_active_sku';
    else if((pg.features || []).length) why = 'has_features';
    else if(pg.field_provenance && pg.field_provenance.features) why = 'features_provenance_recorded';
    else if(!(fam = fams.get(urlKey(pg.source_url)))) why = 'source_page_not_harvested';
    else if(!active.every((c) => fam.codes.map(up).includes(c))) why = 'sku_not_exact_match';
    else if((pg.skus || []).some((s) => held.has(up(s.sku)))) why = 'held_in_review';
    else if(!(draft = draftBySrc.get(urlKey(pg.source_url))) || !(draft.draft.features || []).length) why = 'no_manufacturer_bullets';
    else if(draft.draft.features.some((f) => CLAIM.test(f))) why = 'health_claim_wording';
    bump(why || 'eligible');
    rows.push({ page_key: key, source_url: pg.source_url, active_skus: active, eligible: !why, reason: why, claims: why === 'health_claim_wording' ? draft.draft.features.filter((f) => CLAIM.test(f)) : undefined, held: why === 'held_in_review' ? (pg.skus || []).filter((s) => held.has(up(s.sku))).map((s) => [s.sku, held.get(up(s.sku))]) : undefined,
      before: { features: pg.features || [], features_provenance: (pg.field_provenance || {}).features || null },
      after: why ? null : { features: draft.draft.features.map((f) => f.replace(/ &; /g, ' & ')), features_provenance: 'pedifix.com product page ' + pg.source_url + ' (read ' + today + ') — the manufacturer\'s own bullets, verbatim; owner-approved feature batch ' + today } });
  }
  return { rows, counts, skus: rows.filter((r) => r.eligible).reduce((a, r) => a + r.active_skus.length, 0) };
}
function apply(content, p){
  const out = JSON.parse(JSON.stringify(content));
  for(const r of p.rows.filter((x) => x.eligible)){ const pg = out.pages[r.page_key]; pg.features = r.after.features; pg.field_provenance = Object.assign({}, pg.field_provenance, { features: r.after.features_provenance }); }
  return out;
}
module.exports = { plan, apply, urlKey, CLAIM };
if(require.main === module){
  const line = arg('--line'), file = path.join(__dirname, '..', 'public', 'data', 'content', line + '.json');
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  const research = JSON.parse(fs.readFileSync(path.join(arg('--research'), line + '-content.json'), 'utf8'));
  const review = JSON.parse(fs.readFileSync(path.join(arg('--review'), line + '-review.json'), 'utf8'));
  const retired = fs.readFileSync(arg('--retired'), 'utf8').split(/\s+/).filter(Boolean);
  const p = plan({ content, research, review, retired, today: new Date().toISOString().slice(0, 10) });
  const ev = arg('--evidence'); if(ev){ if(path.resolve(ev).startsWith(path.resolve(__dirname, '..') + path.sep)) throw new Error('evidence stays outside the repo'); fs.writeFileSync(ev, JSON.stringify(p, null, 1)); }
  console.log(JSON.stringify({ line, pages: Object.keys(content.pages).length, counts: p.counts, eligible_pages: p.rows.filter((r) => r.eligible).length, eligible_active_skus: p.skus, applied: process.argv.includes('--apply') }));
  if(process.argv.includes('--apply')){ const raw = fs.readFileSync(file, 'utf8'); const ind = /^\{\n( +)"/.exec(raw); fs.writeFileSync(file, JSON.stringify(apply(content, p), null, ind ? ind[1].length : 0) + (raw.endsWith('\n') ? '\n' : '')); }
}
