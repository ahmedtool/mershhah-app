-- Three more policies allowed ANY logged-in user to write rows they had no
-- relationship to at all:
--
-- 1. public_pages: owner write (USING auth.uid() IS NOT NULL) - any
--    registered user could overwrite the live public page of ANY restaurant
--    on the platform (real customers see this content), not just their own.
-- 2. announcements: admin write, 3. tasks: admin write - both named
--    "admin write" but actually had `(auth.uid() IS NOT NULL) OR admin` as
--    the qual, so any logged-in user (not just admins) could write to the
--    platform-wide announcements and the admin team's internal task board.

DROP POLICY IF EXISTS "public_pages: owner write" ON public.public_pages;
CREATE POLICY "public_pages: owner write" ON public.public_pages
  FOR ALL
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r WHERE r.username = public_pages.id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r WHERE r.username = public_pages.id AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "announcements: admin write" ON public.announcements;
CREATE POLICY "announcements: admin write" ON public.announcements
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tasks: admin write" ON public.tasks;
CREATE POLICY "tasks: admin write" ON public.tasks
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
