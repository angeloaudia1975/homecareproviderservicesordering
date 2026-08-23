-- Compact Pro ROM Post-Op Knee Brace — size chart onto its website source.
update public.product_content_sources
set sizing_rows = '[{"Part Number": "51500", "Description": "Compact Pro, Post-Op Knee w/ Quick Release Buckle, Standard Wrap w/ Drop Lock, Standard", "Thigh Circumference": "Up to 29”"}, {"Part Number": "51508", "Description": "Compact Pro, Post-Op Knee w/ Quick Release Buckle, Standard Wrap w/ Drop Lock, X-Large", "Thigh Circumference": "Up to 35”"}]'::jsonb, sizing_note = null, captured_at = now()
where manufacturer = 'ovation-medical' and page_key = 'compact-pro-rom' and source = 'website';
