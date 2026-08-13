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

const LOGO_URL = "https://www.mershhah.com/logo.jpg";
const SAFE_TO_IGNORE_NOTE = `<p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0;">إذا لم تطلب هذا الإجراء، تجاهل هذا البريد بأمان.</p>`;

// Shared chrome for every auth email: logo header, the caller's content in
// the middle, a signature/footer at the bottom. Kept self-contained in this
// file (not a `_shared` import) since the CLI here deploys each function's
// entrypoint independently.
function emailShell(inner: string, footerNote = SAFE_TO_IGNORE_NOTE) {
  return `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f4f4f5; padding: 40px 16px;">
      <div style="max-width: 440px; margin: 0 auto; background:#ffffff; border-radius: 20px; padding: 36px 28px; border: 1px solid #ececec;">
        <div style="text-align:center; padding-bottom: 22px; margin-bottom: 22px; border-bottom: 1px solid #f0f0f0;">
          <img src="${LOGO_URL}" width="44" height="44" alt="مرشح" style="border-radius: 12px; display: inline-block;" />
        </div>
        ${inner}
        ${footerNote}
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
}

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
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">أكمل إنشاء حسابك بالضغط على الزر التالي:</p>${buttonHtml(linkOrCode.url!, "تأكيد الحساب")}`),
      };
    case "recovery":
      return {
        subject: "طلب استعادة كلمة المرور - مرشح",
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">وصلنا طلب لاستعادة كلمة مرور حسابك. اضغط الزر التالي لاختيار كلمة مرور جديدة:</p>${buttonHtml(linkOrCode.url!, "إعادة تعيين كلمة المرور")}`),
      };
    case "magiclink":
      return {
        subject: "رابط تسجيل الدخول - مرشح",
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">اضغط الزر التالي لتسجيل الدخول مباشرة:</p>${buttonHtml(linkOrCode.url!, "تسجيل الدخول")}`),
      };
    case "invite":
      return {
        subject: "تمت دعوتك للانضمام إلى مرشح",
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">تمت دعوتك لإنشاء حساب في مرشح. اضغط الزر التالي لقبول الدعوة:</p>${buttonHtml(linkOrCode.url!, "قبول الدعوة")}`),
      };
    case "email_change":
      return {
        subject: "تأكيد تغيير البريد الإلكتروني - مرشح",
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">وصلنا طلب لتغيير البريد الإلكتروني المرتبط بحسابك. اضغط الزر التالي للتأكيد:</p>${buttonHtml(linkOrCode.url!, "تأكيد البريد الجديد")}`),
      };
    case "reauthentication":
      return {
        subject: `${linkOrCode.code} هو كود التحقق لمرشح`,
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;margin:0 0 8px;">استخدم الكود التالي لتأكيد هويتك:</p>${codeHtml(linkOrCode.code!)}`),
      };
    default:
      return {
        subject: "إشعار من مرشح",
        html: emailShell(`${greeting}<p style="font-size:14px;color:#111827;">${linkOrCode.url ? buttonHtml(linkOrCode.url, "المتابعة") : linkOrCode.code}</p>`),
      };
  }
}

// signup/invite read as an invitation to join — everything else is a
// security/identity action. Two different inboxes, two different senders.
const WELCOME_ACTION_TYPES = new Set(["signup", "invite"]);

function fromFor(actionType: string): string {
  if (WELCOME_ACTION_TYPES.has(actionType)) {
    return Deno.env.get("SNDR_FROM_WELCOME") || "welcome@mershhah.com";
  }
  return Deno.env.get("SNDR_FROM_AUTH") || "auth@mershhah.com";
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
    const sndrFromEmail = fromFor(actionType);

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
