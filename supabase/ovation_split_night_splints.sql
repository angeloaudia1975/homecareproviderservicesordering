-- ============================================================================
-- Partner 360 · FIRST-PASS SPLIT — Ovation "Posterior Night Splint" (8 SKUs)
-- One catalog record on page 12 actually bundled THREE distinct products:
--   • Posterior Night Splint          31003/31005/31007  (S/M/L)     HCPCS L4396
--   • Dorsal Night Splint             30004/30006        (S-M/L-XL)  HCPCS L4396
--   • Step Free Ankle Stabilizer      22003/22005/22007  (S/M/L)     HCPCS L1902  (an
--       ankle brace, not a night splint — explains the stray L1902 on the old record)
--
-- Part-number → product mapping verified against Ovation Medical product pages
-- (posterior image 01-31007-POSTERIOR-NIGHT; dorsal image 30004-DORSAL-NIGHT-SPLINT;
--  Step Free item #220 / 2200x on ovationmed.com, dme-direct, getabrace).
--
-- This is the SQL equivalent of the workspace "Split" action, run once. It writes a
-- product_content_history row first, so the whole split is reversible from the
-- Catalog Management Workspace → History → Undo. Idempotent: re-running is a no-op
-- once the split has happened (guarded on the source still having >3 SKUs).
--
-- ⚠ HCPCS are set to the standard prefab-PF codes (L4396 night splints, L1902 ankle
--   gauntlet). CONFIRM each against Ovation's coded catalog p.12 before publishing.
--   All three products are left in 'pending_review' — nothing publishes until you
--   review & Publish them in the workspace.
-- ============================================================================
begin;

-- 1) History snapshot (before) — enables Undo. Guarded so re-runs don't duplicate.
insert into public.product_content_history (manufacturer, page_key, action, actor, summary, before, after)
select 'ovation-medical','night-splint','split','HCPS admin (SQL first pass)',
  'Split "Posterior Night Splint" (8 SKUs) → Posterior Night Splint + Dorsal Night Splint + Step Free Ankle Stabilizer',
  jsonb_build_array(to_jsonb(pc.*)),
  '[{"page_key":"night-splint"},{"page_key":"dorsal-night-splint"},{"page_key":"step-free-ankle-stabilizer"}]'::jsonb
from public.product_content pc
where pc.manufacturer='ovation-medical' and pc.page_key='night-splint'
  and jsonb_array_length(coalesce(to_jsonb(pc.skus),'[]'::jsonb)) > 3;

-- 2) NEW · Dorsal Night Splint (30004 / 30006)
insert into public.product_content
  (manufacturer, page_key, name, tagline, description, features, clinical_applications,
   options, billing_codes, category, sku_count, skus, sizing_table, source_pages,
   source_files, confidence, msrp_rule, status)
values ('ovation-medical','dorsal-night-splint','Dorsal Night Splint', null, 'The Dorsal Night Splint uses a lightweight, low-profile design to alleviate the discomfort of plantar fasciitis and heel pain. Its dorsal (top-of-foot) construction allows for easy application and improved patient compliance while gently stretching the plantar fascia and Achilles tendon overnight.',
   '["Lightweight, low-profile dorsal design allows for easy application and improved compliance.","Gently stretches the plantar fascia and Achilles tendon overnight to relieve first-step pain.","Open, dorsal (top-of-foot) construction keeps pressure off the heel and sole.","Soft lined interior is breathable, comfortable, and washable."]'::jsonb, '["Plantar fasciitis","Achilles tendonitis","Heel pain","Drop foot","Post-static pain"]'::jsonb, '{"Size":["Small to Medium","Large to X-Large"]}'::jsonb,
   '["L4396"]'::jsonb, 'Night Splints', 2, '[{"sku":"30004","name":"Dorsal Night Splint","size":"Small to Medium","hcpcs":"L4396","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"},{"sku":"30006","name":"Dorsal Night Splint","size":"Large to X-Large","hcpcs":"L4396","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"}]'::jsonb, '{"columns":["Part Number","Size","Men''s Shoe","Women''s Shoe"],"rows":[{"Part Number":"30004","Size":"Small to Medium","Men''s Shoe":"Fits shoe sizes 5 to 9","Women''s Shoe":"Fits shoe sizes 6 to 10"},{"Part Number":"30006","Size":"Large to X-Large","Men''s Shoe":"Fits shoe sizes 9.5 to 14","Women''s Shoe":"Fits shoe sizes 10.5 to 15"}]}'::json, '12',
   '["Ovation_Medical_Coded_Product_Catalog_2026.pdf","Ovation_Medical_Retail_Catalog_2026.pdf"]'::jsonb, 0.9, 'single_unit_x2', 'pending_review')
on conflict (manufacturer, page_key) do update set
   name=excluded.name, description=excluded.description, features=excluded.features,
   clinical_applications=excluded.clinical_applications, options=excluded.options,
   billing_codes=excluded.billing_codes, category=excluded.category,
   sku_count=excluded.sku_count, skus=excluded.skus, sizing_table=excluded.sizing_table,
   source_pages=excluded.source_pages, msrp_rule=excluded.msrp_rule, updated_at=now();

-- 3) NEW · Step Free Ankle Stabilizer (22003 / 22005 / 22007) — category "Ankles"
insert into public.product_content
  (manufacturer, page_key, name, tagline, description, features, clinical_applications,
   options, billing_codes, category, sku_count, skus, sizing_table, source_pages,
   source_files, confidence, msrp_rule, status)
values ('ovation-medical','step-free-ankle-stabilizer','Step Free Ankle Stabilizer', null, 'A lightweight, low-profile ankle stabilizer that delivers massage-like compression for daytime relief of plantar fasciitis and heel pain. Worn discreetly in most shoes, it supports the ankle and plantar fascia while remaining flexible enough for everyday activity.',
   '["Massage-like compression provides daytime relief from plantar fasciitis and heel pain.","Lightweight and low-profile — worn discreetly inside most shoes.","Supports the plantar fascia and ankle while remaining flexible enough for everyday activity.","Left/right universal design."]'::jsonb, '["Plantar fasciitis","Heel pain","Achilles tendonitis"]'::jsonb, '{"Size":["Small","Medium","Large"]}'::jsonb,
   '["L1902"]'::jsonb, 'Ankles', 3, '[{"sku":"22003","name":"Step Free Ankle Stabilizer","size":"Small","hcpcs":"L1902","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"},{"sku":"22005","name":"Step Free Ankle Stabilizer","size":"Medium","hcpcs":"L1902","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"},{"sku":"22007","name":"Step Free Ankle Stabilizer","size":"Large","hcpcs":"L1902","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"}]'::jsonb, '{"columns":["Part Number","Size","Men''s Shoe","Women''s Shoe"],"rows":[{"Part Number":"22003","Size":"Small","Men''s Shoe":"Up to 7","Women''s Shoe":"Up to 8.5"},{"Part Number":"22005","Size":"Medium","Men''s Shoe":"7.5 to 11","Women''s Shoe":"9 to 12.5"},{"Part Number":"22007","Size":"Large","Men''s Shoe":"11.5+","Women''s Shoe":"13+"}]}'::json, '12',
   '["Ovation_Medical_Coded_Product_Catalog_2026.pdf","Ovation_Medical_Retail_Catalog_2026.pdf"]'::jsonb, 0.9, 'single_unit_x2', 'pending_review')
on conflict (manufacturer, page_key) do update set
   name=excluded.name, description=excluded.description, features=excluded.features,
   clinical_applications=excluded.clinical_applications, options=excluded.options,
   billing_codes=excluded.billing_codes, category=excluded.category,
   sku_count=excluded.sku_count, skus=excluded.skus, sizing_table=excluded.sizing_table,
   source_pages=excluded.source_pages, msrp_rule=excluded.msrp_rule, updated_at=now();

-- 4) UPDATE · keep the original record as the Posterior Night Splint only (31003/31005/31007)
update public.product_content set
   name='Posterior Night Splint',
   description='Ovation''s take on the classic posterior night splint is thoughtfully elevated to provide enhanced comfort. Adjustable bilateral straps allow for a comfortable and gradual stretch of the plantar fascia and Achilles tendon, holding the foot at a 90-degree angle to promote proper healing overnight.',
   features='["Bilateral straps easily adjust flexion, providing a comfortable and gradual stretch of the plantar fascia and Achilles tendon.","Dorsi-flexion can be adjusted off of 90°, allowing for a customized range of motion.","Padded shell holds the foot at a 90-degree angle, providing optimal support and promoting proper healing.","Soft lined interior is breathable, comfortable, and washable.","Straps are padded for comfort across the dorsum of the ankle.","Easy-release buckles are simple to use."]'::jsonb,
   clinical_applications='["Plantar fasciitis","Achilles tendonitis","Heel pain","Drop foot","Post-static pain"]'::jsonb,
   options='{"Size":["Small","Medium","Large"]}'::jsonb,
   billing_codes='["L4396"]'::jsonb,
   category='Night Splints',
   sku_count=3,
   skus='[{"sku":"31003","name":"Posterior Night Splint","size":"Small","hcpcs":"L4396","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"},{"sku":"31005","name":"Posterior Night Splint","size":"Medium","hcpcs":"L4396","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"},{"sku":"31007","name":"Posterior Night Splint","size":"Large","hcpcs":"L4396","group":"","status":"active","disabled":false,"image":"","images":[],"source":"Ovation Coded Product Catalog 2026, p.12"}]'::jsonb,
   sizing_table='{"columns":["Part Number","Size","Men (fits)","Women (fits)"],"rows":[{"Part Number":"31003","Size":"Small","Men (fits)":"Up to 7\"","Women (fits)":"Up to 7.5\""},{"Part Number":"31005","Size":"Medium","Men (fits)":"7.5\"-10\"","Women (fits)":"8\"-10.5\""},{"Part Number":"31007","Size":"Large","Men (fits)":"10.5\"+","Women (fits)":"11\"+"}]}'::json,
   msrp_rule='single_unit_x2',
   status='pending_review',
   updated_at=now()
where manufacturer='ovation-medical' and page_key='night-splint';

commit;

-- Verify:
-- select page_key, name, category, sku_count, status,
--        jsonb_pretty(to_jsonb(skus)) as skus
-- from public.product_content
-- where manufacturer='ovation-medical'
--   and page_key in ('night-splint','dorsal-night-splint','step-free-ankle-stabilizer')
-- order by page_key;
