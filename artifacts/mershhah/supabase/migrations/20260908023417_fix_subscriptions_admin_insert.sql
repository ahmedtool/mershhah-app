-- ============================================================
-- FIX: Admin can't manually activate/renew a subscription
--
-- The admin "Activate/Renew" button on /admin/management inserts a new
-- row into public.subscriptions on behalf of another user, and fails
-- with "new row violates row-level security policy for table
-- subscriptions". fix_rls.sql's "subscriptions: admin full" policy
-- checks auth.users.raw_app_meta_data->>'role' = 'admin' - a field that
-- has to be set separately via the Supabase Admin API and evidently
-- never was, for this admin account. Every other admin check that
-- demonstrably already works (the whole /admin/management page, the
-- nav itself) reads public.profiles.role instead, so switch this one
-- policy back to that - safe here (unlike on profiles itself) since
-- checking profiles from a *different* table's policy isn't
-- self-referential and can't cause the recursion fix_rls.sql was
-- written to avoid.
-- ============================================================

DROP POLICY IF EXISTS "subscriptions: admin full" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin" ON public.subscriptions;

CREATE POLICY "subscriptions_admin" ON public.subscriptions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
