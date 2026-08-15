import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Consumes an approved, unexpired impersonation_requests row and mints a
// real session as the restaurant owner (via the Admin API's magic-link
// generation), so the admin dashboard's "enter now" opens the actual owner
// dashboard in a new tab - the admin's own tab/session is untouched.

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

    const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (adminProfile?.role !== "admin") return json({ error: "forbidden" }, 403);

    const { requestId } = await req.json();
    if (!requestId) return json({ error: "requestId required" }, 400);

    const { data: request } = await supabase
      .from("impersonation_requests")
      .select("*")
      .eq("id", requestId)
      .eq("admin_id", user.id)
      .single();
    if (!request) return json({ error: "الطلب غير موجود" }, 404);
    if (request.status !== "approved") return json({ error: "الطلب غير معتمد بعد" }, 403);
    if (!request.expires_at || new Date(request.expires_at) < new Date()) {
      await supabase.from("impersonation_requests").update({ status: "expired" }).eq("id", requestId);
      return json({ error: "انتهت صلاحية هذا الدخول" }, 403);
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("owner_id")
      .eq("id", request.restaurant_id)
      .single();
    if (!restaurant?.owner_id) return json({ error: "المطعم غير موجود" }, 404);

    const { data: ownerProfile } = await supabase.from("profiles").select("email").eq("id", restaurant.owner_id).single();
    if (!ownerProfile?.email) return json({ error: "بريد صاحب المطعم غير موجود" }, 500);

    // impersonation_grant on the redirect lets OtpGate recognize this
    // session came from an owner-approved entry and skip the OTP prompt -
    // the owner's explicit approval already outranks a 4-digit email code,
    // and the admin has no way to receive a code sent to the owner's inbox.
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.mershhah.com";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: ownerProfile.email,
      options: { redirectTo: `${siteUrl}/owner/dashboard?impersonation_grant=${requestId}` },
    });
    if (linkError) return json({ error: linkError.message }, 500);

    await supabase
      .from("impersonation_requests")
      .update({ entered_at: new Date().toISOString(), entry_count: (request.entry_count || 0) + 1 })
      .eq("id", requestId);

    return json({ actionLink: linkData.properties.action_link });
  } catch (error) {
    console.error("[enter-owner-account] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
