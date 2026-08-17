-- Product Cost Calculations Table
CREATE TABLE IF NOT EXISTS public.product_cost_calculations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  product_name text not null,
  servings numeric(10,2) not null default 1,
  ingredients jsonb not null default '[]',
  packaging_cost numeric(12,2) default 0,
  overhead_percent numeric(6,2) default 0,
  target_margin_percent numeric(6,2) default 30,
  selling_price numeric(12,2),
  total_cost numeric(12,2) default 0,
  cost_per_serving numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- RLS
ALTER TABLE public.product_cost_calculations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_cost_calculations_owner') THEN
    CREATE POLICY "product_cost_calculations_owner" ON public.product_cost_calculations FOR ALL USING (
      (select auth.uid()) = profile_id
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_cost_calculations_admin') THEN
    CREATE POLICY "product_cost_calculations_admin" ON public.product_cost_calculations FOR ALL USING (
      exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
    );
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_product_cost_calculations_profile_id ON public.product_cost_calculations(profile_id);
