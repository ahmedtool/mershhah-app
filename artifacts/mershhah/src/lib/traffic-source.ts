export type TrafficSource =
  | 'qr_branch'
  | 'whatsapp'
  | 'instagram'
  | 'snapchat'
  | 'tiktok'
  | 'x'
  | 'google_maps'
  | 'google_search'
  | 'facebook'
  | 'direct'
  | 'other';

const KNOWN_UTM_SOURCES = [
  'whatsapp', 'instagram', 'snapchat', 'tiktok', 'x', 'google_maps', 'google_search', 'facebook',
] as const;

const REFERRER_PATTERNS: [RegExp, TrafficSource][] = [
  [/instagram\.com/i, 'instagram'],
  [/facebook\.com|fb\.com/i, 'facebook'],
  [/twitter\.com|x\.com|t\.co/i, 'x'],
  [/tiktok\.com/i, 'tiktok'],
  [/snapchat\.com/i, 'snapchat'],
  [/wa\.me|whatsapp\.com/i, 'whatsapp'],
  [/maps\.google|maps\.app\.goo\.gl|google\.\w+\/maps/i, 'google_maps'],
  [/google\./i, 'google_search'],
];

/**
 * Classifies a visit's traffic source from the current URL/referrer.
 * `?source=qr_branch` (the existing physical-QR flow) always wins. An
 * explicit `?utm_source=` from a marketing link is trusted directly next;
 * failing that, document.referrer is matched against known platform
 * domains — many in-app browsers (WhatsApp, Instagram) strip the referrer
 * entirely, which is exactly why the marketing-links generator tags its
 * own links with utm_source instead of relying on the referrer alone.
 */
export function detectTrafficSource(searchParams: URLSearchParams): TrafficSource {
  if (searchParams.get('source') === 'qr_branch') return 'qr_branch';

  const utm = searchParams.get('utm_source')?.toLowerCase();
  if (utm) {
    return (KNOWN_UTM_SOURCES as readonly string[]).includes(utm) ? (utm as TrafficSource) : 'other';
  }

  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  if (!referrer) return 'direct';
  for (const [pattern, source] of REFERRER_PATTERNS) {
    if (pattern.test(referrer)) return source;
  }
  return 'other';
}

export const TRAFFIC_SOURCE_LABEL_KEYS: Record<TrafficSource, string> = {
  qr_branch: 'trafficSource.qrBranch',
  whatsapp: 'trafficSource.whatsapp',
  instagram: 'trafficSource.instagram',
  snapchat: 'trafficSource.snapchat',
  tiktok: 'trafficSource.tiktok',
  x: 'trafficSource.x',
  google_maps: 'trafficSource.googleMaps',
  google_search: 'trafficSource.googleSearch',
  facebook: 'trafficSource.facebook',
  direct: 'trafficSource.direct',
  other: 'trafficSource.other',
};

/** Platforms offered by the marketing-links generator, in display order. */
export const MARKETING_LINK_PLATFORMS: { source: TrafficSource; labelKey: string; hintKey: string }[] = [
  { source: 'whatsapp', labelKey: 'trafficSource.whatsapp', hintKey: 'trafficSource.whatsappHint' },
  { source: 'instagram', labelKey: 'trafficSource.instagram', hintKey: 'trafficSource.instagramHint' },
  { source: 'snapchat', labelKey: 'trafficSource.snapchat', hintKey: 'trafficSource.snapchatHint' },
  { source: 'tiktok', labelKey: 'trafficSource.tiktok', hintKey: 'trafficSource.tiktokHint' },
  { source: 'x', labelKey: 'trafficSource.x', hintKey: 'trafficSource.xHint' },
  { source: 'google_maps', labelKey: 'trafficSource.googleMaps', hintKey: 'trafficSource.googleMapsHint' },
];

export function buildMarketingLink(baseUrl: string, username: string, source: TrafficSource): string {
  return `${baseUrl}/${username}?utm_source=${source}&utm_medium=marketing_link`;
}
