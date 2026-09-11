'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/navigation';
import { resolvePostAuthRoute } from '@/lib/post-auth-redirect';

// Landing page for Supabase's OAuth redirectTo (Google "Continue with
// Google" button). Its only job is: read the session that Supabase just
// established, then send the visitor to onboarding or their dashboard.
// This must NOT mark mershhah_otp_verified_* itself - owner/admin accounts
// still need OtpGate's separate second-factor step (send-login-otp/
// verify-login-otp), which is what stamps profiles.otp_verified_at and
// feeds the otp_ok JWT claim the RLS policies check. For every other role
// OtpGate never gates on this flag at all, so skipping it here is a no-op
// for them and only restores the required 2FA for owner/admin.
export default function AuthCallbackPage() {
  const router = useRouter();

  // Runs once on mount only. useRouter() returns a brand-new object every
  // render (no memoization), so depending on it here would re-run this
  // effect on every render - resolvePostAuthRoute() and its inserts could
  // fire repeatedly and the page would never settle.
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }: any) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) {
        router.push('/login');
        return;
      }
      const route = await resolvePostAuthRoute(user);
      if (cancelled) return;
      router.push(route);
      router.refresh();
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
      <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
    </div>
  );
}
