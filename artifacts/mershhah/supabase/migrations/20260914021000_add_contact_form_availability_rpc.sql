-- Public, anon-callable check so the "التواصل والدعم" entry point can be
-- hidden entirely once a free-plan restaurant hits its monthly cap,
-- instead of showing the customer a submission error that would hint the
-- restaurant is on a limited/free plan. Returns only a boolean - never
-- exposes ticket contents or counts. The enforce_contact_ticket_limit
-- trigger (previous migration) remains the real security boundary; this
-- is purely for the UI to decide whether to show the option at all.
CREATE OR REPLACE FUNCTION public.contact_form_available(p_restaurant_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_paid boolean;
  v_count integer;
  v_limit CONSTANT integer := 15;
BEGIN
  SELECT is_paid_plan INTO v_is_paid FROM public.restaurants WHERE id = p_restaurant_id;

  IF v_is_paid IS NULL THEN
    RETURN false;
  END IF;

  IF v_is_paid IS TRUE THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.support_tickets
  WHERE restaurant_id = p_restaurant_id
    AND source = 'manual'
    AND created_at >= date_trunc('month', now());

  RETURN v_count < v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contact_form_available(text) TO anon, authenticated;
