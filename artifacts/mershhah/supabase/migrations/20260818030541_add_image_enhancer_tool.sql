-- Add Image Quality Enhancer tool to tools table
INSERT INTO public.tools (id, title, description, category, price_label, icon, color, bg_color, popular, type, billing_type, version, developer_name)
VALUES (
  'image-enhancer',
  'تحسين جودة صور المنتجات',
  'حسّن وضوح وجودة صور منتجاتك بضغطة زر — ارفع صورة جديدة أو اختر من صور موجودة عندك بالمنيو. مجاني حتى 10 منتجات شهرياً، وغير محدود للمشتركين.',
  'marketing',
  'مجاني',
  'Sparkles',
  'text-violet-600',
  'bg-violet-50',
  true,
  'free',
  'plan',
  '1.0.0',
  'مرشح'
)
ON CONFLICT (id) DO NOTHING;
