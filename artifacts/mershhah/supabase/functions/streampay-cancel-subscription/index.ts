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

// Cancels a subscription without a refund (the admin "toggle off" action -
// distinct from streampay-refund, which always refunds a specific paid
// invoice). This still has to notify StreamPay so the recurring charge
// actually stops - flipping only our own `subscriptions.status` (as the
// admin orders page used to do) left StreamPay's side of a real paid
// subscription running, so the customer kept getting billed after the
// admin had already "cancelled" and revoked their access.
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only admins can cancel a subscription this way
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

    const { subscription_id } = await req.json();
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

    // Only a real StreamPay recurring subscription needs the gateway call -
    // a free-plan row, a manually-created one, or one that never activated
    // has nothing to stop on StreamPay's side.
    if (subscription.streampay_subscription_id) {
      if (!streamApiKey || !streamApiSecret) {
        return json({ error: "Payment gateway not configured" }, 500);
      }
      const authToken = btoa(`${streamApiKey}:${streamApiSecret}`);
      const cancelRes = await fetch(
        `${streamApiBase}/subscriptions/${subscription.streampay_subscription_id}/cancel`,
        {
          method: "POST",
          headers: { "x-api-key": authToken, "Content-Type": "application/json" },
          body: JSON.stringify({ cancel_at_period_end: false }),
        }
      );
      if (!cancelRes.ok) {
        const cancelBody = await cancelRes.text();
        console.error("[StreamPay Cancel] Failed:", cancelRes.status, cancelBody);
        return json({ error: `Failed to cancel at gateway: ${cancelBody}` }, 500);
      }
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled", cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .eq("id", subscription_id);
    if (updateError) throw updateError;

    return json({ success: true });
  } catch (error) {
    console.error("[StreamPay Cancel] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
