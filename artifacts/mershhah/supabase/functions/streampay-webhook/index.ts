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

// StreamPay's payment object exposes the card network used (payment_method:
// MADA/VISA/MASTERCARD/...) but never a fee amount - they don't expose
// processing fees via the API at all. Fetch the network so the fee can be
// looked up from our own editable payment_fee_rates table.
async function fetchStreamPayPaymentMethod(paymentId: string): Promise<string | null> {
  const key = Deno.env.get("STREAMPAY_API_KEY");
  const secret = Deno.env.get("STREAMPAY_API_SECRET");
  if (!key || !secret || !paymentId) return null;
  try {
    const res = await fetch(`https://stream-app-service.streampay.sa/api/v2/payments/${paymentId}`, {
      headers: { "x-api-key": btoa(`${key}:${secret}`) },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.payment_method || null;
  } catch {
    return null;
  }
}

type Financials = {
  paymentMethod: string | null;
  gatewayFee: number;
  gatewayFeeVat: number;
  netAmount: number;
  cogs: number;
  freeGrantSubsidy: number;
  netProfit: number;
};

// Computes the real net profit for one payment: gross amount minus
// StreamPay's processing fee (rate looked up by card network, since
// StreamPay's API doesn't return the fee directly) minus VAT on that fee,
// minus the cost of goods (AI image generation) and, for credit packs, a
// fixed subsidy allocation that funds the free monthly grant.
async function computeFinancials(
  supabase: any,
  grossAmount: number,
  paymentId: string | undefined,
  cogs: number,
  freeGrantSubsidy: number
): Promise<Financials> {
  const paymentMethod = paymentId ? await fetchStreamPayPaymentMethod(paymentId) : null;

  let feePercent = 6.79; // conservative default (card-network rate) if the method is unknown
  let vatPercent = 15;
  if (paymentMethod) {
    const { data: rate } = await supabase
      .from("payment_fee_rates")
      .select("fee_percent, vat_percent")
      .eq("payment_method", paymentMethod)
      .maybeSingle();
    if (rate) {
      feePercent = Number(rate.fee_percent);
      vatPercent = Number(rate.vat_percent);
    }
  }

  const gatewayFee = Math.round(grossAmount * (feePercent / 100) * 100) / 100;
  const gatewayFeeVat = Math.round(gatewayFee * (vatPercent / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - gatewayFee - gatewayFeeVat) * 100) / 100;
  const netProfit = Math.round((netAmount - cogs - freeGrantSubsidy) * 100) / 100;

  return { paymentMethod, gatewayFee, gatewayFeeVat, netAmount, cogs, freeGrantSubsidy, netProfit };
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

const ADMIN_NOTIFICATION_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "ahmedsupsa@gmail.com";

async function sendEmail(to: string, subject: string, html: string) {
  const sndrApiKey = Deno.env.get("SNDR_API_KEY");
  // SNDR's `from` field rejects any display name, Arabic or Latin - bare
  // email only (confirmed live via their validation error). Don't retry this.
  const sndrFromEmail = Deno.env.get("SNDR_FROM_BILLING") || "billing@mershhah.com";
  if (!sndrApiKey) {
    console.error("[StreamPay Webhook] SNDR_API_KEY not configured — skipping email:", subject);
    return;
  }
  try {
    const res = await fetch("https://api.sndr.sh/v1/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sndrApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sndrFromEmail, to: [to], subject, html }),
    });
    if (!res.ok) {
      console.error("[StreamPay Webhook] SNDR send failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[StreamPay Webhook] SNDR send threw:", err);
  }
}

function emailWrap(inner: string) {
  return `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f4f4f5; padding: 40px 16px;">
      <div style="max-width: 440px; margin: 0 auto; background:#ffffff; border-radius: 20px; padding: 36px 28px; border: 1px solid #ececec;">
        <div style="text-align:center; padding-bottom: 22px; margin-bottom: 22px; border-bottom: 1px solid #f0f0f0;">
          <img src="https://www.mershhah.com/logo.jpg" width="44" height="44" alt="مرشح" style="border-radius: 12px; display: inline-block;" />
        </div>
        ${inner}
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #374151; margin: 0 0 2px; font-weight: 700;">فريق مرشح</p>
          <p style="font-size: 11px; color: #9ca3af; margin: 0 0 14px;">نساعدك تدير مطعمك بذكاء</p>
          <p style="font-size: 10px; color: #c1c5cb; margin: 0;">
            <a href="https://mershhah.com" style="color: #9ca3af; text-decoration: none;">mershhah.com</a>
            &nbsp;·&nbsp; © ${new Date().getFullYear()} مرشح
          </p>
        </div>
      </div>
    </div>
  `;
}

function paymentSuccessEmail(customerName: string, itemLabel: string, amount: number) {
  return emailWrap(`
    <div style="width:48px;height:48px;border-radius:14px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:22px;">✅</div>
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">مرحباً ${customerName || ""}،</p>
    <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px;">تم الدفع بنجاح</h2>
    <p style="font-size: 14px; color: #111827; margin: 0 0 4px;">${itemLabel}</p>
    <p style="font-size: 24px; font-weight: 900; color: #111827; margin: 8px 0 20px;">${amount.toLocaleString("ar-SA")} ر.س</p>
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">يمكنك متابعة تفاصيل اشتراكك من لوحة تحكم مرشح.</p>
  `);
}

function adminPaymentNotificationEmail(customerName: string, customerEmail: string, itemLabel: string, amount: number) {
  return emailWrap(`
    <div style="width:48px;height:48px;border-radius:14px;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:22px;">💰</div>
    <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px;">عملية دفع ناجحة جديدة</h2>
    <table style="width:100%; font-size: 13px; color: #111827; border-collapse: collapse;">
      <tr><td style="padding:8px 0; color:#6b7280;">العميل</td><td style="padding:8px 0; font-weight:700;">${customerName || "غير محدد"}</td></tr>
      <tr><td style="padding:8px 0; color:#6b7280;">البريد</td><td style="padding:8px 0; direction:ltr; text-align:right;">${customerEmail}</td></tr>
      <tr><td style="padding:8px 0; color:#6b7280;">البند</td><td style="padding:8px 0; font-weight:700;">${itemLabel}</td></tr>
      <tr><td style="padding:8px 0; color:#6b7280;">المبلغ</td><td style="padding:8px 0; font-weight:900; font-size:16px;">${amount.toLocaleString("ar-SA")} ر.س</td></tr>
    </table>
  `);
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

        // Looked up once and reused by whichever branch below actually runs —
        // both the customer receipt and the admin notification need it.
        let customerName = "";
        let customerEmail = "";
        if (metadata.profile_id) {
          const { data: payingProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", metadata.profile_id)
            .single();
          customerName = payingProfile?.full_name || "";
          customerEmail = payingProfile?.email || "";
        }

        // Tool purchases (streampay-tool-checkout) carry tool_id instead of
        // plan_id — handle activation separately and stop, since none of the
        // subscription/plan bookkeeping below applies to them.
        if (metadata.tool_id && metadata.profile_id) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + Number(metadata.period_months || 1));

          await supabase.from("activated_tools").upsert({
            profile_id: metadata.profile_id,
            tool_id: metadata.tool_id,
            billing_type: "addon",
            period_months: Number(metadata.period_months || 1),
            status: "active",
            activated_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          }, { onConflict: "profile_id,tool_id" });

          if (invoice?.id) {
            await supabase.from("invoices").insert({
              profile_id: metadata.profile_id,
              streampay_invoice_id: invoice.id,
              streampay_payment_id: payment?.id,
              amount: paidAmount,
              currency: "SAR",
              status: "paid",
              description: metadata.description || "شراء أداة",
              paid_at: new Date().toISOString(),
            });
          }

          const toolFinancials = await computeFinancials(supabase, paidAmount, payment?.id, 0, 0);
          await supabase.from("transactions").insert({
            profile_id: metadata.profile_id,
            type: "tool_purchase",
            amount: paidAmount,
            currency: "SAR",
            status: "completed",
            description: metadata.description || "شراء أداة",
            reference_type: "tool",
            reference_id: metadata.tool_id,
            streampay_payment_id: payment?.id,
            payment_method: toolFinancials.paymentMethod,
            gateway_fee: toolFinancials.gatewayFee,
            gateway_fee_vat: toolFinancials.gatewayFeeVat,
            net_amount: toolFinancials.netAmount,
            cogs: toolFinancials.cogs,
            free_grant_subsidy: toolFinancials.freeGrantSubsidy,
            net_profit: toolFinancials.netProfit,
          });

          const toolLabel = metadata.description || "شراء أداة";
          if (customerEmail) {
            await sendEmail(customerEmail, "تم الدفع بنجاح - مرشح", paymentSuccessEmail(customerName, toolLabel, paidAmount));
          }
          await sendEmail(ADMIN_NOTIFICATION_EMAIL, "💰 عملية دفع ناجحة جديدة - مرشح", adminPaymentNotificationEmail(customerName, customerEmail, toolLabel, paidAmount));

          break;
        }

        // Image-enhancement credit-pack purchases (streampay-credits-checkout)
        // carry pack_id + credits instead of tool_id/plan - credit the
        // restaurant's shared balance (capped at 199, matching the free-grant
        // cap in check_image_enhance_usage) and stop.
        if (metadata.pack_id && metadata.credits && metadata.profile_id) {
          const MAX_BALANCE = 199;
          const { data: payingProfile2 } = await supabase
            .from("profiles")
            .select("restaurant_id")
            .eq("id", metadata.profile_id)
            .single();

          if (payingProfile2?.restaurant_id) {
            const { data: restaurantRow } = await supabase
              .from("restaurants")
              .select("image_credits_balance")
              .eq("id", payingProfile2.restaurant_id)
              .single();

            const newBalance = Math.min((restaurantRow?.image_credits_balance || 0) + Number(metadata.credits), MAX_BALANCE);
            await supabase.from("restaurants")
              .update({ image_credits_balance: newBalance })
              .eq("id", payingProfile2.restaurant_id);
          }

          if (invoice?.id) {
            await supabase.from("invoices").insert({
              profile_id: metadata.profile_id,
              streampay_invoice_id: invoice.id,
              streampay_payment_id: payment?.id,
              amount: paidAmount,
              currency: "SAR",
              status: "paid",
              description: metadata.description || "شحن رصيد صور",
              paid_at: new Date().toISOString(),
            });
          }

          // COGS = the real per-image AI cost for the credits actually
          // delivered. free_grant_subsidy = a fixed allocation covering the
          // monthly free grant (5 images x 0.50 SAR), charged against every
          // paid purchase rather than tracked separately.
          const PER_IMAGE_COST = 0.50;
          const FREE_GRANT_SUBSIDY = 5 * PER_IMAGE_COST;
          const creditFinancials = await computeFinancials(
            supabase, paidAmount, payment?.id,
            Number(metadata.credits) * PER_IMAGE_COST,
            FREE_GRANT_SUBSIDY
          );
          await supabase.from("transactions").insert({
            profile_id: metadata.profile_id,
            type: "credit_pack",
            amount: paidAmount,
            currency: "SAR",
            status: "completed",
            description: metadata.description || "شحن رصيد صور",
            reference_type: "credit_pack",
            reference_id: metadata.pack_id,
            streampay_payment_id: payment?.id,
            payment_method: creditFinancials.paymentMethod,
            gateway_fee: creditFinancials.gatewayFee,
            gateway_fee_vat: creditFinancials.gatewayFeeVat,
            net_amount: creditFinancials.netAmount,
            cogs: creditFinancials.cogs,
            free_grant_subsidy: creditFinancials.freeGrantSubsidy,
            net_profit: creditFinancials.netProfit,
          });

          const creditsLabel = metadata.description || "شحن رصيد صور";
          if (customerEmail) {
            await sendEmail(customerEmail, "تم الدفع بنجاح - مرشح", paymentSuccessEmail(customerName, creditsLabel, paidAmount));
          }
          await sendEmail(ADMIN_NOTIFICATION_EMAIL, "💰 عملية دفع ناجحة جديدة - مرشح", adminPaymentNotificationEmail(customerName, customerEmail, creditsLabel, paidAmount));

          break;
        }

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

          // A confirmed StreamPay payment always means an actual paid plan
          // (free never goes through checkout) - flip the flag every paid
          // feature gate reads, and patch the denormalized public_pages
          // snapshot so it doesn't keep showing stale free-tier state.
          const { data: payingProfile } = await supabase
            .from("profiles")
            .select("restaurant_id")
            .eq("id", metadata.profile_id)
            .single();
          if (payingProfile?.restaurant_id) {
            const restaurantId = payingProfile.restaurant_id;
            await supabase.from("restaurants").update({ is_paid_plan: true }).eq("id", restaurantId);

            const { data: restaurantRow } = await supabase
              .from("restaurants")
              .select("username")
              .eq("id", restaurantId)
              .single();
            if (restaurantRow?.username) {
              const { data: publicPageRow } = await supabase
                .from("public_pages")
                .select("data")
                .eq("id", restaurantRow.username)
                .maybeSingle();
              if (publicPageRow?.data) {
                const updatedData = {
                  ...publicPageRow.data,
                  restaurant: { ...publicPageRow.data.restaurant, is_paid_plan: true },
                };
                await supabase
                  .from("public_pages")
                  .update({ data: updatedData, updated_at: new Date().toISOString() })
                  .eq("id", restaurantRow.username);
              }
            }
          }
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
          const subFinancials = await computeFinancials(supabase, paidAmount, payment?.id, 0, 0);
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
            payment_method: subFinancials.paymentMethod,
            gateway_fee: subFinancials.gatewayFee,
            gateway_fee_vat: subFinancials.gatewayFeeVat,
            net_amount: subFinancials.netAmount,
            cogs: subFinancials.cogs,
            free_grant_subsidy: subFinancials.freeGrantSubsidy,
            net_profit: subFinancials.netProfit,
          });
        }

        // Discount is only consumed now that the payment is actually confirmed —
        // a failed or abandoned checkout must not burn the coupon's usage count.
        if (metadata.discount_code_id && metadata.profile_id) {
          await consumeDiscountCode(supabase, metadata.discount_code_id, metadata.profile_id, Number(metadata.discount_amount || 0));
        }

        const planLabel = metadata.description || "اشتراك باقة";
        if (customerEmail) {
          await sendEmail(customerEmail, "تم الدفع بنجاح - مرشح", paymentSuccessEmail(customerName, planLabel, paidAmount));
        }
        await sendEmail(ADMIN_NOTIFICATION_EMAIL, "💰 عملية دفع ناجحة جديدة - مرشح", adminPaymentNotificationEmail(customerName, customerEmail, planLabel, paidAmount));

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
