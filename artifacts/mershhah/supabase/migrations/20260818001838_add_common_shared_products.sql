-- Bulk-add common restaurant/cafe products to the shared product library
-- (public.shared_menu_products), grouped by category. No price/calories
-- set on purpose: those vary per restaurant and should be filled in
-- after the owner pulls the item from the library.

INSERT INTO public.shared_menu_products (id, name, category, created_at, updated_at) VALUES
-- قهوة
(gen_random_uuid(), 'قهوة عربي', 'قهوة', now(), now()),
(gen_random_uuid(), 'إسبريسو', 'قهوة', now(), now()),
(gen_random_uuid(), 'أمريكانو', 'قهوة', now(), now()),
(gen_random_uuid(), 'لاتيه', 'قهوة', now(), now()),
(gen_random_uuid(), 'كابتشينو', 'قهوة', now(), now()),
(gen_random_uuid(), 'فلات وايت', 'قهوة', now(), now()),
(gen_random_uuid(), 'موكا', 'قهوة', now(), now()),

-- مشروبات ساخنة
(gen_random_uuid(), 'شاي أحمر', 'مشروبات ساخنة', now(), now()),
(gen_random_uuid(), 'شاي أخضر', 'مشروبات ساخنة', now(), now()),
(gen_random_uuid(), 'شاي بالنعناع', 'مشروبات ساخنة', now(), now()),
(gen_random_uuid(), 'كرك', 'مشروبات ساخنة', now(), now()),
(gen_random_uuid(), 'هوت شوكلت', 'مشروبات ساخنة', now(), now()),

-- مشروبات باردة (يشمل العلامات المحلية والعالمية + مشروبات الطاقة)
(gen_random_uuid(), 'آيس لاتيه', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'آيس أمريكانو', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'فرابيه', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'ميلك شيك فانيلا', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'ميلك شيك شوكولاتة', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'ميلك شيك فراولة', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'بيبسي', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'بيبسي دايت', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كوكاكولا', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كوكاكولا دايت', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'سفن أب', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'سبرايت', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'ميرندا', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'فانتا برتقال', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا تفاح', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كينزا تروبيكال', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'ريد بُل', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'باور هورس', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'كود ريد', 'مشروبات باردة', now(), now()),
(gen_random_uuid(), 'ماء', 'مشروبات باردة', now(), now()),

-- عصائر
(gen_random_uuid(), 'عصير مانجو', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير برتقال', 'عصائر', now(), now()),
(gen_random_uuid(), 'ليمون نعناع', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير فراولة', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير رمان', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير أناناس', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير تفاح', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير جوافة', 'عصائر', now(), now()),
(gen_random_uuid(), 'كوكتيل فواكه', 'عصائر', now(), now()),
(gen_random_uuid(), 'عصير جزر', 'عصائر', now(), now()),
(gen_random_uuid(), 'ليموناضة', 'عصائر', now(), now()),

-- مقبلات
(gen_random_uuid(), 'حمص', 'مقبلات', now(), now()),
(gen_random_uuid(), 'متبل', 'مقبلات', now(), now()),
(gen_random_uuid(), 'ورق عنب', 'مقبلات', now(), now()),
(gen_random_uuid(), 'سمبوسة', 'مقبلات', now(), now()),

-- سلطات
(gen_random_uuid(), 'سلطة خضراء', 'سلطات', now(), now()),
(gen_random_uuid(), 'فتوش', 'سلطات', now(), now()),
(gen_random_uuid(), 'تبولة', 'سلطات', now(), now()),
(gen_random_uuid(), 'سلطة سيزر', 'سلطات', now(), now()),

-- شوربات
(gen_random_uuid(), 'شوربة عدس', 'شوربات', now(), now()),
(gen_random_uuid(), 'شوربة خضار', 'شوربات', now(), now()),

-- حلويات
(gen_random_uuid(), 'كنافة', 'حلويات', now(), now()),
(gen_random_uuid(), 'أم علي', 'حلويات', now(), now()),
(gen_random_uuid(), 'تشيز كيك', 'حلويات', now(), now()),
(gen_random_uuid(), 'تيراميسو', 'حلويات', now(), now()),
(gen_random_uuid(), 'كوكيز', 'حلويات', now(), now()),
(gen_random_uuid(), 'براونيز', 'حلويات', now(), now()),
(gen_random_uuid(), 'كيك ليمون', 'حلويات', now(), now()),

-- إفطار
(gen_random_uuid(), 'كرواسان', 'إفطار', now(), now()),
(gen_random_uuid(), 'مافن', 'إفطار', now(), now()),
(gen_random_uuid(), 'بان كيك', 'إفطار', now(), now());
