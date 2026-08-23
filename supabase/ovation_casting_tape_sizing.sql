-- Ovation Premium Fiberglass Casting Tape — size chart onto its website source.
update public.product_content_sources
set sizing_rows = '[{"Part Number": "CF002", "Size": "2”", "U/M": "10/bx"}, {"Part Number": "CF003", "Size": "3”", "U/M": "10/bx"}, {"Part Number": "CF004", "Size": "4”", "U/M": "10/bx"}, {"Part Number": "CF005", "Size": "5”", "U/M": "10/bx"}]'::jsonb, sizing_note = null, captured_at = now()
where manufacturer = 'ovation-medical' and page_key = 'casting-tape' and source = 'website';
