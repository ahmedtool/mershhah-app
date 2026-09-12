-- Cleans up size name_en values that already got saved with leaked
-- CAT-tool placeholder markup (e.g. <ph x="1" type="2906"/>) before the
-- translate-text.ts sanitization fix landed - system-wide, any restaurant
-- affected, not just one.
update public.menu_items
set sizes = (
  select jsonb_agg(
    case when (elem->>'name_en') ~ '<[^>]*>' then
      elem || jsonb_build_object('name_en', trim(regexp_replace(elem->>'name_en', '<[^>]*>', '', 'g')))
    else elem end
  )
  from jsonb_array_elements(sizes) elem
)
where sizes::text ~ '<[^>]*>';

-- Sets the English description for "البيت السعودي" directly, since it
-- was never translated.
update public.restaurants
set description_en = 'A restaurant serving the most delicious dishes of the Saudi people.'
where id = 'e94c8f7a-2fc9-4dde-a793-0a3b1840937d';
