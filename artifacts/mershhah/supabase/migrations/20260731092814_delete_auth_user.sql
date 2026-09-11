-- Function to delete auth user (runs as superuser via SECURITY DEFINER)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/smmriycsboexindabanc/sql

CREATE OR REPLACE FUNCTION public.delete_auth_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.delete_auth_user(uuid) TO authenticated;
