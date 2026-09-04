import type { CSSProperties } from 'react';

// Curated, actually-loaded fonts (see index.html) — restaurants.fontFamily
// used to default to 'Cairo' even though no Cairo font was ever loaded
// anywhere, so it silently fell back to the browser default. Keep the ids
// stable; they're stored as-is in restaurants.fontFamily.
export const FONT_OPTIONS = [
  { id: 'IBM Plex Sans Arabic', labelKey: 'customize.fontClassic', sample: 'أبجد هوز' },
  { id: 'Cairo', labelKey: 'customize.fontFriendly', sample: 'أبجد هوز' },
  { id: 'Tajawal', labelKey: 'customize.fontModern', sample: 'أبجد هوز' },
] as const;

const DEFAULT_FONT = FONT_OPTIONS[0].id;

// Base corner radius (px) — applied to primary cards/buttons on public
// pages. Small badges/pills stay fully round regardless of this value;
// it only governs the "how boxy vs. soft" feel of rectangular surfaces.
export const RADIUS_PRESETS = [
  { id: 'sharp', labelKey: 'customize.radiusSharp', value: 4 },
  { id: 'soft', labelKey: 'customize.radiusSoft', value: 16 },
  { id: 'round', labelKey: 'customize.radiusRound', value: 28 },
] as const;

const DEFAULT_RADIUS = 16;

export function getContrastTextColor(hex?: string | null): string {
  if (!hex) return '#ffffff';
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Perceived luminance (WCAG-ish approximation)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#ffffff';
}

export type ThemedRestaurant = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  buttonTextColor?: string | null;
  borderRadius?: number | null;
  fontFamily?: string | null;
};

/**
 * CSS custom properties for a restaurant's public pages. Spread onto the
 * page's root element style so every descendant can read var(--r-*)
 * without each component re-deriving these from the restaurant row.
 */
export function getPublicThemeStyle(restaurant: ThemedRestaurant | null | undefined): CSSProperties {
  const primary = restaurant?.primaryColor || '#714dfa';
  const secondary = restaurant?.secondaryColor || '#f8fafc';
  const buttonText = restaurant?.buttonTextColor || getContrastTextColor(primary);
  const radius = restaurant?.borderRadius ?? DEFAULT_RADIUS;
  const font = FONT_OPTIONS.some(f => f.id === restaurant?.fontFamily) ? restaurant!.fontFamily! : DEFAULT_FONT;

  return {
    '--r-primary': primary,
    '--r-secondary': secondary,
    '--r-button-text': buttonText,
    '--r-radius': `${radius}px`,
    '--r-radius-sm': `${Math.round(radius * 0.6)}px`,
    fontFamily: `'${font}', 'IBM Plex Sans Arabic', sans-serif`,
  } as CSSProperties;
}
