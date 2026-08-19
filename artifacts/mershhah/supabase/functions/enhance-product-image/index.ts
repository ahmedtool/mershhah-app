import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Nano Banana Pro - studio-quality editing model, chosen after flux-2-klein-4b
// (too blurry) and flux-kontext-pro (still poor quality) both failed a real
// visual check. ~$0.134/output image.
const GEMINI_MODEL = "gemini-3-pro-image";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function buildPrompt(productName: string): string {
  const name = productName?.trim() || "the food item";
  return (
    `High-quality professional product photo of ${name}, soft studio lighting, ` +
    `clean plain white background, food photography style. Keep the exact same dish, ` +
    `plating, and appearance as shown in the original photo - do not change its shape, ` +
    `ingredients, or arrangement. Remove any table, surface, utensils, or other objects ` +
    `in the background and replace them with a clean, solid, plain white background, ` +
    `isolated product-photography style.`
  );
}

async function callGemini(apiKey: string, imageBase64: string, prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/png", data: imageBase64 } },
        ],
      }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini request failed: ${JSON.stringify(body)}`);
  }
  const parts = body?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) return inline.data;
  }
  throw new Error(`Gemini returned no image: ${JSON.stringify(body)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return json({ error: "Image enhancement is not configured. Please contact support." }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { image_base64, product_name } = await req.json();
    if (!image_base64) return json({ error: "image_base64 is required" }, 400);

    // Server-side quota check + consume, mirroring check_image_enhance_usage
    // (paid restaurants only, shared credit balance). This is the same gate
    // the client already checks before calling us, but re-checking here
    // means the credit can never be bypassed by calling this function
    // directly instead of going through the UI.
    const { data: profile } = await supabase.from("profiles").select("restaurant_id").eq("id", user.id).single();
    if (!profile?.restaurant_id) return json({ error: "No restaurant found for this account" }, 400);

    const { data: usageRows, error: usageError } = await supabase.rpc("check_image_enhance_usage", {
      p_restaurant_id: profile.restaurant_id,
      p_consume: true,
    });
    if (usageError) return json({ error: usageError.message }, 500);
    const usageRow = Array.isArray(usageRows) ? usageRows[0] : usageRows;
    if (!usageRow?.allowed) {
      return json({ error: "لا يوجد رصيد كافٍ لتحسين الصورة." }, 402);
    }

    const resultBase64 = await callGemini(geminiApiKey, image_base64, buildPrompt(product_name));

    return json({ image_base64: resultBase64, remaining: usageRow.remaining });
  } catch (error) {
    console.error("[Enhance Product Image] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
