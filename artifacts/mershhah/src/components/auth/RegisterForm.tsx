'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from '@/lib/navigation';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ADMIN_EMAIL = 'ahmedsupsa@gmail.com';
const DEMO_EMAIL = 'demo@mershhah.com';
const DEMO_PASSWORD = 'demo123';

const allAdminPermissions = [
  'dashboard', 'management', 'financials', 'store-management',
  'applications', 'announcements', 'support', 'team', 'workflow', 'sales',
];

const formSchema = z
  .object({
    fullName: z.string().min(2, { message: 'الاسم لازم يكون حرفين عالأقل.' }),
    restaurantName: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.string().email({ message: 'أدخل إيميل صحيح.' }),
    password: z.string().min(6, { message: 'كلمة المرور 6 أحرف عالأقل.' }),
  })
  .superRefine((data, ctx) => {
    if (data.email !== ADMIN_EMAIL) {
      if (!data.restaurantName || data.restaurantName.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اسم المشروع حرفين عالأقل.', path: ['restaurantName'] });
      }
      if (!data.phoneNumber || data.phoneNumber.length < 9) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'أدخل رقم جوال صحيح.', path: ['phoneNumber'] });
      }
    }
  });

export function RegisterForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: '', restaurantName: '', phoneNumber: '', email: '', password: '' },
  });

  const emailValue = form.watch('email');
  const isDemoFlow = emailValue === DEMO_EMAIL;
  const isAdminFlow = emailValue === ADMIN_EMAIL;

  useEffect(() => {
    if (isDemoFlow) {
      form.setValue('password', DEMO_PASSWORD);
    } else if (form.getValues('password') === DEMO_PASSWORD) {
      form.setValue('password', '');
    }
  }, [isDemoFlow, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: values.fullName } },
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('لم يتم إنشاء الحساب.');

      if (!authData.session) {
        toast({ title: 'تحقق من بريدك', description: 'أرسلنا رابط تأكيد إلى بريدك.' });
        setIsLoading(false);
        return;
      }

      const userId = authData.user.id;
      const isDemoUser = values.email === DEMO_EMAIL;
      const isAdmin = values.email === ADMIN_EMAIL;
      const now = new Date().toISOString();
      let restaurantId: string | null = null;

      let uniqueUsername = '';
      if (!isAdmin) {
        restaurantId = crypto.randomUUID();
        const emailPrefix = values.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const randomSuffix = Math.floor(100 + Math.random() * 900);
        uniqueUsername = isDemoUser ? 'democafe' : `${emailPrefix}-${randomSuffix}`;
      }

      const profileData: any = {
        id: userId, full_name: values.fullName, email: values.email,
        phone_number: values.phoneNumber || null, role: isAdmin ? 'admin' : 'owner',
        account_status: 'active', created_at: now,
        restaurant_name: isAdmin ? null : values.restaurantName, restaurant_id: restaurantId,
      };
      if (isAdmin) profileData.admin_permissions = allAdminPermissions;

      const { error: profileInsertError } = await supabase.from('profiles').insert(profileData);
      if (profileInsertError) throw new Error(profileInsertError.message);

      if (!isAdmin && restaurantId) {
        await supabase.from('restaurants').insert({
          id: restaurantId, owner_id: userId, name: values.restaurantName, username: uniqueUsername,
          description: 'مقهى ومطعم يقدم أشهى المأكولات والمشروبات.', logo: null,
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
          { id: crypto.randomUUID(), type: 'restaurant_created', restaurantId, restaurantName: values.restaurantName, userId, timestamp: now },
          { id: crypto.randomUUID(), type: 'subscription_started', restaurantId, userId, planName: 'الباقة المجانية', restaurantName: values.restaurantName, timestamp: now },
        ]);
      }

      if (isDemoUser && restaurantId) {
        const mockMenuItems = [
          { name: 'برجر لحم كلاسيك', description: 'قطعة لحم بقري مشوي مع جبنة شيدر.', category: 'برجر', sizes: [{ id: crypto.randomUUID(), name: 'عادي', price: 28, cost: 12 }], status: 'available', display_tags: 'best_seller' },
          { name: 'برجر دجاج كرسبي', description: 'صدر دجاج مقلي مقرمش.', category: 'برجر', sizes: [{ id: crypto.randomUUID(), name: 'عادي', price: 26, cost: 10 }], status: 'available', display_tags: 'none' },
          { name: 'بطاطس مقلية', description: 'بطاطس ذهبية مقرمشة.', category: 'مقبلات', sizes: [{ id: crypto.randomUUID(), name: 'عادي', price: 9, cost: 3 }], status: 'available', display_tags: 'none' },
          { name: 'حلقات البصل', description: 'حلقات بصل مقلية مقرمشة.', category: 'مقبلات', sizes: [{ id: crypto.randomUUID(), name: 'عادي', price: 12, cost: 4 }], status: 'available', display_tags: 'new' },
          { name: 'مشروب غازي', description: 'كوكاكولا، سبرايت، أو فانتا.', category: 'مشروبات', sizes: [{ id: crypto.randomUUID(), name: 'عادي', price: 5, cost: 1 }], status: 'available', display_tags: 'none' },
          { name: 'ميلك شيك فانيلا', description: 'ميلك شيك كريمي.', category: 'حلويات', sizes: [{ id: crypto.randomUUID(), name: 'عادي', price: 18, cost: 7 }], status: 'unavailable', display_tags: 'none' },
        ];
        await supabase.from('menu_items').insert(
          mockMenuItems.map((item, index) => ({ id: crypto.randomUUID(), ...item, restaurant_id: restaurantId, position: index, created_at: now }))
        );
      }

      toast({ title: 'تم التسجيل!', description: isAdmin ? 'أهلاً بك أيها المدير.' : 'تم تفعيل الباقة المجانية.' });
      router.push(isAdmin ? '/admin/dashboard' : '/owner/dashboard');
      router.refresh();
    } catch (error: any) {
      const msg: string = error?.message || '';
      let description = msg || 'حدث خطأ.';
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already registered')) {
        description = 'البريد مسجل مسبقًا. جرّب تسجيل الدخول.';
      } else if (msg.includes('Email rate limit')) {
        description = 'انتظر قليلاً ثم حاول مجدداً.';
      }
      toast({ variant: 'destructive', title: 'خطأ', description });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {/* Full Name */}
      <div>
        <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">الاسم الكامل</label>
        <input
          type="text"
          placeholder="مثال: خالد الأحمد"
          {...form.register('fullName')}
          disabled={isLoading}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
        />
        {form.formState.errors.fullName && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.fullName.message}</p>}
      </div>

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

      {/* Restaurant Name + Phone */}
      {!isAdminFlow && (
        <>
          <div>
            <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">اسم المشروع (مطعم/مقهى)</label>
            <input
              type="text"
              placeholder="مشروعي"
              {...form.register('restaurantName')}
              disabled={isLoading}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
            />
            {form.formState.errors.restaurantName && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.restaurantName.message}</p>}
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">رقم الجوال</label>
            <input
              type="tel"
              placeholder="05xxxxxxxx"
              {...form.register('phoneNumber')}
              disabled={isLoading}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-300 focus:outline-none focus:border-gray-300 disabled:opacity-50"
            />
            {form.formState.errors.phoneNumber && <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.phoneNumber.message}</p>}
          </div>
        </>
      )}

      {/* Password */}
      <div>
        <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">كلمة المرور</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            {...form.register('password')}
            disabled={isLoading || isDemoFlow}
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
        {isLoading ? 'لحظات...' : 'إنشاء حساب'}
      </button>
    </form>
  );
}
