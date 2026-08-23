-- Arm Sling With Padded Shoulder — add the size chart to its website source.
-- Columns render in the order given: Size · Length... · Part Number.
update public.product_content_sources
set sizing_rows = '[{"Size": "X-Small", "Length from elbow to metacarpal in inches": "9” – 11”", "Part Number": "58012"}, {"Size": "Small", "Length from elbow to metacarpal in inches": "11” – 13”", "Part Number": "58013"}, {"Size": "Medium", "Length from elbow to metacarpal in inches": "13” – 15”", "Part Number": "58015"}, {"Size": "Large", "Length from elbow to metacarpal in inches": "15” – 17”", "Part Number": "58017"}, {"Size": "X-Large", "Length from elbow to metacarpal in inches": "17” – 19”", "Part Number": "58018"}]'::jsonb,
    sizing_note = null,
    captured_at = now()
where manufacturer = 'ovation-medical' and page_key = 'arm-sling' and source = 'website';
