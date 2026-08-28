import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Runs daily via pg_cron (see schedule_marketing_reminders.sql). For every
// "ذكرني" reminder whose occasion falls REMIND_DAYS_BEFORE days from today,
// emails the owner a heads-up. `last_sent_year` guards against sending the
// same occasion twice in one year if the cron fires more than once a day.
const REMIND_DAYS_BEFORE = 3;

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

    // Only the cron job (calling with the service key) may trigger this -
    // it emails people, so it must never be reachable by an anon/owner JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const sndrApiKey = Deno.env.get("SNDR_API_KEY");
    const sndrFromEmail = Deno.env.get("SNDR_FROM_AUTH") || "auth@mershhah.com";
    if (!sndrApiKey) {
      return json({ error: "Email provider not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + REMIND_DAYS_BEFORE);
    const targetMonth = target.getMonth() + 1;
    const targetDay = target.getDate();
    const currentYear = target.getFullYear();

    const { data: reminders, error: remindersError } = await supabase
      .from("marketing_calendar_reminders")
      .select("id, profile_id, occasion_name, last_sent_year")
      .eq("occasion_month", targetMonth)
      .eq("occasion_day", targetDay);

    if (remindersError) throw remindersError;

    const due = (reminders || []).filter((r) => r.last_sent_year !== currentYear);
    if (due.length === 0) {
      return json({ sent: 0 });
    }

    const profileIds = [...new Set(due.map((r) => r.profile_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", profileIds);
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));

    let sentCount = 0;
    for (const reminder of due) {
      const profile = profileById.get(reminder.profile_id);
      if (!profile?.email) continue;

      const emailRes = await fetch("https://api.sndr.sh/v1/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sndrApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sndrFromEmail,
          to: [profile.email],
          subject: `تذكير: ${reminder.occasion_name} بعد ${REMIND_DAYS_BEFORE} أيام`,
          html: `
            <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f4f4f5; padding: 40px 16px;">
              <div style="max-width: 480px; margin: 0 auto; background:#ffffff; border-radius: 20px; padding: 36px 28px; border: 1px solid #ececec;">
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">مرحباً ${profile.full_name || ""}،</p>
                <p style="font-size: 15px; color: #111827; margin: 0 0 16px; font-weight: 700;">مناسبة "${reminder.occasion_name}" بعد ${REMIND_DAYS_BEFORE} أيام — وقت مناسب تجهّز عرضك التسويقي.</p>
                <a href="https://www.mershhah.com/owner/tools/marketing-calendar" style="display:inline-block; background:#111827; color:#fff; text-decoration:none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700;">افتح تقويم التسويق</a>
                <p style="font-size: 11px; color: #9ca3af; margin: 24px 0 0;">فريق مرشح</p>
              </div>
            </div>
          `,
        }),
      });

      if (emailRes.ok) {
        await supabase
          .from("marketing_calendar_reminders")
          .update({ last_sent_year: currentYear })
          .eq("id", reminder.id);
        sentCount++;
      } else {
        console.error("[send-marketing-reminders] SNDR send failed:", emailRes.status, await emailRes.text());
      }
    }

    return json({ sent: sentCount, checked: due.length });
  } catch (error) {
    console.error("[send-marketing-reminders] Fatal error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
