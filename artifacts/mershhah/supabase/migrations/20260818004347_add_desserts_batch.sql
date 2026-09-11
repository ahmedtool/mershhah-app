-- Add mini pancake, crepe, waffle, kunafa (+ diet variants), and ice
-- cream menus to the shared product library (category: حلويات).

INSERT INTO public.shared_menu_products (id, name, category, created_at, updated_at) VALUES
-- ميني بان كيك
(gen_random_uuid(), 'ميني بان كيك نوتيلا', 'حلويات', now(), now()),
(gen_random_uuid(), 'ميني بان كيك لوتس', 'حلويات', now(), now()),
(gen_random_uuid(), 'ميني بان كيك بستاشيو', 'حلويات', now(), now()),
(gen_random_uuid(), 'ميني بان كيك كيندر', 'حلويات', now(), now()),
(gen_random_uuid(), 'ميني بان كيك مكس', 'حلويات', now(), now()),

-- كريب
(gen_random_uuid(), 'كريب نوتيلا', 'حلويات', now(), now()),
(gen_random_uuid(), 'كريب لوتس', 'حلويات', now(), now()),
(gen_random_uuid(), 'كريب كيندر', 'حلويات', now(), now()),
(gen_random_uuid(), 'كريب بستاشيو', 'حلويات', now(), now()),
(gen_random_uuid(), 'كريب نوتيلا بستاشيو', 'حلويات', now(), now()),
(gen_random_uuid(), 'كريب مكس', 'حلويات', now(), now()),

-- وافل
(gen_random_uuid(), 'وافل نوتيلا', 'حلويات', now(), now()),
(gen_random_uuid(), 'وافل لوتس', 'حلويات', now(), now()),
(gen_random_uuid(), 'وافل كيندر', 'حلويات', now(), now()),
(gen_random_uuid(), 'وافل بستاشيو', 'حلويات', now(), now()),
(gen_random_uuid(), 'وافل مكس', 'حلويات', now(), now()),

-- كنافة
(gen_random_uuid(), 'كنافة قشطة', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة وجبن', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة نوتيلا', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة لوتس', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة كيندر', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة جبن', 'حلويات', now(), now()),

-- كنافة الدايت
(gen_random_uuid(), 'كنافة قشطة (دايت)', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة وجبن (دايت)', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة نوتيلا (دايت)', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة لوتس (دايت)', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة قشطة كيندر (دايت)', 'حلويات', now(), now()),
(gen_random_uuid(), 'كنافة جبن (دايت)', 'حلويات', now(), now()),

-- آيس كريم
(gen_random_uuid(), 'آيس كريم كراميل', 'حلويات', now(), now()),
(gen_random_uuid(), 'آيس كريم فانيلا', 'حلويات', now(), now()),
(gen_random_uuid(), 'آيس كريم مانجو', 'حلويات', now(), now()),
(gen_random_uuid(), 'آيس كريم شوكولاتة', 'حلويات', now(), now()),
(gen_random_uuid(), 'آيس كريم توفي', 'حلويات', now(), now()),
(gen_random_uuid(), 'آيس كريم لوتس', 'حلويات', now(), now());
