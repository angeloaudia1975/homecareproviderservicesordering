-- ============================================================================
-- Partner 360 · Ovation Universal LST Double-Pull + LST Plus Double-Pull — sizing
-- Two single-model products, two sizes each (Standard 25"-50", 4XL 50"-60").
-- Part numbers/descriptions verified against Ovation's own size charts:
--   LST      (L0631, page_key lst-double-pull)      61002 / 61004
--   LST Plus (L0637, page_key lst-plus-double-pull) 61007 / 61008
-- Columns kept in authored order (Description, Part Number, Size) via json.
-- The json ALTERs are idempotent — a no-op if a prior sizing file already ran.
-- ============================================================================

alter table public.product_content         alter column sizing_table type json using sizing_table::json;
alter table public.product_content_sources alter column sizing_rows  type json using sizing_rows::json;

-- Universal LST Double-Pull Back Brace (L0631)
update public.product_content
set sizing_table = '[
  {"Description":"Universal Double-Pull LST","Part Number":"61002","Size":"25\"-50\""},
  {"Description":"Universal Double-Pull LST","Part Number":"61004","Size":"50\"-60\" (4XL)"}
]'::json,
    sizing_note = null
where manufacturer='ovation-medical' and page_key='lst-double-pull';

-- Universal LST Plus Double-Pull Back Brace (L0637)
update public.product_content
set sizing_table = '[
  {"Description":"LST Double-Pull With Lateral Panel Universal","Part Number":"61007","Size":"25\"-50\""},
  {"Description":"LST Double-Pull With Lateral Panel Universal","Part Number":"61008","Size":"50\"-60\" (4XL)"}
]'::json,
    sizing_note = null
where manufacturer='ovation-medical' and page_key='lst-plus-double-pull';

-- Verify (optional):
-- select page_key, sizing_table from public.product_content
-- where manufacturer='ovation-medical' and page_key in ('lst-double-pull','lst-plus-double-pull');
