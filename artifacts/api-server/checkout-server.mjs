import http from "node:http";

const STREAMPAY_BASE = process.env.STREAMPAY_BASE_URL || "https://stream-app-service.streampay.sa/api/v2";

function getApiKey() {
  const key = process.env.STREAMPAY_API_KEY;
  const secret = process.env.STREAMPAY_API_SECRET;
  if (!key || !secret) throw new Error("StreamPay API keys not configured");
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

function streamHeaders() {
  return { "x-api-key": getApiKey(), "Content-Type": "application/json" };
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/api/health" && req.method === "GET") {
    return jsonResponse(res, 200, { status: "ok", service: "mershhah-checkout" });
  }

  if (req.url === "/api/checkout/create-payment-link" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { plan_id, plan_name, plan_price, duration_months, customer_name, customer_email, customer_phone, discount_code, discount_amount } = body;

      if (!plan_id || !plan_name || !plan_price) {
        return jsonResponse(res, 400, { error: "Missing required fields" });
      }

      let consumerId = undefined;
      if (customer_email || customer_phone) {
        try {
          const listUrl = new URL(`${STREAMPAY_BASE}/consumers`);
          if (customer_email) listUrl.searchParams.append("email", customer_email);
          if (customer_phone) listUrl.searchParams.append("phone_number", customer_phone);
          const lr = await fetch(listUrl.toString(), { headers: streamHeaders() });
          if (lr.ok) {
            const ld = await lr.json();
            if (ld.data && ld.data.length > 0) consumerId = ld.data[0].id;
          }
        } catch {}

        if (!consumerId) {
          const cp = { name: customer_name || "عميل مرشح", communication_methods: ["EMAIL", "SMS"] };
          if (customer_email) cp.email = customer_email;
          if (customer_phone) cp.phone_number = customer_phone;
          cp.external_id = "mershhah_" + Date.now();
          const cr = await fetch(`${STREAMPAY_BASE}/consumers`, { method: "POST", headers: streamHeaders(), body: JSON.stringify(cp) });
          if (cr.ok) { const cd = await cr.json(); consumerId = cd.id; }
        }
      }

      const finalAmount = Math.max(0, (plan_price || 0) - (discount_amount || 0));
      const origin = req.headers.origin || "http://localhost:5173";

      const pl = {
        name: "اشتراك " + plan_name + " - مرشح",
        description: "باقة " + plan_name + " لمدة " + (duration_months || 1) + " " + (duration_months === 12 ? "سنة" : duration_months > 1 ? "أشهر" : "شهر"),
        items: [{ product_id: plan_id, quantity: 1 }],
        contact_information_type: "PHONE",
        currency: "SAR",
        max_number_of_payments: 1,
        success_redirect_url: origin + "/success",
        failure_redirect_url: origin + "/failure",
        custom_metadata: { plan_id, plan_name, original_price: String(plan_price), discount_code: discount_code || "", discount_amount: String(discount_amount || 0), final_amount: String(finalAmount), source: "mershhah_checkout" },
      };
      if (consumerId) pl.organization_consumer_id = consumerId;

      const pr = await fetch(`${STREAMPAY_BASE}/payment_links`, { method: "POST", headers: streamHeaders(), body: JSON.stringify(pl) });

      if (!pr.ok) {
        const err = await pr.json().catch(function() { return {}; });
        console.error("StreamPay error:", pr.status, JSON.stringify(err));
        return jsonResponse(res, pr.status, { error: "Failed to create payment link", details: err });
      }

      const pd = await pr.json();
      console.log("Payment link created:", pd.id);
      return jsonResponse(res, 200, { url: pd.url, id: pd.id, status: pd.status });
    } catch (e) {
      console.error("Checkout error:", e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  jsonResponse(res, 404, { error: "Not found" });
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
  console.log("");
  console.log("  ✅ Checkout API running on http://localhost:" + PORT);
  console.log("  StreamPay: " + STREAMPAY_BASE);
  console.log("  Keys: " + (process.env.STREAMPAY_API_KEY ? "configured ✓" : "MISSING ✗"));
  console.log("");
});
