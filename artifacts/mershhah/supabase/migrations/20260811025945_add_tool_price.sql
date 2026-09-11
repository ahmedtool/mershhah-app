-- ============================================================
-- ربط متجر الأدوات ببوابة الدفع: سعر رقمي حقيقي بدل النص الحر price_label
-- ============================================================

ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS price numeric default 0;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS streampay_product_id text;

-- ============================================================
-- إصلاح: EditToolDialog كان يكتب هذي الأعمدة وهي غير موجودة أصلاً —
-- كل حفظ لأداة (إضافة أو تعديل) كان يفشل بخطأ 400
-- "Could not find the 'content' column of 'tools' in the schema cache"
-- ============================================================
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS tool_type text default 'external';
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.tools DROP CONSTRAINT IF EXISTS tools_tool_type_check;
ALTER TABLE public.tools ADD CONSTRAINT tools_tool_type_check
  CHECK (tool_type = ANY (ARRAY['external'::text, 'embedded'::text]));
