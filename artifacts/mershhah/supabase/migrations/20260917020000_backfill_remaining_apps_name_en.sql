-- 20260917010000 only knew about the 4 original delivery apps
-- (jahez/hungerstation/toyou/keeta). The verification query at the end of
-- that migration turned up 4 more apps (loyalty/rewards platforms, not
-- delivery) that were also added before name_en existed and never got one:
-- barakah, koinz, bonat, nugttah. Matches by id, same as every other app in
-- this table (jahez -> Jahez, noon_food -> Noon Food, etc.) - these ids are
-- already the intended Latin brand spelling, just never title-cased into
-- name_en.
update public.applications set name_en = 'Barakah' where name_en is null and id = 'barakah';
update public.applications set name_en = 'Koinz' where name_en is null and id = 'koinz';
update public.applications set name_en = 'Bonat' where name_en is null and id = 'bonat';
update public.applications set name_en = 'Nugttah' where name_en is null and id = 'nugttah';

-- Same denormalized-copy propagation as 20260917010000, for any
-- restaurant/branch that already toggled one of these on.
update public.branches b
set applications = (
  select jsonb_agg(
    case when (elem->>'type') = 'global' and a.name_en is not null
      then elem || jsonb_build_object('name_en', a.name_en)
      else elem
    end
  )
  from jsonb_array_elements(b.applications) elem
  left join public.applications a on a.id = elem->>'platformId'
)
where b.applications is not null and jsonb_array_length(b.applications) > 0;

update public.restaurants r
set applications = (
  select jsonb_agg(
    case when (elem->>'type') = 'global' and a.name_en is not null
      then elem || jsonb_build_object('name_en', a.name_en)
      else elem
    end
  )
  from jsonb_array_elements(r.applications) elem
  left join public.applications a on a.id = elem->>'platformId'
)
where r.applications is not null and jsonb_array_length(r.applications) > 0;

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

-- Verification - should return zero rows now.
select id, name, name_en from public.applications where name_en is null;
