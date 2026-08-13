'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, X, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { describeFeature } from '@/lib/plan-feature-labels';
import { useCouponCheck } from '@/hooks/useCouponCheck';
import { usePlanCheckout } from '@/hooks/usePlanCheckout';
import { Skeleton } from '@/components/ui/skeleton';

interface PlanPricingGridProps {
  currentPlanId?: string;
  isCurrentSubscriptionExpired?: boolean;
}

// Single source of truth for plan pricing/checkout — used by AccountStatusChecker
// (onboarding gate), owner/billing, and owner/settings, which each used to fetch
// plans and render their own slightly-diverged card grid.
export function PlanPricingGrid({ currentPlanId, isCurrentSubscriptionExpired }: PlanPricingGridProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { couponCode, setCouponCode, couponDiscount, isCheckingCoupon, checkCoupon, applyDiscount } = useCouponCheck();
  const { checkout, isCheckingOut, isCheckoutInProgress } = usePlanCheckout();

  useEffect(() => {
    supabase.from('plans').select('*').eq('is_active', true).order('price_monthly').then(({ data }: { data: any[] | null }) => {
      const fetched = data || [];
      fetched.sort((a: any, b: any) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return (a.price_monthly || 0) - (b.price_monthly || 0);
      });
      setPlans(fetched);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex bg-gray-100 rounded-xl p-0.5">
          <button onClick={() => setCycle('monthly')} className={cn("h-8 px-4 rounded-lg text-[11px] font-bold transition-all", cycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400')}>
            شهري
          </button>
          <button onClick={() => setCycle('yearly')} className={cn("h-8 px-4 rounded-lg text-[11px] font-bold transition-all", cycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400')}>
            سنوي
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="كوبون خصم (اختياري)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="flex-1 sm:w-40 h-10 px-3 rounded-xl border border-gray-200 text-xs text-center font-bold tracking-wider placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
            dir="ltr"
          />
          <button onClick={checkCoupon} disabled={isCheckingCoupon || !couponCode} className="h-10 px-4 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 shrink-0">
            تحقق
          </button>
        </div>
      </div>

      {couponDiscount && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          <Tag className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[11px] text-emerald-700 font-medium">
            ✓ {couponDiscount.discount_type === 'percentage' ? `خصم ${couponDiscount.discount_value}%` : couponDiscount.discount_type === 'fixed' ? `خصم ثابت ${couponDiscount.discount_value} ر.س` : 'فترة مجانية'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {plans.map((plan) => {
          const originalPrice = cycle === 'yearly' ? (plan.price_yearly || 0) : (plan.price_monthly || 0);
          const price = applyDiscount(originalPrice);
          const isCurrentPlan = currentPlanId === plan.id && !isCurrentSubscriptionExpired;
          const features = Object.entries(plan.features || {});
          const checking = isCheckingOut(plan.id, cycle);

          return (
            <div key={plan.id} className={cn(
              "flex flex-col rounded-2xl border overflow-hidden",
              plan.is_featured ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100',
              isCurrentPlan && 'ring-2 ring-emerald-500 border-emerald-500'
            )}>
              <div className={cn("px-5 pt-5 pb-4", plan.is_featured ? 'bg-gray-900' : 'bg-gray-50')}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={cn("text-base font-bold", plan.is_featured ? 'text-white' : 'text-gray-900')}>{plan.name}</h3>
                  {isCurrentPlan && <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shrink-0">الحالية</span>}
                  {plan.is_featured && !isCurrentPlan && <span className="text-[9px] font-bold bg-white/20 text-white/80 px-2 py-0.5 rounded-full shrink-0">الأكثر انتشاراً</span>}
                </div>
                {plan.description && <p className={cn("text-xs mt-1", plan.is_featured ? 'text-gray-300' : 'text-gray-400')}>{plan.description}</p>}
              </div>

              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-baseline gap-1">
                  {couponDiscount && price !== originalPrice && <span className="text-xs text-gray-300 line-through">{originalPrice}</span>}
                  <span className="text-2xl font-black text-gray-900">{price}</span>
                  <span className="text-xs text-gray-400">ر.س/{cycle === 'yearly' ? 'سنة' : 'شهر'}</span>
                </div>
                {cycle === 'yearly' && plan.price_monthly > 0 && plan.price_yearly > 0 && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">وفّر {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}% سنوياً</p>
                )}
                {plan.trial_days > 0 && <p className="text-[10px] text-amber-600 font-bold mt-1">فترة تجربة {plan.trial_days} يوم</p>}
              </div>

              <div className="px-5 py-4 flex-1 space-y-2">
                {features.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-2">لا توجد تفاصيل إضافية</p>
                ) : (
                  features.map(([key, value]) => {
                    const { label, included } = describeFeature(key, value as boolean | number);
                    return (
                      <div key={key} className={cn("flex items-center gap-2 text-xs", included ? 'text-gray-700 font-medium' : 'text-gray-300 line-through')}>
                        {included ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                        <span>{label}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-5 pb-5">
                <button
                  onClick={() => checkout(plan.id, cycle, couponCode)}
                  disabled={isCurrentPlan || isCheckoutInProgress}
                  className={cn(
                    "w-full h-11 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                    isCurrentPlan ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : checking ? 'bg-gray-400 text-white cursor-wait'
                      : plan.is_featured ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {isCurrentPlan
                    ? 'الباقة الحالية'
                    : checking
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري التوجيه...</>
                    : cycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
