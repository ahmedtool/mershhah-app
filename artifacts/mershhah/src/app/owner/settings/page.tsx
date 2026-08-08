'use client';

import { useEffect, useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/dashboard/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, KeyRound, CreditCard, Calendar, Zap, Clock, Tag, CheckCircle, ArrowRight, Receipt } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const profileFormSchema = z.object({
  full_name: z.string().min(3, { message: 'الاسم يجب أن يكون 3 أحرف على الأقل.' }),
  phone_number: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function OwnerSettingsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();
  const [isSendingReset, startSendingReset] = useTransition();

  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<any>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isBillingLoading, setIsBillingLoading] = useState(true);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: '', phone_number: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ full_name: user.full_name || '', phone_number: user.phone_number || '' });
    }
  }, [user, form]);

  useEffect(() => {
    const fetchBilling = async () => {
      if (!user?.id) return;
      try {
        const [subRes, plansRes, invRes] = await Promise.all([
          supabase.from('subscriptions').select('*').eq('profile_id', user.id).in('status', ['active', 'pending']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('plans').select('*').eq('is_active', true).order('price_monthly'),
          supabase.from('invoices').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(5),
        ]);
        setSubscription(subRes.data);
        setPlans(plansRes.data || []);
        setInvoices(invRes.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsBillingLoading(false);
      }
    };
    fetchBilling();
  }, [user]);

  const handleProfileUpdate = async (data: ProfileFormValues) => {
    if (!user) return;
    startSaving(async () => {
      try {
        const { error } = await supabase.from('profiles').update({ full_name: data.full_name, phone_number: data.phone_number }).eq('id', user.uid);
        if (error) throw error;
        toast({ title: 'تم التحديث بنجاح!' });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handlePasswordReset = () => {
    if (!user?.email) return;
    startSendingReset(async () => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(user.email);
        if (error) throw error;
        toast({ title: 'تم الإرسال', description: 'رابط إعادة التعيين أُرسل لبريدك.' });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleCheckCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsCheckingCoupon(true);
    try {
      const { data, error } = await supabase.from('discount_codes').select('*').eq('code', couponCode.toUpperCase()).eq('is_active', true).single();
      if (error || !data) { toast({ variant: 'destructive', title: 'كوبون غير صالح' }); setCouponDiscount(null); return; }
      const now = new Date();
      const validUntil = data.valid_until ? new Date(data.valid_until) : null;
      if (validUntil && validUntil < now) { toast({ variant: 'destructive', title: 'الكوبون منتهي الصلاحية' }); setCouponDiscount(null); return; }
      if (data.max_uses && data.current_uses >= data.max_uses) { toast({ variant: 'destructive', title: 'الكوبون استُنفد' }); setCouponDiscount(null); return; }
      setCouponDiscount(data);
      toast({ title: 'كوبون صالح ✓', description: data.discount_type === 'percentage' ? `خصم ${data.discount_value}%` : data.discount_type === 'fixed' ? `خصم ${data.discount_value} ر.س` : 'فترة مجانية' });
    } catch { toast({ variant: 'destructive', title: 'خطأ' }); } finally { setIsCheckingCoupon(false); }
  };

  const handleCheckout = async (planId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plan_id: planId, billing_cycle: selectedCycle, discount_code: couponCode || undefined }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { toast({ variant: 'destructive', title: 'خطأ', description: data.error || 'فشل إنشاء رابط الدفع' }); }
    } catch (error: any) { toast({ variant: 'destructive', title: 'خطأ', description: error.message }); }
  };

  if (isUserLoading) {
    return (<div className="space-y-5"><Skeleton className="h-10 w-1/3" /><div className="grid md:grid-cols-2 gap-5"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div></div>);
  }

  const { entitlements } = user!;
  const daysRemaining = entitlements.endDate ? differenceInDays(entitlements.endDate, new Date()) : 0;
  const isFree = entitlements.planId === 'free' || entitlements.planId === 'none';
  const isExpired = subscription?.end_date && new Date(subscription.end_date) < new Date();

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title="الإعدادات" description="معلوماتك الشخصية وإدارة اشتراكك." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Profile */}
        <div className="bg-white border border-gray-100 rounded-2xl">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"><CreditCard className="h-3.5 w-3.5 text-gray-400" /></div>
              الملف الشخصي
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">معلوماتك الشخصية في المنصة</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleProfileUpdate)} className="p-5 space-y-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] text-gray-400 font-bold">الاسم الكامل</FormLabel>
                  <FormControl><Input {...field} className="h-10 rounded-xl border-gray-200 text-xs" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone_number" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] text-gray-400 font-bold">رقم الجوال</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} className="h-10 rounded-xl border-gray-200 text-xs" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-400 font-bold">البريد الإلكتروني</Label>
                <Input value={user?.email || ''} disabled className="h-10 rounded-xl border-gray-200 text-xs bg-gray-50" />
                <p className="text-[10px] text-gray-300">لا يمكن تغييره بعد التسجيل</p>
              </div>
              <button type="submit" disabled={isSaving} className="w-full h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                حفظ التغييرات
              </button>
            </form>
          </Form>
        </div>

        {/* Current Subscription */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"><CreditCard className="h-3.5 w-3.5 text-gray-400" /></div>
                اشتراكي الحالي
              </h3>
              <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border", isFree ? "bg-gray-50 text-gray-500 border-gray-100" : isExpired ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                {isFree ? 'مجاني' : isExpired ? 'منتهية' : subscription?.plan_name || entitlements.planName}
              </span>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {!isFree && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1.5"><Calendar className="h-3 w-3" /><span className="text-[10px] font-bold">ينتهي في</span></div>
                  <p className="text-sm font-black text-gray-900">{subscription?.end_date ? format(new Date(subscription.end_date), 'dd MMM yyyy', { locale: ar }) : '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1.5"><Clock className="h-3 w-3" /><span className="text-[10px] font-bold">المتبقي</span></div>
                  <p className="text-sm font-black text-gray-900">{isExpired ? 'منتهية' : `${daysRemaining} يوم`}</p>
                </div>
              </div>
            )}
            {isFree && (
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center">
                <Zap className="h-5 w-5 text-gray-300 mx-auto mb-1" />
                <p className="text-xs font-bold text-gray-900">باقة مجانية</p>
                <p className="text-[10px] text-gray-400">اختر باقة للمتابعة</p>
              </div>
            )}

            {/* Invoices */}
            {invoices.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-500 mb-2">آخر الفواتير</p>
                <div className="space-y-1.5">
                  {invoices.slice(0, 3).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-3.5 w-3.5 text-gray-300" />
                        <span className="text-[11px] text-gray-500">{inv.description || 'اشتراك'}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-gray-900">{inv.amount} ر.س</span>
                        <span className={cn("text-[10px] font-bold mr-2", inv.status === 'paid' ? 'text-emerald-600' : 'text-red-500')}>
                          {inv.status === 'paid' ? 'مدفوعة' : 'فشل'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="bg-white border border-gray-100 rounded-2xl md:col-span-2">
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"><KeyRound className="h-3.5 w-3.5 text-gray-400" /></div>
                الأمان وكلمة المرور
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">سنرسل رابطاً آمناً إلى <span className="font-bold text-gray-600">{user?.email}</span> لإنشاء كلمة مرور جديدة</p>
            </div>
            <button onClick={handlePasswordReset} disabled={isSendingReset} className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
              {isSendingReset && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              إرسال رابط التغيير
            </button>
          </div>
        </div>
      </div>

      {/* === قسم الباقات والتجديد === */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-gray-900">الباقات والتجديد</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">اختر باقتك وجدد اشتراكك</p>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            <button onClick={() => setSelectedCycle('monthly')} className={cn("h-8 px-4 rounded-lg text-[11px] font-bold transition-all", selectedCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400')}>
              شهري
            </button>
            <button onClick={() => setSelectedCycle('yearly')} className={cn("h-8 px-4 rounded-lg text-[11px] font-bold transition-all", selectedCycle === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400')}>
              سنوي
            </button>
          </div>
        </div>

        {/* Coupon */}
        <div className="flex gap-2">
          <input type="text" placeholder="كوبون خصم (اختياري)" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs text-center font-bold tracking-wider placeholder:text-gray-300 focus:outline-none focus:border-gray-300" dir="ltr" />
          <button onClick={handleCheckCoupon} disabled={isCheckingCoupon || !couponCode} className="h-10 px-4 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50">
            تحقق
          </button>
        </div>
        {couponDiscount && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            <Tag className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] text-emerald-700 font-medium">
              ✓ {couponDiscount.discount_type === 'percentage' ? `خصم ${couponDiscount.discount_value}%` : couponDiscount.discount_type === 'fixed' ? `خصم ثابت ${couponDiscount.discount_value} ر.س` : 'فترة مجانية'}
            </span>
          </div>
        )}

        {/* Plans Grid */}
        {isBillingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((plan) => {
              let price = selectedCycle === 'yearly' ? (plan.price_yearly || 0) : (plan.price_monthly || plan.price || 0);
              if (couponDiscount) {
                if (couponDiscount.discount_type === 'percentage') price = Math.round(price * (1 - couponDiscount.discount_value / 100));
                else if (couponDiscount.discount_type === 'fixed') price = Math.max(0, price - couponDiscount.discount_value);
                else if (couponDiscount.discount_type === 'free_trial') price = 0;
              }
              const originalPrice = selectedCycle === 'yearly' ? (plan.price_yearly || 0) : (plan.price_monthly || plan.price || 0);
              const isCurrentPlan = subscription?.plan_id === plan.id && !isExpired;

              return (
                <div key={plan.id} className={cn("rounded-2xl border overflow-hidden flex flex-col transition-all", plan.is_featured ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100', isCurrentPlan && 'ring-2 ring-emerald-500 border-emerald-500')}>
                  <div className={cn("px-4 pt-4 pb-3", plan.is_featured ? 'bg-gray-900' : 'bg-gray-50')}>
                    <div className="flex items-center justify-between">
                      <h4 className={cn("text-sm font-bold", plan.is_featured ? 'text-white' : 'text-gray-900')}>{plan.name}</h4>
                      {isCurrentPlan && <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">الحالية</span>}
                      {plan.is_featured && !isCurrentPlan && <span className="text-[9px] font-bold bg-white/20 text-white/80 px-2 py-0.5 rounded-full">مميز</span>}
                    </div>
                    {plan.description && <p className={cn("text-[10px] mt-1", plan.is_featured ? 'text-gray-400' : 'text-gray-400')}>{plan.description}</p>}
                  </div>
                  <div className="px-4 py-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        {couponDiscount && price !== originalPrice && <span className="text-[10px] text-gray-300 line-through">{originalPrice}</span>}
                        <span className="text-xl font-black text-gray-900">{price}</span>
                        <span className="text-[10px] text-gray-400">ر.س/{selectedCycle === 'yearly' ? 'سنة' : 'شهر'}</span>
                      </div>
                      {selectedCycle === 'yearly' && plan.price_monthly > 0 && plan.price_yearly > 0 && (
                        <p className="text-[9px] text-emerald-600 font-bold mt-1">
                          وفّر {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}% سنوياً
                        </p>
                      )}
                      {plan.trial_days > 0 && <p className="text-[9px] text-violet-600 font-bold mt-1">فترة تجربة {plan.trial_days} يوم</p>}
                    </div>
                    <button onClick={() => handleCheckout(plan.id)} disabled={isCurrentPlan}
                      className={cn("w-full h-9 rounded-xl text-[11px] font-bold transition-colors mt-3 flex items-center justify-center gap-1",
                        isCurrentPlan ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : plan.is_featured ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border border-gray-200 text-gray-600 hover:bg-gray-50')}>
                      {isCurrentPlan ? 'الباقة الحالية' : <>{selectedCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'} <ArrowRight className="h-3 w-3" /></>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
