import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://www.mershhah.com";

const STATIC_PATHS = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
  { path: "/terms", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy", changefreq: "yearly", priority: "0.2" },
];

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(loc: string, lastmod?: string | null, changefreq?: string, priority?: string): string {
  const parts = [`    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [restaurantsRes, postsRes] = await Promise.all([
      supabase.from("restaurants").select("username, updated_at").not("username", "is", null),
      supabase.from("blog_posts").select("slug, published_at").eq("is_published", true),
    ]);

    const entries: string[] = [];

    for (const { path, changefreq, priority } of STATIC_PATHS) {
      entries.push(urlEntry(`${SITE_URL}${path}`, null, changefreq, priority));
    }

    for (const restaurant of restaurantsRes.data || []) {
      // The hub page (bare username) is each restaurant's real public
      // landing page - /menu/:username is the same content one level in,
      // so only the hub URL goes in the sitemap to avoid duplicate-content
      // signals for the same restaurant.
      entries.push(urlEntry(`${SITE_URL}/${restaurant.username}`, restaurant.updated_at, "weekly", "0.7"));
    }

    for (const post of postsRes.data || []) {
      entries.push(urlEntry(`${SITE_URL}/blog/${post.slug}`, post.published_at, "monthly", "0.5"));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[sitemap] Fatal error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});
