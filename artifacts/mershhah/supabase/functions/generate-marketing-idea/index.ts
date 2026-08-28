import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Powers the "فكرة تسويقية" button on the marketing calendar tool. Reuses
// the same OpenRouter free-tier setup and shared daily cap as
// ai-chat-fallback (see that function for why: pinning to one model has a
// high failure rate under load, and the account-level free-tier limit is
// shared across every feature using this key regardless of which table
// tracks it) - deliberately the SAME `ai_gemini_usage` row, not a separate
// budget, so an owner clicking this repeatedly can't starve the
// customer-facing chat widget of its own share of the pool.
const DAILY_CAP = 45;
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openRouterKey) {
      return json({ error: "Idea generator not configured. Please contact support." }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, restaurant_id")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "owner") {
      return json({ error: "Owner accounts only" }, 403);
    }

    let restaurantName = "المطعم";
    if (profile.restaurant_id) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("name")
        .eq("id", profile.restaurant_id)
        .maybeSingle();
      if (restaurant?.name) restaurantName = restaurant.name;
    }

    const { occasionName, occasionDate } = await req.json();
    if (!occasionName || typeof occasionName !== "string") {
      return json({ error: "occasionName is required" }, 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: usageRow } = await supabase
      .from("ai_gemini_usage")
      .select("request_count")
      .eq("usage_date", today)
      .maybeSingle();

    const currentCount = usageRow?.request_count ?? 0;
    if (currentCount >= DAILY_CAP) {
      return json({ error: "تم الوصول للحد اليومي لتوليد الأفكار، جرّب بعد شوي." }, 429);
    }

    await supabase
      .from("ai_gemini_usage")
      .upsert({ usage_date: today, request_count: currentCount + 1, updated_at: new Date().toISOString() });

    const systemPrompt = `You are a marketing idea generator for Saudi food-sector businesses (restaurants, cafes, bakeries, and similar). Given an occasion/day and a business name, write ONE short, practical, actionable marketing idea in Saudi-casual Arabic (2-4 sentences) the owner could run TODAY - a specific promo mechanic, a social post angle, or an in-store touch. Be concrete (mention a discount shape, a bundle, a caption angle), not generic advice like "post on social media". No emojis beyond 1-2. Do not use markdown formatting.`;

    const userPrompt = `المناسبة: ${occasionName}${occasionDate ? ` (${occasionDate})` : ""}\nاسم المشروع: ${restaurantName}\n\nاعطني فكرة تسويقية واحدة عملية لهذه المناسبة.`;

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
            { role: "user", content: userPrompt },
          ],
          max_tokens: 220,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      console.error("[generate-marketing-idea] OpenRouter request failed or timed out:", fetchErr);
      return json({ error: "تعذّر توليد الفكرة، حاول مرة أخرى." }, 500);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!orRes.ok) {
      console.error("[generate-marketing-idea] OpenRouter API error:", orRes.status, await orRes.text());
      return json({ error: "تعذّر توليد الفكرة، حاول مرة أخرى." }, 500);
    }

    const orData = await orRes.json();
    const idea = orData?.choices?.[0]?.message?.content?.trim();
    if (!idea) {
      return json({ error: "تعذّر توليد الفكرة، حاول مرة أخرى." }, 500);
    }

    return json({ idea });
  } catch (error) {
    console.error("[generate-marketing-idea] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
