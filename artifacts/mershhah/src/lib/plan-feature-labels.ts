// `plans.features` keys are English identifiers (seeded outside the admin
// editor, which writes Arabic labels directly for custom entries) —
// translate the known ones for display instead of leaking raw keys like
// "ai_analysis" into the UI.
export const FEATURE_LABELS: Record<string, string> = {
  menu: 'منيو رقمي لمطعمك أو مقهاك',
  offers: 'العروض والحملات',
  branches: 'الفروع المتعددة',
  ai_tools: 'أدوات ذكاء اصطناعي — تحسين صور الأطباق ومساعد ذكي يرد على عملائك',
  ai_analysis: 'تحليل يساعدك تفهم عملاءك وتزيد مبيعاتك',
  custom_domain: 'دومين خاص باسم مطعمك',
  white_label: 'صفحة خاصة بمطعمك بدون أي شعار ثاني',
  priority_support: 'دعم فني سريع لما تحتاجنا',
};

export function describeFeature(key: string, value: boolean | number): { label: string; included: boolean } {
  const baseLabel = FEATURE_LABELS[key] || key;
  if (typeof value === 'number') {
    return { label: value > 0 ? `${baseLabel} (حتى ${value})` : baseLabel, included: value > 0 };
  }
  return { label: baseLabel, included: !!value };
}
