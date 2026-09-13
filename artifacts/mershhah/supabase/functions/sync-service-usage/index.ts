import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pulls real numbers for the services that actually have something to fetch
// (see the "استهلاك الخدمات" plan) and upserts them into service_usage -
// StreamPay and SNDR need no external call at all (both computed from our
// own tables), Mistral and Cloudflare each need one secret set as an Edge
// Function secret by the admin directly (never passed through chat/code).
// A missing secret just skips that one service instead of failing the sync.
type SyncResult = { service: string; status: "synced" | "skipped" | "failed"; detail?: string };

async function upsertUsage(
  supabase: any,
  serviceKey: string,
  fields: Partial<{
    plan: string | null;
    usage_value: number | null;
    usage_unit: string | null;
    limit_value: number | null;
    limit_unit: string | null;
    cost_sar: number | null;
    billing_cycle: string | null;
    notes: string | null;
  }>
) {
  const patch: Record<string, unknown> = { service_key: serviceKey, updated_at: new Date().toISOString(), updated_by: null, ...fields };

  // None of these providers expose a real quota/limit - if an admin typed
  // one in manually via the edit dialog, a sync that has nothing to report
  // for limit_value/limit_unit must not silently wipe it back to null.
  if (!("limit_value" in fields) || !("limit_unit" in fields)) {
    const { data: existing } = await supabase.from("service_usage").select("limit_value, limit_unit").eq("service_key", serviceKey).maybeSingle();
    if (existing) {
      if (!("limit_value" in fields)) patch.limit_value = existing.limit_value;
      if (!("limit_unit" in fields)) patch.limit_unit = existing.limit_unit;
    }
  }

  const { error } = await supabase.from("service_usage").upsert(patch, { onConflict: "service_key" });
  if (error) throw error;
}

async function syncStreamPay(supabase: any): Promise<SyncResult> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabase
      .from("transactions")
      .select("amount, gateway_fee, gateway_fee_vat, status")
      .eq("status", "completed")
      .gte("created_at", monthStart);
    if (error) throw error;

    const rows = data || [];
    const txCount = rows.length;
    const totalFees = rows.reduce((sum: number, r: any) => sum + (Number(r.gateway_fee) || 0) + (Number(r.gateway_fee_vat) || 0), 0);

    await upsertUsage(supabase, "streampay", {
      plan: "Pay-per-transaction",
      usage_value: txCount,
      usage_unit: "معاملة هذا الشهر",
      cost_sar: Math.round(totalFees * 100) / 100,
      billing_cycle: "شهري",
      notes: "الرسوم = مجموع عمولة البوابة + ضريبتها لهذا الشهر، من جدول transactions مباشرة (بدون أي API خارجي).",
    });
    return { service: "streampay", status: "synced" };
  } catch (err: any) {
    return { service: "streampay", status: "failed", detail: err.message };
  }
}

async function syncMistral(supabase: any): Promise<SyncResult> {
  const apiKey = Deno.env.get("MISTRAL_ADMIN_API_KEY");
  if (!apiKey) return { service: "mistral", status: "skipped", detail: "MISTRAL_ADMIN_API_KEY not set" };

  try {
    const now = new Date();
    const res = await fetch(`https://api.mistral.ai/v1/admin/usage?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`Mistral API returned ${res.status}: ${await res.text()}`);
    const data = await res.json();

    // Response shape isn't fully documented publicly - try the obvious
    // total field first, else sum whatever numeric category costs are
    // present, and always keep the raw payload in notes so a wrong guess
    // here is still visible/fixable from the admin page rather than silent.
    let total: number | null = typeof data.total_cost === "number" ? data.total_cost : null;
    if (total === null && data && typeof data === "object") {
      const categories = ["chat", "completion", "ocr", "audio", "connectors", "libraries_api", "fine_tuning", "vibe_usage"];
      const found = categories.map((c) => data[c]?.cost ?? data[c]?.total_cost ?? data[c]).filter((v) => typeof v === "number");
      if (found.length > 0) total = found.reduce((a: number, b: number) => a + b, 0);
    }

    await upsertUsage(supabase, "mistral", {
      plan: "Usage-based",
      usage_value: total,
      usage_unit: data.currency || "USD",
      cost_sar: null,
      billing_cycle: "شهري",
      notes: `آخر استجابة خام من Mistral Admin API: ${JSON.stringify(data).slice(0, 500)}`,
    });
    return { service: "mistral", status: "synced" };
  } catch (err: any) {
    return { service: "mistral", status: "failed", detail: err.message };
  }
}

async function syncCloudflare(supabase: any): Promise<SyncResult> {
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zoneName = Deno.env.get("CLOUDFLARE_ZONE_NAME") || "mershhah.com";
  if (!token) return { service: "cloudflare", status: "skipped", detail: "CLOUDFLARE_API_TOKEN not set" };

  try {
    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${zoneName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const zoneData = await zoneRes.json();
    const zoneId = zoneData?.result?.[0]?.id;
    if (!zoneId) throw new Error(`No Cloudflare zone found for ${zoneName}`);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(limit: 31, filter: { date_geq: "${monthStart}", date_leq: "${today}" }) {
              sum { requests }
            }
          }
        }
      }
    `;
    const gqlRes = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const gqlData = await gqlRes.json();
    if (gqlData.errors?.length) throw new Error(JSON.stringify(gqlData.errors));

    const groups = gqlData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    const totalRequests = groups.reduce((sum: number, g: any) => sum + (g.sum?.requests || 0), 0);

    await upsertUsage(supabase, "cloudflare", {
      plan: "Free",
      usage_value: totalRequests,
      usage_unit: "طلب هذا الشهر",
      cost_sar: 0,
      billing_cycle: "شهري",
      notes: "الخطة المجانية عادة بدون حد صارم لعدد الطلبات - الرقم هنا للمتابعة فقط.",
    });
    return { service: "cloudflare", status: "synced" };
  } catch (err: any) {
    return { service: "cloudflare", status: "failed", detail: err.message };
  }
}

// SNDR has no public usage/quota API (confirmed - their docs aren't even
// crawlable). Instead this counts what WE logged ourselves in email_log,
// written by every edge function that sends through SNDR (except the raw
// auth-send-email hook, deliberately left uninstrumented - see its own
// comment). Zero external calls, same pattern as StreamPay.
async function syncSndr(supabase: any): Promise<SyncResult> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabase
      .from("email_log")
      .select("status")
      .eq("status", "sent")
      .gte("created_at", monthStart);
    if (error) throw error;

    await upsertUsage(supabase, "sndr", {
      plan: "—",
      usage_value: (data || []).length,
      usage_unit: "إيميل هذا الشهر",
      cost_sar: 0,
      billing_cycle: "شهري",
      notes: "العدد من سجلنا الداخلي (email_log) لكل الإيميلات اللي أرسلناها عبر SNDR هذا الشهر - عدا إيميلات auth-send-email (تأكيد الحساب، استعادة كلمة المرور...) غير مسجّلة حاليًا.",
    });
    return { service: "sndr", status: "synced" };
  } catch (err: any) {
    return { service: "sndr", status: "failed", detail: err.message };
  }
}

async function syncImageKit(supabase: any): Promise<SyncResult> {
  const privateKey = Deno.env.get("IMAGEKIT_PRIVATE_KEY");
  if (!privateKey) return { service: "imagekit", status: "skipped", detail: "IMAGEKIT_PRIVATE_KEY not set" };

  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 1); // ImageKit's range excludes the end date itself
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const credentials = btoa(`${privateKey}:`);
    const res = await fetch(
      `https://api.imagekit.io/v1/accounts/usage?startDate=${fmt(start)}&endDate=${fmt(end)}`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );
    if (!res.ok) throw new Error(`ImageKit API returned ${res.status}: ${await res.text()}`);
    const data = await res.json();

    // Field names aren't independently verified against a live account -
    // try the documented ones, keep the raw payload in notes either way.
    const bandwidthBytes = data.bandwidthBytes ?? data.bandwidth ?? null;
    const storageBytes = data.mediaLibraryStorageBytes ?? data.storage ?? null;
    const bandwidthGB = typeof bandwidthBytes === "number" ? Math.round((bandwidthBytes / 1024 / 1024 / 1024) * 100) / 100 : null;

    await upsertUsage(supabase, "imagekit", {
      plan: "—",
      usage_value: bandwidthGB,
      usage_unit: "GB نقل بيانات هذا الشهر",
      cost_sar: null,
      billing_cycle: "شهري",
      notes: `تخزين الوسائط: ${typeof storageBytes === "number" ? Math.round((storageBytes / 1024 / 1024 / 1024) * 100) / 100 + " GB" : "غير معروف"}. آخر استجابة خام: ${JSON.stringify(data).slice(0, 400)}`,
    });
    return { service: "imagekit", status: "synced" };
  } catch (err: any) {
    return { service: "imagekit", status: "failed", detail: err.message };
  }
}

// Supabase itself exposes a project-level Prometheus metrics endpoint
// (undocumented for anything beyond Postgres internals). Verified live on
// 2026-09-13 against this exact project: only pg_database_size_bytes is
// present - there is NO metric anywhere in the ~200-line dump for Storage,
// Egress, Cached Egress, Edge Function invocations, MAU, or Realtime
// message/connection counts. Those 7 stay dashboard-only; only DB size is
// automated here. Uses the platform-provided SUPABASE_SERVICE_ROLE_KEY
// secret that's already available to every Edge Function - no new secret
// needed.
async function syncSupabase(supabase: any): Promise<SyncResult> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const credentials = btoa(`service_role:${serviceRoleKey}`);

    const res = await fetch(`${supabaseUrl}/customer/v1/privileged/metrics`, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!res.ok) throw new Error(`Supabase metrics endpoint returned ${res.status}`);
    const text = await res.text();

    const lines = text.split("\n").filter((l) => l.startsWith("pg_database_size_bytes{"));
    if (lines.length === 0) throw new Error("pg_database_size_bytes metric not found in response");

    let totalBytes = 0;
    for (const line of lines) {
      const match = line.match(/}\s+([0-9.eE+-]+)\s*$/);
      if (match) totalBytes += parseFloat(match[1]);
    }

    const dbSizeGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 1000) / 1000;

    await upsertUsage(supabase, "supabase", {
      plan: "Free",
      usage_value: dbSizeGB,
      usage_unit: "GB قاعدة البيانات",
      limit_value: 0.5,
      limit_unit: "GB",
      cost_sar: 0,
      billing_cycle: "شهري",
      notes: "تلقائي: حجم قاعدة البيانات فقط (المصدر الوحيد المتاح فعليًا عبر Supabase Metrics API). باقي المؤشرات (Storage، Egress، Cached Egress، Edge Functions، MAU، Realtime) غير موجودة إطلاقًا في هذا الـ API — تحديثها يبقى يدويًا من لوحة Supabase.",
    });
    return { service: "supabase", status: "synced" };
  } catch (err: any) {
    return { service: "supabase", status: "failed", detail: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all([syncStreamPay(admin), syncMistral(admin), syncCloudflare(admin), syncSndr(admin), syncImageKit(admin), syncSupabase(admin)]);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
