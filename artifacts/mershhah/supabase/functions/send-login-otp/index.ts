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

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 45;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sndrApiKey = Deno.env.get("SNDR_API_KEY");
    const sndrFromEmail = Deno.env.get("SNDR_FROM_EMAIL") || "auth@mershhah.com";

    if (!sndrApiKey) {
      return json({ error: "Email provider not configured. Please contact support." }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // This runs right after a successful password sign-in — the caller
    // already holds a valid session, we just confirm who they are.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      return json({ error: "OTP is only required for owner/admin accounts" }, 400);
    }

    // Don't let rapid resend clicks spam the inbox
    const { data: recentCode } = await supabase
      .from("login_otp_codes")
      .select("created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentCode) {
      const ageSeconds = (Date.now() - new Date(recentCode.created_at).getTime()) / 1000;
      if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
        return json({ error: `الرجاء الانتظار ${Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds)} ثانية قبل إعادة الإرسال`, retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds) }, 429);
      }
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const { error: insertError } = await supabase.from("login_otp_codes").insert({
      profile_id: profile.id,
      code,
      expires_at: expiresAt.toISOString(),
    });
    if (insertError) throw insertError;

    const emailRes = await fetch("https://api.sndr.sh/v1/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sndrApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sndrFromEmail,
        to: [profile.email],
        subject: `${code} هو كود تسجيل الدخول لمرشح`,
        html: `
          <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background: #fafafa;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">مرحباً ${profile.full_name || ""}،</p>
            <p style="font-size: 14px; color: #111827; margin: 0 0 8px;">كود تسجيل الدخول إلى لوحة تحكم مرشح:</p>
            <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #111827; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0; direction: ltr;">${code}</div>
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">صالح لمدة ${OTP_TTL_MINUTES} دقائق. إذا لم تطلب تسجيل الدخول، تجاهل هذا البريد.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("[send-login-otp] SNDR send failed:", emailRes.status, errBody);
      return json({ error: "فشل إرسال كود التحقق. حاول مرة أخرى." }, 500);
    }

    // Mask the email so the client can confirm where the code went
    const maskedEmail = profile.email.replace(/^(.{2}).+(@.+)$/, "$1***$2");
    return json({ sent: true, maskedEmail });
  } catch (error) {
    console.error("[send-login-otp] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
