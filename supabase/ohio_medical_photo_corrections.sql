-- Ohio Medical / GCE photo corrections (owner 2026-11-12). Changes ONLY the "image" of 5 saved catalog edits:
--   · RS-00522, RS-00604 (US AC power supply): GCE's own US-site photo of the supply (no European plug shown);
--   · RS-00502-X-D, RS-00608-X-S, RS-00608-X-D (no backpack): their own photos instead of the backpack-bundle photo.
-- Prices, names, descriptions and every other row are untouched. The earlier photos stay in storage (never deleted).
-- Refuses unless exactly the 5 expected rows hold exactly the expected current photos.
begin;
do $om$
declare n int;
begin
  select count(*) into n from public.product_overrides
   where manufacturer = 'ohio-medical' and (
         (code = 'RS-00522'     and patch->>'image' like '%/product-images/gce/RS-00522.webp%')
      or (code = 'RS-00604'     and patch->>'image' like '%/product-images/gce/RS-00604.jpg%')
      or (code = 'RS-00502-X-D' and patch->>'image' = '/assets/products/gce/RS-00502-X-D_RS-00536.jpg')
      or (code = 'RS-00608-X-S' and patch->>'image' = '/assets/products/gce/RS-00608-X-S_RS-00619.jpg')
      or (code = 'RS-00608-X-D' and patch->>'image' = '/assets/products/gce/RS-00608-X-D_RS-00619.jpg'));
  if n <> 5 then raise exception 'expected 5 rows with their current photos, found % — nothing written', n; end if;
  update public.product_overrides o
     set patch = jsonb_set(o.patch, '{image}', to_jsonb(v.img))
    from (values ('RS-00522',     '/assets/products/gce/RS-00522.webp'),
                 ('RS-00604',     '/assets/products/gce/RS-00604.jpg'),
                 ('RS-00502-X-D', '/assets/products/ohio-medical/RS-00502-X-D.jpg'),
                 ('RS-00608-X-S', '/assets/products/ohio-medical/RS-00608-X-S.jpg'),
                 ('RS-00608-X-D', '/assets/products/ohio-medical/RS-00608-X-D.jpg')) as v(code, img)
   where o.manufacturer = 'ohio-medical' and o.code = v.code;
end $om$;
commit;
select code, patch->>'image' as image, patch->>'base_price' as base_price
  from public.product_overrides
 where manufacturer = 'ohio-medical' and code in ('RS-00522','RS-00604','RS-00502-X-D','RS-00608-X-S','RS-00608-X-D')
 order by code;
