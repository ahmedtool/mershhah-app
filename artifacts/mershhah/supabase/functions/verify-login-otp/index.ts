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

const MAX_ATTEMPTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return json({ error: "code is required" }, 400);
    }

    const { data: otpRow, error: fetchError } = await supabase
      .from("login_otp_codes")
      .select("*")
      .eq("profile_id", user.id)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!otpRow) {
      return json({ verified: false, error: "لم يتم إرسال كود بعد. اطلب كوداً جديداً." }, 400);
    }

    if (new Date(otpRow.expires_at) < new Date()) {
      return json({ verified: false, error: "انتهت صلاحية الكود. اطلب كوداً جديداً." }, 400);
    }

    if (otpRow.attempts >= MAX_ATTEMPTS) {
      return json({ verified: false, error: "تجاوزت عدد المحاولات المسموح. اطلب كوداً جديداً." }, 429);
    }

    if (otpRow.code !== code.trim()) {
      await supabase
        .from("login_otp_codes")
        .update({ attempts: otpRow.attempts + 1 })
        .eq("id", otpRow.id);
      const remaining = MAX_ATTEMPTS - (otpRow.attempts + 1);
      return json({ verified: false, error: `كود غير صحيح${remaining > 0 ? ` — باقي ${remaining} محاولات` : ""}` }, 400);
    }

    const verifiedAt = new Date().toISOString();
    await supabase
      .from("login_otp_codes")
      .update({ verified_at: verifiedAt })
      .eq("id", otpRow.id);

    // Feeds the custom access token hook, which stamps an `otp_ok` claim
    // into the JWT on the next token refresh - this is what RLS actually
    // checks server-side. Without this, "verified" only ever meant a flag
    // in the browser's sessionStorage, and the session's real access token
    // (already fully valid from the password sign-in step) worked for every
    // API call regardless of whether OTP had been completed at all.
    await supabase
      .from("profiles")
      .update({ otp_verified_at: verifiedAt })
      .eq("id", user.id);

    return json({ verified: true });
  } catch (error) {
    console.error("[verify-login-otp] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
