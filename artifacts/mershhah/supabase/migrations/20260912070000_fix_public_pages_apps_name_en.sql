-- Same public_pages cache-staleness pattern as 20260912060000, this time
-- for branch delivery-app link names: the 20260912040000 backfill only
-- patched the live branches/restaurants tables, never the cache that
-- /menu/:username actually reads. System-wide fix, not restaurant-specific.
update public.public_pages pp
set data = jsonb_set(
  pp.data,
  '{branches}',
  (
    select coalesce(jsonb_agg(
      jsonb_set(
        branch,
        '{applications}',
        (
          select coalesce(jsonb_agg(
            case when (app_elem->>'type') = 'global' and a.name_en is not null
              then app_elem || jsonb_build_object('name_en', a.name_en)
              else app_elem
            end
          ), '[]'::jsonb)
          from jsonb_array_elements(branch->'applications') app_elem
          left join public.applications a on a.id = app_elem->>'platformId'
        )
      )
    ), '[]'::jsonb)
    from jsonb_array_elements(pp.data->'branches') branch
  )
)
where pp.data->'branches' is not null;
