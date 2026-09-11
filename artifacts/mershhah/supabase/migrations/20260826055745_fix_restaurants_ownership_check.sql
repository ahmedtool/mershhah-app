-- "restaurants: owner full" restricted which rows a user could target
-- (USING owner_id = auth.uid()) but had no WITH CHECK, defaulting to
-- allowing any new row content - meaning an owner could reassign their own
-- restaurant's owner_id to a different account. Verified live: the same
-- update request that succeeds normally was rejected (403) once WITH CHECK
-- required owner_id to still equal the caller after the change.

DROP POLICY IF EXISTS "restaurants: owner full" ON public.restaurants;
CREATE POLICY "restaurants: owner full" ON public.restaurants
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
