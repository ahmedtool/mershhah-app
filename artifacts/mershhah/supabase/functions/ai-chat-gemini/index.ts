import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fallback layer for the restaurant chat widget: called only when the free,
// local rule-based engine (restaurant-chat-flow.ts) doesn't match anything.
// Guarded by a hard daily cap enforced here, server-side, so a bug or a
// traffic spike can never turn into a surprise bill — the Google AI Studio
// key behind this has no billing account attached, so exceeding the free
// tier fails the request rather than charging anything; this cap exists as
// a second, independent line of defense that fails closed even earlier.
const DAILY_CAP = 200;
// Alias that always resolves to Google's current stable Flash model, so
// this never needs a manual bump when a dated model version gets retired
// (which is exactly what broke this the first time).
const MODEL = "gemini-flash-latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Any failure path returns { fallback: true } with a 200 — the caller
  // always has a local reply ready and should just use it silently. A
  // customer-facing chat widget must never surface a raw error.
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      return json({ fallback: true });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { customerMessage, restaurantData, locale } = await req.json();

    if (!customerMessage || typeof customerMessage !== "string") {
      return json({ fallback: true });
    }

    // Atomic-enough for this purpose: worst case under concurrent bursts is
    // a handful of extra requests past the cap, never a runaway.
    const today = new Date().toISOString().slice(0, 10);
    const { data: usageRow } = await supabase
      .from("ai_gemini_usage")
      .select("request_count")
      .eq("usage_date", today)
      .maybeSingle();

    const currentCount = usageRow?.request_count ?? 0;
    if (currentCount >= DAILY_CAP) {
      console.warn("[ai-chat-gemini] Daily cap reached:", currentCount);
      return json({ fallback: true });
    }

    await supabase
      .from("ai_gemini_usage")
      .upsert({ usage_date: today, request_count: currentCount + 1, updated_at: new Date().toISOString() });

    let restaurant: any = {};
    try {
      restaurant = JSON.parse(restaurantData || "{}");
    } catch {
      // proceed with an empty context rather than fail the whole request
    }

    const isArabic = locale !== "en";
    const menuLines = (restaurant.menu || [])
      .slice(0, 60)
      .map((m: any) => `- ${m.name}${m.price ? ` (${m.price} SAR)` : ""}${m.category ? ` [${m.category}]` : ""}`)
      .join("\n");
    const offerLines = (restaurant.offers || [])
      .slice(0, 10)
      .map((o: any) => `- ${o.title}${o.description ? `: ${o.description}` : ""}`)
      .join("\n");
    const branchLines = (restaurant.branches || [])
      .slice(0, 10)
      .map((b: any) => `- ${b.name || ""}${b.address ? `, ${b.address}` : ""}${b.opening_hours ? ` (${b.opening_hours})` : ""}`)
      .join("\n");

    const systemPrompt = `You are the friendly chat assistant for the restaurant "${restaurant.name || ""}", embedded in its digital menu page. ${isArabic ? "Reply only in Saudi-casual Arabic." : "Reply in English."} Keep replies short (2-4 sentences max), warm, and use at most 1-2 emojis. Only mention menu items, prices, offers, or branches that appear in the data below — never invent items, prices, or promises that aren't listed. If the answer truly isn't in the data, say so briefly and suggest they ask about the menu, offers, or branches instead.

MENU:
${menuLines || "(no items listed)"}

OFFERS:
${offerLines || "(no active offers)"}

BRANCHES:
${branchLines || "(no branches listed)"}

Customer message: "${customerMessage}"`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 220 },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.error("[ai-chat-gemini] Gemini API error:", geminiRes.status, await geminiRes.text());
      return json({ fallback: true });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return json({ fallback: true });
    }

    return json({ smartReply: text });
  } catch (error) {
    console.error("[ai-chat-gemini] Fatal error:", error);
    return json({ fallback: true });
  }
});
