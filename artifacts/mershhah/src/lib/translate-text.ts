import { supabase } from '@/lib/supabase';

// MyMemory's free tier caps a single request at 500 bytes of query text.
const MYMEMORY_MAX_BYTES = 480;

function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

async function getCached(text: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('translation_cache')
      .select('translated_text')
      .eq('source_text', text)
      .maybeSingle();
    return data?.translated_text ?? null;
  } catch {
    // Cache table may not exist yet - translation still works without it.
    return null;
  }
}

function setCached(text: string, translated: string): void {
  supabase.from('translation_cache').upsert({ source_text: text, translated_text: translated }).then(
    () => {},
    () => {},
  );
}

async function translateWithMyMemory(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation request failed');
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || typeof translated !== 'string') throw new Error('Translation returned no result');
  return translated;
}

/**
 * Free, no-API-key translation: a shared Supabase cache first (so the same
 * text is never billed against MyMemory's daily quota twice across
 * restaurants), then MyMemory itself. Dish-name shortcuts live in
 * dish-dictionary.ts and are checked by the caller before this.
 */
export async function translateText(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const cached = await getCached(trimmed);
  if (cached) return cached;

  if (utf8ByteLength(trimmed) > MYMEMORY_MAX_BYTES) {
    throw new Error('Text too long to translate in one request');
  }

  const translated = await translateWithMyMemory(trimmed);
  setCached(trimmed, translated);
  return translated;
}
