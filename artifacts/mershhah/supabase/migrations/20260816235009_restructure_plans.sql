-- Restructure the plans catalog: one paid plan (169 SAR/year, unlimited
-- everything), a capped free plan, a hidden 1 SAR test plan for real
-- StreamPay checkout testing, and deactivation of stale test/duplicate rows.
-- Deactivating (not deleting) preserves FK history in subscriptions/transactions.

-- Junk test plan created while testing checkout - no real subscribers.
update public.plans set is_active = false where id = '3af35a9b-7ceb-4162-9dac-1a1bb6570b08';

-- Redundant top tier now that "pro" becomes unlimited-everything.
update public.plans set is_active = false where id = 'enterprise';

-- The single paid plan: 169 SAR/year, unlimited branches/menu/tools, every
-- feature on. Null the StreamPay product so a correct yearly product gets
-- created fresh on the next checkout instead of reusing old monthly terms.
update public.plans set
  name = 'احترافي',
  price = 169,
  price_monthly = 0,
  price_yearly = 169,
  duration_months = 12,
  max_branches = 0,
  max_menu_items = 0,
  max_tools = 0,
  is_active = true,
  is_featured = true,
  streampay_product_id = null,
  features = '{"ai_analysis": true, "custom_domain": true, "api_access": true, "white_label": true, "priority_support": true}'::jsonb
where id = 'pro';

-- Free plan: capped at 8 menu items, 2 branches, no advanced features.
update public.plans set
  max_branches = 2,
  max_menu_items = 8
where id = 'free';

-- Hidden dev-only test plan (1 SAR/year) - kept active for real StreamPay
-- checkout testing, filtered out of every customer-facing plan list by id.
update public.plans set
  name = 'تجربة الدفع (للتطوير فقط)',
  price = 1,
  price_monthly = 0,
  price_yearly = 1,
  duration_months = 12,
  is_active = true,
  is_featured = false,
  streampay_product_id = null
where id = '93250b42-d34c-4996-8d83-359ea26ab264';

select id, name, price_yearly, duration_months, max_branches, max_menu_items, max_tools, is_active, is_featured
from public.plans order by is_active desc, price_yearly;
