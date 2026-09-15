-- Replaces the single flat "احترافي" (169 SAR/year, unlimited everything)
-- plan with three yearly tiers differentiated primarily by branch count,
-- as agreed with the owner: 149 (1 branch) / 249 (up to 10) / 449 (up to
-- 100). Free stays at 0 branches so it's strictly below every paid tier -
-- it previously allowed 2, which made the cheapest paid plan (1 branch)
-- a worse deal than free.
--
-- "pro" is deactivated, not deleted or repurposed: it already has real
-- paying subscribers, and reusing its id for the new 149 tier would
-- silently downgrade them from unlimited to 1-branch mid-subscription the
-- moment their row is read. Deactivating only removes it from new
-- checkout/pricing display (see is_active filtering in the plans RLS
-- policy and the /pricing page's HIDDEN_PLAN_IDS-style filtering) -
-- existing "pro" subscribers keep their current entitlements untouched
-- for as long as their subscription lasts.
update public.plans set is_active = false where id = 'pro';

update public.plans set max_branches = 0 where id = 'free';

insert into public.plans (
  id, name, price, price_yearly, duration_months,
  max_branches, max_menu_items, max_tools, max_job_postings,
  is_active, is_featured, sort_order, features
) values
  (
    'starter', 'أساسي', 149, 149, 12,
    1, 50, 5, 1,
    true, false, 1,
    '{"ai_tools": true}'::jsonb
  ),
  (
    'growth', 'نمو', 249, 249, 12,
    10, 150, 15, 5,
    true, true, 2,
    '{"ai_tools": true, "ai_analysis": true, "gateway_franchise": true, "gateway_wholesale": true}'::jsonb
  ),
  (
    'scale', 'توسّع', 449, 449, 12,
    100, 0, 0, 0,
    true, false, 3,
    '{"ai_tools": true, "ai_analysis": true, "white_label": true, "priority_support": true, "gateway_franchise": true, "gateway_wholesale": true, "gateway_corporate": true, "gateway_partnership": true, "gateway_custom_types": true}'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  price_yearly = excluded.price_yearly,
  duration_months = excluded.duration_months,
  max_branches = excluded.max_branches,
  max_menu_items = excluded.max_menu_items,
  max_tools = excluded.max_tools,
  max_job_postings = excluded.max_job_postings,
  is_active = excluded.is_active,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  features = excluded.features;

select id, name, price_yearly, max_branches, max_menu_items, max_tools, max_job_postings, is_active, is_featured
from public.plans order by is_active desc, sort_order, price_yearly;
