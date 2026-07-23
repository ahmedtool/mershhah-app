/**
 * ميزات افتراضية للباقات (تُستخدم عند عدم وجود حقل features في وثيقة الباقة).
 * يمكن للمدير لاحقاً إضافة حقل features في Firestore لكل باقة.
 */
export const DEFAULT_PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  free: {
    "صفحة رقمية احترافية": true,
    "QR كود جاهز للطباعة": true,
    "عرض المنيو والعروض": true,
    "تجميع روابط التواصل والتوصيل": true,
    "إحصائيات تفاعل أساسية": true,
    "دعم فني مباشر 24/7": true,
    "مساعد ذكي للعملاء": false,
    "تحليل ذكي للمنيو والتقييمات": false,
    "إنشاء صور بالذكاء الاصطناعي": false,
    "مرشح Agent لتنفيذ الأوامر": false,
    "مدير علاقات مخصص": false,
  },
  "3-months": {
    "صفحة رقمية احترافية": true,
    "QR كود جاهز للطباعة": true,
    "عرض المنيو والعروض": true,
    "تجميع روابط التواصل والتوصيل": true,
    "إحصائيات تفاعل أساسية": true,
    "دعم فني مباشر 24/7": true,
    "مساعد ذكي للعملاء": true,
    "تحليل ذكي للمنيو والتقييمات": true,
    "إنشاء 10 صور شهريًا": true,
    "مرشح Agent لتنفيذ الأوامر": true,
    "مدير علاقات مخصص": true,
  },
  annual: {
    "صفحة رقمية احترافية": true,
    "QR كود جاهز للطباعة": true,
    "عرض المنيو والعروض": true,
    "تجميع روابط التواصل والتوصيل": true,
    "إحصائيات تفاعل أساسية": true,
    "دعم فني مباشر 24/7": true,
    "مساعد ذكي للعملاء": true,
    "تحليل ذكي للمنيو والتقييمات": true,
    "إنشاء 10 صور شهريًا": true,
    "مرشح Agent لتنفيذ الأوامر": true,
    "مدير علاقات مخصص": true,
  },
};

export function planIdToFeatureKey(planId: string): string {
  if (!planId) return "free";
  if (planId.includes("free")) return "free";
  if (planId.includes("quarterly") || planId.includes("3-months")) return "3-months";
  if (planId.includes("annual") || planId.includes("yearly")) return "annual";
  return "free";
}

export function getPlanFeatures(planId: string): Record<string, boolean> {
  return DEFAULT_PLAN_FEATURES[planIdToFeatureKey(planId)] ?? DEFAULT_PLAN_FEATURES.free;
}
