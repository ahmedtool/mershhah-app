import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BALANCE = 199;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// StreamPay rejects a second POST /consumers for the same email/phone with
// DUPLICATE_CONSUMER. Their documented fix: search for the existing consumer
// and reuse its id instead of failing the whole checkout.
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

    const { pack_id } = await req.json();
    if (!pack_id) return json({ error: "pack_id is required" }, 400);

    const authToken = btoa(`${streamApiKey}:${streamApiSecret}`);

    // 1. Load the pack
    const { data: pack, error: packError } = await supabase
      .from("image_credit_packs")
      .select("*")
      .eq("id", pack_id)
      .eq("is_active", true)
      .single();

    if (packError || !pack) return json({ error: "Pack not found" }, 404);

    // 2. Resolve the buyer's restaurant and current balance, and refuse to
    // start a purchase that would push them past the 199-credit cap - no
    // point charging for credits they can never receive.
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile?.restaurant_id) return json({ error: "No restaurant found for this account" }, 400);

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("image_credits_balance, is_paid_plan")
      .eq("id", profile.restaurant_id)
      .single();

    if (!restaurant?.is_paid_plan) {
      return json({ error: "أداة تحسين الصور متاحة للمشتركين فقط." }, 403);
    }

    const currentBalance = restaurant.image_credits_balance || 0;
    if (currentBalance + pack.credits > MAX_BALANCE) {
      return json({
        error: `لا يمكن الشراء — رصيدك الحالي (${currentBalance}) + هذي الباقة (${pack.credits}) يتجاوز الحد الأقصى (${MAX_BALANCE} صورة).`,
      }, 400);
    }

    // 3. Get or create StreamPay consumer
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

    // 4. Resolve a StreamPay product for this pack (cached on the pack row).
    let productId: string | null = pack.streampay_product_id;
    if (!productId) {
      const productRes = await fetch(`${streamApiBase}/products`, {
        method: "POST",
        headers: { "x-api-key": authToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${pack.name} - ${pack.credits} صورة`,
          description: `${pack.credits} تحسين صورة بالذكاء الاصطناعي`,
          type: "ONE_OFF",
          prices: [{ currency: "SAR", amount: Number(pack.price) }],
        }),
      });
      const productBody = await productRes.text();
      if (!productRes.ok) {
        return json({ error: `Failed to create product: ${productBody}` }, 500);
      }
      productId = JSON.parse(productBody).id;
      await supabase.from("image_credit_packs").update({ streampay_product_id: productId }).eq("id", pack_id);
    }

    // 5. Create payment link
    const origin = req.headers.get("origin") || "https://www.mershhah.com";
    const paymentLinkRes = await fetch(`${streamApiBase}/payment_links`, {
      method: "POST",
      headers: { "x-api-key": authToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${pack.name} - ${pack.credits} صورة`,
        description: `شحن ${pack.credits} تحسين صورة`,
        items: [{ product_id: productId, quantity: 1 }],
        contact_information_type: "PHONE",
        currency: "SAR",
        max_number_of_payments: 1,
        organization_consumer_id: consumerId,
        success_redirect_url: `${origin}/owner/tools/image-enhancer?credit_purchase=success`,
        failure_redirect_url: `${origin}/owner/tools/image-enhancer?credit_purchase=failed`,
        custom_metadata: {
          profile_id: user.id,
          pack_id: pack_id,
          credits: pack.credits,
          description: `شحن رصيد صور - ${pack.name}`,
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
    console.error("[StreamPay Credits Checkout] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
