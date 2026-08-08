-- Store Integration Migration
-- Adds columns for tool integration support and configuration

-- 1. Add integration columns to tools table
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS integration_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS config_schema jsonb;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS permissions text[];
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS version text default '1.0.0';
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS developer_name text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS developer_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS screenshots text[];
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) default 0;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS total_installs integer default 0;

-- 2. Add config column to activated_tools for per-restaurant configuration
ALTER TABLE public.activated_tools ADD COLUMN IF NOT EXISTS config jsonb default '{}';
ALTER TABLE public.activated_tools ADD COLUMN IF NOT EXISTS installed_by uuid;

-- 3. Create tool_reviews table for tool ratings
CREATE TABLE IF NOT EXISTS public.tool_reviews (
  id uuid primary key default gen_random_uuid(),
  tool_id text references public.tools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  rating integer check (rating >= 1 and rating <= 5),
  review text,
  created_at timestamptz default now(),
  unique(tool_id, profile_id)
);

-- 4. Create tool_logs table for tracking tool usage
CREATE TABLE IF NOT EXISTS public.tool_logs (
  id uuid primary key default gen_random_uuid(),
  tool_id text references public.tools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 5. RLS policies for new tables
ALTER TABLE public.tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_logs ENABLE ROW LEVEL SECURITY;

-- Tool reviews: public read, owner write own
CREATE POLICY "tool_reviews_public_read" ON public.tool_reviews FOR SELECT USING (true);
CREATE POLICY "tool_reviews_insert_own" ON public.tool_reviews FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);
CREATE POLICY "tool_reviews_update_own" ON public.tool_reviews FOR UPDATE USING ((select auth.uid()) = profile_id);
CREATE POLICY "tool_reviews_delete_own" ON public.tool_reviews FOR DELETE USING ((select auth.uid()) = profile_id);
CREATE POLICY "tool_reviews_admin_all" ON public.tool_reviews FOR ALL USING (
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
);

-- Tool logs: owner read own, admin full
CREATE POLICY "tool_logs_owner_read" ON public.tool_logs FOR SELECT USING (
  (select auth.uid()) = profile_id OR
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
);
CREATE POLICY "tool_logs_insert_own" ON public.tool_logs FOR INSERT WITH CHECK ((select auth.uid()) = profile_id);
CREATE POLICY "tool_logs_admin_all" ON public.tool_logs FOR ALL USING (
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
);

-- 6. Enable realtime for tool tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_logs;

-- 7. Create index for performance
CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_id ON public.tool_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_logs_profile_id ON public.tool_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_tool_id ON public.tool_reviews(tool_id);
CREATE INDEX IF NOT EXISTS idx_activated_tools_config ON public.activated_tools USING gin(config);
