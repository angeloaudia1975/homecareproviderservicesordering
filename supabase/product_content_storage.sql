-- ============================================================================
-- Partner 360 · Product Content — image storage bucket
-- Creates a PUBLIC bucket for images pasted / uploaded in the enrichment tool.
-- Public read (dealers load the images); writes go only through the Netlify
-- function using the service-role key. Run once. Safe to re-run.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-content', 'product-content', true)
on conflict (id) do update set public = true;
