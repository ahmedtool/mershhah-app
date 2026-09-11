'use client';

import { useState, useEffect } from "react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Utensils, MapPin, Wrench, Sparkles, TrendingUp, Star, Headset, Globe, Building2, Check, Minus } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";
import { supabase } from "@/lib/supabase";
import type { Plan } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { usePlanCheckout } from "@/hooks/usePlanCheckout";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

// Dev-only test plans, hidden from every customer-facing screen.
const HIDDEN_PLAN_IDS = ['93250b42-d34c-4996-8d83-359ea26ab264'];

type FeatureRow = { key: string; icon: React.ElementType; label: string; included: boolean };

// Combines the real, enforced limits (max_menu_items/max_branches/max_tools)
// with the boolean feature flags into one ordered, plain-language list —
// concrete numbers instead of a generic yes/no checklist. Keep this in sync
// with EditPlanDialog's TOGGLE_FEATURE_KEYS: a flag missing here can be
// switched on for a plan in the admin editor and never show up here.
function buildFeatureRows(plan: Plan): FeatureRow[] {
  const features = (plan.features || {}) as Record<string, boolean>;
  const menuLimit = plan.max_menu_items ?? 0;
  const branchLimit = plan.max_branches ?? 0;
  const toolsLimit = plan.max_tools ?? 0;

  return [
    {
      key: 'menu',
      icon: Utensils,
      label: menuLimit > 0 ? `حتى ${menuLimit} ${menuLimit === 1 ? 'صنف' : 'أصناف'} بالمنيو` : 'منيو بلا حدود',
      included: true,
    },
    {
      key: 'branches',
      icon: MapPin,
      label: branchLimit > 0 ? `حتى ${branchLimit} ${branchLimit === 1 ? 'فرع' : 'فروع'}` : 'فروع بلا حدود',
      included: true,
    },
    {
      key: 'tools',
      icon: Wrench,
      label: toolsLimit > 0 ? `حتى ${toolsLimit} ${toolsLimit === 1 ? 'أداة مفعّلة' : 'أدوات مفعّلة'} من متجر الأدوات` : 'أدوات بلا حدود من متجر الأدوات',
      included: true,
    },
    {
      key: 'ai_tools',
      icon: Sparkles,
      label: 'أدوات ذكاء اصطناعي — تحسين صور الأطباق ومساعد ذكي يرد على عملائك',
      included: !!features.ai_tools,
    },
    {
      key: 'ai_analysis',
      icon: TrendingUp,
      label: 'تحليل يساعدك تفهم عملاءك وتزيد مبيعاتك',
      included: !!features.ai_analysis,
    },
    {
      key: 'white_label',
      icon: Star,
      label: 'صفحة خاصة بمطعمك بدون أي شعار ثاني',
      included: !!features.white_label,
    },
    {
      key: 'custom_domain',
      icon: Globe,
      label: 'دومين خاص باسم مطعمك',
      included: !!features.custom_domain,
    },
    {
      key: 'gateway_corporate',
      icon: Building2,
      label: 'استقبال طلبات الشركات والفعاليات',
      included: !!features.gateway_corporate,
    },
    {
      key: 'priority_support',
      icon: Headset,
      label: 'دعم فني سريع لما تحتاجنا',
      included: !!features.priority_support,
    },
  ];
}

const FAQS = [
  {
    q: 'هل يتطلب التسجيل بطاقة ائتمان؟',
    a: 'لا. التسجيل في مرشح مجاني بالكامل ولا يطلب أي بيانات دفع — تدفع فقط إذا وعندما تختار الترقية لباقة مدفوعة.',
  },
  {
    q: 'ما الفرق الأساسي بين الباقات؟',
    a: 'كل الباقات تشترك في نفس الأساسيات (منيو رقمي، أكواد QR، مساعد ذكي). الفرق الرئيسي هو عدد الفروع المسموح، مع مزايا إضافية في الباقات الأعلى مثل التحليلات الذكية ودعم الأولوية.',
  },
  {
    q: 'ماذا لو وصلت للحد الأقصى من الفروع أو الأدوات في باقتي؟',
    a: 'يظهر لك تنبيه واضح بحد باقتك الحالية عند محاولة تجاوزه، ويمكنك حينها الترقية لباقة أعلى مباشرة من هذه الصفحة.',
  },
  {
    q: 'هل يمكنني التبديل بين الباقات لاحقاً؟',
    a: 'إذا كنت على الباقة المجانية، يمكنك الترقية لأي باقة مدفوعة مباشرة من هذه الصفحة. إذا كان لديك اشتراك مدفوع فعّال وتريد التبديل لباقة أخرى، تواصل معنا وسنساعدك.',
  },
  {
    q: 'هل عدد الأدوات المفعّلة من متجر الأدوات يعتمد على باقتي؟',
    a: 'نعم — كل باقة لها حد أقصى لعدد الأدوات المفعّلة في نفس الوقت (موضح أعلاه). رقّي باقتك لتفعيل المزيد من الأدوات.',
  },
];

export default function PricingPage() {
  useDocumentMeta(
    'الأسعار والباقات',
    'باقات اشتراك مرشح لأصحاب المطاعم والمقاهي — اختر الباقة المناسبة لعدد فروعك وأصنافك، مع منيو رقمي ومساعد ذكي وأدوات نمو.'
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { checkout, isCheckingOut } = usePlanCheckout();

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase.from("plans").select("*").eq("is_active", true);
        const fetched = ((data || []) as Plan[]).filter((p) => !HIDDEN_PLAN_IDS.includes(p.id));
        fetched.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return (a.price_yearly ?? 0) - (b.price_yearly ?? 0);
        });
        setPlans(fetched);
      } catch {
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Union of every feature row that's actually true for at least one plan
  // (plus the three always-shown limit rows) — the comparison table below
  // only lists rows that meaningfully differ, driven entirely by real data.
  const comparisonRows: FeatureRow[] = plans.length
    ? (() => {
        const perPlanRows = plans.map(buildFeatureRows);
        const template = perPlanRows[0] || [];
        return template
          .map((row) => row.key)
          .filter((key) => ['menu', 'branches', 'tools'].includes(key) || perPlanRows.some((rows) => rows.find((r) => r.key === key)?.included))
          .map((key) => perPlanRows[0].find((r) => r.key === key)!);
      })()
    : [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-white" dir="rtl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Logo />
          <Button asChild variant="ghost" className="text-gray-600 text-sm font-bold hover:bg-gray-50 rounded-xl px-4">
            <Link href="/"><ArrowLeft className="ml-2 h-4 w-4" />العودة</Link>
          </Button>
        </div>
      </header>

      <main className="py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">باقة تكبر مع عدد فروعك</h1>
            <p className="text-sm text-gray-600 max-w-lg mx-auto">
              جميع أساسيات مرشح متاحة في كل الباقات — لا مزايا مقفلة. ابدأ مجاناً بدون بطاقة ائتمان، ورقّي وقت ما تحتاج.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Skeleton className="h-[460px] rounded-3xl" />
              <Skeleton className="h-[460px] rounded-3xl" />
              <Skeleton className="h-[460px] rounded-3xl hidden lg:block" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              <p className="text-sm">لا توجد باقات متاحة حالياً.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                {plans.map((plan) => {
                  const isFree = (plan.price_yearly ?? 0) === 0;
                  const featured = !!plan.is_featured;
                  const rows = buildFeatureRows(plan);
                  const checking = isCheckingOut(plan.id, 'yearly');
                  const ctaClass = `block w-full h-12 rounded-2xl text-sm font-bold text-center leading-[3rem] transition-colors disabled:opacity-60 ${featured ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`;

                  // Free plan and logged-out visitors go through registration -
                  // a freshly-registered account lands on the real in-app
                  // upgrade gate (PlanPricingGrid), which already checks out
                  // correctly. A logged-in visitor on this marketing page can
                  // check out directly, the same way the dashboard does -
                  // this is what makes the payment actually tied to their
                  // account instead of a static, identity-less payment link.
                  const cta = isFree ? (
                    <Link href="/register" className={ctaClass}>ابدأ مجاناً</Link>
                  ) : user ? (
                    <button type="button" onClick={() => checkout(plan.id, 'yearly')} disabled={checking} className={ctaClass}>
                      {checking ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'اختر هذه الباقة'}
                    </button>
                  ) : (
                    <Link href="/register" className={ctaClass}>اختر هذه الباقة</Link>
                  );

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-3xl p-7 flex flex-col ${
                        featured
                          ? 'bg-gray-900 text-white sm:-translate-y-3 shadow-2xl shadow-gray-900/20'
                          : 'bg-white border border-gray-100 text-gray-900'
                      }`}
                    >
                      {featured && (
                        <div className="absolute -top-3 right-7 bg-white text-gray-900 text-[10px] font-black px-3 py-1 rounded-full">
                          الأكثر انتشاراً
                        </div>
                      )}

                      <div className="mb-5">
                        <h3 className="text-lg font-black mb-1">{plan.name}</h3>
                        <p className={`text-xs ${featured ? 'text-gray-400' : 'text-gray-600'}`}>{plan.description || ''}</p>
                      </div>

                      <div className="flex items-baseline gap-1.5 mb-1">
                        {isFree ? (
                          <span className="text-3xl font-black">مجاني</span>
                        ) : (
                          <>
                            <span className="text-4xl font-black">{plan.price_yearly}</span>
                            <span className={`text-sm font-bold ${featured ? 'text-gray-400' : 'text-gray-600'}`}>ر.س</span>
                          </>
                        )}
                      </div>
                      <p className={`text-[11px] mb-6 ${featured ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isFree ? 'دائماً مجاناً' : 'سنوياً'}
                      </p>

                      <div className={`border-t pt-5 mb-6 flex-1 ${featured ? 'border-white/10' : 'border-gray-100'}`}>
                        <ul className="space-y-3.5">
                          {rows.map((row) => {
                            const Icon = row.icon;
                            return (
                              <li key={row.key} className={`flex items-start gap-3 text-xs leading-relaxed ${
                                row.included
                                  ? featured ? 'text-gray-100' : 'text-gray-700'
                                  : featured ? 'text-gray-600' : 'text-gray-600 line-through'
                              }`}>
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  row.included
                                    ? featured ? 'bg-white/10' : 'bg-gray-900/5'
                                    : featured ? 'bg-white/5' : 'bg-gray-50'
                                }`}>
                                  {row.included
                                    ? <Icon className={`h-3.5 w-3.5 ${featured ? 'text-white' : 'text-gray-900'}`} />
                                    : <Icon className={`h-3.5 w-3.5 ${featured ? 'text-gray-600' : 'text-gray-600'}`} />}
                                </span>
                                <span>{row.label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {cta}
                    </div>
                  );
                })}
              </div>

              {plans.length > 1 && (
                <div className="mt-20">
                  <h2 className="text-xl font-black text-gray-900 text-center mb-8">مقارنة تفصيلية</h2>
                  <div className="overflow-x-auto rounded-2xl border border-gray-100">
                    <table className="w-full text-xs text-center min-w-[560px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-right py-3 px-4 font-bold text-gray-600">الميزة</th>
                          {plans.map((plan) => (
                            <th key={plan.id} className="py-3 px-4 font-black text-gray-900">{plan.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((row) => (
                          <tr key={row.key} className="border-b border-gray-50 last:border-0">
                            <td className="text-right py-3 px-4 font-bold text-gray-700">{row.label}</td>
                            {plans.map((plan) => {
                              const planRow = buildFeatureRows(plan).find((r) => r.key === row.key)!;
                              return (
                                <td key={plan.id} className="py-3 px-4">
                                  {planRow.included
                                    ? <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                                    : <Minus className="h-4 w-4 text-gray-600 mx-auto" />}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-20">
            <h2 className="text-xl font-black text-gray-900 text-center mb-8">أسئلة متكررة</h2>
            <div className="max-w-2xl mx-auto space-y-3">
              {FAQS.map((item) => (
                <div key={item.q} className="rounded-2xl border border-gray-100 p-5">
                  <p className="text-sm font-bold text-gray-900 mb-1.5">{item.q}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 text-center rounded-3xl bg-gray-900 text-white px-6 py-14">
            <h2 className="text-2xl font-black mb-2">جرّب مرشح مجاناً اليوم</h2>
            <p className="text-sm text-gray-400 mb-7">فعّل مشروعك في أقل من خمس دقائق — بدون بطاقة ائتمان.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="h-12 px-8 rounded-2xl bg-white text-gray-900 hover:bg-gray-100 text-sm font-bold">
                <Link href="/register">ابدأ مجاناً</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 px-8 rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10 text-sm font-bold">
                <Link href="/contact">تحدث معنا</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
