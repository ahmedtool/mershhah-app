'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Loader2, CheckCircle2, ArrowRight, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/navigation';

const formSchema = z.object({
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين.',
  path: ['confirmPassword'],
});

export function ResetPasswordForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // null = still checking, true = valid recovery session, false = no/expired link
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    // Supabase parses the #access_token=...&type=recovery fragment and
    // establishes a session automatically on client init — just confirm it landed.
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasRecoverySession(!!data.session);
    };
    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setHasRecoverySession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      await supabase.auth.signOut();
      setIsSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error.message || 'تعذّر تحديث كلمة المرور. حاول مجدداً.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (hasRecoverySession === null) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300 mx-auto" />
      </div>
    );
  }

  if (hasRecoverySession === false) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">الرابط غير صالح أو منتهي الصلاحية</h3>
        <p className="text-xs text-gray-400 mb-5 leading-relaxed">
          اطلب رابط استعادة كلمة مرور جديد وحاول مرة أخرى.
        </p>
        <Link href="/forgot-password"
          className="inline-flex items-center gap-1.5 h-10 px-6 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors">
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          طلب رابط جديد
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">تم تحديث كلمة المرور</h3>
        <p className="text-xs text-gray-400">جاري تحويلك لصفحة تسجيل الدخول...</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">كلمة المرور الجديدة</label>
        <input
          type="password"
          placeholder="••••••••"
          {...form.register('password')}
          disabled={isLoading}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
        />
        {form.formState.errors.password && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.password.message}</p>}
      </div>

      <div>
        <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">تأكيد كلمة المرور</label>
        <input
          type="password"
          placeholder="••••••••"
          {...form.register('confirmPassword')}
          disabled={isLoading}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
        />
        {form.formState.errors.confirmPassword && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.confirmPassword.message}</p>}
      </div>

      <button type="submit" disabled={isLoading}
        className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
      </button>
    </form>
  );
}
