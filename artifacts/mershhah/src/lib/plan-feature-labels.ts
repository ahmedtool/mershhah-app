// `plans.features` keys are English identifiers (seeded outside the admin
// editor, which writes Arabic labels directly for custom entries) —
// translate the known ones for display instead of leaking raw keys like
// "ai_analysis" into the UI.

// Arabic-only labels for the (not yet i18n'd) admin plan editor.
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

// i18n key lookup for owner-facing surfaces (PlanPricingGrid).
export const FEATURE_LABEL_KEYS: Record<string, string> = {
  menu: 'planFeatures.menu',
  offers: 'planFeatures.offers',
  branches: 'planFeatures.branches',
  ai_tools: 'planFeatures.aiTools',
  ai_analysis: 'planFeatures.aiAnalysis',
  custom_domain: 'planFeatures.customDomain',
  white_label: 'planFeatures.whiteLabel',
  priority_support: 'planFeatures.prioritySupport',
};

export function describeFeature(
  key: string,
  value: boolean | number,
  t: (key: string) => string
): { label: string; included: boolean } {
  const baseLabel = FEATURE_LABEL_KEYS[key] ? t(FEATURE_LABEL_KEYS[key]) : key;
  if (typeof value === 'number') {
    return { label: value > 0 ? `${baseLabel} (${t('planFeatures.upTo')} ${value})` : baseLabel, included: value > 0 };
  }
  return { label: baseLabel, included: !!value };
}
