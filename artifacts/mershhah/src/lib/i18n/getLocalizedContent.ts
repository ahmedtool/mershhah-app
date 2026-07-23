import type { Locale } from './translations';

export function getLocalized<T extends Record<string, any>>(
  item: T,
  field: keyof T,
  locale: Locale
): string {
  if (locale === 'en') {
    const enField = `${String(field)}_en` as keyof T;
    const enValue = item[enField];
    if (enValue && typeof enValue === 'string' && enValue.trim()) {
      return enValue;
    }
  }
  const value = item[field];
  return typeof value === 'string' ? value : '';
}

export function getLocalizedOrFallback<T extends Record<string, any>>(
  item: T,
  field: keyof T,
  locale: Locale,
  fallback: string = ''
): string {
  const result = getLocalized(item, field, locale);
  return result || fallback;
}
