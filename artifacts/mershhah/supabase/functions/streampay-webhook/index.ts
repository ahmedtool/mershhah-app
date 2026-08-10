import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// StreamPay signs each webhook as `X-Webhook-Signature: t={timestamp},v1={hex hmac}`
// where hmac = HMAC-SHA256(`${timestamp}.${rawBody}`, webhookSecret).
// https://docs.streampay.sa/webhooks
async function verifyStreamPaySignature(secret: string, rawBody: string, signatureHeader: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject stale/replayed signatures (5 minute tolerance)
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function consumeDiscountCode(supabase: any, discountCodeId: string, profileId: string, discountAmount: number) {
  const { error: rpcError } = await supabase.rpc("increment_discount_usage", { code_id: discountCodeId });
  if (rpcError) {
    console.error("[StreamPay Webhook] Failed to increment discount usage:", rpcError);
  }
  await supabase.from("discount_code_usage").insert({
    discount_code_id: discountCodeId,
    profile_id: profileId,
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
    const webhookSecret = Deno.env.get("STREAMPAY_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("[StreamPay Webhook] STREAMPAY_WEBHOOK_SECRET is not configured — refusing to process webhook");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signatureHeader = req.headers.get("X-Webhook-Signature") || "";
    const eventType = req.headers.get("X-Webhook-Event") || "";
    const entityId = req.headers.get("X-Webhook-Entity-ID") || "";

    const isValid = await verifyStreamPaySignature(webhookSecret, body, signatureHeader);
    if (!isValid) {
      console.error("[StreamPay Webhook] Rejected: invalid or missing signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

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

        // Activate the pending subscription created by streampay-checkout for
        // this profile. StreamPay doesn't echo our local subscription id back,
        // so this matches the same way SUBSCRIPTION_CREATED/ACTIVATED does below.
        if (metadata.profile_id) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("profile_id", metadata.profile_id)
            .eq("status", "pending");
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
            streampay_payment_id: payment?.id,
          });
        }

        // Discount is only consumed now that the payment is actually confirmed —
        // a failed or abandoned checkout must not burn the coupon's usage count.
        if (metadata.discount_code_id && metadata.profile_id) {
          await consumeDiscountCode(supabase, metadata.discount_code_id, metadata.profile_id, Number(metadata.discount_amount || 0));
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
