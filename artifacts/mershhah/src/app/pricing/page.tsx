'use client';

import { useState, useEffect } from "react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Loader2, Utensils, MapPin, Wrench, Sparkles, TrendingUp, Star, Headset, Building2, Check, Minus } from "lucide-react";
import { Link } from "wouter";
import { LandingFooter } from "@/components/shared/LandingFooter";
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
  // The DB column is kept at 1 (not 0) on branches-disabled plans, since 0
  // means "unlimited" for this column - real "zero branches" is expressed
  // via this separate flag instead. Read it here too so the card's copy
  // matches the actual entitlement instead of leaking the workaround value.
  const branchesDisabled = !!features.branches_disabled;

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
      label: branchesDisabled
        ? 'بدون فروع'
        : branchLimit > 0 ? `حتى ${branchLimit} ${branchLimit === 1 ? 'فرع' : 'فروع'}` : 'فروع بلا حدود',
      included: true,
    },
    {
      key: 'tools',
      icon: Wrench,
      label: toolsLimit > 0
        ? `حتى ${toolsLimit} ${toolsLimit === 1 ? 'أداة مفعّلة' : 'أدوات مفعّلة'} من متجر الأدوات (بعضها مجاني وبعضها مدفوع)`
        : 'أدوات بلا حدود من متجر الأدوات (بعضها مجاني وبعضها مدفوع)',
      included: true,
    },
    {
      key: 'priority_support',
      icon: Headset,
      label: 'دعم فني سريع لما تحتاجنا',
      // A baseline promise to every customer regardless of plan, not a
      // paid differentiator - grouped with the other always-included rows
      // above (rather than last) so it doesn't strand a checkmark after a
      // run of crossed-out differentiators on lower tiers.
      included: true,
    },
    {
      key: 'ai_tools',
      icon: Sparkles,
      label: 'مساعد ذكاء اصطناعي يرد على استفسارات عملائك تلقائياً',
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
      label: 'صفحة مطعمك بدون علامة مرشح المائية',
      included: !!features.white_label,
    },
    {
      key: 'gateway_corporate',
      icon: Building2,
      label: 'استقبال طلبات الشركات والفعاليات',
      included: !!features.gateway_corporate,
    },
  ];
}

const FAQS = [
  {
    q: 'وش الفرق بين الباقات؟',
    a: 'كل الباقات تشترك في نفس الأساسيات (منيو رقمي، مساعد ذكي، تحليلات). الفرق الرئيسي هو عدد الفروع المسموح به، مع حدود أعلى لعدد الأصناف والأدوات كل ما ارتفعت الباقة.',
  },
  {
    q: 'وش يصير لو وصلت لحد باقتي؟',
    a: 'يوضح لك النظام إنك وصلت لحد باقتك الحالية (فروع أو أصناف)، وتقدر تتواصل معنا فوراً للترقية لباقة أعلى.',
  },
  {
    q: 'هل أدوات متجر الأدوات مرتبطة بسعر الباقة؟',
    a: 'عدد الأدوات اللي تقدر تفعّلها بنفس الوقت يعتمد على باقتك، لكن الأدوات نفسها منها المجاني ومنها له سعر مستقل بغض النظر عن باقتك.',
  },
  {
    q: 'أقدر أرقّي باقتي لاحقاً؟',
    a: 'أيوه، تواصل معنا وبنساعدك تترقّى لباقة أعلى فوراً.',
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
        // Strict price order - is_featured only controls the "الأكثر
        // اختياراً" badge/border on its own card, not its position.
        fetched.sort((a, b) => (a.price_yearly ?? 0) - (b.price_yearly ?? 0));
        setPlans(fetched);
      } catch {
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Union of every boolean feature row that's actually true for at least one
  // plan - the numeric limit rows (menu/branches/tools) are deliberately
  // excluded here: their label text bakes in one specific plan's number
  // ("حتى 150 صنف"), so reusing that same label as a shared row for every
  // column and reducing it to a check/dash was actively misleading. Those
  // limits are already shown correctly, per-plan, on the cards above.
  const comparisonRows: FeatureRow[] = plans.length
    ? (() => {
        const perPlanRows = plans.map(buildFeatureRows);
        const template = perPlanRows[0] || [];
        return template
          .map((row) => row.key)
          .filter((key) => !['menu', 'branches', 'tools'].includes(key))
          .filter((key) => perPlanRows.some((rows) => rows.find((r) => r.key === key)?.included))
          .map((key) => perPlanRows[0].find((r) => r.key === key)!);
      })()
    : [];

  return (
    <div dir="rtl" className="min-h-screen bg-[#e9e9ec] py-6 sm:py-10 px-3 sm:px-6">
      <div className="max-w-[1040px] mx-auto bg-white rounded-[24px] sm:rounded-[28px] overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-4 sm:gap-7 px-5 sm:px-10 py-5 sm:py-6">
          <Logo />
          <Link href="/" className="text-sm font-semibold text-[#8b8b95] hover:text-[#3d4a66] transition-colors">
            الرئيسية
          </Link>
          <span className="hidden sm:inline text-sm font-semibold text-[#131a2b]">الباقات</span>
          <div className="flex-1" />
          <Button asChild className="bg-[#131a2b] hover:bg-[#2b3549] text-white rounded-full px-5 sm:px-6 h-10 sm:h-11 text-[13px] sm:text-[13.5px] font-semibold">
            <Link href="/register">ابدأ الآن</Link>
          </Button>
        </header>

        {/* Hero */}
        <section className="text-center pt-8 sm:pt-10 px-5 sm:px-10">
          <div className="inline-flex items-center gap-2 bg-[#f4f4f7] rounded-full px-4 py-[7px] text-xs font-semibold text-[#5b6478]">
            <span className="w-[7px] h-[7px] rounded-full bg-[#2fbf71]" />
            أسعار واضحة بدون تعقيد
          </div>
          <h1 className="mt-[18px] text-3xl sm:text-4xl md:text-[44px] leading-[1.35] font-bold text-[#131a2b] tracking-tight">
            باقة تكبر <span className="text-[#8b93a6]">مع عدد فروعك</span>
          </h1>
          <p className="mt-3.5 max-w-[540px] mx-auto text-[15px] leading-[1.9] text-[#8b8b95]">
            جميع أساسيات مرشّح متاحة في كل الباقات — لا مزايا مقفلة. اختر الباقة المناسبة لعدد فروعك، ورقّي وقت ما تحتاج.
          </p>
          <div className="inline-flex items-center gap-2 bg-[#f4f4f7] rounded-full px-5 py-2.5 mt-6 text-[12.5px] font-semibold text-[#5b6478]">
            اشتراك سنوي · الفرق الرئيسي بين الباقات هو عدد الفروع
          </div>
        </section>

        {/* Plan cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] px-5 sm:px-10 pt-9">
            <Skeleton className="h-[460px] rounded-[22px]" />
            <Skeleton className="h-[460px] rounded-[22px]" />
            <Skeleton className="h-[460px] rounded-[22px] hidden sm:block" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-[#8b8b95]">
            <p className="text-sm">لا توجد باقات متاحة حالياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] px-5 sm:px-10 pt-9 items-stretch">
            {plans.map((plan) => {
              const featured = !!plan.is_featured;
              const rows = buildFeatureRows(plan);
              const checking = isCheckingOut(plan.id, 'yearly');
              const ctaClass = 'block w-full h-12 rounded-full text-sm font-bold text-center leading-[3rem] transition-colors disabled:opacity-60 bg-[#131a2b] text-white hover:bg-[#2b3549]';

              // Logged-out visitors go through registration - a freshly
              // registered account lands on the real in-app upgrade gate
              // (PlanPricingGrid), which already checks out correctly. A
              // logged-in visitor on this marketing page can check out
              // directly, the same way the dashboard does - this is what
              // makes the payment actually tied to their account instead
              // of a static, identity-less payment link.
              const cta = user ? (
                <button type="button" onClick={() => checkout(plan.id, 'yearly')} disabled={checking} className={ctaClass}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'اختر هذه الباقة'}
                </button>
              ) : (
                <Link href="/register" className={ctaClass}>اختر هذه الباقة</Link>
              );

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-[22px] p-7 flex flex-col ${
                    featured ? 'bg-white border-2 border-[#131a2b]' : 'bg-[#f4f4f7]'
                  }`}
                >
                  {featured && (
                    <div className="absolute -top-3 inset-x-0 mx-auto w-fit bg-[#131a2b] text-white text-[11px] font-bold px-3.5 py-1 rounded-full whitespace-nowrap">
                      الأكثر اختياراً
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-[#131a2b] tracking-tight">{plan.name}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-[1.8] text-[#8b8b95]">{plan.description || ''}</p>
                  </div>

                  <div className="flex items-end gap-1.5 mt-5">
                    <span className="text-[32px] font-bold text-[#131a2b] tracking-tight">{plan.price_yearly}</span>
                    <span className="text-[12.5px] font-semibold text-[#9a9aa5] pb-1.5">ر.س / سنوياً</span>
                  </div>

                  <div className="mt-6 pt-6 border-t border-[#e4e4ea] flex-1">
                    <ul className="space-y-3">
                      {rows.map((row) => {
                        const Icon = row.icon;
                        return (
                          <li key={row.key} className={`flex items-start gap-2.5 text-[12.5px] leading-relaxed ${
                            row.included ? 'text-[#5b6478]' : 'text-[#a7a7b2] line-through'
                          }`}>
                            <span className={`w-[26px] h-[26px] rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              row.included ? 'bg-[#131a2b]' : 'bg-[#eeeef3]'
                            }`}>
                              <Icon className={`h-3.5 w-3.5 ${row.included ? 'text-white' : 'text-[#a7a7b2]'}`} />
                            </span>
                            <span>{row.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mt-6">{cta}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Comparison table */}
        {comparisonRows.length > 0 && (
          <div className="pt-16 px-5 sm:px-10">
            <h2 className="m-0 text-center text-2xl sm:text-[26px] font-bold text-[#131a2b] tracking-tight">مقارنة تفصيلية</h2>
            <div className="mt-6 border border-[#eeeef3] rounded-[18px] overflow-hidden overflow-x-auto">
              <table className="w-full text-[12.5px] min-w-[480px]">
                <thead>
                  <tr className="bg-[#f4f4f7]">
                    <th className="text-right py-3.5 px-5 font-bold text-[#131a2b]">الميزة</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="text-center py-3.5 px-5 font-bold text-[#131a2b]">{plan.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.key} className="border-t border-[#f1f1f5]">
                      <td className="text-right py-3.5 px-5 font-semibold text-[#131a2b]">{row.label}</td>
                      {plans.map((plan) => {
                        const planRow = buildFeatureRows(plan).find((r) => r.key === row.key)!;
                        return (
                          <td key={plan.id} className="py-3.5 px-5">
                            {planRow.included
                              ? <Check className="h-4 w-4 text-[#2fbf71] mx-auto" />
                              : <Minus className="h-4 w-4 text-[#c3c3cd] mx-auto" />}
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

        {/* FAQ */}
        <div className="pt-16 px-5 sm:px-10">
          <h2 className="m-0 text-center text-2xl sm:text-[26px] font-bold text-[#131a2b] tracking-tight">أسئلة متكررة</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            {FAQS.map((item) => (
              <div key={item.q} className="bg-[#f4f4f7] rounded-[18px] p-6">
                <div className="text-[14.5px] font-bold text-[#131a2b]">{item.q}</div>
                <p className="mt-2.5 text-[13px] leading-[1.9] text-[#8b8b95]">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="pt-16 px-4 sm:px-6">
          <div className="relative bg-[#131a2b] rounded-[24px] px-6 sm:px-8 py-12 text-center overflow-hidden">
            <div className="absolute left-1/2 -top-[200px] w-[640px] h-[640px] -ml-[320px] rounded-full border border-white/[0.07]" />
            <h2 className="relative m-0 text-2xl sm:text-[27px] font-bold tracking-tight text-white">جاهز تبدأ؟</h2>
            <p className="relative mt-3 text-sm text-[#9aa3b6]">فعّل مشروعك في أقل من خمس دقائق.</p>
            <div className="relative flex justify-center gap-3 mt-7 flex-wrap">
              <Button asChild className="bg-white hover:bg-[#e9e9ec] text-[#131a2b] rounded-full px-8 h-[52px] text-[13.5px] font-bold">
                <Link href="/register">ابدأ الآن</Link>
              </Button>
              <Button asChild variant="outline" className="bg-transparent hover:bg-transparent hover:border-white text-white border border-white/25 rounded-full px-8 h-[52px] text-[13.5px] font-semibold">
                <Link href="/contact">تحدث معنا</Link>
              </Button>
            </div>
          </div>
        </div>

        <LandingFooter />

      </div>
    </div>
  );
}
