import { lookupDishTerm } from '@/lib/dish-dictionary';
import { translateText } from '@/lib/translate-text';

export type TranslateMenuItemInput = { name: string; description?: string };
export type TranslateMenuItemOutput = { name_en: string; description_en: string };

export async function translateMenuItem(input: TranslateMenuItemInput): Promise<TranslateMenuItemOutput> {
  const dictHit = lookupDishTerm(input.name);
  const name_en = dictHit ?? await translateText(input.name);
  const description_en = input.description?.trim() ? await translateText(input.description) : '';
  return { name_en, description_en };
}
