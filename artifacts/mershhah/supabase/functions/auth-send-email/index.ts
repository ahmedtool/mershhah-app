import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

// Supabase's "Send Email" auth hook. Replaces the built-in mailer for every
// auth email (signup confirmation, password recovery, magic link, invite,
// email change, reauthentication) with one routed through SNDR, in Arabic.
// https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

interface HookUser {
  email: string;
  user_metadata?: { full_name?: string };
  new_email?: string;
}

interface HookEmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  token_new: string;
  token_hash_new: string;
}

const BRAND = {
  wrapOpen: `<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background: #fafafa;">`,
  wrapClose: `</div>`,
  footer: `<p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0;">إذا لم تطلب هذا الإجراء، تجاهل هذا البريد بأمان.</p>`,
};

function buttonHtml(url: string, label: string) {
  return `<a href="${url}" style="display:block;text-align:center;background:#111827;color:#fff;text-decoration:none;font-weight:900;font-size:14px;border-radius:12px;padding:14px;margin:16px 0;">${label}</a>`;
}

function codeHtml(code: string) {
  return `<div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #111827; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0; direction: ltr;">${code}</div>`;
}

function buildVerifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string) {
  const url = new URL(`${supabaseUrl}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", type);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function templateFor(actionType: string, name: string, linkOrCode: { url?: string; code?: string }) {
  const greeting = `<p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">مرحباً ${name || ""}،</p>`;

  switch (actionType) {
    case "signup":
      return {
        subject: "تأكيد إنشاء حسابك في مرشح",
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">أكمل إنشاء حسابك بالضغط على الزر التالي:</p>${buttonHtml(linkOrCode.url!, "تأكيد الحساب")}${BRAND.footer}${BRAND.wrapClose}`,
      };
    case "recovery":
      return {
        subject: "طلب استعادة كلمة المرور - مرشح",
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">وصلنا طلب لاستعادة كلمة مرور حسابك. اضغط الزر التالي لاختيار كلمة مرور جديدة:</p>${buttonHtml(linkOrCode.url!, "إعادة تعيين كلمة المرور")}${BRAND.footer}${BRAND.wrapClose}`,
      };
    case "magiclink":
      return {
        subject: "رابط تسجيل الدخول - مرشح",
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">اضغط الزر التالي لتسجيل الدخول مباشرة:</p>${buttonHtml(linkOrCode.url!, "تسجيل الدخول")}${BRAND.footer}${BRAND.wrapClose}`,
      };
    case "invite":
      return {
        subject: "تمت دعوتك للانضمام إلى مرشح",
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">تمت دعوتك لإنشاء حساب في مرشح. اضغط الزر التالي لقبول الدعوة:</p>${buttonHtml(linkOrCode.url!, "قبول الدعوة")}${BRAND.footer}${BRAND.wrapClose}`,
      };
    case "email_change":
      return {
        subject: "تأكيد تغيير البريد الإلكتروني - مرشح",
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">وصلنا طلب لتغيير البريد الإلكتروني المرتبط بحسابك. اضغط الزر التالي للتأكيد:</p>${buttonHtml(linkOrCode.url!, "تأكيد البريد الجديد")}${BRAND.footer}${BRAND.wrapClose}`,
      };
    case "reauthentication":
      return {
        subject: `${linkOrCode.code} هو كود التحقق لمرشح`,
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">استخدم الكود التالي لتأكيد هويتك:</p>${codeHtml(linkOrCode.code!)}${BRAND.footer}${BRAND.wrapClose}`,
      };
    default:
      return {
        subject: "إشعار من مرشح",
        html: `${BRAND.wrapOpen}${greeting}<p style="font-size:14px;color:#111827;">${linkOrCode.url ? buttonHtml(linkOrCode.url, "المتابعة") : linkOrCode.code}</p>${BRAND.wrapClose}`,
      };
  }
}

async function sendViaSndr(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.sndr.sh/v1/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SNDR send failed (${res.status}): ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 405 });
  }

  const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const sndrApiKey = Deno.env.get("SNDR_API_KEY");
  const sndrFromEmail = Deno.env.get("SNDR_FROM_EMAIL") || "auth@mershhah.com";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!hookSecretRaw || !sndrApiKey) {
    console.error("[auth-send-email] Missing SEND_EMAIL_HOOK_SECRET or SNDR_API_KEY");
    // Returning a non-2xx here makes Supabase fall back to nothing (email
    // signups get blocked per docs) — but leaving misconfiguration silent
    // would be worse than a loud, visible failure in the logs.
    return new Response(JSON.stringify({ error: { http_code: 500, message: "Email hook not configured" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const hookSecret = hookSecretRaw.replace("v1,whsec_", "");
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: HookUser;
      email_data: HookEmailData;
    };

    const name = user.user_metadata?.full_name || "";
    const actionType = email_data.email_action_type;

    if (actionType === "reauthentication") {
      const { subject, html } = templateFor(actionType, name, { code: email_data.token });
      await sendViaSndr(sndrApiKey, sndrFromEmail, user.email, subject, html);
    } else if (actionType === "email_change" && email_data.token_hash_new) {
      // Secure Email Change: two separate confirmations, one per address.
      // Field names are swapped by Supabase's own convention — see docs.
      const urlToOldEmail = buildVerifyUrl(supabaseUrl, email_data.token_hash_new, actionType, email_data.redirect_to);
      const urlToNewEmail = buildVerifyUrl(supabaseUrl, email_data.token_hash, actionType, email_data.redirect_to);
      const toOld = templateFor(actionType, name, { url: urlToOldEmail });
      await sendViaSndr(sndrApiKey, sndrFromEmail, user.email, toOld.subject, toOld.html);
      if (user.new_email) {
        const toNew = templateFor(actionType, name, { url: urlToNewEmail });
        await sendViaSndr(sndrApiKey, sndrFromEmail, user.new_email, toNew.subject, toNew.html);
      }
    } else {
      const tokenHash = email_data.token_hash || email_data.token_hash_new;
      const url = buildVerifyUrl(supabaseUrl, tokenHash, actionType, email_data.redirect_to);
      const { subject, html } = templateFor(actionType, name, { url });
      const target = actionType === "email_change" ? (user.new_email || user.email) : user.email;
      await sendViaSndr(sndrApiKey, sndrFromEmail, target, subject, html);
    }
  } catch (error) {
    console.error("[auth-send-email] Error:", error);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: error.message || "Failed to send email" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
