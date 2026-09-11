-- storage.objects policies had the same gap as several table-level ones
-- found earlier: "logged in" was being used as a stand-in for "owns this",
-- which isn't the same thing.
--
-- chat-attachments: "Anyone can upload chat attachments" and "Public read
-- for chat attachments" had NO auth requirement at all, despite the bucket
-- being marked private - verified live, an anonymous request downloaded a
-- real customer's photo from a real support conversation. Scoped to the
-- chat's actual owner (or admin), matching chats' own RLS policy.
--
-- restaurant-assets: INSERT/DELETE only checked `auth.uid() IS NOT NULL`,
-- not which restaurant the path belongs to - verified live, a throwaway
-- file placed under a different (fake) restaurant's folder was deleted
-- successfully using an unrelated account's token. Scoped uploads/deletes
-- under restaurants/{id}/... to that restaurant's real owner; kept
-- admin-only for the other top-level folders (application_logos, tools,
-- shared-products), which are platform-managed, not per-restaurant.

DROP POLICY IF EXISTS "Anyone can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read for chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments: auth all" ON storage.objects;

CREATE POLICY "chat-attachments: participant only" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'chat-attachments' AND (
      public.is_admin() OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = (storage.foldername(name))[2] AND c."ownerId" = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'chat-attachments' AND (
      public.is_admin() OR EXISTS (
        SELECT 1 FROM public.chats c
        WHERE c.id = (storage.foldername(name))[2] AND c."ownerId" = auth.uid()::text
      )
    )
  );

-- NOTE: `name` inside the EXISTS subquery must refer to storage.objects.name
-- (the file path), not restaurants.name (the business's display name) - an
-- earlier version of this policy left it unqualified and Postgres silently
-- resolved it to the closer `restaurants.name` instead, since that column
-- also exists. storage.foldername() on a plain business name string like
-- "مقهى تجريبي" has no '/' separators, so the ownership check always came
-- back false - verified live, it blocked even the restaurant's own owner
-- from uploading to their own folder. Fixed by qualifying explicitly.
DROP POLICY IF EXISTS "restaurant-assets: auth upload" ON storage.objects;
CREATE POLICY "restaurant-assets: auth upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'restaurant-assets' AND (
      public.is_admin() OR (
        (storage.foldername(objects.name))[1] = 'restaurants' AND
        EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = (storage.foldername(objects.name))[2] AND r.owner_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "restaurant-assets: owner delete" ON storage.objects;
CREATE POLICY "restaurant-assets: owner delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'restaurant-assets' AND (
      public.is_admin() OR (
        (storage.foldername(objects.name))[1] = 'restaurants' AND
        EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = (storage.foldername(objects.name))[2] AND r.owner_id = auth.uid())
      )
    )
  );
