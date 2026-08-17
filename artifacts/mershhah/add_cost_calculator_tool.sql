-- Add Product Cost Calculator tool to tools table
INSERT INTO public.tools (id, title, description, category, price_label, icon, color, bg_color, popular, type, billing_type, version, developer_name)
VALUES (
  'cost-calculator',
  'حاسبة تكلفة المنتج',
  'احسب تكلفة تصنيع أي منتج بالضبط: المكونات + التغليف + نسبة هدر/تشغيل، وشوف تكلفة الحصة الواحدة والسعر المقترح لتحقيق هامش الربح اللي تبيه.',
  'operations',
  'مجاني',
  'Coins',
  'text-amber-600',
  'bg-amber-50',
  true,
  'free',
  'plan',
  '1.0.0',
  'مرشح'
)
ON CONFLICT (id) DO NOTHING;
