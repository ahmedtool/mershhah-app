insert into tools (id, title, description, category, price_label, icon, color, bg_color, popular, type, billing_type, tool_type, price)
values
  ('keeta-reports-reader', 'قارئ تقارير كيتا', 'ارفع ملف تقرير كيتا (Excel أو CSV) وشوف ملخص واضح: إجمالي المبيعات، عدد الطلبات، والأصناف الأكثر تكراراً.', 'operations', 'مجاني', 'FileSpreadsheet', 'text-emerald-500', 'bg-emerald-500/10', false, 'free', 'plan', 'external', 0),
  ('hungerstation-reports-reader', 'قارئ تقارير هنقرستيشن', 'ارفع ملف تقرير هنقرستيشن (Excel أو CSV) وشوف ملخص واضح: إجمالي المبيعات، عدد الطلبات، والأصناف الأكثر تكراراً.', 'operations', 'مجاني', 'Truck', 'text-orange-500', 'bg-orange-500/10', false, 'free', 'plan', 'external', 0)
on conflict (id) do nothing;

select id, title from tools order by title;
