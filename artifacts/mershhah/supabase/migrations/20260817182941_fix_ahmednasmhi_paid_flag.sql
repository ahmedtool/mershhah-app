update public.restaurants set is_paid_plan = true where id = 'e94c8f7a-2fc9-4dde-a793-0a3b1840937d';

update public.public_pages
set data = jsonb_set(data, '{restaurant,is_paid_plan}', 'true'::jsonb),
    updated_at = now()
where id = 'ahmednasmhi-358';

select id, username, is_paid_plan from public.restaurants where id = 'e94c8f7a-2fc9-4dde-a793-0a3b1840937d';
