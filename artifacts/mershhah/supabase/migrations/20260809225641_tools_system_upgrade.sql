-- ============================================================
-- تطوير نظام الأدوات: أداة خارجية + مدمجة
-- ============================================================

-- أعمدة جديدة لجدول tools
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS tool_type text default 'embedded' check (tool_type in ('embedded', 'external', 'builtin'));
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS content text default '';
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS sandbox_sandbox boolean default false;

-- ============================================================
-- RLS: السماح للإدارة بإدارة الأدوات
-- ============================================================
DROP POLICY IF EXISTS "tools: admin write" ON public.tools;
CREATE POLICY "tools: admin write" ON public.tools FOR ALL USING (
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
);
