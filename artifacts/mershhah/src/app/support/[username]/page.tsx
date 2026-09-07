'use client';

import { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { getPublicPage } from '@/lib/public-pages';
import { Info, MessageSquare, Briefcase, Store, Package, Building2, Handshake, ChevronRight, ChevronLeft } from 'lucide-react';
import { StorageImage } from '@/components/shared/StorageImage';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicThemeStyle } from '@/lib/public-theme';
import { PublicPageBackdrop } from '@/components/shared/PublicPageBackdrop';
import { useLanguage } from '@/components/shared/LanguageContext';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { getCustomTypeIcon } from '@/lib/gateway-service-types';

const SERVICE_CARDS = [
  { type: 'contact', icon: MessageSquare, titleKey: 'ownerGateway.contactTitle', descKey: 'publicGateway.contactCardDesc' },
  { type: 'jobs', icon: Briefcase, titleKey: 'ownerGateway.jobsTitle', descKey: 'publicGateway.jobsCardDesc' },
  { type: 'franchise', icon: Store, titleKey: 'ownerGateway.franchiseTitle', descKey: 'publicGateway.franchiseCardDesc' },
  { type: 'wholesale', icon: Package, titleKey: 'ownerGateway.wholesaleTitle', descKey: 'publicGateway.wholesaleCardDesc' },
  { type: 'corporate', icon: Building2, titleKey: 'ownerGateway.corporateTitle', descKey: 'publicGateway.corporateCardDesc' },
  { type: 'partnership', icon: Handshake, titleKey: 'ownerGateway.partnershipTitle', descKey: 'publicGateway.partnershipCardDesc' },
] as const;

const BUILDABLE_SERVICE_TYPES = ['jobs', 'franchise', 'wholesale', 'corporate', 'partnership'];

// A custom type's route is /support/:username/custom/:slug, not
// /support/:username/custom:xyz - this turns a gatewayServices service_type
// ("custom:xyz" or a built-in type) into the path segment(s) after the
// username.
function pathForServiceType(type: string) {
  return type.startsWith('custom:') ? `custom/${type.slice('custom:'.length)}` : type;
}

type CustomCard = { type: string; title: string; icon: string };

export default function SupportGatewayPage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();
  const { t, dir } = useLanguage();
  const alignStart = dir === 'rtl' ? 'text-right' : 'text-left';

  const [restaurant, setRestaurant] = useState<any>(null);
  const [enabledServices, setEnabledServices] = useState<string[]>([]);
  const [customCards, setCustomCards] = useState<CustomCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!username) return;
      try {
        const data = await getPublicPage(username);
        if (data?.restaurant) {
          setRestaurant(data.restaurant);
          const gatewayServices = data.gatewayServices || [];
          const enabledTypes = gatewayServices
            .map((s) => s.service_type)
            .filter((type) => BUILDABLE_SERVICE_TYPES.includes(type));
          const customs = gatewayServices.filter((s) => s.service_type.startsWith('custom:'));
          setCustomCards(customs.map((s) => ({ type: s.service_type, title: s.config?.title || '', icon: s.config?.icon || '' })));
          setEnabledServices(['contact', ...enabledTypes, ...customs.map((s) => s.service_type)]);
          setLoading(false);
          return;
        }

        const { data: rest } = await supabase.from('restaurants').select('*').eq('username', username).limit(1).single();
        if (!rest) {
          setRestaurant(null);
          setLoading(false);
          return;
        }
        setRestaurant(rest);
        const { data: gw } = await supabase
          .from('business_gateway_services')
          .select('service_type, config')
          .eq('restaurant_id', rest.id)
          .eq('is_enabled', true);
        const gatewayServices = gw || [];
        const enabledTypes = gatewayServices
          .map((s: any) => s.service_type)
          .filter((type: string) => BUILDABLE_SERVICE_TYPES.includes(type));
        const customs = gatewayServices.filter((s: any) => s.service_type.startsWith('custom:'));
        setCustomCards(customs.map((s: any) => ({ type: s.service_type, title: s.config?.title || '', icon: s.config?.icon || '' })));
        setEnabledServices(['contact', ...enabledTypes, ...customs.map((s: any) => s.service_type)]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  useEffect(() => {
    if (!loading && restaurant && enabledServices.length === 1) {
      router.replace(`/support/${username}/${pathForServiceType(enabledServices[0])}`);
    }
  }, [loading, restaurant, enabledServices, username]);

  if (loading || (restaurant && enabledServices.length === 1)) {
    return (
      <div className="min-h-screen bg-white" dir={dir}>
        <div className="max-w-lg mx-auto px-5 space-y-8 pt-8">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
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
  const cards = SERVICE_CARDS.filter(c => enabledServices.includes(c.type));

  return (
    <div className="min-h-screen pb-16 relative overflow-x-hidden" style={{ ...themeStyle, background: 'linear-gradient(to bottom, color-mix(in srgb, var(--r-secondary) 25%, white), white 220px)' }} dir={dir}>
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
          <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{t('publicGateway.pageTitle')}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-5 space-y-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.type}
              href={`/support/${username}/${pathForServiceType(card.type)}`}
              className={`flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all ${alignStart}`}
              style={{ borderRadius: 'var(--r-radius)' }}
            >
              <div
                className="w-11 h-11 flex items-center justify-center shrink-0"
                style={{ backgroundColor: restaurant.primaryColor || '#111827', color: 'var(--r-button-text)', borderRadius: 'var(--r-radius-sm)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{t(card.titleKey)}</h3>
                <p className="text-[11px] text-gray-600 mt-0.5">{t(card.descKey)}</p>
              </div>
              {dir === 'rtl' ? <ChevronLeft className="h-4 w-4 text-gray-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />}
            </Link>
          );
        })}
        {customCards.map((card) => {
          const Icon = getCustomTypeIcon(card.icon);
          return (
            <Link
              key={card.type}
              href={`/support/${username}/${pathForServiceType(card.type)}`}
              className={`flex items-center gap-4 p-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all ${alignStart}`}
              style={{ borderRadius: 'var(--r-radius)' }}
            >
              <div
                className="w-11 h-11 flex items-center justify-center shrink-0"
                style={{ backgroundColor: restaurant.primaryColor || '#111827', color: 'var(--r-button-text)', borderRadius: 'var(--r-radius-sm)' }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
              </div>
              {dir === 'rtl' ? <ChevronLeft className="h-4 w-4 text-gray-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
