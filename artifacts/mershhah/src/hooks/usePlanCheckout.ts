import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// Shared by every screen that can start a plan subscription (the
// account-status paywall, /owner/settings, /owner/billing) so the
// streampay-checkout call and its error handling live in one place
// instead of three independently-copied fetch calls.
export function usePlanCheckout() {
  const { toast } = useToast();
  const [checkingOutKey, setCheckingOutKey] = useState<string | null>(null);

  const checkout = async (planId: string, cycle: 'monthly' | 'yearly', discountCode?: string) => {
    const key = `${planId}-${cycle}`;
    setCheckingOutKey(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/streampay-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plan_id: planId, billing_cycle: cycle, discount_code: discountCode || undefined }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast({ variant: 'destructive', title: 'تعذّر بدء الدفع', description: data.error || 'فشل إنشاء رابط الدفع' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    } finally {
      setCheckingOutKey(null);
    }
  };

  return {
    checkout,
    isCheckingOut: (planId: string, cycle: 'monthly' | 'yearly') => checkingOutKey === `${planId}-${cycle}`,
    isCheckoutInProgress: checkingOutKey !== null,
  };
}
