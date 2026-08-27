-- Stamps an `otp_ok` claim into every JWT Supabase issues (sign-in and
-- refresh). owner/admin accounts get otp_ok=true only if they verified an
-- OTP code within the last hour (matching OtpGate's existing idle-timeout
-- window); everyone else always gets otp_ok=true, since OTP was never
-- required for them. This is what makes OTP a real, server-checked gate
-- instead of just a sessionStorage flag in the browser - the RLS policies
-- that reference this claim are the actual enforcement point, not the
-- React component.
--
-- Never raises: any error here must not be able to break sign-in for
-- everyone. On error the claim is simply left unset, which restrictive RLS
-- policies checking it treat as false (fails closed on data access, not on
-- login itself).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  target_user_id uuid;
  target_role text;
  verified_at timestamptz;
BEGIN
  target_user_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  SELECT role, otp_verified_at INTO target_role, verified_at
  FROM public.profiles WHERE id = target_user_id;

  IF target_role IN ('owner', 'admin') THEN
    claims := jsonb_set(claims, '{otp_ok}', to_jsonb(verified_at IS NOT NULL AND verified_at > now() - interval '1 hour'));
  ELSE
    claims := jsonb_set(claims, '{otp_ok}', 'true'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
