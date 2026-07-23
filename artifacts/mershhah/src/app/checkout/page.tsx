'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from '@/lib/navigation';
import { Link } from 'wouter';
import {
    ArrowLeft,
    ShieldCheck,
    Clock,
    Tag,
    Loader2,
    Check,
    CreditCard,
    AlertCircle,
    Lock,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Plan, DiscountCode } from '@/lib/types';
import { getPlanFeatures } from '@/lib/plan-features';
import { Skeleton } from '@/components/ui/skeleton';

export default function CheckoutPage() {
    const searchParams = useSearchParams();
    const { user } = useUser();
    const { toast } = useToast();

    const planId = searchParams.get('plan');
    const discountCode = searchParams.get('code') || '';
    const discountAmount = Number(searchParams.get('discount') || '0');

    const [plan, setPlan] = useState<Plan | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.full_name || '');
            setEmail(user.email || '');
            setPhone(user.phone_number || '');
        }
    }, [user]);

    useEffect(() => {
        if (!planId) {
            setIsLoading(false);
            return;
        }

        const fetchPlan = async () => {
            try {
                const { data } = await supabase
                    .from('plans')
                    .select('*')
                    .eq('id', planId)
                    .single();

                if (data) {
                    setPlan(data as Plan);
                }
            } catch {
                setPlan(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlan();
    }, [planId]);

    const originalPrice = plan?.price ?? 0;
    const finalPrice = Math.max(0, originalPrice - discountAmount);
    const durationMonths = plan?.duration_months ?? 1;

    const handleCheckout = async () => {
        if (!plan) return;

        if (!name.trim()) {
            setError('الاسم مطلوب');
            return;
        }
        if (!email.trim() && !phone.trim()) {
            setError('البريد الإلكتروني أو رقم الجوال مطلوب');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const response = await fetch('/api/checkout/create-payment-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: plan.id,
                    plan_name: plan.name,
                    plan_price: originalPrice,
                    duration_months: durationMonths,
                    customer_name: name,
                    customer_email: email,
                    customer_phone: phone,
                    discount_code: discountCode,
                    discount_amount: discountAmount,
                }),
            });

            const text = await response.text();
            let data: any;
            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                throw new Error('استجابة غير صالحة من الخادم. تأكد من تشغيل سيرفر API على المنفذ 8080.');
            }

            if (!response.ok) {
                throw new Error(data.error || data.detail || `خطأ ${response.status}: فشل في إنشاء رابط الدفع`);
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('لم يتم الحصول على رابط الدفع من StreamPay');
            }
        } catch (err: any) {
            const msg = err.message?.includes('Failed to fetch')
                ? 'تعذر الاتصال بالخادم. تأكد من تشغيل API Server على المنفذ 8080.'
                : err.message || 'حدث خطأ غير متوقع';
            setError(msg);
            toast({
                title: 'خطأ',
                description: msg,
                variant: 'destructive',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4" dir="rtl">
                <div className="w-full max-w-md space-y-4">
                    <Skeleton className="h-[400px] rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4" dir="rtl">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h1 className="text-lg font-bold text-gray-900 mb-2">باقة غير موجودة</h1>
                    <p className="text-sm text-gray-400 mb-6">الباقة المحددة غير موجودة أو لم تعد متاحة.</p>
                    <Link
                        href="/owner/upgrade"
                        className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        العودة لصفحة الترقية
                    </Link>
                </div>
            </div>
        );
    }

    const features = plan.features && Object.keys(plan.features).length > 0
        ? plan.features
        : getPlanFeatures(plan.id);

    return (
        <div className="min-h-screen bg-white" dir="rtl">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/owner/upgrade" className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="h-4 w-4" />
                        إلغاء
                    </Link>
                    <div className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-400">دفع آمن ومشفر</span>
                    </div>
                </div>
            </header>

            <main className="py-8 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Order Summary */}
                        <div className="flex-1">
                            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
                                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-gray-400" />
                                    ملخص الطلب
                                </h2>

                                {/* Plan Card */}
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                                        {plan.is_featured && (
                                            <span className="text-[9px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-full">
                                                الأكثر انتشاراً
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mb-3">{plan.description}</p>

                                    <div className="flex items-baseline gap-1.5">
                                        {discountAmount > 0 && (
                                            <span className="text-lg font-bold text-gray-300 line-through">{originalPrice}</span>
                                        )}
                                        <span className="text-2xl font-black text-gray-900">{finalPrice}</span>
                                        <span className="text-xs font-bold text-gray-400">ر.س</span>
                                        <span className="text-[10px] text-gray-300">
                                            / {durationMonths > 1 ? `${durationMonths} أشهر` : 'شهر'}
                                        </span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <Tag className="h-3 w-3 text-emerald-500" />
                                            <span className="text-[10px] font-bold text-emerald-600">
                                                وفّرت {discountAmount.toLocaleString()} ر.س
                                                {discountCode && ` (${discountCode})`}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Features */}
                                <div className="border-t border-gray-100 pt-3">
                                    <p className="text-[10px] font-bold text-gray-500 mb-2">الميزات المشمولة:</p>
                                    <ul className="space-y-1.5">
                                        {Object.entries(features).slice(0, 5).map(([feature, included]) => (
                                            <li key={feature} className={`flex items-center gap-2 text-[11px] ${!included ? 'text-gray-300 line-through' : 'text-gray-600'}`}>
                                                <Check className={`h-3 w-3 shrink-0 ${included ? 'text-emerald-500' : 'text-gray-200'}`} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Price Breakdown */}
                            <div className="bg-white border border-gray-100 rounded-2xl p-5">
                                <h2 className="text-sm font-bold text-gray-900 mb-3">تفاصيل السعر</h2>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-400">سعر الباقة</span>
                                        <span className="font-bold text-gray-600">{originalPrice.toLocaleString()} ر.س</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-emerald-600">الخصم</span>
                                            <span className="font-bold text-emerald-600">-{discountAmount.toLocaleString()} ر.س</span>
                                        </div>
                                    )}
                                    <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                                        <span className="text-sm font-bold text-gray-900">الإجمالي</span>
                                        <span className="text-lg font-black text-gray-900">{finalPrice.toLocaleString()} ر.س</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Form */}
                        <div className="lg:w-96 shrink-0">
                            <div className="bg-white border border-gray-100 rounded-2xl p-5 sticky top-24">
                                <h2 className="text-sm font-bold text-gray-900 mb-4">بيانات الدفع</h2>

                                <div className="space-y-3 mb-5">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5">الاسم الكامل *</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="الاسم كما هو في البطاقة"
                                            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5">البريد الإلكتروني *</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="example@email.com"
                                            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1.5">رقم الجوال</label>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+9665XXXXXXXX"
                                            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs placeholder:text-gray-300 focus:outline-none focus:border-gray-300"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-center gap-1.5 mb-4 p-3 bg-red-50 rounded-xl">
                                        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                        <span className="text-[11px] text-red-600">{error}</span>
                                    </div>
                                )}

                                <button
                                    onClick={handleCheckout}
                                    disabled={isProcessing}
                                    className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            جاري التوجيه للدفع...
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="h-3.5 w-3.5" />
                                            الدفع {finalPrice.toLocaleString()} ر.س
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-[9px] text-gray-300 mt-3">
                                    بالضغط على "الدفع" أنت توافق على الشروط والأحكام
                                </p>

                                {/* Payment Methods */}
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-[10px] text-gray-400 text-center mb-2">طرق الدفع المقبولة</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md">
                                            <span className="text-[10px] font-bold text-gray-500">VISA</span>
                                        </div>
                                        <div className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md">
                                            <span className="text-[10px] font-bold text-gray-500">MADA</span>
                                        </div>
                                        <div className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md">
                                            <span className="text-[10px] font-bold text-gray-500">MC</span>
                                        </div>
                                        <div className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-md">
                                            <span className="text-[10px] font-bold text-gray-500">APPLE PAY</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Trust */}
                                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        <span>تشفير SSL 256-bit لحماية بياناتك</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        <span>تفعيل الاشتراك فوراً بعد الدفع</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
