'use client';

import { useState, useEffect } from "react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "@/components/shared/PublicFooter";
import { supabase } from "@/lib/supabase";
import type { Plan } from "@/lib/types";
import { getPlanFeatures } from "@/lib/plan-features";
import { Skeleton } from "@/components/ui/skeleton";

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase.from("plans").select("*").eq("is_active", true);
        const fetched = (data || []) as Plan[];
        fetched.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return (a.price ?? 0) - (b.price ?? 0);
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
    <div className="min-h-screen overflow-x-hidden" dir="rtl">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <Logo />
          <Button asChild variant="ghost" className="text-gray-600 text-sm font-bold hover:bg-gray-50 rounded-xl px-4">
            <Link href="/"><ArrowLeft className="ml-2 h-4 w-4" />العودة</Link>
          </Button>
        </div>
      </header>

      <main className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">باقات شفافة، مصممة لنموّك</h1>
            <p className="text-sm text-gray-400 max-w-lg mx-auto">ابدأ مجاناً أو أطلق العنان للقوة الكاملة لمطعمك أو مقهاك.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-[400px] rounded-2xl" />
              <Skeleton className="h-[400px] rounded-2xl" />
              <Skeleton className="h-[400px] rounded-2xl" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm">لا توجد باقات متاحة حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const features = plan.features && Object.keys(plan.features).length > 0 ? plan.features : getPlanFeatures(plan.id);
                const isFree = (plan.price ?? 0) === 0;
                const ctaHref = isFree ? "/register" : (plan.payment_link || "/register");
                const ctaLabel = isFree ? "ابدأ مجاناً" : "اختر هذه الباقة";
                const isExternal = ctaHref.startsWith("http");

                return (
                  <div key={plan.id} className={`relative bg-white border rounded-2xl p-6 flex flex-col ${plan.is_featured ? 'border-gray-900' : 'border-gray-100'}`}>
                    {plan.is_featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                        الأكثر انتشاراً
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="text-base font-bold text-gray-900 mb-1">{plan.name}</h3>
                      <p className="text-[11px] text-gray-400">{plan.description || ''}</p>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-3xl font-black text-gray-900">{plan.price ?? 0}</span>
                      <span className="text-sm font-bold text-gray-400">ر.س</span>
                    </div>
                    <p className="text-[10px] text-gray-300 mb-6">
                      {(plan.price ?? 0) === 0 ? 'دائماً مجاناً' : `لكل ${plan.duration_months ?? 1} أشهر`}
                    </p>
                    <div className="border-t border-gray-100 pt-5 mb-6 flex-1">
                      <ul className="space-y-2.5">
                        {Object.entries(features).map(([feature, included]) => (
                          <li key={feature} className={`flex items-center gap-2.5 text-xs ${!included ? 'text-gray-300 line-through' : 'text-gray-600'}`}>
                            <Check className={`h-3.5 w-3.5 shrink-0 ${included ? 'text-emerald-500' : 'text-gray-200'}`} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {isExternal ? (
                      <a href={ctaHref} target="_blank" rel="noopener noreferrer"
                        className={`block w-full h-10 rounded-xl text-xs font-bold text-center leading-10 transition-colors ${plan.is_featured ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {ctaLabel}
                      </a>
                    ) : (
                      <Link href={ctaHref}
                        className={`block w-full h-10 rounded-xl text-xs font-bold text-center leading-10 transition-colors ${plan.is_featured ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {ctaLabel}
                      </Link>
                    )}
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
