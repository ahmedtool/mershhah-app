'use client';

import { useState, useEffect } from "react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Utensils, MapPin, Wrench, Sparkles, TrendingUp, Star, Headset } from "lucide-react";
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

type FeatureRow = { icon: React.ElementType; label: string; included: boolean };

// Combines the real, enforced limits (max_menu_items/max_branches/max_tools)
// with the boolean feature flags into one ordered, plain-language list —
// concrete numbers instead of a generic yes/no checklist.
function buildFeatureRows(plan: Plan): FeatureRow[] {
  const features = (plan.features || {}) as Record<string, boolean>;
  const menuLimit = plan.max_menu_items ?? 0;
  const branchLimit = plan.max_branches ?? 0;
  const toolsLimit = plan.max_tools ?? 0;

  return [
    {
      icon: Utensils,
      label: menuLimit > 0 ? `حتى ${menuLimit} ${menuLimit === 1 ? 'صنف' : 'أصناف'} بالمنيو` : 'منيو بلا حدود',
      included: true,
    },
    {
      icon: MapPin,
      label: branchLimit > 0 ? `حتى ${branchLimit} ${branchLimit === 1 ? 'فرع' : 'فروع'}` : 'فروع بلا حدود',
      included: true,
    },
    {
      icon: Wrench,
      label: toolsLimit > 0 ? `حتى ${toolsLimit} ${toolsLimit === 1 ? 'أداة' : 'أدوات'}` : 'كل الأدوات بلا حدود',
      included: true,
    },
    {
      icon: Sparkles,
      label: 'أدوات ذكاء اصطناعي — تحسين صور الأطباق ومساعد ذكي يرد على عملائك',
      included: !!features.ai_tools,
    },
    {
      icon: TrendingUp,
      label: 'تحليل يساعدك تفهم عملاءك وتزيد مبيعاتك',
      included: !!features.ai_analysis,
    },
    {
      icon: Star,
      label: 'صفحة خاصة بمطعمك بدون أي شعار ثاني',
      included: !!features.white_label,
    },
    {
      icon: Headset,
      label: 'دعم فني سريع لما تحتاجنا',
      included: !!features.priority_support,
    },
  ];
}

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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">باقات شفافة، مصممة لنموّك</h1>
            <p className="text-sm text-gray-600 max-w-lg mx-auto">ابدأ مجاناً أو أطلق العنان للقوة الكاملة لمطعمك أو مقهاك.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Skeleton className="h-[460px] rounded-3xl" />
              <Skeleton className="h-[460px] rounded-3xl" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              <p className="text-sm">لا توجد باقات متاحة حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
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
                            <li key={row.label} className={`flex items-start gap-3 text-xs leading-relaxed ${
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
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
