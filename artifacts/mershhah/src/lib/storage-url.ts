import { supabase } from '@/lib/supabase';

const BUCKET = 'restaurant-assets';

/**
 * Resolves an image field to a displayable URL. Values are either a legacy
 * Supabase Storage path (resolved via getPublicUrl) or an already-absolute
 * URL — ImageKit uploads, or a local blob: preview — which is returned as-is.
 */
export function resolveStorageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath || imagePath.trim() === '') return null;
  if (imagePath.startsWith('http') || imagePath.startsWith('blob:')) return imagePath;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return data?.publicUrl || null;
}
