/// <reference lib="dom" />
/// <reference types="node" />

// Vercel Middleware (Node.js runtime, per Vercel's own recommendation over
// the deprecated default edge runtime) - runs before the SPA rewrite in
// vercel.json, only for the paths listed in `config.matcher` below. This
// file sits alone at the repo root with no tsconfig of its own, so it
// inherits tsconfig.base.json's minimal `lib`/`types` (no DOM, no node) -
// the triple-slash references above pull in Request/Response/URL/fetch and
// process without touching that shared config.
//
// Link-preview crawlers (WhatsApp, Telegram, Discord, etc.) fetch the raw
// HTML and never run JavaScript, so the per-restaurant <title>/og:* tags
// that useDocumentMeta() sets client-side (src/hooks/useDocumentMeta.ts)
// are invisible to them - they only ever see index.html's static, generic
// Mershhah branding, regardless of which restaurant's page was shared.
//
// For a request whose User-Agent matches a known crawler, this returns a
// small standalone HTML document carrying that restaurant's real
// name/logo/description as OG tags instead of letting the normal SPA
// rewrite happen. Real visitors (any other User-Agent) are unaffected -
// the function returns undefined and Vercel continues to the normal
// rewrite/static response.
const BOT_UA_RE = /(facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|vkShare|W3C_Validator|Applebot|Googlebot|Bingbot|YandexBot|DuckDuckBot)/i;

export const config = {
  runtime: 'nodejs',
  matcher: ['/menu/:username*'],
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveLogoUrl(supabaseUrl: string, logo: string | null | undefined): string {
  const fallback = 'https://www.mershhah.com/opengraph.jpg';
  if (!logo) return fallback;
  if (logo.startsWith('http') || logo.startsWith('blob:')) return logo;
  return `${supabaseUrl}/storage/v1/object/public/restaurant-assets/${logo}`;
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_UA_RE.test(userAgent)) return;

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/menu\/([^/]+)\/?$/);
  const username = match?.[1];
  if (!username) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return;

  try {
    const restRes = await fetch(
      `${supabaseUrl}/rest/v1/public_pages?id=eq.${encodeURIComponent(username.toLowerCase())}&select=data`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    if (!restRes.ok) return;
    const rows = (await restRes.json()) as Array<{ data?: { restaurant?: Record<string, any> } }>;
    const restaurant = rows?.[0]?.data?.restaurant;
    if (!restaurant?.name) return;

    const title = `منيو ${restaurant.name} | مرشح`;
    const description =
      restaurant.description?.trim() ||
      `تصفح منيو ${restaurant.name} على مرشح.`;
    const image = resolveLogoUrl(supabaseUrl, restaurant.logo);

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(url.toString())}" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0; url=${escapeHtml(url.toString())}" />
</head>
<body></body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch {
    return;
  }
}
