-- ============================================================
-- 🔴 شغّل هذا الملف كاملاً في Supabase SQL Editor
-- https://supabase.com/dashboard/project/smmriycsboexindabanc/sql
-- ============================================================

-- ============================================================
-- 1. أدوات المتجر (columns + tables)
-- ============================================================
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS integration_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS config_schema jsonb;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS permissions text[];
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS version text default '1.0.0';
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS developer_name text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS developer_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS screenshots text[];
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) default 0;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS total_installs integer default 0;

ALTER TABLE public.activated_tools ADD COLUMN IF NOT EXISTS config jsonb default '{}';
ALTER TABLE public.activated_tools ADD COLUMN IF NOT EXISTS installed_by uuid;

-- tool_reviews table
CREATE TABLE IF NOT EXISTS public.tool_reviews (
  id uuid primary key default gen_random_uuid(),
  tool_id text references public.tools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  rating integer check (rating >= 1 and rating <= 5),
  review text,
  created_at timestamptz default now(),
  unique(tool_id, profile_id)
);

-- tool_logs table
CREATE TABLE IF NOT EXISTS public.tool_logs (
  id uuid primary key default gen_random_uuid(),
  tool_id text references public.tools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

ALTER TABLE public.tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_public_read') THEN CREATE POLICY "tool_reviews_public_read" ON public.tool_reviews FOR SELECT USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_insert_own') THEN CREATE POLICY "tool_reviews_insert_own" ON public.tool_reviews FOR INSERT WITH CHECK ((select auth.uid()) = profile_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_update_own') THEN CREATE POLICY "tool_reviews_update_own" ON public.tool_reviews FOR UPDATE USING ((select auth.uid()) = profile_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_delete_own') THEN CREATE POLICY "tool_reviews_delete_own" ON public.tool_reviews FOR DELETE USING ((select auth.uid()) = profile_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_admin_all') THEN CREATE POLICY "tool_reviews_admin_all" ON public.tool_reviews FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_logs_owner_read') THEN CREATE POLICY "tool_logs_owner_read" ON public.tool_logs FOR SELECT USING ((select auth.uid()) = profile_id OR exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_logs_insert_own') THEN CREATE POLICY "tool_logs_insert_own" ON public.tool_logs FOR INSERT WITH CHECK ((select auth.uid()) = profile_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_logs_admin_all') THEN CREATE POLICY "tool_logs_admin_all" ON public.tool_logs FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')); END IF; END $$;

CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_id ON public.tool_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_logs_profile_id ON public.tool_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_tool_id ON public.tool_reviews(tool_id);
CREATE INDEX IF NOT EXISTS idx_activated_tools_config ON public.activated_tools USING gin(config);

-- ============================================================
-- 2. فك قيود category + تعطيل RLS على tools مؤقتاً
-- ============================================================
ALTER TABLE public.tools DROP CONSTRAINT IF EXISTS tools_category_check;
ALTER TABLE public.tools ADD CONSTRAINT tools_category_check CHECK (category IS NOT NULL AND length(category) > 0);
ALTER TABLE public.tools DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. تفعيل tools RLS مع سياسات صحيحة
-- ============================================================
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tools: public read" ON public.tools;
DROP POLICY IF EXISTS "tools: admin write" ON public.tools;
CREATE POLICY "tools: public read" ON public.tools FOR SELECT USING (true);
CREATE POLICY "tools: admin write" ON public.tools FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

-- ============================================================
-- 4. إصلاح activated_tools RLS
-- ============================================================
DROP POLICY IF EXISTS "activated_tools: owner" ON public.activated_tools;
DROP POLICY IF EXISTS "activated_tools: admin" ON public.activated_tools;
DROP POLICY IF EXISTS "activated_tools_owner_all" ON public.activated_tools;
DROP POLICY IF EXISTS "activated_tools_admin_all" ON public.activated_tools;
ALTER TABLE public.activated_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activated_tools_owner_all" ON public.activated_tools FOR ALL USING ((select auth.uid()) = profile_id) WITH CHECK ((select auth.uid()) = profile_id);
CREATE POLICY "activated_tools_admin_all" ON public.activated_tools FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

-- ============================================================
-- 5. تطبيقات التوصيل لكل فرع
-- ============================================================
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS applications jsonb DEFAULT '[]'::jsonb;

-- ============================================================
-- 6. حاسبة الرواتب
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  month text not null,
  employees jsonb not null default '[]',
  total_gross numeric(12,2) default 0,
  total_net numeric(12,2) default 0,
  created_at timestamptz default now()
);
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'salary_records_owner') THEN CREATE POLICY "salary_records_owner" ON public.salary_records FOR ALL USING ((select auth.uid()) = profile_id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'salary_records_admin') THEN CREATE POLICY "salary_records_admin" ON public.salary_records FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_salary_records_profile_id ON public.salary_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_month ON public.salary_records(month);

INSERT INTO public.tools (id, title, description, category, price_label, icon, color, bg_color, popular, type, billing_type, version, developer_name)
VALUES ('salary-calculator', 'حاسبة الرواتب', 'احسب رواتب موظفينك بسهولة مع خصومات التأمينات والسلفات والغياب. تحفظ وتصدر كشوف الرواتب الشهرية.', 'operations', 'مجاني', 'Calculator', 'text-violet-600', 'bg-violet-50', true, 'free', 'plan', '1.0.0', 'مرشح')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. حذف المستخدم من auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_auth_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_auth_user(uuid) TO authenticated;

-- ============================================================
-- 8. نظام مالي: StreamPay + باقات + فواتير + كوبونات
-- ============================================================
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

DROP TABLE IF EXISTS public.discount_code_usage CASCADE;
DROP TABLE IF EXISTS public.discount_codes CASCADE;

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

CREATE TABLE IF NOT EXISTS public.discount_code_usage (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid references public.discount_codes(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  subscription_id text references public.subscriptions(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  discount_amount numeric not null,
  created_at timestamptz default now()
);

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

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile ON public.subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON public.subscriptions(streampay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_profile ON public.invoices(profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON public.invoices(streampay_invoice_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_transactions_profile ON public.transactions(profile_id);

-- Financial RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_owner" ON public.invoices;
CREATE POLICY "invoices_owner" ON public.invoices FOR SELECT USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "transactions_owner" ON public.transactions;
CREATE POLICY "transactions_owner" ON public.transactions FOR SELECT USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "invoices_admin" ON public.invoices;
CREATE POLICY "invoices_admin" ON public.invoices FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

DROP POLICY IF EXISTS "plans_admin" ON public.plans;
CREATE POLICY "plans_admin" ON public.plans FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

DROP POLICY IF EXISTS "plans_public" ON public.plans;
CREATE POLICY "plans_public" ON public.plans FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "discount_codes_admin" ON public.discount_codes;
CREATE POLICY "discount_codes_admin" ON public.discount_codes FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

DROP POLICY IF EXISTS "discount_code_usage_admin" ON public.discount_code_usage;
CREATE POLICY "discount_code_usage_admin" ON public.discount_code_usage FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

DROP POLICY IF EXISTS "discount_code_usage_owner" ON public.discount_code_usage;
CREATE POLICY "discount_code_usage_owner" ON public.discount_code_usage FOR SELECT USING ((select auth.uid()) = profile_id);

DROP POLICY IF EXISTS "transactions_admin" ON public.transactions;
CREATE POLICY "transactions_admin" ON public.transactions FOR ALL USING (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

-- Service role policies (for webhooks)
DROP POLICY IF EXISTS "invoices_service" ON public.invoices;
CREATE POLICY "invoices_service" ON public.invoices FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "subscriptions_service" ON public.subscriptions;
CREATE POLICY "subscriptions_service" ON public.subscriptions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

DROP POLICY IF EXISTS "transactions_service" ON public.transactions;
CREATE POLICY "transactions_service" ON public.transactions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ============================================================
-- 9. Function to increment discount code usage
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_discount_usage(code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.discount_codes SET current_uses = current_uses + 1 WHERE id = code_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_discount_usage(uuid) TO service_role;

-- ✅ انتهى — شغّل هذا كاملاً
