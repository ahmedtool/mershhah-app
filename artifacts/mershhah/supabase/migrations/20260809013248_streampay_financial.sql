-- ============================================================
-- مخطط مالي: StreamPay + باقات + فواتير + كوبونات خصم
-- ============================================================

-- 1. تطوير جدول الباقات
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS streampay_product_id text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_monthly numeric default 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_yearly numeric default 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_price_monthly text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_price_yearly text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS currency text default 'SAR';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS features jsonb default '[]'::jsonb;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order integer default 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS trial_days integer default 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_branches integer default 1;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_menu_items integer default 50;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_tools integer default 5;

-- 2. تطوير جدول الاشتراكات
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS streampay_subscription_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS streampay_customer_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS billing_cycle text default 'monthly' check (billing_cycle in ('monthly', 'yearly', 'one_time'));
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount numeric default 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS currency text default 'SAR';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean default false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS discount_code_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS discount_amount numeric default 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- 3. جدول الفواتير
DROP TABLE IF EXISTS public.invoices CASCADE;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  subscription_id text references public.subscriptions(id) on delete set null,
  streampay_invoice_id text,
  streampay_payment_id text,
  amount numeric not null,
  currency text default 'SAR',
  status text default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  description text,
  billing_period text,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- 4. جدول كوبونات الخصم
DROP TABLE IF EXISTS public.discount_code_usage CASCADE;
DROP TABLE IF EXISTS public.discount_codes CASCADE;

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed', 'free_trial')),
  discount_value numeric not null default 0,
  max_uses integer,
  current_uses integer default 0,
  applicable_plans text[] default '{}',
  min_amount numeric default 0,
  valid_from timestamptz default now(),
  valid_until timestamptz,
  is_active boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 5. جدول استخدام الكوبونات
CREATE TABLE IF NOT EXISTS public.discount_code_usage (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid references public.discount_codes(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  subscription_id text references public.subscriptions(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  discount_amount numeric not null,
  created_at timestamptz default now()
);

-- 6. جدول سجل المعاملات المالية
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('subscription', 'tool_purchase', 'refund', 'adjustment')),
  amount numeric not null,
  currency text default 'SAR',
  status text default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  description text,
  reference_type text,
  reference_id text,
  streampay_payment_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 7. فهرس
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile ON public.subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON public.subscriptions(streampay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_profile ON public.invoices(profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON public.invoices(streampay_invoice_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_transactions_profile ON public.transactions(profile_id);

-- 8. RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Owner sees own data
DROP POLICY IF EXISTS "invoices_owner" ON public.invoices;
CREATE POLICY "invoices_owner" ON public.invoices FOR SELECT USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "transactions_owner" ON public.transactions;
CREATE POLICY "transactions_owner" ON public.transactions FOR SELECT USING ((select auth.uid()) = profile_id);

-- Admin sees all
DROP POLICY IF EXISTS "invoices_admin" ON public.invoices;
CREATE POLICY "invoices_admin" ON public.invoices FOR ALL USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin') );

DROP POLICY IF EXISTS "plans_admin" ON public.plans;
CREATE POLICY "plans_admin" ON public.plans FOR ALL USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin') );

DROP POLICY IF EXISTS "plans_public" ON public.plans;
CREATE POLICY "plans_public" ON public.plans FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "discount_codes_admin" ON public.discount_codes;
CREATE POLICY "discount_codes_admin" ON public.discount_codes FOR ALL USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin') );

DROP POLICY IF EXISTS "discount_code_usage_admin" ON public.discount_code_usage;
CREATE POLICY "discount_code_usage_admin" ON public.discount_code_usage FOR ALL USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin') );

DROP POLICY IF EXISTS "discount_code_usage_owner" ON public.discount_code_usage;
CREATE POLICY "discount_code_usage_owner" ON public.discount_code_usage FOR SELECT USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "transactions_admin" ON public.transactions;
CREATE POLICY "transactions_admin" ON public.transactions FOR ALL USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role = 'admin') );

-- Service role (for webhooks)
DROP POLICY IF EXISTS "invoices_service" ON public.invoices;
CREATE POLICY "invoices_service" ON public.invoices FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "subscriptions_service" ON public.subscriptions;
CREATE POLICY "subscriptions_service" ON public.subscriptions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "transactions_service" ON public.transactions;
CREATE POLICY "transactions_service" ON public.transactions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
