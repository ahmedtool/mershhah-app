'use client';

import { useUser } from '@/hooks/useUser';
import { Loader2, ShieldAlert, BadgeInfo, Check, X, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import type { Subscription } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { describeFeature } from '@/lib/plan-feature-labels';

type OnboardingPlan = {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    trial_days: number;
    is_featured: boolean;
    features?: Record<string, boolean | number>;
};

const FullPageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="animate-spin h-10 w-10 text-gray-900" />
    </div>
);

const CenteredMessage = ({ icon: Icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center p-6 bg-background rounded-lg">
        <Icon className="w-16 h-16 text-gray-900 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <div className="max-w-md text-muted-foreground">{children}</div>
    </div>
);

export function AccountStatusChecker({ children }: { children: React.ReactNode }) {
    const { user, isLoading: isUserLoading } = useUser();
    const [plans, setPlans] = useState<OnboardingPlan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(true);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
    const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const fetchPlans = async () => {
            setIsLoadingPlans(true);
            try {
                const { data, error } = await supabase
                    .from('plans')
                    .select('id, name, description, price_monthly, price_yearly, trial_days, is_featured, features')
                    .eq('is_active', true);
                if (error) throw error;
                const fetchedPlans = (data || []) as OnboardingPlan[];
                fetchedPlans.sort((a, b) => {
                    if (a.is_featured && !b.is_featured) return -1;
                    if (!a.is_featured && b.is_featured) return 1;
                    return (a.price_monthly || 0) - (b.price_monthly || 0);
                });
                setPlans(fetchedPlans);
            } catch (error) {
                console.error("Error fetching plans:", error);
            } finally {
                setIsLoadingPlans(false);
            }
        };
        fetchPlans();
    }, []);

    useEffect(() => {
        if (isUserLoading || !user) {
            setIsCheckingSubscription(false);
            return;
        }

        const checkAndMigrateSubscription = async () => {
            setIsCheckingSubscription(true);
            try {
                const { data: subs, error } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('profile_id', user.uid);

                if (error) throw error;

                const now = new Date();
                const hasValidSub = (subs || []).some((sub: Subscription) => {
                    const endDate = new Date(sub.end_date);
                    return sub.status === 'active' && endDate > now;
                });

                if (hasValidSub) {
                    setHasActiveSubscription(true);
                } else {
                    setHasActiveSubscription(false);

                    // Migration: old user with active account but no subscription row
                    if (user.account_status === 'active' && (!subs || subs.length === 0)) {
                        const startDate = new Date();
                        const endDate = new Date();
                        endDate.setFullYear(startDate.getFullYear() + 100);

                        const { error: insertError } = await supabase.from('subscriptions').insert({
                            profile_id: user.uid,
                            plan_id: 'free',
                            plan_name: 'الباقة المجانية',
                            status: 'active',
                            start_date: startDate.toISOString(),
                            end_date: endDate.toISOString(),
                        });

                        if (!insertError) {
                            setHasActiveSubscription(true);
                            toast({ title: 'أهلاً بعودتك!', description: 'تم تحديث حسابك إلى نظام الباقات الجديد (الباقة المجانية).', duration: 5000 });
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking/migrating subscription:", error);
                setHasActiveSubscription(false);
            } finally {
                setIsCheckingSubscription(false);
            }
        };

        checkAndMigrateSubscription();
    }, [user, isUserLoading, toast]);

    const handleCheckout = async (planId: string, cycle: 'monthly' | 'yearly') => {
        setCheckingOutId(`${planId}-${cycle}`);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-checkout`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        plan_id: planId,
                        billing_cycle: cycle,
                        discount_code: couponCode || undefined,
                    }),
                }
            );
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast({ variant: 'destructive', title: 'تعذّر بدء الدفع', description: data.error || 'فشل إنشاء رابط الدفع' });
                setCheckingOutId(null);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: error.message });
            setCheckingOutId(null);
        }
    };

    const isLoading = isUserLoading || isLoadingPlans || isCheckingSubscription;

    if (isLoading) return <FullPageLoader />;
    if (!user) return <FullPageLoader />;

    if (user.role !== 'owner') {
        return <CenteredMessage icon={ShieldAlert} title="غير مصرح به">ليس لديك صلاحية الوصول لهذه الصفحة.</CenteredMessage>;
    }

    const needsToPay = user.account_status === 'pending' || (user.account_status === 'active' && !hasActiveSubscription);

    if (user.account_status === 'suspended') {
        return (
            <CenteredMessage icon={BadgeInfo} title="الحساب معلق">
                <p>تم تعليق حسابك. الرجاء التواصل مع الدعم للمزيد من المعلومات.</p>
                <Button asChild className='mt-6'>
                    <Link href="/owner/support">تواصل مع الدعم</Link>
                </Button>
            </CenteredMessage>
        );
    }

    if (needsToPay) {
        return (
            <div className="w-full max-w-5xl mx-auto p-4 py-10" dir="rtl">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-2 text-gray-900">باقي خطوة واحدة لتفعيل حسابك!</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">شكراً لتسجيلك في مرشح. اختر الباقة التي تناسب مرحلة نمو مشروعك.</p>
                </div>

                {/* Coupon */}
                <div className="max-w-xs mx-auto mb-8 bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Tag className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-700">كوبون خصم (اختياري)</span>
                    </div>
                    <input
                        type="text"
                        placeholder="أدخل الكوبون"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-center font-bold tracking-wider placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                        dir="ltr"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                    {plans.map(plan => {
                        const features = Object.entries(plan.features || {});
                        const isCheckingOutMonthly = checkingOutId === `${plan.id}-monthly`;
                        const isCheckingOutYearly = checkingOutId === `${plan.id}-yearly`;
                        return (
                            <div key={plan.id} className={`flex flex-col rounded-2xl border overflow-hidden ${plan.is_featured ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100'}`}>
                                <div className={`px-6 pt-6 pb-5 ${plan.is_featured ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                    {plan.is_featured && (
                                        <span className="text-[10px] font-medium text-gray-300 bg-white/10 px-2 py-0.5 rounded-full">الأكثر انتشاراً</span>
                                    )}
                                    <h3 className={`text-lg font-bold mt-2 ${plan.is_featured ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                                    {plan.description && (
                                        <p className={`text-xs mt-1 ${plan.is_featured ? 'text-gray-300' : 'text-gray-400'}`}>{plan.description}</p>
                                    )}
                                </div>

                                <div className="px-6 py-5 border-b border-gray-100 space-y-1">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-gray-900">{plan.price_monthly || 0}</span>
                                        <span className="text-xs text-gray-400">ر.س/شهر</span>
                                    </div>
                                    {plan.trial_days > 0 && (
                                        <p className="text-[10px] text-amber-600 font-bold">فترة تجربة {plan.trial_days} يوم</p>
                                    )}
                                </div>

                                <div className="px-6 py-5 flex-1 space-y-2.5">
                                    {features.length === 0 ? (
                                        <p className="text-xs text-gray-300 text-center py-2">لا توجد تفاصيل إضافية</p>
                                    ) : (
                                        features.map(([key, value]) => {
                                            const { label, included } = describeFeature(key, value);
                                            return (
                                                <div key={key} className={`flex items-center gap-2.5 text-xs ${included ? 'text-gray-700 font-medium' : 'text-gray-300 line-through'}`}>
                                                    {included ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <X className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                                                    <span>{label}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="px-6 pb-6 space-y-2">
                                    <button
                                        onClick={() => handleCheckout(plan.id, 'monthly')}
                                        disabled={checkingOutId !== null}
                                        className="w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isCheckingOutMonthly ? <Loader2 className="h-4 w-4 animate-spin" /> : 'اشتراك شهري'}
                                    </button>
                                    {plan.price_yearly > 0 && (
                                        <button
                                            onClick={() => handleCheckout(plan.id, 'yearly')}
                                            disabled={checkingOutId !== null}
                                            className="w-full h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isCheckingOutYearly ? <Loader2 className="h-4 w-4 animate-spin" /> : `اشتراك سنوي (${plan.price_yearly} ر.س)`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (user.account_status === 'active' && hasActiveSubscription) {
        return <>{children}</>;
    }

    return <FullPageLoader />;
}
