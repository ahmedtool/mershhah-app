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

const DEFAULT_STORAGE_KEY = 'mershhah_locale';

function readStoredLocale(storageKey: string): Locale {
  if (typeof window === 'undefined') return 'ar';
  const stored = window.localStorage.getItem(storageKey);
  return stored === 'en' ? 'en' : 'ar';
}

export function LanguageProvider({
  children,
  initialLocale,
  storageKey = DEFAULT_STORAGE_KEY,
  manageDocument = true,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  // Lets a subtree (e.g. the owner dashboard) keep its own language choice
  // independent from the public-facing pages, which nest a LanguageProvider
  // with a different key so the two never share state or storage.
  storageKey?: string;
  // Only the outermost provider should own <html lang/dir> - a nested
  // provider (owner dashboard) leaves it alone and relies on its own
  // subtree passing `dir` down explicitly, so two providers never fight
  // over the same global attribute.
  manageDocument?: boolean;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || 'ar');

  // Pick up a persisted choice once mounted (SSR-safe: localStorage isn't
  // available during the initial server-rendered pass, so this can't run
  // in the useState initializer above).
  useEffect(() => {
    setLocaleState(readStoredLocale(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!manageDocument) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale, manageDocument]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    window.localStorage.setItem(storageKey, newLocale);
  }, [storageKey]);

  const t = useCallback((key: string): string => {
    if (!key) return '';
    const keys = key.split('.');
    let value: any = translations[locale];
    for (const k of keys) {
      if (value === undefined) return key;
      value = value[k];
    }
    return typeof value === 'string' ? value : key;
  }, [locale]);

  const isRTL = locale === 'ar';
  const dir: 'rtl' | 'ltr' = isRTL ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isRTL, dir }}>
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
