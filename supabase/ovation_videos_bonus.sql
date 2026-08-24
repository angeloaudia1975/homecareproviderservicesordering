-- ============================================================================
-- Partner 360 · Ovation Medical — bonus videos for ALREADY-COVERED products
-- Two product videos have appeared on ovationmed.com since the first docs/videos
-- pass. These UPDATEs touch ONLY the videos column, so existing documents are kept.
-- Optional. Idempotent.
-- ============================================================================

update public.product_content
set videos = '[{"title": "Nu-Form Ankle Brace — Patented Design", "url": "https://www.ovationmed.com/app/uploads/2024/05/Nu-Form-Ankle-3-Patented.mp4"}]'::jsonb
where manufacturer='ovation-medical' and page_key='nu-form-ankle-brace';

update public.product_content
set videos = '[{"title": "Gen 2® Walking Boot — Overview", "url": "https://www.ovationmed.com/app/uploads/2024/01/Big-Rig-Media-OvationMedical_Gen2Boot.mp4"}]'::jsonb
where manufacturer='ovation-medical' and page_key='gen2-walking-boot';
