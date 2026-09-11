-- "subscriptions: owner" (ALL, USING profile_id = auth.uid(), no explicit
-- WITH CHECK) let any authenticated user PATCH/INSERT their own subscription
-- row with plan_id='pro', status='active' directly via REST - an instant,
-- permanent free upgrade with zero payment. Verified live with a disposable
-- test account (successfully self-upgraded, then immediately reverted).
--
-- The app only ever self-inserts the free plan (RegisterForm/LoginForm/
-- AccountStatusChecker all use plan_id='free' literally) - real paid plans
-- are only ever written by the StreamPay webhook (service_role) or the
-- admin panel. Block anything else at the trigger level, since RLS's
-- default WITH CHECK (falling back to the USING clause) only constrains
-- profile_id, not which plan a user can grant themselves.

CREATE OR REPLACE FUNCTION public.prevent_self_paid_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := (current_setting('request.jwt.claims', true)::json ->> 'role');
  IF jwt_role = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.plan_id IS DISTINCT FROM 'free' THEN
    RAISE EXCEPTION 'Cannot self-assign a paid plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_paid_subscription_trigger ON public.subscriptions;
CREATE TRIGGER prevent_self_paid_subscription_trigger
BEFORE INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_paid_subscription();
