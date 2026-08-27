'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Loader2, ShieldCheck, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const sessionKey = (uid: string) => `mershhah_otp_verified_${uid}`;
const IDLE_SIGNOUT_MS = 60 * 60 * 1000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart'];

async function callOtpFunction(path: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function OtpGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerified, setIsVerified] = useState(false);
  const [isCheckingGrant, setIsCheckingGrant] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  // Fail OPEN if the email provider isn't configured yet (SNDR_API_KEY
  // missing server-side) — a broken send must never lock owners/admins out
  // of their own dashboard entirely. It starts actually enforcing itself
  // automatically the moment the key is added, no redeploy needed.
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const sentForUid = useRef<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const needsOtp = !!user && (user.role === 'owner' || user.role === 'admin');

  // A fresh sign-in must never be treated as already-verified just because
  // this browser tab verified a *previous* session for the same account —
  // sessionStorage survives sign-out, so the flag has to be cleared the
  // moment that sign-out actually happens, not just when the tab closes.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('mershhah_otp_verified_'))
          .forEach((k) => sessionStorage.removeItem(k));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendCode = async () => {
    if (!user) return;
    setIsSending(true);
    setError('');
    const { ok, data } = await callOtpFunction('send-login-otp');
    setIsSending(false);
    if (ok) {
      setMaskedEmail(data.maskedEmail || '');
      setCooldown(45);
      toast({ title: 'تم إرسال الكود', description: `تحقق من بريدك ${data.maskedEmail || ''}` });
    } else if (String(data.error || '').includes('not configured')) {
      console.warn('[OtpGate] Email provider not configured — allowing access without OTP.');
      setProviderUnavailable(true);
    } else {
      setError(data.error || 'فشل إرسال الكود');
      if (data.retryAfter) setCooldown(data.retryAfter);
    }
  };

  useEffect(() => {
    if (!user) return;
    // Compute verified synchronously and act on it immediately in the same
    // pass — splitting this into "check" + "decide to send" as two separate
    // effects raced: the send-effect ran with the stale (default false)
    // isVerified before the check-effect's setIsVerified(true) had actually
    // re-rendered, firing an OTP send that then got silently bypassed.
    const verified = sessionStorage.getItem(sessionKey(user.uid)) === '1';
    setIsVerified(verified);
    if (verified || sentForUid.current === user.uid) return;
    sentForUid.current = user.uid;

    // A session opened via an owner-approved temporary-access grant (see
    // enter-owner-account) carries this param — the owner's own explicit
    // approval already outranks a 4-digit email code, and there'd be no way
    // for whoever is in this tab to receive a code sent to the owner's inbox.
    const grantId = searchParams.get('impersonation_grant');
    if (grantId) {
      setIsCheckingGrant(true);
      callOtpFunction('verify-impersonation-grant', { requestId: grantId }).then(({ ok, data }) => {
        setIsCheckingGrant(false);
        // Strip the param either way so it can't be replayed via a bookmark/share.
        window.history.replaceState({}, '', window.location.pathname);
        if (ok && data.valid) {
          sessionStorage.setItem(sessionKey(user.uid), '1');
          setIsVerified(true);
          // The current JWT was minted before the grant stamped
          // otp_verified_at server-side - refresh so its otp_ok claim
          // catches up, or RLS keeps treating this session as unverified
          // even though the UI has already moved past this screen.
          supabase.auth.refreshSession().catch(() => {});
        } else if (needsOtp) {
          sendCode();
        }
      });
      return;
    }

    if (needsOtp) sendCode();
  }, [needsOtp, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // After an hour with no mouse/keyboard/touch activity, sign the user out
  // completely instead of just re-locking behind a fresh OTP — no session
  // means no more codes sent until they actually log back in.
  useEffect(() => {
    if (!needsOtp || !isVerified || !user) return;

    let idleTimer: ReturnType<typeof setTimeout>;
    const signOutIdle = async () => {
      sessionStorage.removeItem(sessionKey(user.uid));
      await supabase.auth.signOut();
      toast({ title: 'تم تسجيل الخروج', description: 'انتهت الجلسة بعد ساعة من عدم النشاط.' });
      router.push('/login');
      router.refresh();
    };
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(signOutIdle, IDLE_SIGNOUT_MS);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetIdleTimer));
    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [needsOtp, isVerified, user, toast, router]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 3) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d !== '') && next.join('').length === 4) {
      submitCode(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitCode = async (fullCode: string) => {
    if (!user) return;
    setIsSubmitting(true);
    setError('');
    const { ok, data } = await callOtpFunction('verify-login-otp', { code: fullCode });
    setIsSubmitting(false);
    if (ok && data.verified) {
      sessionStorage.setItem(sessionKey(user.uid), '1');
      setIsVerified(true);
      // Same reason as the grant path: the session's JWT was minted before
      // verify-login-otp stamped otp_verified_at, so it still carries the
      // old otp_ok:false claim until refreshed.
      supabase.auth.refreshSession().catch(() => {});
    } else {
      setError(data.error || 'كود غير صحيح');
      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  if (isUserLoading || !user) return <>{children}</>;
  if (isCheckingGrant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }
  if (!needsOtp || isVerified || providerUnavailable) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">كود التحقق</h1>
          <p className="text-xs text-gray-400 mt-1">
            {isSending ? 'جاري إرسال الكود...' : maskedEmail ? `أدخل الكود المرسل إلى ${maskedEmail}` : 'أدخل كود التحقق المرسل إلى بريدك'}
          </p>
        </div>

        <div className="flex justify-center gap-2" dir="ltr">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isSubmitting || isSending}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-14 h-14 rounded-xl border border-gray-200 text-center text-2xl font-black text-gray-900 focus:outline-none focus:border-gray-900 disabled:opacity-50"
            />
          ))}
        </div>

        {isSubmitting && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري التحقق...
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

        <button
          onClick={sendCode}
          disabled={isSending || cooldown > 0}
          className="w-full h-10 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {cooldown > 0 ? `أعد الإرسال بعد ${cooldown} ثانية` : 'إعادة إرسال الكود'}
        </button>
      </div>
    </div>
  );
}
