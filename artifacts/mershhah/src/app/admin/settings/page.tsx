'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, KeyRound, User, Link2, Unlink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserIdentity } from '@supabase/supabase-js';

const profileFormSchema = z.object({
  full_name: z.string().min(3, { message: 'الاسم يجب أن يكون 3 أحرف على الأقل.' }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function SettingsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();
  const [isSendingReset, startSendingReset] = useTransition();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isUnlinkingGoogle, startUnlinkingGoogle] = useTransition();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { full_name: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ full_name: user.full_name || '' });
    }
  }, [user, form]);

  useEffect(() => {
    supabase.auth.getUserIdentities().then(({ data }: any) => {
      setIdentities(data?.identities || []);
    });
  }, []);

  const googleIdentity = identities?.find((i) => i.provider === 'google') || null;

  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      // Links a Google identity to the CURRENTLY signed-in auth user - unlike
      // signInWithOAuth, this reuses the existing auth.users row instead of
      // creating a new one, so "Continue with Google" starts resolving to
      // this same account/profile instead of hitting /auth/account-exists.
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/admin/settings` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      setIsLinkingGoogle(false);
    }
  };

  const handleUnlinkGoogle = () => {
    if (!googleIdentity) return;
    startUnlinkingGoogle(async () => {
      try {
        const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
        if (error) throw error;
        setIdentities((prev) => (prev || []).filter((i) => i.provider !== 'google'));
        toast({ title: 'تم إلغاء ربط حساب جوجل' });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  const handleProfileUpdate = async (data: ProfileFormValues) => {
    if (!user) return;
    startSaving(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: data.full_name })
          .eq('id', user.uid);
        if (error) throw error;
        toast({ title: 'تم تحديث الملف الشخصي' });
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
        toast({ title: 'تم إرسال الرابط', description: 'أرسلنا رابط إعادة التعيين إلى بريدك.' });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    });
  };

  if (isUserLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">الإعدادات</h1>
        <p className="text-xs text-gray-600 mt-0.5">إدارة حسابك الشخصي والأمان</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile */}
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">الملف الشخصي</h2>
                <p className="text-[11px] text-gray-600">معلوماتك الشخصية</p>
              </div>
            </div>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleProfileUpdate)} className="p-5 space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-600">الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11 rounded-xl border-gray-200 text-sm" disabled={isSaving} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <label className="text-xs text-gray-600">البريد الإلكتروني</label>
                <Input value={user?.email || ''} disabled className="h-11 rounded-xl border-gray-200 text-sm bg-gray-50" />
                <p className="text-[10px] text-gray-600">لا يمكن تغيير البريد</p>
              </div>
              <button type="submit" disabled={isSaving}
                className="h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </form>
          </Form>
        </div>

        {/* Security */}
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">الأمان</h2>
                <p className="text-[11px] text-gray-600">إدارة كلمة المرور</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-600">قم بتغيير كلمة المرور بشكل دوري لأمان حسابك.</p>
            <button onClick={handlePasswordReset} disabled={isSendingReset}
              className="h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full">
              {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {isSendingReset ? 'جاري الإرسال...' : 'إرسال رابط تغيير كلمة المرور'}
            </button>
            <p className="text-[10px] text-gray-600 text-center">سيتم إرسال الرابط إلى بريدك المسجل</p>
          </div>
        </div>

        {/* Connected accounts */}
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">الحسابات المرتبطة</h2>
                <p className="text-[11px] text-gray-600">ربط حساب جوجل يخليك تدخل به مباشرة لنفس حسابك</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {identities === null ? (
              <Skeleton className="h-11 rounded-xl" />
            ) : googleIdentity ? (
              <>
                <div className="flex items-center justify-between h-11 px-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                  <span>حساب جوجل مرتبط بهذا الحساب</span>
                </div>
                <button onClick={handleUnlinkGoogle} disabled={isUnlinkingGoogle}
                  className="h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full">
                  {isUnlinkingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                  إلغاء ربط حساب جوجل
                </button>
              </>
            ) : (
              <button onClick={handleLinkGoogle} disabled={isLinkingGoogle}
                className="h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full">
                {isLinkingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {isLinkingGoogle ? 'جاري التحويل إلى جوجل...' : 'ربط حساب جوجل'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
