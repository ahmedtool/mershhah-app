import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BFL_API_BASE = "https://api.bfl.ai/v1";
const BFL_MODEL = "flux-2-klein-4b";
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90000;

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

async function pollForResult(pollingUrl: string, apiKey: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(pollingUrl, { headers: { "x-key": apiKey, accept: "application/json" } });
    const body = await res.json();
    if (body.status === "Ready") {
      const url = body.result?.sample;
      if (!url) throw new Error("Result ready but no image URL returned");
      return url;
    }
    if (body.status === "Error" || body.status === "Failed" || body.status === "Content Moderated") {
      throw new Error(`FLUX generation failed: ${body.status} - ${JSON.stringify(body.details || body)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for FLUX result");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bflApiKey = Deno.env.get("BFL_API_KEY");

    if (!bflApiKey) {
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

    // Call FLUX and poll for the result.
    const submitRes = await fetch(`${BFL_API_BASE}/${BFL_MODEL}`, {
      method: "POST",
      headers: { "x-key": bflApiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        prompt: buildPrompt(product_name),
        input_image: image_base64,
        output_format: "png",
      }),
    });
    const submitBody = await submitRes.json();
    if (!submitRes.ok || !submitBody.polling_url) {
      return json({ error: `FLUX request failed: ${JSON.stringify(submitBody)}` }, 502);
    }

    const resultUrl = await pollForResult(submitBody.polling_url, bflApiKey);

    // Fetch the result server-side and return it inline as base64, so the
    // client never has to deal with BFL's short-lived signed URL directly.
    const imageRes = await fetch(resultUrl);
    if (!imageRes.ok) return json({ error: "Failed to download generated image" }, 502);
    const imageBuffer = new Uint8Array(await imageRes.arrayBuffer());
    let binary = "";
    for (let i = 0; i < imageBuffer.length; i++) binary += String.fromCharCode(imageBuffer[i]);
    const resultBase64 = btoa(binary);

    return json({ image_base64: resultBase64, remaining: usageRow.remaining });
  } catch (error) {
    console.error("[Enhance Product Image] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
