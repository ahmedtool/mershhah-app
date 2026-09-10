'use client';

import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/shared/LanguageContext';

// Landed here because check-existing-account found a profile with the same
// email under a DIFFERENT auth identity - almost always: this person
// already has a password-era account, and just tried "Continue with
// Google" for the first time. Google is a separate auth provider, so
// without account linking configured it gets its own new auth.users id
// instead of reusing the existing one. Signing out and using the email/
// code option instead resolves to the SAME existing account correctly,
// since email OTP matches by email on the one auth.users row rather than
// needing a separate linked identity the way a third-party OAuth
// provider does.
export default function AccountExistsPage() {
  const { t } = useLanguage();

  const handleSignOutAndRetry = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6" dir="rtl">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-black text-gray-900">{t('auth.accountExistsTitle')}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{t('auth.accountExistsDesc')}</p>
        <button
          onClick={handleSignOutAndRetry}
          className="w-full h-11 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors"
        >
          {t('auth.accountExistsRetry')}
        </button>
      </div>
    </div>
  );
}
