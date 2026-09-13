'use client';

import { useLanguage } from '@/components/shared/LanguageContext';

interface SubscriberStatsProps {
  total: number;
  active: number;
  expiringSoon: number;
  trial: number;
  annualRevenue: number;
}

export function SubscriberStats({ total, active, expiringSoon, trial, annualRevenue }: SubscriberStatsProps) {
  const { t, locale } = useLanguage();
  const tiles = [
    { label: t('adminManagement.statTotal'), value: total },
    { label: t('adminManagement.statActive'), value: active },
    { label: t('adminManagement.statExpiring'), value: expiringSoon },
    { label: t('adminManagement.statTrial'), value: trial },
    { label: t('adminManagement.statRevenue'), value: `${annualRevenue.toLocaleString(locale === 'ar' ? 'ar' : 'en-US')} ${t('ownerSettings.currency')}` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="text-[11px] text-gray-600 mb-2">{tile.label}</div>
          <div className="text-xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{tile.value}</div>
        </div>
      ))}
    </div>
  );
}
