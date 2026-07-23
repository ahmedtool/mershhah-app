'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, type Locale } from '@/lib/i18n/translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLocale,
}: { 
  children: React.ReactNode; 
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState('ar');
    setMounted(true);
  }, [initialLocale]);

  const setLocale = useCallback((_newLocale: Locale) => {
    if (locale !== 'ar') {
      setLocaleState('ar');
    }
  }, [locale]);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: any = translations['ar'];
    for (const k of keys) {
      if (value === undefined) return key;
      value = value[k];
    }
    return typeof value === 'string' ? value : key;
  }, []);

  const isRTL = true;
  const dir: 'rtl' | 'ltr' = 'rtl';

  return (
    <LanguageContext.Provider value={{ locale: 'ar', setLocale, t, isRTL, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: 'ar',
      setLocale: () => {},
      t: (key: string) => key,
      isRTL: true,
      dir: 'rtl',
    };
  }
  return context;
}
