-- Store Tables Migration
-- Run AFTER store_integration.sql

-- 1. Create tool_reviews table
CREATE TABLE IF NOT EXISTS public.tool_reviews (
  id uuid primary key default gen_random_uuid(),
  tool_id text references public.tools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  rating integer check (rating >= 1 and rating <= 5),
  review text,
  created_at timestamptz default now(),
  unique(tool_id, profile_id)
);

-- 2. Create tool_logs table
CREATE TABLE IF NOT EXISTS public.tool_logs (
  id uuid primary key default gen_random_uuid(),
  tool_id text references public.tools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 3. Enable RLS
ALTER TABLE public.tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for tool_reviews
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_public_read') THEN
    CREATE POLICY "tool_reviews_public_read" ON public.tool_reviews FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_insert_own') THEN
    CREATE POLICY "tool_reviews_insert_own" ON public.tool_reviews FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_update_own') THEN
    CREATE POLICY "tool_reviews_update_own" ON public.tool_reviews FOR UPDATE USING ((select auth.uid()) = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_delete_own') THEN
    CREATE POLICY "tool_reviews_delete_own" ON public.tool_reviews FOR DELETE USING ((select auth.uid()) = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_reviews_admin_all') THEN
    CREATE POLICY "tool_reviews_admin_all" ON public.tool_reviews FOR ALL USING (
      exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
    );
  END IF;
END $$;

-- 5. RLS policies for tool_logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_logs_owner_read') THEN
    CREATE POLICY "tool_logs_owner_read" ON public.tool_logs FOR SELECT USING (
      (select auth.uid()) = profile_id OR
      exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_logs_insert_own') THEN
    CREATE POLICY "tool_logs_insert_own" ON public.tool_logs FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tool_logs_admin_all') THEN
    CREATE POLICY "tool_logs_admin_all" ON public.tool_logs FOR ALL USING (
      exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
    );
  END IF;
END $$;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_id ON public.tool_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_logs_profile_id ON public.tool_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_tool_id ON public.tool_reviews(tool_id);
CREATE INDEX IF NOT EXISTS idx_activated_tools_config ON public.activated_tools USING gin(config);
