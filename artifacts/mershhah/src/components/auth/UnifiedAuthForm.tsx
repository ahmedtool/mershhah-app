'use client';

import { useState } from 'react';
import { Link } from 'wouter';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/shared/LanguageContext';
import { resolvePostAuthRoute } from '@/lib/post-auth-redirect';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.89c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.92l-3.89-3.01c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.28v3.1C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.61H1.28A11.96 11.96 0 000 12c0 1.93.46 3.76 1.28 5.39l4.02-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.61l4.02 3.1c.94-2.83 3.58-4.96 6.7-4.96z" />
    </svg>
  );
}

export function UnifiedAuthForm() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [otpError, setOtpError] = useState('');

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: error.message });
      setIsGoogleLoading(false);
    }
    // On success the browser navigates away to Google, so no further local
    // state update is needed here.
  };

  const handleContinueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!EMAIL_REGEX.test(email)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setIsEmailLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setIsEmailLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: t('common.errorTitle'), description: error.message });
      return;
    }
    setStep('otp');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setIsOtpLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });
    if (error || !data.user) {
      setOtpError(t('auth.invalidOtp'));
      setIsOtpLoading(false);
      return;
    }
    // Do NOT mark mershhah_otp_verified_* here: this is only the app's
    // first-factor sign-in. Owner/admin accounts still need the separate
    // second-factor step OtpGate enforces (send-login-otp/verify-login-otp),
    // which is what actually stamps profiles.otp_verified_at server-side and
    // feeds the otp_ok JWT claim the RLS policies check. Setting this flag
    // early let owner/admin sessions skip that second factor entirely.
    const route = await resolvePostAuthRoute(data.user);
    router.push(route);
    router.refresh();
  };

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-3">
        <p className="text-xs text-gray-600">
          {t('auth.otpSentTitle')} <span dir="ltr" className="font-bold text-gray-900">{email}</span>
        </p>
        <div>
          <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('auth.otpCodeLabel')}</label>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            dir="ltr"
            placeholder={t('auth.otpCodePlaceholder')}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            disabled={isOtpLoading}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-center text-lg tracking-[0.3em] placeholder:tracking-normal placeholder:text-gray-600 focus:outline-none focus:border-gray-300 disabled:opacity-50"
          />
          {otpError && <p className="text-[10px] text-red-500 mt-1">{otpError}</p>}
        </div>
        <button type="submit" disabled={isOtpLoading}
          className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {isOtpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isOtpLoading ? t('auth.confirming') : t('auth.confirmButton')}
        </button>
        <button type="button" onClick={() => { setStep('email'); setOtpCode(''); setOtpError(''); }}
          className="w-full text-[11px] font-bold text-gray-600 hover:text-gray-900 transition-colors">
          {t('auth.changeEmail')}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={isGoogleLoading}
        className="w-full h-11 rounded-xl border border-gray-200 text-gray-900 text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        {t('auth.continueWithGoogle')}
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-[11px] text-gray-600">{t('auth.orDivider')}</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleContinueWithEmail} className="space-y-3">
        <div>
          <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">{t('auth.emailLabel')}</label>
          <input
            type="email"
            dir="ltr"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEmailLoading}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-left placeholder:text-gray-600 focus:outline-none focus:border-gray-300 disabled:opacity-50"
          />
          {emailError && <p className="text-[10px] text-red-500 mt-1">{emailError}</p>}
        </div>
        <button type="submit" disabled={isEmailLoading}
          className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {isEmailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEmailLoading ? t('auth.sending') : t('auth.continueButton')}
        </button>
      </form>

      <p className="text-center text-[10px] text-gray-600 pt-1">
        {t('auth.termsAgreementPrefix')}{' '}
        <Link href="/terms" className="underline hover:text-gray-900">{t('auth.termsAgreementLink')}</Link>
      </p>
    </div>
  );
}
