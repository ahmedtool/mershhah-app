import { Router, type IRouter } from "express";

const router: IRouter = Router();

const STREAMPAY_BASE = process.env.STREAMPAY_BASE_URL || "https://stream-app-service.streampay.sa/api/v2";

function getApiKey(): string {
  const key = process.env.STREAMPAY_API_KEY;
  const secret = process.env.STREAMPAY_API_SECRET;
  if (!key || !secret) {
    throw new Error("StreamPay API keys not configured");
  }
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

function streamPayHeaders() {
  return {
    "x-api-key": getApiKey(),
    "Content-Type": "application/json",
  };
}

// POST /api/checkout/create-payment-link
router.post("/checkout/create-payment-link", async (req, res) => {
  try {
    const {
      plan_id,
      plan_name,
      plan_price,
      duration_months,
      customer_name,
      customer_email,
      customer_phone,
      discount_code,
      discount_amount,
    } = req.body;

    if (!plan_id || !plan_name || !plan_price) {
      res.status(400).json({ error: "Missing required fields: plan_id, plan_name, plan_price" });
      return;
    }

    // 1. Create or find consumer
    let consumerId: string | undefined;

    if (customer_email || customer_phone) {
      try {
        // Try to find existing consumer first
        const listUrl = new URL(`${STREAMPAY_BASE}/consumers`);
        if (customer_email) listUrl.searchParams.append("email", customer_email);
        if (customer_phone) listUrl.searchParams.append("phone_number", customer_phone);

        const listRes = await fetch(listUrl.toString(), {
          headers: streamPayHeaders(),
        });

        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.data && listData.data.length > 0) {
            consumerId = listData.data[0].id;
          }
        }
      } catch {
        // Ignore lookup errors, we'll create a new consumer
      }

      // Create consumer if not found
      if (!consumerId) {
        const consumerPayload: Record<string, any> = {
          name: customer_name || "عميل مرشح",
          communication_methods: ["EMAIL", "SMS"],
        };
        if (customer_email) consumerPayload.email = customer_email;
        if (customer_phone) consumerPayload.phone_number = customer_phone;
        consumerPayload.external_id = `mershhah_${Date.now()}`;

        const consumerRes = await fetch(`${STREAMPAY_BASE}/consumers`, {
          method: "POST",
          headers: streamPayHeaders(),
          body: JSON.stringify(consumerPayload),
        });

        if (consumerRes.ok) {
          const consumerData = await consumerRes.json();
          consumerId = consumerData.id;
        }
      }
    }

    // 2. Calculate final amount
    const finalAmount = Math.max(0, (plan_price || 0) - (discount_amount || 0));

    // 3. Create payment link
    const paymentLinkPayload: Record<string, any> = {
      name: `اشتراك ${plan_name} - مرشح`,
      description: `باقة ${plan_name} لمدة ${duration_months || 1} ${duration_months === 12 ? 'سنة' : duration_months > 1 ? 'أشهر' : 'شهر'}`,
      items: [
        {
          product_id: plan_id,
          quantity: 1,
        },
      ],
      contact_information_type: "PHONE",
      currency: "SAR",
      max_number_of_payments: 1,
      success_redirect_url: `${req.headers.origin || "http://localhost:5173"}/success`,
      failure_redirect_url: `${req.headers.origin || "http://localhost:5173"}/failure`,
      custom_metadata: {
        plan_id,
        plan_name,
        original_price: String(plan_price),
        discount_code: discount_code || "",
        discount_amount: String(discount_amount || 0),
        final_amount: String(finalAmount),
        source: "mershhah_checkout",
      },
    };

    if (consumerId) {
      paymentLinkPayload.organization_consumer_id = consumerId;
    }

    const paymentRes = await fetch(`${STREAMPAY_BASE}/payment_links`, {
      method: "POST",
      headers: streamPayHeaders(),
      body: JSON.stringify(paymentLinkPayload),
    });

    if (!paymentRes.ok) {
      const errorData = await paymentRes.json().catch(() => ({}));
      console.error("StreamPay payment link error:", errorData);
      res.status(paymentRes.status).json({
        error: "Failed to create payment link",
        details: errorData,
      });
      return;
    }

    const paymentData = await paymentRes.json();

    res.json({
      url: paymentData.url,
      id: paymentData.id,
      status: paymentData.status,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// GET /api/checkout/verify/:invoiceId
router.get("/checkout/verify/:invoiceId", async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoiceRes = await fetch(`${STREAMPAY_BASE}/invoices/${invoiceId}`, {
      headers: streamPayHeaders(),
    });

    if (!invoiceRes.ok) {
      res.status(invoiceRes.status).json({ error: "Failed to verify invoice" });
      return;
    }

    const invoice = await invoiceRes.json();

    res.json({
      id: invoice.id,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      subscription_id: invoice.subscription_id,
      payments: invoice.payments,
    });
  } catch (error: any) {
    console.error("Verify error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
