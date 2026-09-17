-- shared_menu_products.category has no English counterpart - the
-- "Shared Library" dialog's category filter always showed Arabic even
-- when the app was set to English, since there was nothing else to show.
alter table public.shared_menu_products add column if not exists category_en text;

-- Backfill the 4 categories the admin dialog's own suggestion pills
-- already used before category_en existed - anything outside these 4
-- needs a manual translation from the admin (the dialog now has a
-- translate button for that).
update public.shared_menu_products set category_en = 'Soft Drinks' where category_en is null and category = 'مشروبات غازية';
update public.shared_menu_products set category_en = 'Natural Juices' where category_en is null and category = 'عصائر طبيعية';
update public.shared_menu_products set category_en = 'Desserts' where category_en is null and category = 'حلويات';
update public.shared_menu_products set category_en = 'Sauces' where category_en is null and category = 'صوصات';

-- Verification - any row here needs a manual English category.
select id, name, category, category_en from public.shared_menu_products where category_en is null;
