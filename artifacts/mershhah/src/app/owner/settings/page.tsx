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
import { Loader2, KeyRound, CreditCard, Calendar, Zap, Clock, Receipt } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PlanPricingGrid } from '@/components/dashboard/PlanPricingGrid';

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
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isBillingLoading, setIsBillingLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, startChangingPassword] = useTransition();

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
        const [subRes, invRes] = await Promise.all([
          supabase.from('subscriptions').select('*').eq('profile_id', user.id).in('status', ['active', 'pending']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('invoices').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(5),
        ]);
        setSubscription(subRes.data);
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
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: 'تم الإرسال', description: 'رابط إعادة التعيين أُرسل لبريدك.' });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleChangePassword = () => {
    if (!user?.email) return;
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'كلمة المرور الجديدة قصيرة', description: 'يجب أن تكون 6 أحرف على الأقل.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'كلمتا المرور غير متطابقتين' });
      return;
    }
    startChangingPassword(async () => {
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (signInError) throw new Error('كلمة المرور الحالية غير صحيحة.');
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        toast({ title: 'تم تغيير كلمة المرور بنجاح' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      } catch (error: any) {
        toast({ title: 'تعذّر تغيير كلمة المرور', description: error.message, variant: 'destructive' });
      }
    });
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
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"><CreditCard className="h-3.5 w-3.5 text-gray-600" /></div>
              الملف الشخصي
            </h3>
            <p className="text-[11px] text-gray-600 mt-1">معلوماتك الشخصية في المنصة</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleProfileUpdate)} className="p-5 space-y-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] text-gray-600 font-bold">الاسم الكامل</FormLabel>
                  <FormControl><Input {...field} className="h-10 rounded-xl border-gray-200 text-xs" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone_number" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] text-gray-600 font-bold">رقم الجوال</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} className="h-10 rounded-xl border-gray-200 text-xs" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-gray-600 font-bold">البريد الإلكتروني</Label>
                <Input value={user?.email || ''} disabled className="h-10 rounded-xl border-gray-200 text-xs bg-gray-50" />
                <p className="text-[10px] text-gray-600">لا يمكن تغييره بعد التسجيل</p>
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
                <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"><CreditCard className="h-3.5 w-3.5 text-gray-600" /></div>
                اشتراكي الحالي
              </h3>
              <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border", isFree ? "bg-gray-50 text-gray-600 border-gray-100" : isExpired ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                {isFree ? 'مجاني' : isExpired ? 'منتهية' : subscription?.plan_name || entitlements.planName}
              </span>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {!isFree && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-gray-600 mb-1.5"><Calendar className="h-3 w-3" /><span className="text-[10px] font-bold">ينتهي في</span></div>
                  <p className="text-sm font-black text-gray-900">{subscription?.end_date ? format(new Date(subscription.end_date), 'dd MMM yyyy', { locale: ar }) : '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-gray-600 mb-1.5"><Clock className="h-3 w-3" /><span className="text-[10px] font-bold">المتبقي</span></div>
                  <p className="text-sm font-black text-gray-900">{isExpired ? 'منتهية' : `${daysRemaining} يوم`}</p>
                </div>
              </div>
            )}
            {isFree && (
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center">
                <Zap className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                <p className="text-xs font-bold text-gray-900">باقة مجانية</p>
                <p className="text-[10px] text-gray-600">اختر باقة للمتابعة</p>
              </div>
            )}

            {/* Invoices */}
            {invoices.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-600 mb-2">آخر الفواتير</p>
                <div className="space-y-1.5">
                  {invoices.slice(0, 3).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-[11px] text-gray-600">{inv.description || 'اشتراك'}</span>
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
                <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"><KeyRound className="h-3.5 w-3.5 text-gray-600" /></div>
                الأمان وكلمة المرور
              </h3>
              <p className="text-[11px] text-gray-600 mt-1">غيّر كلمة المرور مباشرة، أو استلمها عبر رابط يُرسل إلى <span className="font-bold text-gray-600">{user?.email}</span></p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowPasswordForm((v) => !v)} className="h-9 px-4 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors">
                {showPasswordForm ? 'إلغاء' : 'تغيير كلمة المرور'}
              </button>
              <button onClick={handlePasswordReset} disabled={isSendingReset} className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                {isSendingReset && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                إرسال رابط بالبريد
              </button>
            </div>
          </div>
          {showPasswordForm && (
            <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-50">
              <div className="space-y-1.5 pt-4">
                <Label className="text-[11px] text-gray-600 font-bold">كلمة المرور الحالية</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-10 rounded-xl border-gray-200 text-xs" />
              </div>
              <div className="space-y-1.5 pt-4">
                <Label className="text-[11px] text-gray-600 font-bold">كلمة المرور الجديدة</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 rounded-xl border-gray-200 text-xs" />
              </div>
              <div className="space-y-1.5 pt-4">
                <Label className="text-[11px] text-gray-600 font-bold">تأكيد كلمة المرور الجديدة</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10 rounded-xl border-gray-200 text-xs" />
              </div>
              <div className="sm:col-span-3">
                <button onClick={handleChangePassword} disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="h-10 px-5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isChangingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  حفظ كلمة المرور الجديدة
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === قسم الباقات والتجديد === */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-gray-900">الباقات والتجديد</h3>
          <p className="text-[11px] text-gray-600 mt-0.5">اختر باقتك وجدد اشتراكك</p>
        </div>

        {isBillingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
        ) : (
          <PlanPricingGrid currentPlanId={subscription?.plan_id} isCurrentSubscriptionExpired={isExpired} />
        )}
      </div>
    </div>
  );
}
