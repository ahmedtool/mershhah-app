-- Replace the guessed Kinza flavors with the real product lineup
DELETE FROM public.shared_menu_products WHERE name IN ('كينزا تفاح', 'كينزا تروبيكال');

INSERT INTO public.shared_menu_products (id, name, category, created_at, updated_at) VALUES
(gen_random_uuid(), 'كينزا كولا', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا برتقال', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا حمضيات', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا ليمون', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا رمان', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا توت بري', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا دايت كولا', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا ليمون زيرو', 'مشروبات باردة', now(), now());
