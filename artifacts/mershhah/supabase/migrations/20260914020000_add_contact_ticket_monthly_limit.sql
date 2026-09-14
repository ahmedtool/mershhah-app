-- The public "التواصل والدعم" (contact) form was the one gateway channel
-- with no plan gating at all - every other business_gateway_services type
-- (franchise/wholesale/corporate/partnership/custom) is already behind a
-- paid-plan entitlement flag. Free-plan restaurants now get a 15-per-month
-- cap on customer-submitted (source = 'manual') tickets; paid plans
-- (is_paid_plan = true) stay unlimited. AI-assistant-created tickets
-- (source = 'ai') are a separate feature and are left untouched.
CREATE OR REPLACE FUNCTION public.enforce_contact_ticket_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_paid boolean;
  v_count integer;
  v_limit CONSTANT integer := 15;
BEGIN
  IF NEW.source <> 'manual' OR NEW.restaurant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_paid_plan INTO v_is_paid FROM public.restaurants WHERE id = NEW.restaurant_id;

  IF v_is_paid IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.support_tickets
  WHERE restaurant_id = NEW.restaurant_id
    AND source = 'manual'
    AND created_at >= date_trunc('month', now());

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'contact_ticket_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_contact_ticket_limit ON public.support_tickets;
CREATE TRIGGER trg_enforce_contact_ticket_limit
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_ticket_limit();
