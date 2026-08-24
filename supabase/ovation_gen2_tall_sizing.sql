-- ============================================================================
-- Partner 360 · Ovation Gen 2® Walking Boot — TALL (Standard) models sizing
-- Applies to BOTH tall-height models. The manufacturer's "Standard Sizes" chart
-- lists both part-number series: 100xx = Tall Pneumatic, 110xx = Tall
-- Non-Pneumatic. Foot sizing is identical for pneumatic and non-pneumatic;
-- only height/inflation differ. Each model gets its OWN part numbers below.
--
-- (The json column-order ALTERs are idempotent — a no-op if ovation_gen2_short_sizing.sql
-- already ran. They keep columns in authored order: Part Number, Size, Men's Shoe, Women's Shoe.)
-- ============================================================================

alter table public.product_content         alter column sizing_table type json using sizing_table::json;
alter table public.product_content_sources alter column sizing_rows  type json using sizing_rows::json;

-- Tall Pneumatic (Standard Pneumatic Walker) — SKUs 10002–10008 --------------
update public.product_content
set sizing_table = '[
  {"Part Number":"10002","Size":"X-Small","Men''s Shoe":"2-4","Women''s Shoe":"3.5-5.5"},
  {"Part Number":"10003","Size":"Small","Men''s Shoe":"4.5-6.5","Women''s Shoe":"6-8"},
  {"Part Number":"10005","Size":"Medium","Men''s Shoe":"7-10","Women''s Shoe":"8.5-11.5"},
  {"Part Number":"10007","Size":"Large","Men''s Shoe":"10.5-12.5","Women''s Shoe":"12-14"},
  {"Part Number":"10008","Size":"X-Large","Men''s Shoe":"13-15","Women''s Shoe":"14.5-16.5"}
]'::json,
    sizing_note = 'Tall (standard-height) model. Fit by US shoe size.'
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-tall-air';

-- Tall Non-Pneumatic (Standard Walker) — SKUs 11002–11008 --------------------
update public.product_content
set sizing_table = '[
  {"Part Number":"11002","Size":"X-Small","Men''s Shoe":"2-4","Women''s Shoe":"3.5-5.5"},
  {"Part Number":"11003","Size":"Small","Men''s Shoe":"4.5-6.5","Women''s Shoe":"6-8"},
  {"Part Number":"11005","Size":"Medium","Men''s Shoe":"7-10","Women''s Shoe":"8.5-11.5"},
  {"Part Number":"11007","Size":"Large","Men''s Shoe":"10.5-12.5","Women''s Shoe":"12-14"},
  {"Part Number":"11008","Size":"X-Large","Men''s Shoe":"13-15","Women''s Shoe":"14.5-16.5"}
]'::json,
    sizing_note = 'Tall (standard-height) model. Fit by US shoe size.'
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-tall-non-pneumatic';

-- Verify (optional):
-- select page_key, sizing_table from public.product_content
-- where manufacturer='ovation-medical' and page_key like 'gen2-walking-boot-tall%' order by page_key;
