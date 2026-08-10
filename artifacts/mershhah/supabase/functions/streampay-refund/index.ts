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
      return json({ error: "Payment gateway not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only admins can issue refunds
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfile?.role !== "admin") {
      return json({ error: "Forbidden — admin only" }, 403);
    }

    const { subscription_id, refund_reason, refund_note, cancel_subscription } = await req.json();
    if (!subscription_id) {
      return json({ error: "subscription_id is required" }, 400);
    }

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .single();
    if (subError || !subscription) {
      return json({ error: "Subscription not found" }, 404);
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("subscription_id", subscription_id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invoice?.streampay_payment_id) {
      return json({ error: "No paid StreamPay payment found for this subscription" }, 400);
    }

    const authToken = btoa(`${streamApiKey}:${streamApiSecret}`);

    // StreamPay refunds are always full refunds of the given payment
    // https://docs.streampay.sa/api/v2-payments-refund
    const refundRes = await fetch(`${streamApiBase}/payments/${invoice.streampay_payment_id}/refund`, {
      method: "POST",
      headers: { "x-api-key": authToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        refund_reason: refund_reason || "REQUESTED_BY_CUSTOMER",
        refund_note: refund_note || undefined,
      }),
    });

    const refundBody = await refundRes.text();
    if (!refundRes.ok) {
      console.error("[StreamPay Refund] Failed:", refundRes.status, refundBody);
      return json({ error: `Refund failed: ${refundBody}` }, 500);
    }
    const refundData = JSON.parse(refundBody);
    const refundedAmount = Number(refundData?.amount_refunded ?? refundData?.amount ?? invoice.amount);

    // Stop future billing on the same subscription unless the caller opted out
    if (cancel_subscription !== false && subscription.streampay_subscription_id) {
      const cancelRes = await fetch(
        `${streamApiBase}/subscriptions/${subscription.streampay_subscription_id}/cancel`,
        {
          method: "POST",
          headers: { "x-api-key": authToken, "Content-Type": "application/json" },
          body: JSON.stringify({ cancel_at_period_end: false }),
        }
      );
      if (!cancelRes.ok) {
        console.error("[StreamPay Refund] Subscription cancel failed:", cancelRes.status, await cancelRes.text());
      }
    }

    await supabase
      .from("invoices")
      .update({ status: "refunded" })
      .eq("id", invoice.id);

    await supabase
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", subscription_id);

    await supabase.from("transactions").insert({
      profile_id: subscription.profile_id,
      type: "refund",
      amount: refundedAmount,
      currency: invoice.currency || "SAR",
      status: "completed",
      description: `استرجاع مبلغ اشتراك ${subscription.plan_name}`,
      reference_type: "subscription",
      reference_id: subscription_id,
      streampay_payment_id: invoice.streampay_payment_id,
    });

    return json({ success: true, refunded_amount: refundedAmount });
  } catch (error) {
    console.error("[StreamPay Refund] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
