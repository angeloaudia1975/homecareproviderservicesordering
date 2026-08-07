-- ============================================================================
-- Retire "Complete Medical Supplies" from the HCPS ordering platform.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Removes it from ordering access (Dealer Manager grid + portal) and from the
-- catalog/admin manufacturer lists. HISTORICAL SALES ARE KEPT — the manufacturers
-- row is deactivated (not deleted) so past commission/analytics still resolve its
-- name. The catalog data file is also removed from the portal manifest separately.
-- ============================================================================

-- 1) Remove ordering-access grants everywhere (unchecks it in every dealer's grid,
--    and drops it from each dealer's portal entitlement).
delete from dealer_manufacturers where manufacturer = 'complete-medical-supplies';

-- 2) Hide it from the catalog + admin manufacturer lists (keep the row for history).
update manufacturers set active = false where slug = 'complete-medical-supplies';

-- 3) Clear any catalog customizations for it (logo, custom products, links, overrides,
--    featured items). Each is safe/no-op if there was nothing set.
delete from featured_products where manufacturer = 'complete-medical-supplies';
delete from product_links     where manufacturer = 'complete-medical-supplies';
delete from custom_products   where manufacturer = 'complete-medical-supplies';
delete from product_overrides where manufacturer = 'complete-medical-supplies';
delete from manufacturer_meta where slug = 'complete-medical-supplies';
