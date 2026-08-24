-- ============================================================================
-- Partner 360 · Ovation Medical — Gen 2 Walking Boot VARIANTS (4 models)
-- Splits the 20-SKU Gen 2 record into its four real manufacturer models, each with
-- its OWN page, primary image, IFU, height + pneumatic spec, and billing codes.
-- Shared Gen 2 content (story, features, clinical uses, overview video) is COPIED
-- into each model so every record is self-contained.
-- Status = pending_review: review & approve each model in the enrichment tool.
-- Run AFTER product_content_variants.sql. Idempotent (upsert per page_key).
-- ============================================================================

insert into public.product_content
  (manufacturer, page_key, name, tagline, description, features, clinical_applications, options, billing_codes,
   image, category, sku_count, skus, images_gallery, sizing_table, sizing_note, documents, videos,
   parent_key, variant_label, variant_group, variant_order, is_parent, status)
values
  ('ovation-medical', 'gen2-walking-boot-tall-air', 'Gen 2® Walking Boot (Tall Pneumatic)', 'The World''s Most Advanced Walker',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '["Pneumatic air bladders provide adjustable compression and actively reduce edema.", "Incredibly light weight and low profile.", "Intuitive Sole allows patients to track naturally with their own gait pattern.", "Shock-Pod feature results in 50% less energy being transferred to the injured limb upon each heel strike.", "Sure-Grip resting surface prevents the limb from slipping when elevated on a smooth surface.", "Sculpted frame accommodates a wide variety of patient anatomies.", "Easy single push-button release system."]'::jsonb, '["Soft tissue injuries", "Grade 2 and 3 sprains / stable fractures", "Post-operative use", "Trauma and rehab"]'::jsonb, '{"Height": ["Tall"], "Inflation": ["Pneumatic"], "Color": ["Blue", "Red", "Black", "Grey"], "Size": ["X-Small", "Small", "Medium", "Large", "X-Large"]}'::jsonb, '["L4360", "L4361"]'::jsonb,
   'https://www.ovationmed.com/app/uploads/2023/08/01-10007BLU-STANDARD-PNEUMATIC-WALKER-1.jpg', 'Walking Boots', 5, '["10002", "10003", "10005", "10007", "10008"]'::jsonb,
   '[{"url": "https://www.ovationmed.com/app/uploads/2023/08/01-10007BLU-STANDARD-PNEUMATIC-WALKER-1.jpg", "caption": "Tall Pneumatic — Blue", "primary": true}]'::jsonb, '[]'::jsonb, 'Available in 5 sizes (X-Small–X-Large). Tall height, Pneumatic.',
   '[{"title": "Instructions for Use (IFU) — Pneumatic", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Pneumatic-Walking-Boot-IFU.pdf"}]'::jsonb, '[{"title": "Gen 2® Walking Boot — Overview", "url": "https://www.ovationmed.com/app/uploads/2024/01/Big-Rig-Media-OvationMedical_Gen2Boot.mp4"}]'::jsonb,
   'gen2-walking-boot', 'Tall Pneumatic', 'Pneumatic Walkers::Standard Pneumatic Walker', 1, false, 'pending_review')
on conflict (manufacturer, page_key) do update set
   name=excluded.name, tagline=excluded.tagline, description=excluded.description, features=excluded.features,
   clinical_applications=excluded.clinical_applications, options=excluded.options, billing_codes=excluded.billing_codes,
   image=excluded.image, category=excluded.category, sku_count=excluded.sku_count, skus=excluded.skus,
   images_gallery=excluded.images_gallery, sizing_note=excluded.sizing_note, documents=excluded.documents,
   videos=excluded.videos, parent_key=excluded.parent_key, variant_label=excluded.variant_label,
   variant_group=excluded.variant_group, variant_order=excluded.variant_order, is_parent=false,
   status='pending_review', updated_at=now();

insert into public.product_content_sources
  (manufacturer, page_key, source, source_label, source_url, name, description, images,
   parent_key, variant_label, variant_group, captured_at)
values
  ('ovation-medical', 'gen2-walking-boot-tall-air', 'website', 'Manufacturer Website', 'https://www.ovationmed.com/products-medical/gen-2-walking-boot-tall-air/', 'Gen 2® Walking Boot (Tall Pneumatic)',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '[{"url": "https://www.ovationmed.com/app/uploads/2023/08/01-10007BLU-STANDARD-PNEUMATIC-WALKER-1.jpg", "caption": "Tall Pneumatic — primary"}]'::jsonb,
   'gen2-walking-boot', 'Tall Pneumatic', 'Pneumatic Walkers::Standard Pneumatic Walker', now())
on conflict (manufacturer, page_key, source) do update set
   source_url=excluded.source_url, name=excluded.name, description=excluded.description, images=excluded.images,
   parent_key=excluded.parent_key, variant_label=excluded.variant_label, variant_group=excluded.variant_group;

insert into public.product_content
  (manufacturer, page_key, name, tagline, description, features, clinical_applications, options, billing_codes,
   image, category, sku_count, skus, images_gallery, sizing_table, sizing_note, documents, videos,
   parent_key, variant_label, variant_group, variant_order, is_parent, status)
values
  ('ovation-medical', 'gen2-walking-boot-short-air', 'Gen 2® Walking Boot (Short Pneumatic)', 'The World''s Most Advanced Walker',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '["Short, low-profile height with pneumatic air bladders for adjustable compression and edema control.", "Incredibly light weight and low profile.", "Intuitive Sole allows patients to track naturally with their own gait pattern.", "Shock-Pod feature results in 50% less energy being transferred to the injured limb upon each heel strike.", "Sure-Grip resting surface prevents the limb from slipping when elevated on a smooth surface.", "Sculpted frame accommodates a wide variety of patient anatomies.", "Easy single push-button release system."]'::jsonb, '["Soft tissue injuries", "Grade 2 and 3 sprains / stable fractures", "Post-operative use", "Trauma and rehab"]'::jsonb, '{"Height": ["Short"], "Inflation": ["Pneumatic"], "Color": ["Blue", "Red", "Black", "Grey"], "Size": ["X-Small", "Small", "Medium", "Large", "X-Large"]}'::jsonb, '["L4360", "L4361"]'::jsonb,
   'https://www.ovationmed.com/app/uploads/2023/08/01-10107BLU-SHORT-PNEUMATIC-WALKER-1.jpg', 'Walking Boots', 5, '["10102", "10103", "10105", "10107", "10108"]'::jsonb,
   '[{"url": "https://www.ovationmed.com/app/uploads/2023/08/01-10107BLU-SHORT-PNEUMATIC-WALKER-1.jpg", "caption": "Short Pneumatic — Blue", "primary": true}]'::jsonb, '[]'::jsonb, 'Available in 5 sizes (X-Small–X-Large). Short height, Pneumatic.',
   '[{"title": "Instructions for Use (IFU) — Short Pneumatic", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Pneumatic-Short-Walking-Boot-IFU.pdf"}]'::jsonb, '[{"title": "Gen 2® Walking Boot — Overview", "url": "https://www.ovationmed.com/app/uploads/2024/01/Big-Rig-Media-OvationMedical_Gen2Boot.mp4"}]'::jsonb,
   'gen2-walking-boot', 'Short Pneumatic', 'Pneumatic Walkers::Short Pneumatic Walker', 2, false, 'pending_review')
on conflict (manufacturer, page_key) do update set
   name=excluded.name, tagline=excluded.tagline, description=excluded.description, features=excluded.features,
   clinical_applications=excluded.clinical_applications, options=excluded.options, billing_codes=excluded.billing_codes,
   image=excluded.image, category=excluded.category, sku_count=excluded.sku_count, skus=excluded.skus,
   images_gallery=excluded.images_gallery, sizing_note=excluded.sizing_note, documents=excluded.documents,
   videos=excluded.videos, parent_key=excluded.parent_key, variant_label=excluded.variant_label,
   variant_group=excluded.variant_group, variant_order=excluded.variant_order, is_parent=false,
   status='pending_review', updated_at=now();

insert into public.product_content_sources
  (manufacturer, page_key, source, source_label, source_url, name, description, images,
   parent_key, variant_label, variant_group, captured_at)
values
  ('ovation-medical', 'gen2-walking-boot-short-air', 'website', 'Manufacturer Website', 'https://www.ovationmed.com/products-medical/gen-2-walking-boot-short-air/', 'Gen 2® Walking Boot (Short Pneumatic)',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '[{"url": "https://www.ovationmed.com/app/uploads/2023/08/01-10107BLU-SHORT-PNEUMATIC-WALKER-1.jpg", "caption": "Short Pneumatic — primary"}]'::jsonb,
   'gen2-walking-boot', 'Short Pneumatic', 'Pneumatic Walkers::Short Pneumatic Walker', now())
on conflict (manufacturer, page_key, source) do update set
   source_url=excluded.source_url, name=excluded.name, description=excluded.description, images=excluded.images,
   parent_key=excluded.parent_key, variant_label=excluded.variant_label, variant_group=excluded.variant_group;

insert into public.product_content
  (manufacturer, page_key, name, tagline, description, features, clinical_applications, options, billing_codes,
   image, category, sku_count, skus, images_gallery, sizing_table, sizing_note, documents, videos,
   parent_key, variant_label, variant_group, variant_order, is_parent, status)
values
  ('ovation-medical', 'gen2-walking-boot-tall-non-pneumatic', 'Gen 2® Walking Boot (Tall Non-Pneumatic)', 'The World''s Most Advanced Walker',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '["Tall upright frame with a non-pneumatic foam liner for a secure, comfortable fit.", "Incredibly light weight and low profile.", "Intuitive Sole allows patients to track naturally with their own gait pattern.", "Shock-Pod feature results in 50% less energy being transferred to the injured limb upon each heel strike.", "Sure-Grip resting surface prevents the limb from slipping when elevated on a smooth surface.", "Sculpted frame accommodates a wide variety of patient anatomies.", "Easy single push-button release system."]'::jsonb, '["Soft tissue injuries", "Grade 2 and 3 sprains / stable fractures", "Post-operative use", "Trauma and rehab"]'::jsonb, '{"Height": ["Tall"], "Inflation": ["Non-Pneumatic"], "Color": ["Blue", "Red", "Black", "Grey"], "Size": ["X-Small", "Small", "Medium", "Large", "X-Large"]}'::jsonb, '["L4386", "L4387"]'::jsonb,
   'https://www.ovationmed.com/app/uploads/2023/07/01-11007BLU-STANDARD-WALKER-BLUE.jpg', 'Walking Boots', 5, '["11002", "11003", "11005", "11007", "11008"]'::jsonb,
   '[{"url": "https://www.ovationmed.com/app/uploads/2023/07/01-11007BLU-STANDARD-WALKER-BLUE.jpg", "caption": "Tall Non-Pneumatic — Blue", "primary": true}]'::jsonb, '[]'::jsonb, 'Available in 5 sizes (X-Small–X-Large). Tall height, Non-Pneumatic.',
   '[{"title": "Instructions for Use (IFU) — Standard", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Standard-Walking-Boot-IFU.pdf"}, {"title": "PDAC Coding Verification (Gen 2 Walker, Non-Air)", "type": "other", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/08/PDAC-LETTER-WALKER-GEN2-NON-AIR-.pdf"}]'::jsonb, '[{"title": "Gen 2® Walking Boot — Overview", "url": "https://www.ovationmed.com/app/uploads/2024/01/Big-Rig-Media-OvationMedical_Gen2Boot.mp4"}]'::jsonb,
   'gen2-walking-boot', 'Tall Non-Pneumatic', 'Standard Walkers::Standard Walker', 3, false, 'pending_review')
on conflict (manufacturer, page_key) do update set
   name=excluded.name, tagline=excluded.tagline, description=excluded.description, features=excluded.features,
   clinical_applications=excluded.clinical_applications, options=excluded.options, billing_codes=excluded.billing_codes,
   image=excluded.image, category=excluded.category, sku_count=excluded.sku_count, skus=excluded.skus,
   images_gallery=excluded.images_gallery, sizing_note=excluded.sizing_note, documents=excluded.documents,
   videos=excluded.videos, parent_key=excluded.parent_key, variant_label=excluded.variant_label,
   variant_group=excluded.variant_group, variant_order=excluded.variant_order, is_parent=false,
   status='pending_review', updated_at=now();

insert into public.product_content_sources
  (manufacturer, page_key, source, source_label, source_url, name, description, images,
   parent_key, variant_label, variant_group, captured_at)
values
  ('ovation-medical', 'gen2-walking-boot-tall-non-pneumatic', 'website', 'Manufacturer Website', 'https://www.ovationmed.com/products-medical/gen-2-walking-boot-tall-non-pneumatic/', 'Gen 2® Walking Boot (Tall Non-Pneumatic)',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '[{"url": "https://www.ovationmed.com/app/uploads/2023/07/01-11007BLU-STANDARD-WALKER-BLUE.jpg", "caption": "Tall Non-Pneumatic — primary"}]'::jsonb,
   'gen2-walking-boot', 'Tall Non-Pneumatic', 'Standard Walkers::Standard Walker', now())
on conflict (manufacturer, page_key, source) do update set
   source_url=excluded.source_url, name=excluded.name, description=excluded.description, images=excluded.images,
   parent_key=excluded.parent_key, variant_label=excluded.variant_label, variant_group=excluded.variant_group;

insert into public.product_content
  (manufacturer, page_key, name, tagline, description, features, clinical_applications, options, billing_codes,
   image, category, sku_count, skus, images_gallery, sizing_table, sizing_note, documents, videos,
   parent_key, variant_label, variant_group, variant_order, is_parent, status)
values
  ('ovation-medical', 'gen2-walking-boot-short-non-pneumatic', 'Gen 2® Walking Boot (Short Non-Pneumatic)', 'The World''s Most Advanced Walker',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '["Short, low-profile height with a non-pneumatic foam liner for a secure, comfortable fit.", "Incredibly light weight and low profile.", "Intuitive Sole allows patients to track naturally with their own gait pattern.", "Shock-Pod feature results in 50% less energy being transferred to the injured limb upon each heel strike.", "Sure-Grip resting surface prevents the limb from slipping when elevated on a smooth surface.", "Sculpted frame accommodates a wide variety of patient anatomies.", "Easy single push-button release system."]'::jsonb, '["Soft tissue injuries", "Grade 2 and 3 sprains / stable fractures", "Post-operative use", "Trauma and rehab"]'::jsonb, '{"Height": ["Short"], "Inflation": ["Non-Pneumatic"], "Color": ["Blue", "Red", "Black", "Grey"], "Size": ["X-Small", "Small", "Medium", "Large", "X-Large"]}'::jsonb, '["L4386", "L4387"]'::jsonb,
   'https://www.ovationmed.com/app/uploads/2023/07/01-11107BLU-SHORT-WALKER-BLUE-1.jpg', 'Walking Boots', 5, '["11102", "11103", "11105", "11107", "11108"]'::jsonb,
   '[{"url": "https://www.ovationmed.com/app/uploads/2023/07/01-11107BLU-SHORT-WALKER-BLUE-1.jpg", "caption": "Short Non-Pneumatic — Blue", "primary": true}]'::jsonb, '[]'::jsonb, 'Available in 5 sizes (X-Small–X-Large). Short height, Non-Pneumatic.',
   '[{"title": "Instructions for Use (IFU) — Short Standard", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Standard-Short-Walking-Boot-IFU.pdf"}, {"title": "PDAC Coding Verification (Gen 2 Walker, Non-Air)", "type": "other", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/08/PDAC-LETTER-WALKER-GEN2-NON-AIR-.pdf"}]'::jsonb, '[{"title": "Gen 2® Walking Boot — Overview", "url": "https://www.ovationmed.com/app/uploads/2024/01/Big-Rig-Media-OvationMedical_Gen2Boot.mp4"}]'::jsonb,
   'gen2-walking-boot', 'Short Non-Pneumatic', 'Standard Walkers::Short Walker', 4, false, 'pending_review')
on conflict (manufacturer, page_key) do update set
   name=excluded.name, tagline=excluded.tagline, description=excluded.description, features=excluded.features,
   clinical_applications=excluded.clinical_applications, options=excluded.options, billing_codes=excluded.billing_codes,
   image=excluded.image, category=excluded.category, sku_count=excluded.sku_count, skus=excluded.skus,
   images_gallery=excluded.images_gallery, sizing_note=excluded.sizing_note, documents=excluded.documents,
   videos=excluded.videos, parent_key=excluded.parent_key, variant_label=excluded.variant_label,
   variant_group=excluded.variant_group, variant_order=excluded.variant_order, is_parent=false,
   status='pending_review', updated_at=now();

insert into public.product_content_sources
  (manufacturer, page_key, source, source_label, source_url, name, description, images,
   parent_key, variant_label, variant_group, captured_at)
values
  ('ovation-medical', 'gen2-walking-boot-short-non-pneumatic', 'website', 'Manufacturer Website', 'https://www.ovationmed.com/products-medical/gen-2-walking-boot-short-non-pneumatic/', 'Gen 2® Walking Boot (Short Non-Pneumatic)',
   'Ovation''s patented Gen 2® Walking Boot has been validated as the most advanced double upright walker on the market by healthcare professionals worldwide. Designed with the patient in mind, our Gen 2® eliminates all of the issues associated with old style walking boots. Lightyears ahead of its competition, the Gen 2® is the best option for your patients.', '[{"url": "https://www.ovationmed.com/app/uploads/2023/07/01-11107BLU-SHORT-WALKER-BLUE-1.jpg", "caption": "Short Non-Pneumatic — primary"}]'::jsonb,
   'gen2-walking-boot', 'Short Non-Pneumatic', 'Standard Walkers::Short Walker', now())
on conflict (manufacturer, page_key, source) do update set
   source_url=excluded.source_url, name=excluded.name, description=excluded.description, images=excluded.images,
   parent_key=excluded.parent_key, variant_label=excluded.variant_label, variant_group=excluded.variant_group;
