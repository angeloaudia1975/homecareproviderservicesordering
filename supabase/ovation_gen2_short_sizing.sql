-- ============================================================================
-- Partner 360 · Ovation Gen 2® Walking Boot — SHORT models sizing chart
-- Applies to BOTH short-height models (foot sizing is identical for pneumatic
-- and non-pneumatic; only height/inflation differ). The manufacturer's "Short
-- Sizes" chart lists both part-number series: 101xx = Short Pneumatic,
-- 111xx = Short Non-Pneumatic. Each model gets its OWN part numbers below.
--
-- Column-order fix: sizing_table / sizing_rows are switched from jsonb to json
-- so the table renders columns in the authored order (Part Number, Size, Men's
-- Shoe, Women's Shoe). jsonb normalizes key order by length, which would bury
-- "Part Number" in the middle. Safe: nothing uses jsonb operators on these
-- columns (verified) — they are only stored, selected, and rendered by key.
-- Idempotent (re-running the ALTERs on a json column is a no-op).
-- ============================================================================

alter table public.product_content         alter column sizing_table type json using sizing_table::json;
alter table public.product_content_sources alter column sizing_rows  type json using sizing_rows::json;

-- Short Pneumatic (Short Pneumatic Walker) — SKUs 10102–10108 ----------------
update public.product_content
set sizing_table = '[
  {"Part Number":"10102","Size":"X-Small","Men''s Shoe":"2-4","Women''s Shoe":"3.5-5.5"},
  {"Part Number":"10103","Size":"Small","Men''s Shoe":"4.5-6.5","Women''s Shoe":"6-8"},
  {"Part Number":"10105","Size":"Medium","Men''s Shoe":"7-10","Women''s Shoe":"8.5-11.5"},
  {"Part Number":"10107","Size":"Large","Men''s Shoe":"10.5-12.5","Women''s Shoe":"12-14"},
  {"Part Number":"10108","Size":"X-Large","Men''s Shoe":"13-15","Women''s Shoe":"14.5-16.5"}
]'::json,
    sizing_note = 'Short-height model. Fit by US shoe size.'
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-short-air';

-- Short Non-Pneumatic (Short Walker) — SKUs 11102–11108 ----------------------
update public.product_content
set sizing_table = '[
  {"Part Number":"11102","Size":"X-Small","Men''s Shoe":"2-4","Women''s Shoe":"3.5-5.5"},
  {"Part Number":"11103","Size":"Small","Men''s Shoe":"4.5-6.5","Women''s Shoe":"6-8"},
  {"Part Number":"11105","Size":"Medium","Men''s Shoe":"7-10","Women''s Shoe":"8.5-11.5"},
  {"Part Number":"11107","Size":"Large","Men''s Shoe":"10.5-12.5","Women''s Shoe":"12-14"},
  {"Part Number":"11108","Size":"X-Large","Men''s Shoe":"13-15","Women''s Shoe":"14.5-16.5"}
]'::json,
    sizing_note = 'Short-height model. Fit by US shoe size.'
where manufacturer='ovation-medical' and page_key='gen2-walking-boot-short-non-pneumatic';

-- Verify (optional):
-- select page_key, sizing_table from public.product_content
-- where manufacturer='ovation-medical' and page_key like 'gen2-walking-boot-short%' order by page_key;
