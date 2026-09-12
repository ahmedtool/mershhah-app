-- The public menu page (/menu/:username) reads from public_pages, a
-- denormalized cache synced only when an owner action calls
-- syncPublicPage() - a direct SQL UPDATE on menu_items/restaurants (like
-- the previous two cleanup migrations) never touches this cache, so the
-- broken translation kept showing to visitors even after the source
-- tables were fixed. Patches the cache directly, system-wide for the
-- size-name tag artifact, and for "saudi" specifically for the
-- description that migration 20260912050000 set on the live table but
-- never reached this cache.

update public.public_pages pp
set data = jsonb_set(
  pp.data,
  '{menu}',
  (
    select coalesce(jsonb_agg(
      jsonb_set(
        item,
        '{sizes}',
        (
          select coalesce(jsonb_agg(
            case when (sz->>'name_en') ~ '<[^>]*>' then
              sz || jsonb_build_object('name_en', trim(regexp_replace(sz->>'name_en', '<[^>]*>', '', 'g')))
            else sz end
          ), '[]'::jsonb)
          from jsonb_array_elements(item->'sizes') sz
        )
      )
    ), '[]'::jsonb)
    from jsonb_array_elements(pp.data->'menu') item
  )
)
where pp.data->'menu' is not null and pp.data::text ~ '<[^>]*>';

update public.public_pages
set data = jsonb_set(
  data,
  '{restaurant,description_en}',
  '"A restaurant serving the most delicious dishes of the Saudi people."'
)
where id = 'saudi';
