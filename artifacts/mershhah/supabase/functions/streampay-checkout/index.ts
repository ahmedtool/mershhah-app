import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const streamApiKey = Deno.env.get("STREAMPAY_API_KEY")!;
    const streamApiSecret = Deno.env.get("STREAMPAY_API_SECRET")!;
    const streamApiBase = "https://stream-app-service.streampay.sa/api/v2";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { plan_id, billing_cycle, discount_code } = await req.json();
    const authToken = btoa(`${streamApiKey}:${streamApiSecret}`);

    // 1. Get plan
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
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
      const consumerRes = await fetch(`${streamApiBase}/consumers`, {
        method: "POST",
        headers: {
          "x-api-key": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile?.full_name || user.email || "Customer",
          email: user.email,
          phone_number: profile?.phone,
          external_id: user.id,
          communication_methods: ["EMAIL", "SMS"],
        }),
      });

      const consumer = await consumerRes.json();
      consumerId = consumer.id;

      await supabase
        .from("profiles")
        .update({ streampay_consumer_id: consumerId })
        .eq("id", user.id);
    }

    // 3. Apply discount if provided
    let discountAmount = 0;
    let discountCodeId = null;
    
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

        if (notExpired && withinUses && validFrom <= now) {
          const price = billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
          if (dc.discount_type === "percentage") {
            discountAmount = Math.round((price * dc.discount_value) / 100);
          } else if (dc.discount_type === "fixed") {
            discountAmount = Math.min(dc.discount_value, price);
          } else if (dc.discount_type === "free_trial") {
            discountAmount = price;
          }
          discountCodeId = dc.id;
        }
      }
    }

    // 4. Determine amount
    const basePrice = billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
    const finalAmount = Math.max(0, basePrice - discountAmount);

    // 5. Create StreamPay product for this plan if not exists
    let productId = plan.streampay_product_id;
    if (!productId) {
      const productRes = await fetch(`${streamApiBase}/products`, {
        method: "POST",
        headers: {
          "x-api-key": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${plan.name} - ${billing_cycle === "yearly" ? "سنوي" : "شهري"}`,
          description: plan.description,
          price: Math.round(finalAmount * 100), // StreamPay uses halalas
          currency: "SAR",
          type: "RECURRING",
          recurring_interval: billing_cycle === "yearly" ? "YEARLY" : "MONTHLY",
        }),
      });

      const product = await productRes.json();
      productId = product.id;

      await supabase
        .from("plans")
        .update({ streampay_product_id: productId })
        .eq("id", plan_id);
    }

    // 6. Create payment link
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
        success_redirect_url: `${req.headers.get("origin") || "https://www.mershhah.com"}/billing/success`,
        failure_redirect_url: `${req.headers.get("origin") || "https://www.mershhah.com"}/billing/failed`,
        custom_metadata: {
          profile_id: user.id,
          plan_id: plan_id,
          billing_cycle: billing_cycle,
          discount_code_id: discountCodeId,
          discount_amount: discountAmount,
          description: `اشتراك ${plan.name} - ${billing_cycle === "yearly" ? "سنوي" : "شهري"}`,
        },
        language: "ar",
      }),
    });

    const paymentLink = await paymentLinkRes.json();

    // 7. Record pending subscription
    const endDate = new Date();
    if (billing_cycle === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

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

    // 8. Update discount code usage
    if (discountCodeId) {
      await supabase.rpc("increment_discount_usage", { code_id: discountCodeId }).catch(() => {
        supabase
          .from("discount_codes")
          .update({ current_uses: supabase.rpc ? undefined : 1 })
          .eq("id", discountCodeId);
      });
    }

    return new Response(
      JSON.stringify({ url: paymentLink.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[StreamPay Checkout] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
