-- ============================================================================
-- Partner 360 · Ovation Gen 2® Walking Boot — narrow each model's Options
-- Each of the 4 models should list only ITS OWN Height + Inflation; Color stays
-- shared (all models come in Blue/Red/Black/Grey). The 5 sizes remain the SKU
-- dimension, not an option chip. Updates the display record (product_content) and
-- the PDF source capture (so a future re-merge stays narrow). Idempotent.
--
--   Tall Pneumatic      → Height: Tall  · Inflation: Pneumatic
--   Short Pneumatic     → Height: Short · Inflation: Pneumatic
--   Tall Non-Pneumatic  → Height: Tall  · Inflation: Non-Pneumatic
--   Short Non-Pneumatic → Height: Short · Inflation: Non-Pneumatic
-- ============================================================================

-- Tall Pneumatic (Standard Pneumatic Walker) ---------------------------------
update public.product_content
set options = '{"Height":["Tall"],"Inflation":["Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-tall-air';
update public.product_content_sources
set options = '{"Height":["Tall"],"Inflation":["Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-tall-air' and source='pdf';

-- Short Pneumatic (Short Pneumatic Walker) -----------------------------------
update public.product_content
set options = '{"Height":["Short"],"Inflation":["Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-short-air';
update public.product_content_sources
set options = '{"Height":["Short"],"Inflation":["Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-short-air' and source='pdf';

-- Tall Non-Pneumatic (Standard Walker) ---------------------------------------
update public.product_content
set options = '{"Height":["Tall"],"Inflation":["Non-Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-tall-non-pneumatic';
update public.product_content_sources
set options = '{"Height":["Tall"],"Inflation":["Non-Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-tall-non-pneumatic' and source='pdf';

-- Short Non-Pneumatic (Short Walker) -----------------------------------------
update public.product_content
set options = '{"Height":["Short"],"Inflation":["Non-Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-short-non-pneumatic';
update public.product_content_sources
set options = '{"Height":["Short"],"Inflation":["Non-Pneumatic"],"Color":["Blue","Red","Black","Grey"]}'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-short-non-pneumatic' and source='pdf';

-- Verify (optional):
-- select page_key, options from public.product_content
-- where manufacturer='ovation-medical' and page_key like 'gen2-walking-boot-%' order by page_key;
