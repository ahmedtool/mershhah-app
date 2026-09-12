-- Backfills name_en onto existing branch/restaurant delivery-app link
-- entries for global apps (jahez/hungerstation/etc.), joined from the
-- admin catalog (public.applications.name_en) by platformId. Needed
-- because these are denormalized copies made at toggle-on time - adding
-- name_en to the catalog table doesn't retroactively update copies that
-- already existed. New toggles from now on carry it automatically.

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
