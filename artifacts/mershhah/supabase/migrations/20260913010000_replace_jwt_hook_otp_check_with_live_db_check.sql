-- The otp_ok JWT claim depends on Supabase's Auth Hooks feature actually
-- firing on every token mint. Verified live and conclusively that it
-- doesn't reliably: the hook function is correct (calling it directly
-- returns {"otp_ok": true} for a real owner), permissions are correct,
-- and the Dashboard shows it Enabled and pointed at the right function -
-- yet a genuinely fresh token (checked in a clean incognito session)
-- never carries the claim at all. That silently fails every RESTRICTIVE
-- policy checking auth.jwt()->>'otp_ok' closed, which was blocking real
-- restaurant owners from their own data (reproduced live: every table on
-- the owner dashboard read back empty).
--
-- Replaces the JWT-claim dependency with a plain SECURITY DEFINER lookup
-- straight from profiles, evaluated fresh on every query the same way
-- is_admin() already is elsewhere - no dependency on Auth Hooks at all.
-- Same semantics as before: true for everyone except an admin who hasn't
-- completed a step-up OTP check within the last hour.
CREATE OR REPLACE FUNCTION public.otp_ok()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND (otp_verified_at IS NULL OR otp_verified_at <= now() - interval '1 hour')
  );
$$;

GRANT EXECUTE ON FUNCTION public.otp_ok() TO authenticated;

DROP POLICY IF EXISTS "require_otp: profiles" ON public.profiles;
CREATE POLICY "require_otp: profiles" ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: subscriptions" ON public.subscriptions;
CREATE POLICY "require_otp: subscriptions" ON public.subscriptions
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: transactions" ON public.transactions;
CREATE POLICY "require_otp: transactions" ON public.transactions
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: invoices" ON public.invoices;
CREATE POLICY "require_otp: invoices" ON public.invoices
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: restaurants" ON public.restaurants;
CREATE POLICY "require_otp: restaurants" ON public.restaurants
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: branches" ON public.branches;
CREATE POLICY "require_otp: branches" ON public.branches
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: menu_items" ON public.menu_items;
CREATE POLICY "require_otp: menu_items" ON public.menu_items
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: offers" ON public.offers;
CREATE POLICY "require_otp: offers" ON public.offers
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

DROP POLICY IF EXISTS "require_otp: discount_codes" ON public.discount_codes;
CREATE POLICY "require_otp: discount_codes" ON public.discount_codes
  AS RESTRICTIVE FOR ALL TO authenticated USING (public.otp_ok());

-- Verification: shows the raw condition per profile (otp_ok() itself
-- reads auth.uid(), which is only meaningful inside a real user session,
-- not from the SQL Editor) - "would_block" should be false for every
-- owner, true only for an admin who hasn't verified recently.
select id, email, role, otp_verified_at,
  (role = 'admin' and (otp_verified_at is null or otp_verified_at <= now() - interval '1 hour')) as would_block
from public.profiles where id = 'ad111a69-73c5-431d-ad07-14d5ba5c8a56';
