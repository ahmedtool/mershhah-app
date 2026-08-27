-- Adds the actual enforcement layer on top of the otp_ok JWT claim: a
-- RESTRICTIVE policy is AND'd on top of every existing permissive policy,
-- so it can only take access away, never grant it - safe to add without
-- touching any of the policies that already work. Scoped `TO authenticated`
-- only, so anonymous/public access (restaurant pages, menus, etc.) is
-- completely untouched - anon requests are never subject to it at all.
-- service_role bypasses RLS entirely at the role level in Supabase, so
-- Edge Functions/webhooks using the service key are unaffected either way.
--
-- Scope: the account/financial/admin surface the security review flagged -
-- profiles, subscriptions, transactions, invoices, restaurants. Customers
-- and free-tier accounts always get otp_ok=true from the hook (OTP was
-- never required for them), so this only ever actually restricts owner/
-- admin accounts that haven't completed a recent OTP check.

DROP POLICY IF EXISTS "require_otp: profiles" ON public.profiles;
CREATE POLICY "require_otp: profiles" ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: subscriptions" ON public.subscriptions;
CREATE POLICY "require_otp: subscriptions" ON public.subscriptions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: transactions" ON public.transactions;
CREATE POLICY "require_otp: transactions" ON public.transactions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: invoices" ON public.invoices;
CREATE POLICY "require_otp: invoices" ON public.invoices
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: restaurants" ON public.restaurants;
CREATE POLICY "require_otp: restaurants" ON public.restaurants
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));
