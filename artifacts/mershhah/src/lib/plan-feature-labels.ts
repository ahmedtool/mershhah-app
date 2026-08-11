// `plans.features` keys are English identifiers (seeded outside the admin
// editor, which writes Arabic labels directly for custom entries) —
// translate the known ones for display instead of leaking raw keys like
// "ai_analysis" into the UI.
export const FEATURE_LABELS: Record<string, string> = {
  menu: 'قائمة المنيو الرقمية',
  offers: 'العروض والحملات',
  branches: 'الفروع المتعددة',
  ai_analysis: 'تحليل وتوصيات ذكية',
  custom_domain: 'نطاق مخصص',
  api_access: 'الوصول عبر API',
  white_label: 'بدون شعار مرشح',
  priority_support: 'دعم فني ذو أولوية',
};

export function describeFeature(key: string, value: boolean | number): { label: string; included: boolean } {
  const baseLabel = FEATURE_LABELS[key] || key;
  if (typeof value === 'number') {
    return { label: value > 0 ? `${baseLabel} (حتى ${value})` : baseLabel, included: value > 0 };
  }
  return { label: baseLabel, included: !!value };
}
