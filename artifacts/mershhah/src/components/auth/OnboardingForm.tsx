'use client';

import { useEffect, useState } from 'react';
import { Utensils, Coffee, Cookie, Store, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/shared/LanguageContext';
import { FREE_PLAN_ID, freeSubscriptionEndDate } from '@/lib/free-plan';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

const PHONE_REGEX = /^05\d{8}$/;

const BUSINESS_TYPES = [
  { value: 'restaurant', labelKey: 'onboarding.businessTypeRestaurant', icon: Utensils },
  { value: 'cafe', labelKey: 'onboarding.businessTypeCafe', icon: Coffee },
  { value: 'bakery_sweets', labelKey: 'onboarding.businessTypeBakerySweets', icon: Cookie },
  { value: 'other', labelKey: 'onboarding.businessTypeOther', icon: Store },
] as const;

export function OnboardingForm() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [projectName, setProjectName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [otherBusinessType, setOtherBusinessType] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ projectName?: string; businessType?: string; phoneNumber?: string }>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      if (!data.session?.user) {
        router.push('/login');
        return;
      }
      setUser(data.session.user);
    });
  }, [router]);

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    || user?.email?.split('@')[0]
    || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const nextErrors: typeof errors = {};
    if (projectName.trim().length < 2) nextErrors.projectName = t('onboarding.projectNameRequired');
    const resolvedBusinessType = businessType === 'other' ? otherBusinessType.trim() : businessType;
    if (!resolvedBusinessType) nextErrors.businessType = t('onboarding.businessTypeRequired');
    const cleanedPhone = phoneNumber.replace(/[\s-]/g, '');
    if (!PHONE_REGEX.test(cleanedPhone)) nextErrors.phoneNumber = t('onboarding.phoneRequired');

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      const { data: phoneTaken, error: phoneCheckError } = await supabase.rpc('is_phone_registered', { p_phone: cleanedPhone });
      if (phoneCheckError) throw new Error(phoneCheckError.message);
      if (phoneTaken) {
        setErrors({ phoneNumber: t('onboarding.phoneTaken') });
        setIsLoading(false);
        return;
      }

      const userId = user.id;
      const now = new Date().toISOString();
      const restaurantId = crypto.randomUUID();
      const emailPrefix = (user.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const uniqueUsername = `${emailPrefix || 'restaurant'}-${randomSuffix}`;
      const fullName = (user.user_metadata?.full_name as string | undefined) || user.email || '';

      const { error: profileInsertError } = await supabase.from('profiles').insert({
        id: userId, full_name: fullName, email: user.email,
        phone_number: cleanedPhone, role: 'owner',
        account_status: 'active', created_at: now,
        restaurant_name: projectName.trim(), restaurant_id: restaurantId,
      });
      if (profileInsertError) {
        if (profileInsertError.code === '23505' && profileInsertError.message.includes('phone_number')) {
          setErrors({ phoneNumber: t('onboarding.phoneTaken') });
          setIsLoading(false);
          return;
        }
        throw new Error(profileInsertError.message);
      }

      await supabase.from('restaurants').insert({
        id: restaurantId, owner_id: userId, name: projectName.trim(), username: uniqueUsername,
        description: 'مقهى ومطعم يقدم أشهى المأكولات والمشروبات.', logo: null,
        business_type: resolvedBusinessType,
        primaryColor: '#6366F1', secondaryColor: '#F3F4F6', buttonTextColor: '#FFFFFF',
        borderRadius: 12, fontFamily: 'Cairo', socialLinks: null, deliveryApps: null,
        aiConfig: null, created_at: now, is_paid_plan: false,
      });

      const startDate = new Date();
      await supabase.from('subscriptions').insert({
        id: crypto.randomUUID(), profile_id: userId, plan_id: FREE_PLAN_ID,
        plan_name: 'الباقة المجانية', status: 'active',
        start_date: startDate.toISOString(), end_date: freeSubscriptionEndDate(startDate).toISOString(),
      });

      await supabase.from('activity').insert([
        { id: crypto.randomUUID(), type: 'restaurant_created', restaurantId, restaurantName: projectName.trim(), userId, timestamp: now },
        { id: crypto.randomUUID(), type: 'subscription_started', restaurantId, userId, planName: 'الباقة المجانية', restaurantName: projectName.trim(), timestamp: now },
      ]);

      supabase.auth.getSession().then(({ data: sessionData }: any) => {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
        }).catch(() => {});
      });

      toast({ title: 'تم تفعيل الباقة المجانية.' });
      router.push('/owner/dashboard');
      router.refresh();
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: error?.message || t('auth.genericError') });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900 mb-1">
          {t('onboarding.greetingPrefix')} {firstName} 👋
        </h1>
        <p className="text-sm text-gray-600">{t('onboarding.subtitle')}</p>
      </div>

      <div>
        <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('onboarding.projectNameLabel')}</label>
        <input
          type="text"
          placeholder={t('onboarding.projectNamePlaceholder')}
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          disabled={isLoading}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-600 focus:outline-none focus:border-gray-300 disabled:opacity-50"
        />
        {errors.projectName && <p className="text-[10px] text-red-500 mt-1">{errors.projectName}</p>}
      </div>

      <div>
        <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('onboarding.businessTypeLabel')}</label>
        <div className="grid grid-cols-4 gap-1.5">
          {BUSINESS_TYPES.map(({ value, labelKey, icon: Icon }) => {
            const selected = businessType === value;
            return (
              <button
                key={value}
                type="button"
                disabled={isLoading}
                onClick={() => setBusinessType(value)}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold transition-colors disabled:opacity-50',
                  selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-tight">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
        {businessType === 'other' && (
          <input
            type="text"
            placeholder={t('onboarding.businessTypeOtherPlaceholder')}
            value={otherBusinessType}
            onChange={(e) => setOtherBusinessType(e.target.value)}
            disabled={isLoading}
            className="w-full h-10 px-3 mt-2 rounded-xl border border-gray-200 text-xs text-right placeholder:text-gray-600 focus:outline-none focus:border-gray-300 disabled:opacity-50"
          />
        )}
        {errors.businessType && <p className="text-[10px] text-red-500 mt-1">{errors.businessType}</p>}
      </div>

      <div>
        <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('onboarding.phoneLabel')}</label>
        <input
          type="tel"
          dir="ltr"
          placeholder={t('onboarding.phonePlaceholder')}
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          disabled={isLoading}
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-left placeholder:text-gray-600 focus:outline-none focus:border-gray-300 disabled:opacity-50"
        />
        {errors.phoneNumber && <p className="text-[10px] text-red-500 mt-1">{errors.phoneNumber}</p>}
      </div>

      <button type="submit" disabled={isLoading || !user}
        className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t('onboarding.submitButton')}
      </button>
    </form>
  );
}
