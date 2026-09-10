'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/navigation';
import { resolvePostAuthRoute } from '@/lib/post-auth-redirect';

// Landing page for Supabase's OAuth redirectTo (Google "Continue with
// Google" button). Its only job is: read the session that Supabase just
// established, mark it as OTP-verified (Google sign-in is itself a strong
// identity proof, so OtpGate shouldn't immediately ask again), then send
// the visitor to onboarding or their dashboard.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }: any) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) {
        router.push('/login');
        return;
      }
      sessionStorage.setItem(`mershhah_otp_verified_${user.id}`, '1');
      const route = await resolvePostAuthRoute(user);
      if (cancelled) return;
      router.push(route);
      router.refresh();
    });

    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white" dir="rtl">
      <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
    </div>
  );
}
