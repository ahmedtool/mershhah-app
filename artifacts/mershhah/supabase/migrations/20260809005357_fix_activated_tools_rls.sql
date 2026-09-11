-- Check activated_tools RLS and fix if needed
-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'activated_tools';

-- Drop existing policies and recreate with simpler ones
DROP POLICY IF EXISTS "activated_tools: owner" ON public.activated_tools;
DROP POLICY IF EXISTS "activated_tools: admin" ON public.activated_tools;

-- Enable RLS
ALTER TABLE public.activated_tools ENABLE ROW LEVEL SECURITY;

-- Owner can read/write their own activated tools
CREATE POLICY "activated_tools_owner_all" ON public.activated_tools
  FOR ALL
  USING ((select auth.uid()) = profile_id)
  WITH CHECK ((select auth.uid()) = profile_id);

-- Admin can do everything
CREATE POLICY "activated_tools_admin_all" ON public.activated_tools
  FOR ALL
  USING (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

-- Also make sure tools table is readable
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tools: public read" ON public.tools;
CREATE POLICY "tools_public_read" ON public.tools FOR SELECT USING (true);
