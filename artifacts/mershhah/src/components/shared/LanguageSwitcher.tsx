'use client';

import { useLanguage } from './LanguageContext';
import { Languages } from 'lucide-react';

/** Small pill button that flips to the other language on click. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  const nextLocale = locale === 'ar' ? 'en' : 'ar';
  const nextLabel = nextLocale === 'ar' ? 'العربية' : 'English';

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-colors whitespace-nowrap ${className}`}
      title={nextLabel}
    >
      <Languages className="h-3.5 w-3.5 shrink-0" />
      <span>{nextLabel}</span>
    </button>
  );
}
