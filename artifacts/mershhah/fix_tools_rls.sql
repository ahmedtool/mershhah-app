-- Temporarily disable RLS on tools table for admin operations
ALTER TABLE public.tools DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS but allow all authenticated users to read/write:
-- ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "tools: public read" ON public.tools;
-- DROP POLICY IF EXISTS "tools: admin write" ON public.tools;
-- CREATE POLICY "tools: public read" ON public.tools FOR SELECT USING (true);
-- CREATE POLICY "tools: authenticated all" ON public.tools FOR ALL USING (auth.role() = 'authenticated');
