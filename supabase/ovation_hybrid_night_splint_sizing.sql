-- ============================================================================
-- Partner 360 · Ovation Hybrid Night Splint — sizing chart
-- Single-model product (page_key hybrid-night-splint), two sizes. Columns kept
-- in authored order (Part Number, Sizes, Men's Shoe, Women's Shoe) via json.
-- The json ALTERs are idempotent — a no-op if a prior Gen 2 sizing file ran.
-- ============================================================================

alter table public.product_content         alter column sizing_table type json using sizing_table::json;
alter table public.product_content_sources alter column sizing_rows  type json using sizing_rows::json;

update public.product_content
set sizing_table = '[
  {"Part Number":"30014","Sizes":"Small to Medium","Men''s Shoe":"Fits shoe sizes 5 to 9","Women''s Shoe":"Fits shoe sizes 6 to 10"},
  {"Part Number":"30016","Sizes":"Large to X-Large","Men''s Shoe":"Fits shoe sizes 9.5 to 14","Women''s Shoe":"Fits shoe sizes 10.5 to 15"}
]'::json,
    sizing_note = null
where manufacturer='ovation-medical' and page_key='hybrid-night-splint';

-- Verify (optional):
-- select page_key, sizing_table from public.product_content
-- where manufacturer='ovation-medical' and page_key='hybrid-night-splint';
