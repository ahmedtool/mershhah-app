import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export type DiscountCode = {
  discount_type: 'percentage' | 'fixed' | 'free_trial';
  discount_value: number;
  valid_until?: string | null;
  max_uses?: number | null;
  current_uses?: number | null;
};

// Shared by /owner/settings and /owner/billing, which both let the owner
// type a coupon and preview the discounted price before checkout.
export function useCouponCheck() {
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<DiscountCode | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  const checkCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsCheckingCoupon(true);
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .single();
      if (error || !data) {
        toast({ variant: 'destructive', title: 'كوبون غير صالح' });
        setCouponDiscount(null);
        return;
      }
      const now = new Date();
      const validUntil = data.valid_until ? new Date(data.valid_until) : null;
      if (validUntil && validUntil < now) {
        toast({ variant: 'destructive', title: 'الكوبون منتهي الصلاحية' });
        setCouponDiscount(null);
        return;
      }
      if (data.max_uses && data.current_uses >= data.max_uses) {
        toast({ variant: 'destructive', title: 'الكوبون استُنفد' });
        setCouponDiscount(null);
        return;
      }
      setCouponDiscount(data);
      toast({
        title: 'كوبون صالح ✓',
        description: data.discount_type === 'percentage' ? `خصم ${data.discount_value}%`
          : data.discount_type === 'fixed' ? `خصم ${data.discount_value} ر.س`
          : 'فترة مجانية',
      });
    } catch {
      toast({ variant: 'destructive', title: 'خطأ' });
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const applyDiscount = (price: number) => {
    if (!couponDiscount) return price;
    if (couponDiscount.discount_type === 'percentage') return Math.round(price * (1 - couponDiscount.discount_value / 100));
    if (couponDiscount.discount_type === 'fixed') return Math.max(0, price - couponDiscount.discount_value);
    return 0; // free_trial
  };

  return { couponCode, setCouponCode, couponDiscount, isCheckingCoupon, checkCoupon, applyDiscount };
}
