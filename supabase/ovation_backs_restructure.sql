-- ============================================================================
-- Partner 360 · Ovation "Backs" de-merge — split ls-double-pull-back (26 SKUs)
-- into the 8 distinct products it was actually bundling. SKUs route to each
-- product by its catalog group(s) (variant_group; pipe-delimited = spans
-- standard + 4XL groups). LS/LST/LST-Plus are separate products (each std+4XL).
-- The 5 non-double-pull products (Flex Power Plus, Spine Brace, Tri-Mod,
-- Premium Plus Back 8-Inch, Nu-Form Extension Belt) become their own records.
--
-- New/updated records are status='pending_review' (except LS which is already
-- approved) — review & approve each in the enrichment tool to complete the
-- de-merge. Requires the pipe-delimited variant_group routing in public/index.html.
-- Idempotent (upsert on manufacturer,page_key).
-- ============================================================================

-- 1) Universal LS Double-Pull — repurpose the existing (approved) record
update public.product_content set
  name='Universal LS Double-Pull Back Brace',
  billing_codes='["L0627", "L0642"]'::jsonb,
  options='{"Size": ["Standard (25\"-50\")", "4XL (50\"-60\")"]}'::jsonb,
  skus='["61001", "61003"]'::jsonb, sku_count=2,
  variant_group='Backs::Universal LS Double Pull|Backs::Universal (4XL) LS Double Pull', parent_key=null, is_parent=false
where manufacturer='ovation-medical' and page_key='ls-double-pull-back';

-- Universal LST Double-Pull Back Brace  (2 SKUs)
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'lst-double-pull', 'Universal LST Double-Pull Back Brace', 'The Universal LST Double-Pull adds rigid lateral panels to the double-pull lumbosacral design for higher, firmer thoracolumbar support. The dual-pulley system delivers adjustable compression, and universal sizing with easily adjustable straps allows quick clinical application.', '["Rigid lateral panels add higher, firmer thoracolumbar support.", "Double-pull pulley system provides adjustable compression.", "Universally sized; easily adjustable straps for quick application.", "Anterior panel included.", "Breathable, comfortable materials."]'::jsonb, '["Lumbar spinal post-op care", "Chronic lower back pain", "Lumbar sprains and strains", "Post-operative support"]'::jsonb, '{"Size": ["Standard", "4XL"]}'::jsonb, '["L0631", "L0648"]'::jsonb,
   null, 'Backs', '["61002", "61004"]'::jsonb, 2, 'Backs::Universal LST Double Pull|Backs::Universal (4XL) LST Double Pull', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;

-- Universal LST Plus Double-Pull Back Brace  (2 SKUs)
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'lst-plus-double-pull', 'Universal LST Plus Double-Pull Back Brace', 'The Universal LST Plus Double-Pull provides the most extensive coverage in the double-pull line, with extended rigid panels for maximum thoracolumbar support. Dual-pulley compression, universal sizing, and adjustable straps for quick clinical application.', '["Extended rigid panels for maximum thoracolumbar support.", "Double-pull pulley system provides adjustable compression.", "Universally sized; adjustable straps.", "Anterior panel included."]'::jsonb, '["Lumbar spinal post-op care", "Chronic lower back pain", "Fracture management", "Post-operative support"]'::jsonb, '{"Size": ["Standard", "4XL"]}'::jsonb, '["L0637", "L0650"]'::jsonb,
   null, 'Backs', '["61007", "61008"]'::jsonb, 2, 'Backs::Universal LST Plus Double Pull|Backs::Universal LST Plus (4XL) Double Pull', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;

-- Flex Power Plus Back Brace  (5 SKUs)  — needs content enrichment
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'flex-power-plus', 'Flex Power Plus Back Brace', '', '[]'::jsonb, '[]'::jsonb, '{"Size": ["Small", "Medium", "Large", "X-Large", "XX-Large"]}'::jsonb, '[]'::jsonb,
   null, 'Backs', '["60023", "60025", "60027", "60028", "60029"]'::jsonb, 5, 'Backs::Flex Power Plus', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;

-- Spine Brace  (6 SKUs)  — needs content enrichment
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'spine-brace', 'Spine Brace', '', '[]'::jsonb, '[]'::jsonb, '{"Size": ["Small", "Medium", "Large", "X-Large", "XX-Large", "XXX-Large"]}'::jsonb, '[]'::jsonb,
   null, 'Backs', '["60010", "60013", "60015", "60017", "60018", "60019"]'::jsonb, 6, 'Backs::Spine Brace', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;

-- Tri-Mod System Back Brace  (5 SKUs)  — needs content enrichment
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'tri-mod-system', 'Tri-Mod System Back Brace', '', '[]'::jsonb, '[]'::jsonb, '{"Size": ["Small", "Medium", "Large", "X-Large", "XX-Large"]}'::jsonb, '[]'::jsonb,
   null, 'Backs', '["60033", "60035", "60037", "60038", "60039"]'::jsonb, 5, 'Backs::Tri-Mod System', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;

-- Premium Plus Back, 8-Inch  (2 SKUs)  — needs content enrichment
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'premium-plus-back-8', 'Premium Plus Back, 8-Inch', '', '[]'::jsonb, '[]'::jsonb, '{"Size": ["Large", "X-Large"], "Color": ["Black"]}'::jsonb, '[]'::jsonb,
   null, 'Backs', '["60067", "60068"]'::jsonb, 2, 'Backs::Premium Plus Back, 8-Inch', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;

-- Nu-Form Universal Extension Belt  (2 SKUs)
insert into public.product_content
  (manufacturer, page_key, name, description, features, clinical_applications, options, billing_codes,
   image, category, skus, sku_count, variant_group, is_parent, status)
values
  ('ovation-medical', 'nu-form-extension-belt', 'Nu-Form Universal Extension Belt', 'Extension belt accessory for the Nu-Form Universal Back Brace, extending the waist range for larger patients. Available individually or in a 10-pack.', '["Extends the waist range of the Nu-Form Universal Back Brace.", "Available individually or in a 10-pack."]'::jsonb, '[]'::jsonb, '{"Pack": ["Single", "10-Pack"]}'::jsonb, '[]'::jsonb,
   null, 'Backs', '["61000-2", "61000-210"]'::jsonb, 2, 'Backs::Nu-Form Universal Extension Belt|Backs::Nu-Form Universal Extension Belt 10-Pack', false, 'pending_review')
on conflict (manufacturer, page_key) do update set
  name=excluded.name, description=excluded.description, features=excluded.features,
  clinical_applications=excluded.clinical_applications, options=excluded.options,
  billing_codes=excluded.billing_codes, category=excluded.category, skus=excluded.skus,
  sku_count=excluded.sku_count, variant_group=excluded.variant_group, is_parent=false;
