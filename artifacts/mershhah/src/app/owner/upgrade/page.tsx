'use client';

import { useState, useEffect } from 'react';
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import {
    Check,
    Tag,
    ShoppingCart,
    X,
    Loader2,
    ShieldCheck,
    Clock,
    Sparkles,
    AlertCircle,
    Crown,
    ArrowUpRight,
    Zap,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Plan, DiscountCode } from '@/lib/types';
import { getPlanFeatures } from '@/lib/plan-features';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function OwnerUpgradePage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
    const [discountError, setDiscountError] = useState('');
    const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const currentPlanId = user?.entitlements?.planId || 'free';

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

    const getDiscountedPrice = (plan: Plan) => {
        const price = plan.price ?? 0;
        if (!appliedDiscount || price === 0) return price;
        if (appliedDiscount.discount_type === 'percentage') {
            return Math.round(price * (1 - appliedDiscount.discount_value / 100));
        }
        return Math.max(0, price - appliedDiscount.discount_value);
    };

    const applyDiscount = async () => {
        if (!discountCode.trim()) return;
        setIsApplyingDiscount(true);
        setDiscountError('');

        try {
            const { data, error } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', discountCode.trim().toUpperCase())
                .eq('is_active', true)
                .single();

            if (error || !data) {
                setDiscountError('كود الخصم غير صحيح أو غير نشط');
                return;
            }

            const code = data as DiscountCode;

            if (code.expires_at && new Date(code.expires_at) < new Date()) {
                setDiscountError('كود الخصم منتهي الصلاحية');
                return;
            }

            if (code.max_uses && code.used_count >= code.max_uses) {
                setDiscountError('كود الخصم وصل للحد الأقصى من الاستخدام');
                return;
            }

            if (code.starts_at && new Date(code.starts_at) > new Date()) {
                setDiscountError('كود الخصم لم يبدأ بعد');
                return;
            }

            setAppliedDiscount(code);
            setDiscountError('');
            toast({ title: 'تم تطبيق الكود بنجاح', description: `خصم ${code.discount_type === 'percentage' ? `${code.discount_value}%` : `${code.discount_value} ر.س`}` });
        } catch {
            setDiscountError('حدث خطأ أثناء التحقق من الكود');
        } finally {
            setIsApplyingDiscount(false);
        }
    };

    const handleSubscribe = async (plan: Plan) => {
        setSelectedPlan(plan);
        setIsProcessing(true);

        try {
            const params = new URLSearchParams();
            params.set('plan', plan.id);

            if (appliedDiscount) {
                const price = plan.price ?? 0;
                let discountAmt = 0;
                if (appliedDiscount.discount_type === 'percentage') {
                    discountAmt = Math.round(price * appliedDiscount.discount_value / 100);
                } else {
                    discountAmt = Math.min(appliedDiscount.discount_value, price);
                }
                params.set('code', appliedDiscount.code);
                params.set('discount', String(discountAmt));
            }

            window.location.href = `/checkout?${params.toString()}`;
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-5 pb-20">
            <PageHeader
                title="ترقية الحساب"
                description="اختر الباقة المناسبة لتطوير مطعمك بالميزات المتقدمة."
            />

            {/* Current Plan Banner */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                            <Crown className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-900">الباقة الحالية</p>
                            <p className="text-[11px] text-gray-400">
                                {currentPlanId === 'free' ? 'الباقة المجانية' : currentPlanId === 'pro' ? 'الباقة الاحترافية' : 'باقة المؤسسات'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentPlanId !== 'free' && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                نشط
                            </span>
                        )}
                        {currentPlanId === 'free' && (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                                مجاني
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Discount Code */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">كود الخصم</h3>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        placeholder="أدخل كود الخصم هنا"
                        disabled={!!appliedDiscount}
                        className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs text-right font-mono placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:bg-gray-50"
                    />
                    {appliedDiscount ? (
                        <button
                            onClick={() => { setAppliedDiscount(null); setDiscountCode(''); }}
                            className="h-10 px-4 rounded-xl bg-red-50 text-red-500 text-[11px] font-bold hover:bg-red-100 transition-colors"
                        >
                            إزالة
                        </button>
                    ) : (
                        <button
                            onClick={applyDiscount}
                            disabled={isApplyingDiscount || !discountCode.trim()}
                            className="h-10 px-4 rounded-xl bg-gray-900 text-white text-[11px] font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            {isApplyingDiscount ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tag className="h-3 w-3" />}
                            تطبيق
                        </button>
                    )}
                </div>
                {discountError && (
                    <div className="flex items-center gap-1 mt-2">
                        <AlertCircle className="h-3 w-3 text-red-500" />
                        <span className="text-[10px] text-red-500">{discountError}</span>
                    </div>
                )}
                {appliedDiscount && (
                    <div className="flex items-center gap-1 mt-2">
                        <Tag className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-600">
                            {appliedDiscount.code} — خصم {appliedDiscount.discount_type === 'percentage' ? `${appliedDiscount.discount_value}%` : `${appliedDiscount.discount_value} ر.س`}
                        </span>
                    </div>
                )}
            </div>

            {/* Plans */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-[400px] rounded-2xl" />
                    <Skeleton className="h-[400px] rounded-2xl" />
                    <Skeleton className="h-[400px] rounded-2xl" />
                </div>
            ) : plans.length === 0 ? (
                <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl">
                    <p className="text-sm text-gray-400">لا توجد باقات متاحة حالياً.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                        const features = plan.features && Object.keys(plan.features).length > 0
                            ? plan.features
                            : getPlanFeatures(plan.id);
                        const isFree = (plan.price ?? 0) === 0;
                        const isCurrent = currentPlanId === plan.id;
                        const discountedPrice = getDiscountedPrice(plan);
                        const savings = (plan.price ?? 0) - discountedPrice;

                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    "relative bg-white border rounded-2xl p-5 flex flex-col transition-all",
                                    plan.is_featured && !isCurrent
                                        ? 'border-gray-900 ring-1 ring-gray-900'
                                        : isCurrent
                                            ? 'border-emerald-300 bg-emerald-50/30'
                                            : 'border-gray-100 hover:border-gray-200'
                                )}
                            >
                                {plan.is_featured && !isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                                        الأكثر انتشاراً
                                    </div>
                                )}
                                {isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                                        باقتك الحالية
                                    </div>
                                )}

                                <div className="mb-4">
                                    <h3 className="text-base font-bold text-gray-900 mb-1">{plan.name}</h3>
                                    <p className="text-[11px] text-gray-400 line-clamp-2">{plan.description || ''}</p>
                                </div>

                                <div className="mb-4">
                                    {isFree ? (
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-3xl font-black text-gray-900">0</span>
                                            <span className="text-sm font-bold text-gray-400">ر.س</span>
                                            <span className="text-[10px] text-gray-300">/ دائماً مجاناً</span>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-baseline gap-1.5">
                                                {appliedDiscount && savings > 0 && (
                                                    <span className="text-lg font-bold text-gray-300 line-through ml-2">{plan.price}</span>
                                                )}
                                                <span className="text-3xl font-black text-gray-900">{discountedPrice}</span>
                                                <span className="text-sm font-bold text-gray-400">ر.س</span>
                                                <span className="text-[10px] text-gray-300">/ {plan.duration_months > 1 ? `${plan.duration_months} أشهر` : 'شهر'}</span>
                                            </div>
                                            {appliedDiscount && savings > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Tag className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-[10px] font-bold text-emerald-600">
                                                        وفّرت {savings.toLocaleString()} ر.س
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-gray-100 pt-4 mb-4 flex-1">
                                    <ul className="space-y-2">
                                        {Object.entries(features).slice(0, 6).map(([feature, included]) => (
                                            <li key={feature} className={cn(
                                                "flex items-center gap-2 text-[11px]",
                                                !included ? 'text-gray-300 line-through' : 'text-gray-600'
                                            )}>
                                                <Check className={cn(
                                                    "h-3 w-3 shrink-0",
                                                    included ? 'text-emerald-500' : 'text-gray-200'
                                                )} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                        {Object.keys(features).length > 6 && (
                                            <li className="text-[10px] text-gray-400 pr-5">
                                                + {Object.keys(features).length - 6} ميزة إضافية
                                            </li>
                                        )}
                                    </ul>
                                </div>

                                {isFree ? (
                                    <div className="h-10 rounded-xl border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">
                                        الباقة الحالية
                                    </div>
                                ) : isCurrent ? (
                                    <div className="h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                                        مشترك حالياً
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={isProcessing}
                                        className={cn(
                                            "w-full h-10 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
                                            plan.is_featured
                                                ? 'bg-gray-900 text-white hover:bg-gray-800'
                                                : 'border border-gray-200 text-gray-600 hover:bg-gray-50',
                                            isProcessing && 'opacity-50 cursor-not-allowed'
                                        )}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <>
                                                <Zap className="h-3 w-3" />
                                                اشترك الآن
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-6 text-gray-400">
                <div className="flex items-center gap-1.5 text-[10px]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>دفع آمن</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                    <Clock className="h-4 w-4" />
                    <span>تفعيل فوري</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>إلغاء في أي وقت</span>
                </div>
            </div>
        </div>
    );
}
