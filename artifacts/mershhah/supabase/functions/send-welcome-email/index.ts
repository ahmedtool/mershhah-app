import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sends a one-time welcome email right after signup. Not GoTrue's own
// "confirmation" email (that's handled natively by Supabase's Resend SMTP
// config) - this is called directly by the client once the new profile row
// exists, since the old approach (a GoTrue "Send Email" hook routing signup
// events here) has been broken and disabled for a while.

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sndrApiKey = Deno.env.get("SNDR_API_KEY");
    const sndrFromEmail = `Mershhah <${Deno.env.get("SNDR_FROM_WELCOME") || "welcome@mershhah.com"}>`;

    if (!sndrApiKey) return json({ error: "not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user?.email) return json({ error: "unauthorized" }, 401);

    // Trust the caller's own session for who to email, not client-supplied
    // fields, so this can't be used to spam arbitrary addresses.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, restaurant_name, role")
      .eq("id", user.id)
      .single();

    const name = profile?.full_name || "";
    const isOwner = profile?.role === "owner";

    const subject = "أهلاً بك في مرشح 🎉";
    const html = `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f4f4f5; padding: 40px 16px;">
        <div style="max-width: 440px; margin: 0 auto; background:#ffffff; border-radius: 20px; padding: 36px 28px; border: 1px solid #ececec;">
          <div style="text-align:center; padding-bottom: 22px; margin-bottom: 22px; border-bottom: 1px solid #f0f0f0;">
            <img src="https://www.mershhah.com/logo.jpg" width="44" height="44" alt="مرشح" style="border-radius: 12px; display: inline-block;" />
          </div>
          <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">أهلاً ${name || "بك"} 👋</p>
          <p style="font-size: 14px; color: #111827; margin: 0 0 8px;">
            ${isOwner
              ? `تم إنشاء حساب${profile?.restaurant_name ? ` "${profile.restaurant_name}"` : ""} بنجاح. جاهز تبدأ تبني منيوك وتخصص صفحتك العامة من لوحة التحكم.`
              : "تم إنشاء حسابك بنجاح."}
          </p>
          <a href="https://www.mershhah.com/owner/dashboard" style="display:block;text-align:center;background:#111827;color:#fff;text-decoration:none;font-weight:900;font-size:14px;border-radius:12px;padding:14px;margin:20px 0;">فتح لوحة التحكم</a>
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

    const emailRes = await fetch("https://api.sndr.sh/v1/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sndrApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sndrFromEmail, to: [user.email], subject, html }),
    });

    if (!emailRes.ok) {
      console.error("[send-welcome-email] SNDR send failed:", emailRes.status, await emailRes.text());
      return json({ error: "send failed" }, 500);
    }

    return json({ sent: true });
  } catch (error) {
    console.error("[send-welcome-email] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
