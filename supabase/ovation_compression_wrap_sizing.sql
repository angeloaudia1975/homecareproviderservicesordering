-- Ovation Self-Adhering Compression Wrap — size chart onto its website source.
update public.product_content_sources
set sizing_rows = '[{"Part Number": "BC002SN", "Size": "2” x 5 yd", "U/M": "12 rolls"}, {"Part Number": "BC003SN", "Size": "3” x 5 yd", "U/M": "12 rolls"}, {"Part Number": "BC004SN", "Size": "4” x 5 yd", "U/M": "12 rolls"}, {"Part Number": "BC006SN", "Size": "6” x 5 yd", "U/M": "12 rolls"}]'::jsonb, sizing_note = null, captured_at = now()
where manufacturer = 'ovation-medical' and page_key = 'compression-wrap' and source = 'website';
