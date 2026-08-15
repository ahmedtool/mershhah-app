import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-initiated request for temporary, owner-approved access to a
// restaurant's real dashboard (support use case). Creates a pending row in
// impersonation_requests and emails the owner to go approve/deny it from
// their own dashboard - never a link that grants access by itself.

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (adminProfile?.role !== "admin") return json({ error: "forbidden" }, 403);

    const { restaurantId, reason } = await req.json();
    if (!restaurantId) return json({ error: "restaurantId required" }, 400);

    const { data: existing } = await supabase
      .from("impersonation_requests")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("admin_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return json({ request: existing, alreadyPending: true });

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, owner_id, name")
      .eq("id", restaurantId)
      .single();
    if (!restaurant) return json({ error: "restaurant not found" }, 404);

    const { data: inserted, error: insertError } = await supabase
      .from("impersonation_requests")
      .insert({ admin_id: user.id, restaurant_id: restaurantId, reason: reason || null, status: "pending" })
      .select()
      .single();
    if (insertError) return json({ error: insertError.message }, 500);

    const sndrApiKey = Deno.env.get("SNDR_API_KEY");
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", restaurant.owner_id)
      .single();

    if (sndrApiKey && ownerProfile?.email) {
      const adminName = adminProfile.full_name || "فريق مرشح";
      const html = `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f4f4f5; padding: 40px 16px;">
          <div style="max-width: 440px; margin: 0 auto; background:#ffffff; border-radius: 20px; padding: 36px 28px; border: 1px solid #ececec;">
            <div style="text-align:center; padding-bottom: 22px; margin-bottom: 22px; border-bottom: 1px solid #f0f0f0;">
              <img src="https://www.mershhah.com/logo.jpg" width="44" height="44" alt="مرشح" style="border-radius: 12px; display: inline-block;" />
            </div>
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">مرحباً ${ownerProfile.full_name || ""}،</p>
            <p style="font-size: 14px; color: #111827; margin: 0 0 8px;"><b>${adminName}</b> من فريق دعم مرشح يطلب دخول مؤقت للوحة تحكم "${restaurant.name}" للمساعدة.</p>
            ${reason ? `<p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">السبب: ${reason}</p>` : ""}
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">افتح لوحة تحكمك وراح تشوف طلب الموافقة فوق. لو وافقت، يقدر يدخل حسابك لمدة ٢٤ ساعة بس.</p>
            <a href="https://www.mershhah.com/owner/dashboard" style="display:block;text-align:center;background:#111827;color:#fff;text-decoration:none;font-weight:900;font-size:14px;border-radius:12px;padding:14px;margin:20px 0;">فتح لوحة التحكم</a>
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">إذا ما توقعت هذا الطلب، تجاهله أو ارفضه من لوحة تحكمك.</p>
            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
              <p style="font-size: 13px; color: #374151; margin: 0 0 2px; font-weight: 700;">فريق مرشح</p>
              <p style="font-size: 10px; color: #c1c5cb; margin: 14px 0 0;">
                <a href="https://mershhah.com" style="color: #9ca3af; text-decoration: none;">mershhah.com</a>
                &nbsp;·&nbsp; © ${new Date().getFullYear()} مرشح
              </p>
            </div>
          </div>
        </div>
      `;
      await fetch("https://api.sndr.sh/v1/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sndrApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Mershhah <${Deno.env.get("SNDR_FROM_AUTH") || "auth@mershhah.com"}>`,
          to: [ownerProfile.email],
          subject: "طلب دخول مؤقت لحسابك - مرشح",
          html,
        }),
      }).catch((e) => console.error("[request-owner-access] notify failed:", e));
    }

    return json({ request: inserted });
  } catch (error) {
    console.error("[request-owner-access] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
