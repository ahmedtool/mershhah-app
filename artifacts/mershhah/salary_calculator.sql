-- Salary Records Table
CREATE TABLE IF NOT EXISTS public.salary_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  month text not null,
  employees jsonb not null default '[]',
  total_gross numeric(12,2) default 0,
  total_net numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- RLS
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'salary_records_owner') THEN
    CREATE POLICY "salary_records_owner" ON public.salary_records FOR ALL USING (
      (select auth.uid()) = profile_id
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'salary_records_admin') THEN
    CREATE POLICY "salary_records_admin" ON public.salary_records FOR ALL USING (
      exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
    );
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_salary_records_profile_id ON public.salary_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_month ON public.salary_records(month);
