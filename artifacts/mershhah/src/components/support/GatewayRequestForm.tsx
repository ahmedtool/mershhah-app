'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicThemeStyle } from '@/lib/public-theme';
import { PublicPageBackdrop } from '@/components/shared/PublicPageBackdrop';
import { useLanguage } from '@/components/shared/LanguageContext';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { FormFieldsRenderer, missingRequiredFields, type FormValues } from '@/components/support/FormFieldsRenderer';
import type { BusinessGatewayField, BusinessGatewayServiceType, BusinessGatewayBaseFields } from '@/lib/types';
import { usePublicPageBackground } from '@/hooks/usePublicPageBackground';

interface GatewayRequestFormProps {
  serviceType: BusinessGatewayServiceType;
  titleKey?: string;
  fields?: BusinessGatewayField[];
}

// Shared public-facing intake form for the "just a form" gateway service
// types (franchise, wholesale, corporate, partnership, and owner-authored
// custom types) - each built-in page file (support/[username]/franchise,
// .../wholesale, ...) is a thin wrapper that just supplies
// serviceType/titleKey/fields, so the actual header/loading/theme/submit
// plumbing lives in exactly one place. For a custom type (serviceType
// "custom:<slug>"), titleKey/fields are omitted and resolved instead from
// the restaurant's cached gatewayServices config, since that title/field
// list is owner-authored raw text rather than a translation key.
export function GatewayRequestForm({ serviceType, titleKey, fields }: GatewayRequestFormProps) {
  const params = useParams();
  const username = params.username as string;
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';
  const isCustom = serviceType.startsWith('custom:');

  const [restaurant, setRestaurant] = useState<any>(null);
  const [customConfig, setCustomConfig] = useState<{ title?: string; title_en?: string; fields?: BusinessGatewayField[] } | null>(null);
  const [baseFields, setBaseFields] = useState<BusinessGatewayBaseFields>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, startSubmitting] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  usePublicPageBackground(restaurant?.secondaryColor);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fieldValues, setFieldValues] = useState<FormValues>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!username) return;
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          const svc = (data.gatewayServices || []).find((s) => s.service_type === serviceType);
          setCustomConfig((svc?.config as typeof customConfig) || null);
          setBaseFields(svc?.config?.baseFields || {});
          setLoading(false);
          return;
        }
        const { data: rest } = await supabase.from('restaurants').select('*').eq('username', username).limit(1).single();
        setRestaurant(rest || null);
        if (rest) {
          const { data: svc } = await supabase
            .from('business_gateway_services')
            .select('config')
            .eq('restaurant_id', rest.id)
            .eq('service_type', serviceType)
            .eq('is_enabled', true)
            .single();
          setCustomConfig(svc?.config || null);
          setBaseFields(svc?.config?.baseFields || {});
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  const isEnglish = dir === 'ltr';
  const effectiveTitle = isCustom
    ? ((isEnglish && customConfig?.title_en) || customConfig?.title || '')
    : (titleKey ? t(titleKey) : '');
  // Built-in types fall back to their default questions until the owner
  // saves an override; custom types are always fully owner-authored.
  const effectiveFields: BusinessGatewayField[] = isCustom
    ? (customConfig?.fields || [])
    : (Array.isArray(customConfig?.fields) ? customConfig!.fields! : (fields || []));
  const restaurantName = (isEnglish && restaurant?.name_en) || restaurant?.name || '';
  // A base field is shown-and-required, or hidden entirely - there's no
  // "shown but optional" state, so visibility and required-ness are the
  // same flag.
  const nameVisible = baseFields.name !== false;
  const phoneVisible = baseFields.phone !== false;
  const emailVisible = baseFields.email === true;
  const canSubmit = (!nameVisible || !!name.trim()) && (!phoneVisible || !!phone.trim()) && (!emailVisible || !!email.trim())
    && missingRequiredFields(effectiveFields, fieldValues).length === 0;

  const handleSubmit = () => {
    if (!restaurant) return;
    startSubmitting(async () => {
      try {
        const { error } = await supabase.from('business_requests').insert({
          restaurant_id: restaurant.id,
          service_type: serviceType,
          name,
          phone,
          email: email || null,
          fields: fieldValues,
          status: 'new',
        });
        if (error) throw error;
        setSubmitted(true);
      } catch (error: any) {
        toast({ title: t('ownerSettings.errorTitle'), description: t('publicJobs.applicationFailedDesc'), variant: 'destructive' });
      }
    });
  };

  const primaryColor = restaurant?.primaryColor || '#111827';

  if (loading) {
    return (
      <div className="min-h-screen bg-white" dir={dir}>
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-center p-6 space-y-5">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
          <Info size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{t('hubPage.restaurantNotFound')}</h1>
      </div>
    );
  }

  const themeStyle = getPublicThemeStyle(restaurant);

  return (
    <div className="min-h-screen pb-16 relative overflow-x-hidden" style={themeStyle} dir={dir}>
      <PublicPageBackdrop />

      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          {dir === 'rtl' ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <LanguageSwitcher />
      </div>

      <div className={`max-w-lg mx-auto w-full px-5 pb-8 text-center space-y-3 ${alignStart}`}>
        <div className="relative w-16 h-16 mx-auto overflow-hidden" style={{ borderRadius: 'var(--r-radius)' }}>
          <StorageImage
            imagePath={restaurant.logo}
            alt={restaurant.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{restaurantName}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{effectiveTitle}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5">
        {submitted ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('publicSupport.submittedTitle')}</h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xs mx-auto">{t('publicGatewayForm.submittedDesc')}</p>
            </div>
            <button onClick={() => window.history.back()} className="text-xs font-semibold" style={{ color: primaryColor }}>
              {t('publicSupport.back')}
            </button>
          </div>
        ) : (
          <div className={`border border-gray-100 p-5 space-y-4 ${alignStart}`} style={{ borderRadius: 'var(--r-radius)' }}>
            {nameVisible && (
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('publicSupport.nameLabel')} *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('publicSupport.namePlaceholder')} className="h-10 text-sm rounded-lg border-gray-100" />
              </div>
            )}
            {phoneVisible && (
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('ownerSettings.phoneLabel')} *</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="05XXXXXXXX" className="h-10 text-sm rounded-lg border-gray-100" dir="ltr" />
              </div>
            )}
            {emailVisible && (
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block">{t('ownerSettings.emailLabel')} *</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-10 text-sm rounded-lg border-gray-100" dir="ltr" />
              </div>
            )}

            <FormFieldsRenderer fields={effectiveFields} values={fieldValues} onChange={setFieldValues} uploadContext={{ restaurantId: restaurant.id, serviceType }} />

            <Button
              onClick={handleSubmit}
              className="w-full h-10 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: primaryColor, color: 'var(--r-button-text)' }}
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('publicShared.send')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
