import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function consumeDiscountCode(
  supabase: any,
  discountCodeId: string,
  profileId: string,
  subscriptionId: string | null,
  discountAmount: number,
) {
  const { error: rpcError } = await supabase.rpc("increment_discount_usage", { code_id: discountCodeId });
  if (rpcError) {
    console.error("[StreamPay Checkout] Failed to increment discount usage:", rpcError);
  }
  await supabase.from("discount_code_usage").insert({
    discount_code_id: discountCodeId,
    profile_id: profileId,
    subscription_id: subscriptionId,
    discount_amount: discountAmount,
  });
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

    // Validate secrets exist
    if (!streamApiKey || !streamApiSecret) {
      console.error("[StreamPay Checkout] Missing secrets! STREAMPAY_API_KEY:", !!streamApiKey, "STREAMPAY_API_SECRET:", !!streamApiSecret);
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured. Please contact support." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("[StreamPay Checkout] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { plan_id, billing_cycle, discount_code } = await req.json();
    console.log("[StreamPay Checkout] Request:", { plan_id, billing_cycle, discount_code, user_id: user.id });

    const authToken = btoa(`${streamApiKey}:${streamApiSecret}`);

    // 1. Get plan
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      console.error("[StreamPay Checkout] Plan not found:", plan_id, planError);
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // 2. Get or create StreamPay consumer
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    let consumerId = profile?.streampay_consumer_id;

    if (!consumerId) {
      console.log("[StreamPay Checkout] Creating consumer for user:", user.id);
      const consumerRes = await fetch(`${streamApiBase}/consumers`, {
        method: "POST",
        headers: {
          "x-api-key": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile?.full_name || user.email || "Customer",
          email: user.email,
          phone_number: profile?.phone || undefined,
          external_id: user.id,
          // SMS requires a phone number on file — only request it when we actually have one
          communication_methods: profile?.phone ? ["EMAIL", "SMS"] : ["EMAIL"],
        }),
      });

      const consumerBody = await consumerRes.text();
      console.log("[StreamPay Checkout] Consumer response:", consumerRes.status, consumerBody);

      if (!consumerRes.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to create customer: ${consumerBody}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const consumer = JSON.parse(consumerBody);
      consumerId = consumer.id;

      await supabase
        .from("profiles")
        .update({ streampay_consumer_id: consumerId })
        .eq("id", user.id);
    }

    // 3. Validate discount (NOT consumed here — only once payment is actually confirmed)
    let discountAmount = 0;
    let discountCodeId: string | null = null;
    const basePriceForValidation = billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;

    if (discount_code) {
      const { data: dc } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", discount_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (dc) {
        const now = new Date();
        const validFrom = new Date(dc.valid_from);
        const validUntil = dc.valid_until ? new Date(dc.valid_until) : null;
        const notExpired = !validUntil || validUntil > now;
        const withinUses = !dc.max_uses || dc.current_uses < dc.max_uses;
        const appliesToPlan = !dc.applicable_plans?.length || dc.applicable_plans.includes(plan_id);
        const meetsMinAmount = !dc.min_amount || basePriceForValidation >= dc.min_amount;

        if (notExpired && withinUses && validFrom <= now && appliesToPlan && meetsMinAmount) {
          if (dc.discount_type === "percentage") {
            discountAmount = Math.round((basePriceForValidation * dc.discount_value) / 100);
          } else if (dc.discount_type === "fixed") {
            discountAmount = Math.min(dc.discount_value, basePriceForValidation);
          } else if (dc.discount_type === "free_trial") {
            discountAmount = basePriceForValidation;
          }
          discountCodeId = dc.id;
        }
      }
    }

    // 4. Determine amount
    const basePrice = basePriceForValidation;
    const finalAmount = Math.max(0, basePrice - discountAmount);
    const hasDiscount = discountAmount > 0;

    const endDate = new Date();
    if (billing_cycle === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // 5. Fully-discounted (free trial) checkout: StreamPay requires amount >= 1,
    // so there is nothing to charge — activate locally and skip the gateway entirely.
    if (finalAmount <= 0) {
      const { data: freeSub, error: freeSubError } = await supabase
        .from("subscriptions")
        .insert({
          profile_id: user.id,
          plan_id: plan_id,
          plan_name: plan.name,
          billing_cycle: billing_cycle,
          amount: 0,
          currency: "SAR",
          status: "active",
          discount_code_id: discountCodeId,
          discount_amount: discountAmount,
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          next_billing_date: endDate.toISOString(),
        })
        .select()
        .single();

      if (freeSubError) {
        console.error("[StreamPay Checkout] Failed to create free subscription:", freeSubError);
        return new Response(JSON.stringify({ error: "Failed to activate subscription" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      if (discountCodeId) {
        await consumeDiscountCode(supabase, discountCodeId, user.id, freeSub?.id ?? null, discountAmount);
      }

      const origin = req.headers.get("origin") || "https://www.mershhah.com";
      return new Response(
        JSON.stringify({ url: `${origin}/billing/success?status=free` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 6. Resolve a StreamPay product for this exact price.
    // Only the canonical (non-discounted) product is cached on the plan row.
    // A discounted checkout always gets its own product, so a coupon can never
    // permanently change the price everyone else pays for that plan.
    let productId: string | null = hasDiscount ? null : plan.streampay_product_id;

    if (!productId) {
      console.log("[StreamPay Checkout] Creating product for plan:", plan.name, "amount:", finalAmount);
      const productRes = await fetch(`${streamApiBase}/products`, {
        method: "POST",
        headers: {
          "x-api-key": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${plan.name} - ${billing_cycle === "yearly" ? "سنوي" : "شهري"}`,
          description: plan.description || `اشتراك ${plan.name}`,
          type: "RECURRING",
          recurring_interval: billing_cycle === "yearly" ? "YEAR" : "MONTH",
          prices: [{ currency: "SAR", amount: finalAmount }],
        }),
      });

      const productBody = await productRes.text();
      console.log("[StreamPay Checkout] Product response:", productRes.status, productBody);

      if (!productRes.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to create product: ${productBody}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const product = JSON.parse(productBody);
      productId = product.id;

      // Only cache the product on the plan when it reflects the plan's real price
      if (!hasDiscount) {
        await supabase
          .from("plans")
          .update({ streampay_product_id: productId })
          .eq("id", plan_id);
      }
    }

    // 7. Create payment link
    const origin = req.headers.get("origin") || "https://www.mershhah.com";
    console.log("[StreamPay Checkout] Creating payment link, consumer:", consumerId, "product:", productId);

    const paymentLinkRes = await fetch(`${streamApiBase}/payment_links`, {
      method: "POST",
      headers: {
        "x-api-key": authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${plan.name} - ${billing_cycle === "yearly" ? "سنوي" : "شهري"}`,
        description: `اشتراك ${plan.name}`,
        items: [{ product_id: productId, quantity: 1 }],
        contact_information_type: "PHONE",
        currency: "SAR",
        max_number_of_payments: 1,
        organization_consumer_id: consumerId,
        success_redirect_url: `${origin}/billing/success`,
        failure_redirect_url: `${origin}/billing/failed`,
        custom_metadata: {
          profile_id: user.id,
          plan_id: plan_id,
          billing_cycle: billing_cycle,
          discount_code_id: discountCodeId,
          discount_amount: discountAmount,
          description: `اشتراك ${plan.name} - ${billing_cycle === "yearly" ? "سنوي" : "شهري"}`,
        },
      }),
    });

    const paymentLinkBody = await paymentLinkRes.text();
    console.log("[StreamPay Checkout] Payment link response:", paymentLinkRes.status, paymentLinkBody);

    if (!paymentLinkRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to create payment link: ${paymentLinkBody}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const paymentLink = JSON.parse(paymentLinkBody);

    if (!paymentLink.url) {
      console.error("[StreamPay Checkout] No URL in response:", paymentLink);
      return new Response(
        JSON.stringify({ error: "Payment link created but no URL returned", raw: paymentLink }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 8. Record pending subscription. The discount code is only consumed once
    // the webhook confirms the payment actually succeeded (see streampay-webhook).
    await supabase.from("subscriptions").insert({
      profile_id: user.id,
      plan_id: plan_id,
      plan_name: plan.name,
      billing_cycle: billing_cycle,
      amount: finalAmount,
      currency: "SAR",
      status: "pending",
      discount_code_id: discountCodeId,
      discount_amount: discountAmount,
      start_date: new Date().toISOString(),
      end_date: endDate.toISOString(),
      next_billing_date: endDate.toISOString(),
    });

    console.log("[StreamPay Checkout] Success! URL:", paymentLink.url);
    return new Response(
      JSON.stringify({ url: paymentLink.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[StreamPay Checkout] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
