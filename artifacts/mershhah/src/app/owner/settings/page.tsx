'use client';

import { useEffect, useTransition } from 'react';
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
import { Loader2, KeyRound, CreditCard, Calendar, ArrowUpRight, Zap, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'wouter';
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

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: '', phone_number: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
      });
    }
  }, [user, form]);

  const handleProfileUpdate = async (data: ProfileFormValues) => {
    if (!user) return;
    startSaving(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: data.full_name, phone_number: data.phone_number })
          .eq('id', user.uid);
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

  if (isUserLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid md:grid-cols-2 gap-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { entitlements } = user!;
  const daysRemaining = entitlements.endDate ? differenceInDays(entitlements.endDate, new Date()) : 0;
  const isFree = entitlements.planId === 'free' || entitlements.planId === 'none';

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title="الإعدادات" description="معلوماتك الشخصية وتفاصيل اشتراكك." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Profile */}
        <div className="bg-white border border-gray-100 rounded-2xl">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <CreditCard className="h-3.5 w-3.5 text-gray-400" />
              </div>
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
              <button type="submit" disabled={isSaving}
                className="w-full h-10 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                حفظ التغييرات
              </button>
            </form>
          </Form>
        </div>

        {/* Subscription */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                </div>
                الاشتراك والباقة
              </h3>
              <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border", isFree ? "bg-gray-50 text-gray-500 border-gray-100" : "bg-gray-900 text-white border-gray-900")}>
                {entitlements.planName}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">تفاصيل باقتك الحالية</p>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1.5">
                  <Calendar className="h-3 w-3" />
                  <span className="text-[10px] font-bold">ينتهي في</span>
                </div>
                <p className="text-sm font-black text-gray-900">
                  {isFree ? 'دائم' : (entitlements.endDate ? format(entitlements.endDate, 'dd MMM yyyy', { locale: ar }) : '—')}
                </p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1.5">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px] font-bold">المتبقي</span>
                </div>
                <p className="text-sm font-black text-gray-900">{isFree ? 'غير محدود' : `${daysRemaining} يوم`}</p>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500">مزايا باقتك:</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
                  <Zap className="h-3 w-3" />
                  الواجهة الرقمية والمنيو
                </div>
                {entitlements.canUseAiAnalysis && (
                  <div className="flex items-center gap-2 text-[11px] font-bold text-gray-700 bg-gray-50 border border-gray-100 p-2 rounded-lg">
                    <Zap className="h-3 w-3 text-gray-400" />
                    أدوات التحليل والذكاء الاصطناعي
                  </div>
                )}
                {entitlements.canUseStudioImageGeneration && (
                  <div className="flex items-center gap-2 text-[11px] font-bold text-gray-700 bg-gray-50 border border-gray-100 p-2 rounded-lg">
                    <Zap className="h-3 w-3 text-gray-400" />
                    استوديو الصور الإبداعي
                  </div>
                )}
              </div>
            </div>

            <Link href="/pricing"
              className="w-full h-10 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              {isFree ? 'ترقية الباقة' : 'تجديد أو تغيير'}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Password */}
        <div className="bg-white border border-gray-100 rounded-2xl md:col-span-2">
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <KeyRound className="h-3.5 w-3.5 text-gray-400" />
                </div>
                الأمان وكلمة المرور
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                سنرسل رابطاً آمناً إلى <span className="font-bold text-gray-600">{user?.email}</span> لإنشاء كلمة مرور جديدة
              </p>
            </div>
            <button onClick={handlePasswordReset} disabled={isSendingReset}
              className="h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
              {isSendingReset && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              إرسال رابط التغيير
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
