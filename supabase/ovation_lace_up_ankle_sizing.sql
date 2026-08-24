-- ============================================================================
-- Partner 360 · Ovation Lace-Up Ankle Brace — sizing chart
-- Single-model product (page_key lace-up-ankle), sized by ankle circumference.
-- Columns kept in authored order (Part Number, Sizes, Ankle Circumference) via json.
-- The json ALTERs are idempotent — a no-op if a prior sizing file ran.
-- ============================================================================

alter table public.product_content         alter column sizing_table type json using sizing_table::json;
alter table public.product_content_sources alter column sizing_rows  type json using sizing_rows::json;

update public.product_content
set sizing_table = '[
  {"Part Number":"25001","Sizes":"XX-Small","Ankle Circumference":"9\"-10\""},
  {"Part Number":"25002","Sizes":"X-Small","Ankle Circumference":"10\"-11\""},
  {"Part Number":"25003","Sizes":"Small","Ankle Circumference":"11\"-12\""},
  {"Part Number":"25005","Sizes":"Medium","Ankle Circumference":"12\"-13\""},
  {"Part Number":"25007","Sizes":"Large","Ankle Circumference":"13\"-14\""},
  {"Part Number":"25008","Sizes":"X-Large","Ankle Circumference":"14\"-15\""},
  {"Part Number":"25009","Sizes":"XX-Large","Ankle Circumference":"15\"-16\""}
]'::json,
    sizing_note = null
where manufacturer='ovation-medical' and page_key='lace-up-ankle';

-- Verify (optional):
-- select page_key, sizing_table from public.product_content
-- where manufacturer='ovation-medical' and page_key='lace-up-ankle';
