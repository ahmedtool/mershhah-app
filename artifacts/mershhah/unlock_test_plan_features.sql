-- The 1 SAR test plan should mirror the real paid plan's entitlements so
-- testing through it reflects the actual premium experience, not a limited one.
update public.plans set
  max_branches = 0,
  max_menu_items = 0,
  max_tools = 0,
  features = '{"ai_analysis": true, "custom_domain": true, "api_access": true, "white_label": true, "priority_support": true}'::jsonb
where id = '93250b42-d34c-4996-8d83-359ea26ab264';

select id, name, max_branches, max_menu_items, max_tools, features from public.plans where id = '93250b42-d34c-4996-8d83-359ea26ab264';
