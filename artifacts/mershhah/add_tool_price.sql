-- ============================================================
-- ربط متجر الأدوات ببوابة الدفع: سعر رقمي حقيقي بدل النص الحر price_label
-- ============================================================

ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS price numeric default 0;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS streampay_product_id text;
