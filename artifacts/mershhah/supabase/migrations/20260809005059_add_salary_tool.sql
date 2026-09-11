-- Add Salary Calculator tool to tools table
INSERT INTO public.tools (id, title, description, category, price_label, icon, color, bg_color, popular, type, billing_type, version, developer_name)
VALUES (
  'salary-calculator',
  'حاسبة الرواتب',
  'احسب رواتب موظفينك بسهولة مع خصومات التأمينات والسلفات والغياب. تقدر تحفظ وتصدر كشوف الرواتب الشهرية.',
  'operations',
  'مجاني',
  'Calculator',
  'text-violet-600',
  'bg-violet-50',
  true,
  'free',
  'plan',
  '1.0.0',
  'مرشح'
)
ON CONFLICT (id) DO NOTHING;
