-- Phase 3, item M1: add_otp_restrictive_policies.sql only covered
-- profiles/subscriptions/transactions/invoices/restaurants - a session
-- with a valid JWT but otp_ok=false (owner/admin who hasn't completed the
-- email code yet) could still read/write branches, menu_items, offers and
-- discount_codes directly via the API even though the UI (OtpGate) never
-- lets it get there. Same safe pattern as before: RESTRICTIVE only takes
-- access away, never grants it, and COALESCE(...,false) fails closed if
-- the claim is ever missing. Scoped TO authenticated only, so public menu
-- browsing (anon reads) is completely untouched.

DROP POLICY IF EXISTS "require_otp: branches" ON public.branches;
CREATE POLICY "require_otp: branches" ON public.branches
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: menu_items" ON public.menu_items;
CREATE POLICY "require_otp: menu_items" ON public.menu_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: offers" ON public.offers;
CREATE POLICY "require_otp: offers" ON public.offers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));

DROP POLICY IF EXISTS "require_otp: discount_codes" ON public.discount_codes;
CREATE POLICY "require_otp: discount_codes" ON public.discount_codes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'otp_ok')::boolean, false));
