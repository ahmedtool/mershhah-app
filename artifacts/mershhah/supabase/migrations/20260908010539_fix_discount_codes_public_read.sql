-- ============================================================
-- FIX: discount_codes has no SELECT policy for regular users
--
-- discount_codes RLS only ever had one policy (admin-only, FOR ALL),
-- across every migration that touched it. That means any restaurant
-- owner typing a coupon code into /owner/billing or /owner/settings
-- (useCouponCheck.ts does a direct client-side
-- `supabase.from('discount_codes').select(...)`) gets silently blocked
-- by RLS and shown "كوبون غير صالح" for every code, even a valid one -
-- the checkout itself (server-side, service-role key) was never
-- affected, only this client-side preview/validation step.
--
-- Mirrors the existing "plans_public" policy pattern (plans table):
-- expose only active rows, nothing about who can write.
-- ============================================================

DROP POLICY IF EXISTS "discount_codes_public" ON public.discount_codes;
CREATE POLICY "discount_codes_public" ON public.discount_codes
  FOR SELECT USING (is_active = true);
