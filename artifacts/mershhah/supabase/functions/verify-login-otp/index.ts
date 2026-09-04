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

    // Check against every still-active code for this profile, not just the
    // latest one - if a second code was ever requested (resend, or two
    // overlapping sends) while an earlier one is still unexpired, a code
    // from an older email is just as real and must still be accepted.
    const nowIso = new Date().toISOString();
    const { data: activeRows, error: fetchError } = await supabase
      .from("login_otp_codes")
      .select("*")
      .eq("profile_id", user.id)
      .is("verified_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    if (!activeRows || activeRows.length === 0) {
      // Distinguish "never sent" from "sent but expired" for a clearer message.
      const { data: latestAny } = await supabase
        .from("login_otp_codes")
        .select("id")
        .eq("profile_id", user.id)
        .is("verified_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const message = latestAny
        ? "انتهت صلاحية الكود. اطلب كوداً جديداً."
        : "لم يتم إرسال كود بعد. اطلب كوداً جديداً.";
      return json({ verified: false, error: message }, 400);
    }

    if (activeRows.every((r) => r.attempts >= MAX_ATTEMPTS)) {
      return json({ verified: false, error: "تجاوزت عدد المحاولات المسموح. اطلب كوداً جديداً." }, 429);
    }

    const trimmedCode = code.trim();
    const matched = activeRows.find((r) => r.code === trimmedCode && r.attempts < MAX_ATTEMPTS);

    if (!matched) {
      const eligible = activeRows.filter((r) => r.attempts < MAX_ATTEMPTS);
      await Promise.all(
        eligible.map((r) =>
          supabase.from("login_otp_codes").update({ attempts: r.attempts + 1 }).eq("id", r.id)
        )
      );
      const remaining = Math.min(...eligible.map((r) => MAX_ATTEMPTS - (r.attempts + 1)));
      return json({ verified: false, error: `كود غير صحيح${remaining > 0 ? ` — باقي ${remaining} محاولات` : ""}` }, 400);
    }

    const verifiedAt = new Date().toISOString();
    // Invalidate every other still-active code for this profile too, so a
    // leftover valid code from an older email can't be reused after a
    // successful login has already happened.
    await supabase
      .from("login_otp_codes")
      .update({ verified_at: verifiedAt })
      .eq("profile_id", user.id)
      .is("verified_at", null);

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
