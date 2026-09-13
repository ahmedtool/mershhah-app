-- Product decision: mandatory step-up OTP now applies to admin accounts
-- only. Owner sign-up/sign-in must stay fast (Google -> straight into
-- /owner, or email OTP as the one and only factor) - the earlier design
-- required a second factor for owner too, which this reverses. If an
-- owner ever gets a self-serve "enable 2FA" toggle in the future, this
-- function is where that per-owner opt-in would be re-introduced.
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

  IF target_role = 'admin' THEN
    claims := jsonb_set(claims, '{otp_ok}', to_jsonb(verified_at IS NOT NULL AND verified_at > now() - interval '1 hour'));
  ELSE
    claims := jsonb_set(claims, '{otp_ok}', 'true'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END;
$$;
