
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Link } from 'wouter';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const formSchema = z.object({
  email: z.string().email({ message: 'أدخل إيميل صحيح.' }),
});

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email);
      if (error) throw error;
      setIsSubmitted(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: 'لم نتمكن من الإرسال. تأكد من البريد وحاول مجدداً.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">تم إرسال الرابط</h3>
        <p className="text-xs text-gray-400 mb-5 leading-relaxed">
          أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك. تحقق من صندوق الوارد.
        </p>
        <Link href="/login"
          className="inline-flex items-center gap-1.5 h-10 px-6 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors">
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          العودة للدخول
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">البريد الإلكتروني</label>
        <input
          type="email"
          placeholder="بريدك@example.com"
          {...form.register('email')}
          disabled={isLoading}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
        />
        {form.formState.errors.email && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.email.message}</p>}
      </div>

      <button type="submit" disabled={isLoading}
        className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading ? 'لحظات...' : 'إرسال رابط إعادة التعيين'}
      </button>
    </form>
  );
}
