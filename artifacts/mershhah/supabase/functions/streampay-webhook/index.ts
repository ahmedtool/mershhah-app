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
    const webhookSecret = Deno.env.get("STREAMPAY_WEBHOOK_SECRET") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("X-Webhook-Signature") || "";
    const eventType = req.headers.get("X-Webhook-Event") || "";
    const entityId = req.headers.get("X-Webhook-Entity-ID") || "";

    console.log(`[StreamPay Webhook] Event: ${eventType}, Entity: ${entityId}`);

    const payload = JSON.parse(body);

    switch (eventType) {
      case "PAYMENT_SUCCEEDED": {
        const payment = payload.data?.payment;
        const invoice = payload.data?.invoice;
        const metadata = payload.data?.metadata || {};

        // Update invoice status
        if (invoice?.id) {
          await supabase
            .from("invoices")
            .update({
              status: "paid",
              streampay_payment_id: payment?.id,
              paid_at: new Date().toISOString(),
            })
            .eq("streampay_invoice_id", invoice.id);
        }

        // Update subscription if exists
        const subscriptionId = metadata.subscription_id || invoice?.subscription_id;
        if (subscriptionId) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("streampay_subscription_id", subscriptionId);
        }

        // Create transaction record
        if (metadata.profile_id) {
          await supabase.from("transactions").insert({
            profile_id: metadata.profile_id,
            type: "subscription",
            amount: parseFloat(payment?.amount || "0"),
            currency: "SAR",
            status: "completed",
            description: metadata.description || "اشتراك باقة",
            reference_type: "subscription",
            reference_id: subscriptionId,
            streampay_payment_id: payment?.id,
          });
        }

        break;
      }

      case "PAYMENT_FAILED": {
        const payment = payload.data?.payment;
        const metadata = payload.data?.metadata || {};

        if (metadata.profile_id) {
          await supabase.from("transactions").insert({
            profile_id: metadata.profile_id,
            type: "subscription",
            amount: parseFloat(payment?.amount || "0"),
            currency: "SAR",
            status: "failed",
            description: "فشل الدفع",
            streampay_payment_id: payment?.id,
            metadata: { error: payload.data?.error },
          });
        }
        break;
      }

      case "SUBSCRIPTION_CREATED":
      case "SUBSCRIPTION_ACTIVATED": {
        const subscription = payload.data?.subscription;
        const metadata = payload.data?.metadata || {};

        if (subscription && metadata.profile_id) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              streampay_subscription_id: subscription.id,
              next_billing_date: subscription.current_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("profile_id", metadata.profile_id)
            .eq("status", "pending");
        }
        break;
      }

      case "SUBSCRIPTION_CANCELED":
      case "SUBSCRIPTION_INACTIVATED": {
        const subscription = payload.data?.subscription;
        if (subscription) {
          await supabase
            .from("subscriptions")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("streampay_subscription_id", subscription.id);
        }
        break;
      }

      case "SUBSCRIPTION_CYCLE_RENEWAL_FAILED": {
        const subscription = payload.data?.subscription;
        if (subscription) {
          await supabase
            .from("subscriptions")
            .update({
              status: "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("streampay_subscription_id", subscription.id);
        }
        break;
      }

      default:
        console.log(`[StreamPay Webhook] Unhandled event: ${eventType}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[StreamPay Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
