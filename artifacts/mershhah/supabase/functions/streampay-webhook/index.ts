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

async function fetchStreamPayAmount(path: string): Promise<number> {
  const key = Deno.env.get("STREAMPAY_API_KEY");
  const secret = Deno.env.get("STREAMPAY_API_SECRET");
  if (!key || !secret) return NaN;
  try {
    const res = await fetch(`https://stream-app-service.streampay.sa/api/v2${path}`, {
      headers: { "x-api-key": btoa(`${key}:${secret}`) },
    });
    if (!res.ok) return NaN;
    const data = await res.json();
    return Number(data?.amount);
  } catch {
    return NaN;
  }
}

// Every signup is auto-enrolled in the free plan as "active". Once a paid
// plan actually activates, that free row must stop being active too —
// otherwise the profile ends up with two simultaneously "active"
// subscriptions, which confuses admin reporting and re-blocks future
// upgrades (the checkout guard only exempts the free plan, not a mix).
async function supersedeFreePlan(supabase: any, profileId: string, keepSubscriptionId: string | null) {
  let query = supabase
    .from("subscriptions")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("plan_id", "free")
    .eq("status", "active");
  if (keepSubscriptionId) query = query.neq("id", keepSubscriptionId);
  await query;
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

        // The webhook payload only includes {id, url} for payment/invoice —
        // the actual amount isn't in it, so fetch the authoritative figure.
        let paidAmount = Number(payment?.amount);
        if (!Number.isFinite(paidAmount) && payment?.id) {
          paidAmount = await fetchStreamPayAmount(`/payments/${payment.id}`);
        }
        if (!Number.isFinite(paidAmount)) paidAmount = 0;

        // Activate the pending subscription created by streampay-checkout for
        // this profile. StreamPay doesn't echo our local subscription id back,
        // so this matches the same way SUBSCRIPTION_CREATED/ACTIVATED does below.
        let subscriptionId: string | null = null;
        if (metadata.profile_id) {
          const { data: updatedSub } = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("profile_id", metadata.profile_id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();
          subscriptionId = updatedSub?.id ?? null;
          if (subscriptionId) await supersedeFreePlan(supabase, metadata.profile_id, subscriptionId);
        }

        // Record the invoice. There's nothing to update yet (checkout never
        // creates the row up front), so insert it directly here.
        if (invoice?.id && metadata.profile_id) {
          await supabase.from("invoices").insert({
            profile_id: metadata.profile_id,
            subscription_id: subscriptionId,
            streampay_invoice_id: invoice.id,
            streampay_payment_id: payment?.id,
            amount: paidAmount,
            currency: "SAR",
            status: "paid",
            description: metadata.description || "اشتراك باقة",
            billing_period: metadata.billing_cycle,
            paid_at: new Date().toISOString(),
          });
        }

        // Create transaction record
        if (metadata.profile_id) {
          await supabase.from("transactions").insert({
            profile_id: metadata.profile_id,
            type: "subscription",
            amount: paidAmount,
            currency: "SAR",
            status: "completed",
            description: metadata.description || "اشتراك باقة",
            reference_type: "subscription",
            reference_id: subscriptionId,
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
          await supersedeFreePlan(supabase, metadata.profile_id, null);
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
