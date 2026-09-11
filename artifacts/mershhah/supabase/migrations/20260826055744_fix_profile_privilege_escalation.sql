-- "profiles: update own" (USING auth.uid() = id, WITH CHECK not set) let any
-- authenticated user change ANY column on their own row via a plain REST
-- call - including `role`. Confirmed live with a test account: a single
-- authenticated PATCH request set role to 'admin' and was accepted (200),
-- granting full platform admin access with zero other information needed.
-- Immediately reverted the test account afterward.
--
-- RLS alone can't express "same USING row, but only some columns may
-- change" - a BEFORE UPDATE trigger checking OLD vs NEW is the standard fix.
-- Admins are exempt so the admin panel's own role-management still works.

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change role';
    END IF;
    IF NEW.admin_permissions IS DISTINCT FROM OLD.admin_permissions THEN
      RAISE EXCEPTION 'Cannot change admin_permissions';
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'Cannot change account_status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_privilege_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_self_privilege_escalation_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_privilege_escalation();
