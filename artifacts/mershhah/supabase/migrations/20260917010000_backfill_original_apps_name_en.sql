-- 20260912020000 added name_en to public.applications and seeded 7 new
-- delivery platforms with it, but explicitly skipped jahez/hungerstation/
-- toyou/keeta "since those already exist" - leaving name_en NULL for the
-- 4 original apps ever since. That's why an owner's menu still shows
-- these 4 in Arabic even after switching the app to English: there was
-- simply no English name stored to fall back to.
--
-- Matches by id first (same slug convention as every app added since -
-- 'jahez', 'hungerstation', 'toyou', 'keeta' per the 20260912020000
-- comment), with a name-text fallback in case any of these rows predate
-- that id convention.
update public.applications set name_en = 'Jahez'
  where name_en is null and (id = 'jahez' or name = 'جاهز');
update public.applications set name_en = 'HungerStation'
  where name_en is null and (id = 'hungerstation' or name = 'هنقرستيشن');
update public.applications set name_en = 'ToYou'
  where name_en is null and (id = 'toyou' or name ilike '%تو يو%' or name ilike '%toyou%');
update public.applications set name_en = 'Keeta'
  where name_en is null and (id = 'keeta' or name = 'كيتا');

-- Same denormalized-copy backfill as 20260912040000/20260912070000, now
-- that these 4 apps finally have a name_en to copy - a restaurant/branch
-- that toggled one of them on before today would otherwise keep showing
-- Arabic forever, since the copy is only made once, at toggle-on time.
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

-- Verification - should return zero rows once this migration matched
-- every original app correctly. Any row still here means the id/name
-- match above missed it and needs a manual name_en update.
select id, name, name_en from public.applications where name_en is null;
