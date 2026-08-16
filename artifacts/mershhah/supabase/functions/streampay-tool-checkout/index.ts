import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// StreamPay rejects a second POST /consumers for the same email/phone with
// DUPLICATE_CONSUMER (per their docs, this happens whenever a consumer was
// created on a prior attempt that didn't finish saving streampay_consumer_id
// back to our profile row). Their documented fix: search for the existing
// consumer and reuse its id instead of failing the whole checkout.
async function findExistingConsumerId(
  streamApiBase: string,
  authToken: string,
  email: string | undefined,
): Promise<string | null> {
  if (!email) return null;
  const res = await fetch(`${streamApiBase}/consumers?search_term=${encodeURIComponent(email)}&limit=20`, {
    headers: { "x-api-key": authToken },
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  const match = (body?.data || []).find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
  return match?.id || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const streamApiKey = Deno.env.get("STREAMPAY_API_KEY");
    const streamApiSecret = Deno.env.get("STREAMPAY_API_SECRET");
    const streamApiBase = "https://stream-app-service.streampay.sa/api/v2";

    if (!streamApiKey || !streamApiSecret) {
      return json({ error: "Payment gateway not configured. Please contact support." }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { tool_id } = await req.json();
    if (!tool_id) return json({ error: "tool_id is required" }, 400);

    const authToken = btoa(`${streamApiKey}:${streamApiSecret}`);

    // 1. Load the tool and validate it's actually a paid, independently
    // purchasable add-on. "plan"-billed tools are bundled with an active
    // paid subscription instead — they never go through StreamPay directly.
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select("*")
      .eq("id", tool_id)
      .single();

    if (toolError || !tool) return json({ error: "Tool not found" }, 404);
    if (tool.type !== "paid" || !(Number(tool.price) > 0)) {
      return json({ error: "This tool is free — activate it directly instead of checking out." }, 400);
    }
    if (tool.billing_type !== "addon") {
      return json({ error: "This tool is included with a paid subscription, not purchased separately." }, 400);
    }

    // 2. Don't let an already-active (non-expired) purchase be bought again
    const { data: existingActivation } = await supabase
      .from("activated_tools")
      .select("tool_id, status, expires_at")
      .eq("profile_id", user.id)
      .eq("tool_id", tool_id)
      .eq("status", "active")
      .maybeSingle();

    if (existingActivation && (!existingActivation.expires_at || new Date(existingActivation.expires_at) > new Date())) {
      return json({ error: "لديك بالفعل اشتراك فعّال بهذي الأداة." }, 409);
    }

    // 3. Get or create StreamPay consumer
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    let consumerId = profile?.streampay_consumer_id;

    if (!consumerId) {
      const consumerRes = await fetch(`${streamApiBase}/consumers`, {
        method: "POST",
        headers: { "x-api-key": authToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile?.full_name || user.email || "Customer",
          email: user.email,
          phone_number: profile?.phone,
          external_id: user.id,
          communication_methods: profile?.phone ? ["EMAIL", "SMS"] : ["EMAIL"],
        }),
      });
      const consumerBody = await consumerRes.text();
      if (!consumerRes.ok) {
        if (consumerBody.includes("DUPLICATE_CONSUMER")) {
          consumerId = await findExistingConsumerId(streamApiBase, authToken, user.email);
        }
        if (!consumerId) {
          return json({ error: `Failed to create customer: ${consumerBody}` }, 500);
        }
      } else {
        consumerId = JSON.parse(consumerBody).id;
      }
      await supabase.from("profiles").update({ streampay_consumer_id: consumerId }).eq("id", user.id);
    }

    // 4. Resolve a StreamPay product for this tool. Tool purchases have no
    // discount codes, so the price is always deterministic — safe to cache
    // and reuse (EditToolDialog clears this whenever the admin edits price).
    let productId: string | null = tool.streampay_product_id;
    if (!productId) {
      const productRes = await fetch(`${streamApiBase}/products`, {
        method: "POST",
        headers: { "x-api-key": authToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tool.title,
          description: tool.description || `أداة ${tool.title}`,
          type: "ONE_OFF",
          prices: [{ currency: "SAR", amount: Number(tool.price) }],
        }),
      });
      const productBody = await productRes.text();
      if (!productRes.ok) {
        return json({ error: `Failed to create product: ${productBody}` }, 500);
      }
      productId = JSON.parse(productBody).id;
      await supabase.from("tools").update({ streampay_product_id: productId }).eq("id", tool_id);
    }

    // 5. Create payment link
    const origin = req.headers.get("origin") || "https://www.mershhah.com";
    const paymentLinkRes = await fetch(`${streamApiBase}/payment_links`, {
      method: "POST",
      headers: { "x-api-key": authToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tool.title,
        description: `تفعيل أداة ${tool.title}`,
        items: [{ product_id: productId, quantity: 1 }],
        contact_information_type: "PHONE",
        currency: "SAR",
        max_number_of_payments: 1,
        organization_consumer_id: consumerId,
        success_redirect_url: `${origin}/owner/store?tool_purchase=success&tool=${tool_id}`,
        failure_redirect_url: `${origin}/owner/store?tool_purchase=failed&tool=${tool_id}`,
        custom_metadata: {
          profile_id: user.id,
          tool_id: tool_id,
          period_months: tool.period_months || 1,
          description: `تفعيل أداة ${tool.title}`,
        },
      }),
    });

    const paymentLinkBody = await paymentLinkRes.text();
    if (!paymentLinkRes.ok) {
      return json({ error: `Failed to create payment link: ${paymentLinkBody}` }, 500);
    }
    const paymentLink = JSON.parse(paymentLinkBody);
    if (!paymentLink.url) {
      return json({ error: "Payment link created but no URL returned", raw: paymentLink }, 500);
    }

    return json({ url: paymentLink.url });
  } catch (error) {
    console.error("[StreamPay Tool Checkout] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
