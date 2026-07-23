'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from '@/lib/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const formSchema = z.object({
  email: z.string().email({ message: 'أدخل إيميل صحيح.' }),
  password: z.string().min(6, { message: 'كلمة المرور 6 أحرف عالأقل.' }),
});

const adminPages = [
  { href: '/admin/dashboard', permissionId: 'dashboard' },
  { href: '/admin/management', permissionId: 'management' },
  { href: '/admin/financials', permissionId: 'financials' },
  { href: '/admin/referrals', permissionId: 'referrals' },
  { href: '/admin/store-management', permissionId: 'store-management' },
  { href: '/admin/support', permissionId: 'support' },
  { href: '/admin/team', permissionId: 'team' },
  { href: '/admin/workflow', permissionId: 'workflow' },
  { href: '/admin/sales', permissionId: 'sales' },
];

const SUPER_ADMIN_EMAIL = 'ahmedsupsa@gmail.com';
const DEMO_EMAIL = 'demo@mershhah.com';

export function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'الإيميل أو كلمة المرور غير صحيحة.');
      }

      const userId = authData.user.id;

      let { data: profile } = await supabase
        .from('profiles').select('*').eq('id', userId).single();

      if (!profile) {
        const isDemo = values.email === DEMO_EMAIL;
        const isSuperAdmin = values.email === SUPER_ADMIN_EMAIL;

        if (isDemo) throw new Error('الحساب التجريبي غير موجود. أنشئ حساباً أولاً.');

        let restaurantId: string | null = null;
        const now = new Date().toISOString();
        let uniqueUsername = '';

        if (!isSuperAdmin) {
          restaurantId = crypto.randomUUID();
          const emailPrefix = values.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          uniqueUsername = `${emailPrefix || 'restaurant'}-${randomSuffix}`;
        }

        const profileData: any = {
          id: userId, full_name: values.email.split('@')[0] || 'مستخدم جديد',
          email: values.email, phone_number: null,
          role: isSuperAdmin ? 'admin' : 'owner', account_status: 'active',
          created_at: now, restaurant_name: isSuperAdmin ? null : 'مشروعي',
          restaurant_id: restaurantId,
        };
        if (isSuperAdmin) {
          profileData.admin_permissions = ['dashboard', 'management', 'financials', 'store-management', 'applications', 'announcements', 'support', 'team', 'workflow', 'sales'];
        }

        await supabase.from('profiles').insert(profileData);
        profile = profileData as Profile;

        if (!isSuperAdmin && restaurantId) {
          await supabase.from('restaurants').insert({
            id: restaurantId, owner_id: userId, name: 'مشروعي', username: uniqueUsername,
            description: 'مطعم أو مقهى جديد.', logo: null,
            primaryColor: '#6366F1', secondaryColor: '#F3F4F6', buttonTextColor: '#FFFFFF',
            borderRadius: 12, fontFamily: 'Cairo', socialLinks: null, deliveryApps: null,
            aiConfig: null, created_at: now, is_paid_plan: false,
          });

          const startDate = new Date();
          const endDate = new Date();
          endDate.setFullYear(startDate.getFullYear() + 100);
          await supabase.from('subscriptions').insert({
            id: crypto.randomUUID(), profile_id: userId, plan_id: 'free',
            plan_name: 'الباقة المجانية', status: 'active',
            start_date: startDate.toISOString(), end_date: endDate.toISOString(),
          });

          await supabase.from('activity').insert([
            { id: crypto.randomUUID(), type: 'restaurant_created', restaurantId, restaurantName: 'مشروعي', userId, timestamp: now },
            { id: crypto.randomUUID(), type: 'subscription_started', restaurantId, userId, planName: 'الباقة المجانية', restaurantName: 'مشروعي', timestamp: now },
          ]);
        }
      }

      const userProfile = profile as Profile;

      if (userProfile.role === 'admin') {
        toast({ title: 'أهلاً بك أيها المدير!' });
        let redirectPath = '/admin/dashboard';
        if (userProfile.email !== SUPER_ADMIN_EMAIL && userProfile.admin_permissions?.length) {
          const firstPermittedPage = adminPages.find((page) => userProfile.admin_permissions!.includes(page.permissionId));
          if (firstPermittedPage) redirectPath = firstPermittedPage.href;
        }
        router.push(redirectPath);
      } else if (userProfile.role === 'owner') {
        toast({ title: 'تم تسجيل الدخول' });
        router.push('/owner/dashboard');
      } else {
        throw new Error('دور المستخدم غير معروف.');
      }
      router.refresh();
    } catch (error: any) {
      let description = 'الإيميل أو كلمة المرور غير صحيحة.';
      if (error.message?.includes('لم يتم العثور') || error.message?.includes('الحساب التجريبي غير موجود')) {
        description = error.message;
      }
      toast({ variant: 'destructive', title: 'خطأ', description });
      await supabase.auth.signOut().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {/* Email */}
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

      {/* Password */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[11px] font-bold text-gray-500">كلمة المرور</label>
          <Link href="/forgot-password" className="text-[10px] text-gray-400 hover:text-gray-600">نسيت كلمة المرور؟</Link>
        </div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            {...form.register('password')}
            disabled={isLoading}
            className="w-full h-10 px-3 pl-9 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
          />
          <button type="button" onClick={() => setShowPassword(p => !p)}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.formState.errors.password && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.password.message}</p>}
      </div>

      {/* Submit */}
      <button type="submit" disabled={isLoading}
        className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isLoading ? 'لحظات...' : 'تسجيل الدخول'}
      </button>
    </form>
  );
}
