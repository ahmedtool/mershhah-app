-- FIX: Re-uploading a file that already exists at the same path in
-- restaurant-assets (upsert:true, e.g. re-adding/replacing an admin app
-- logo, or an owner re-uploading their restaurant logo/menu image) fails
-- with "new row violates row-level security policy" - reproduced live via
-- /admin/applications: a brand-new logo filename uploads fine (plain
-- INSERT), but overwriting an existing one (upsert becomes an UPDATE)
-- has no matching policy, since fix_storage_policies.sql only ever added
-- INSERT and DELETE policies for this bucket and never UPDATE.
--
-- Same admin-or-owning-restaurant scoping as the existing INSERT/DELETE
-- policies, just for UPDATE.

CREATE POLICY "restaurant-assets: owner update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'restaurant-assets' AND (
      public.is_admin() OR (
        (storage.foldername(objects.name))[1] = 'restaurants' AND
        EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = (storage.foldername(objects.name))[2] AND r.owner_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'restaurant-assets' AND (
      public.is_admin() OR (
        (storage.foldername(objects.name))[1] = 'restaurants' AND
        EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = (storage.foldername(objects.name))[2] AND r.owner_id = auth.uid())
      )
    )
  );
