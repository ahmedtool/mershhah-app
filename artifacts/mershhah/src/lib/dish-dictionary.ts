/**
 * Common Saudi/Gulf dish names general-purpose translators mangle or
 * transliterate inconsistently. Checked before falling back to a real
 * translation call, so the "signature" items always come back right.
 */
export const DISH_DICTIONARY: Record<string, string> = {
  'مندي': 'Mandi',
  'مظبي': 'Madhbi',
  'مضبي': 'Madhbi',
  'جريش': 'Jareesh',
  'سليق': 'Saleeg',
  'مدفون': 'Madfoon',
  'كبسة': 'Kabsa',
  'مجبوس': 'Majboos',
  'مرقوق': 'Marqooq',
  'مرقوقة': 'Marqooqa',
  'ثريد': 'Thareed',
  'حنيذ': 'Haneeth',
  'قرصان': 'Qursan',
  'مطازيز': 'Matazeez',
  'مفطح': 'Muftah',
  'جلامة': 'Jalamah',
  'مقلقل': 'Maqlaqel',
  'شاورما': 'Shawarma',
  'فتة': 'Fatteh',
  'مسخن': 'Musakhan',
  'ملوخية': 'Molokhia',
  'مقلوبة': 'Maqluba',
  'مندازي': 'Mandazi',
  'صيادية': 'Sayadieh',
  'حمص': 'Hummus',
  'متبل': 'Mutabbal',
  'تبولة': 'Tabbouleh',
  'فتوش': 'Fattoush',
  'شكشوكة': 'Shakshuka',
  'بليلة': 'Balila',
  'عريكة': 'Areeka',
  'هريس': 'Harees',
};

/** Word-boundary lookup so "مندي دجاج" still matches the "مندي" entry. */
export function lookupDishTerm(text: string): string | null {
  const trimmed = text.trim();
  if (DISH_DICTIONARY[trimmed]) return DISH_DICTIONARY[trimmed];
  return null;
}
