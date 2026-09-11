-- ============================================================
-- ربط الباقات بمزايا وحدود حقيقية مختلفة لكل باقة (بدل قيم متطابقة
-- افتراضية على الجميع، حتى بين المجانية والمؤسسات)
-- max_* = 0 يعني "غير محدود" (يُقرأ كذلك في hooks/useUser.tsx)
-- ============================================================

UPDATE public.plans SET
  max_branches = 1,
  max_menu_items = 30,
  max_tools = 2,
  features = '{"menu": true, "ai_analysis": false, "custom_domain": false, "api_access": false, "white_label": false, "priority_support": false}'::jsonb
WHERE id = 'free';

UPDATE public.plans SET
  max_branches = 3,
  max_menu_items = 150,
  max_tools = 10,
  features = '{"menu": true, "ai_analysis": true, "custom_domain": false, "api_access": false, "white_label": false, "priority_support": true}'::jsonb
WHERE id = 'pro';

UPDATE public.plans SET
  max_branches = 0,
  max_menu_items = 0,
  max_tools = 0,
  features = '{"menu": true, "ai_analysis": true, "custom_domain": true, "api_access": true, "white_label": true, "priority_support": true}'::jsonb
WHERE id = 'enterprise';
