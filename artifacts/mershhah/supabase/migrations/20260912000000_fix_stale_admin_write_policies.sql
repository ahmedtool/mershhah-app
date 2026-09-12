-- ============================================================
-- FIX: Admin can't add a global app (and 7 other tables have the same
-- latent bug)
--
-- Reported: adding a new app on /admin/applications fails with "new row
-- violates row-level security policy". Root cause: fix_rls.sql (2026-07-25)
-- rewrote "applications: admin full" (and 9 other tables' admin policies)
-- to check auth.users.raw_app_meta_data->>'role' = 'admin' - a field only
-- ever set via the Supabase Admin API, which nothing in this app's sign-up
-- or admin-creation code path does (profiles.role is what's actually set
-- and checked everywhere else). That makes the check permanently false.
--
-- This exact bug was already found and fixed once for `subscriptions`
-- (see fix_subscriptions_admin_insert.sql) and once for `profiles` (see
-- fix_profiles_admin_rls_recursion.sql, via the is_admin() function this
-- migration also reuses). The other 8 tables fix_rls.sql touched were
-- never revisited - fixing them all now instead of waiting for each to
-- surface as its own support ticket.
-- ============================================================

DROP POLICY IF EXISTS "restaurants: admin full" ON public.restaurants;
CREATE POLICY "restaurants: admin full" ON public.restaurants FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "branches: admin full" ON public.branches;
CREATE POLICY "branches: admin full" ON public.branches FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "menu_items: admin full" ON public.menu_items;
CREATE POLICY "menu_items: admin full" ON public.menu_items FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "offers: admin full" ON public.offers;
CREATE POLICY "offers: admin full" ON public.offers FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reviews: admin full" ON public.reviews;
CREATE POLICY "reviews: admin full" ON public.reviews FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "hub_visits: admin full" ON public.hub_visits;
CREATE POLICY "hub_visits: admin full" ON public.hub_visits FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "applications: admin full" ON public.applications;
CREATE POLICY "applications: admin full" ON public.applications FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "activity: admin full" ON public.activity;
CREATE POLICY "activity: admin full" ON public.activity FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
