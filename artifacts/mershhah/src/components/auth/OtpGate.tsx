'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { Loader2, ShieldCheck, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const sessionKey = (uid: string) => `mershhah_otp_verified_${uid}`;

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
  const [isVerified, setIsVerified] = useState(false);
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

  useEffect(() => {
    if (!user) return;
    setIsVerified(sessionStorage.getItem(sessionKey(user.uid)) === '1');
  }, [user]);

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
    if (needsOtp && !isVerified && user && sentForUid.current !== user.uid) {
      sentForUid.current = user.uid;
      sendCode();
    }
  }, [needsOtp, isVerified, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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
    } else {
      setError(data.error || 'كود غير صحيح');
      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  if (isUserLoading || !user) return <>{children}</>;
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
