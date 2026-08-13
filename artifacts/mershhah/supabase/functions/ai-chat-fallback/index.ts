import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fallback layer for the restaurant chat widget: called only when the free,
// local rule-based engine (restaurant-chat-flow.ts) doesn't match anything.
// Guarded by a hard daily cap enforced here, server-side, so a bug or a
// traffic spike can never turn into a surprise bill.
//
// Uses OpenRouter's free tier: a $0-balance account calling a model with a
// `:free` suffix is rate-limited (50 req/day, 20/min) rather than billed -
// see https://openrouter.ai/docs/api-reference/limits.
//
// Two things measured live before landing here:
// 1. Pinning to a single model (google/gemma-4-26b-a4b-it:free) had ~66%
//    failure rate - that model's latency under real load regularly
//    exceeded any reasonable timeout.
// 2. The `openrouter/free` auto-router improved availability but sometimes
//    routed to a model unsuited for conversation - one leaked its raw
//    chain-of-thought into the reply, another returned literally
//    "User Safety: safe". Worse than no reply for a customer.
// The `models` array (OpenRouter tries each in order, falling back on
// failure) gets both: only curated, conversational models ever answer, and
// 4/4 live tests succeeded vs 1/3 for a single pinned model.
const DAILY_CAP = 45; // stays under OpenRouter's 50/day zero-balance limit with margin
const MODELS = ["google/gemma-4-26b-a4b-it:free", "openai/gpt-oss-20b:free"];
const REQUEST_TIMEOUT_MS = 15000;

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

  // Any failure path returns { fallback: true } with a 200 - the caller
  // always has a local reply ready and should just use it silently. A
  // customer-facing chat widget must never surface a raw error.
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openRouterKey) {
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
      console.warn("[ai-chat-fallback] Daily cap reached:", currentCount);
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

    const systemPrompt = `You are the friendly chat assistant for the restaurant "${restaurant.name || ""}", embedded in its digital menu page. ${isArabic ? "Reply only in Saudi-casual Arabic." : "Reply in English."} Keep replies short (2-4 sentences max), warm, and use at most 1-2 emojis. Only mention menu items, prices, offers, or branches that appear in the data below - never invent items, prices, or promises that aren't listed. If the answer truly isn't in the data, say so briefly and suggest they ask about the menu, offers, or branches instead.

MENU:
${menuLines || "(no items listed)"}

OFFERS:
${offerLines || "(no active offers)"}

BRANCHES:
${branchLines || "(no branches listed)"}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let orRes: Response;
    try {
      orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          models: MODELS,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: customerMessage },
          ],
          max_tokens: 220,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      // Covers both the abort (slow/congested free model) and genuine
      // network failures - either way, the customer just gets the local
      // reply instead of waiting indefinitely.
      console.error("[ai-chat-fallback] OpenRouter request failed or timed out:", fetchErr);
      return json({ fallback: true });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!orRes.ok) {
      console.error("[ai-chat-fallback] OpenRouter API error:", orRes.status, await orRes.text());
      return json({ fallback: true });
    }

    const orData = await orRes.json();
    const text = orData?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return json({ fallback: true });
    }

    return json({ smartReply: text });
  } catch (error) {
    console.error("[ai-chat-fallback] Fatal error:", error);
    return json({ fallback: true });
  }
});
