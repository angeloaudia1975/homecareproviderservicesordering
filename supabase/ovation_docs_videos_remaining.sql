-- ============================================================================
-- Partner 360 · Ovation Medical — documents & videos (remaining products)
-- Instruction sheets (IFU) pulled from the ovationmed.com WordPress media library
-- (wp-json/wp/v2/media). Completes the docs/videos sweep alongside ovation_docs_videos.sql.
-- Run once. Idempotent (full overwrite per product).
--
-- Coverage note: of the 13 products not covered by the first pass, these 5 have an
-- IFU on the manufacturer site. The other 8 — Foam Ankle Stirrups (ankle-stirrup),
-- Post-Op Shoe (post-op-shoe), Casting Tape (casting-tape), Roll Splint (roll-splint),
-- Gauze (gauze), Cloth Tape (tape), Compression Wrap (compression-wrap), and
-- Elastic Bandage (elastic-bandage) — have NO documents or videos published by Ovation
-- (verified against the complete media library: 77 PDFs, 8 videos). They are left as-is.
-- ============================================================================

update public.product_content
set documents = '[{"title": "Instructions for Use (IFU)", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Lace-up-Ankle-IFU.pdf"}]'::jsonb,
    videos = '[]'::jsonb
where manufacturer='ovation-medical' and page_key='lace-up-ankle';

update public.product_content
set documents = '[{"title": "Instructions for Use (IFU)", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Lumbar-Support-5.5x8.5-R1.pdf"}]'::jsonb,
    videos = '[]'::jsonb
where manufacturer='ovation-medical' and page_key='lumbar-support';

update public.product_content
set documents = '[{"title": "Instructions for Use (IFU)", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Neoprene-Knee-Support-with-Stabilized-Patella-IFU.pdf"}]'::jsonb,
    videos = '[]'::jsonb
where manufacturer='ovation-medical' and page_key='neoprene-knee';

update public.product_content
set documents = '[{"title": "Instructions for Use (IFU)", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Posterior-Night-Splint-IFU.pdf"}]'::jsonb,
    videos = '[]'::jsonb
where manufacturer='ovation-medical' and page_key='night-splint';

update public.product_content
set documents = '[{"title": "Instructions for Use (IFU)", "type": "instructions", "hosted": false, "url": "https://www.ovationmed.com/app/uploads/2023/09/Pressure-Relief-Pad-IFU.pdf"}]'::jsonb,
    videos = '[]'::jsonb
where manufacturer='ovation-medical' and page_key='pressure-relief-pad';
