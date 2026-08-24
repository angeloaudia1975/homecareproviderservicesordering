-- ============================================================================
-- Partner 360 · Ovation Universal LS Double-Pull Back Brace — sizing chart
-- Single-model product (page_key ls-double-pull-back), two sizes by waist range.
-- Columns kept in authored order (Description, Part Number, Size) via json.
-- The json ALTERs are idempotent — a no-op if a prior sizing file ran.
-- ============================================================================

alter table public.product_content         alter column sizing_table type json using sizing_table::json;
alter table public.product_content_sources alter column sizing_rows  type json using sizing_rows::json;

update public.product_content
set sizing_table = '[
  {"Description":"Universal Double-Pull LS","Part Number":"61001","Size":"25\"-50\""},
  {"Description":"Universal Double-Pull LS","Part Number":"61003","Size":"50\"-60\" (4XL)"}
]'::json,
    sizing_note = null
where manufacturer='ovation-medical' and page_key='ls-double-pull-back';

-- Verify (optional):
-- select page_key, sizing_table from public.product_content
-- where manufacturer='ovation-medical' and page_key='ls-double-pull-back';
