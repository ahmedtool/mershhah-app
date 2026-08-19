-- Lower the free monthly grant (15 -> 5) and reprice the credit packs for
-- Nano Banana Pro's real cost (~0.50 SAR/image) at a ~30% margin, keeping
-- the same round SAR prices (19/29/39).

CREATE OR REPLACE FUNCTION public.check_image_enhance_usage(p_restaurant_id text, p_consume boolean DEFAULT false)
RETURNS TABLE(allowed boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_is_paid boolean;
  v_balance integer;
  v_last_grant timestamptz;
  v_free_amount CONSTANT integer := 5;
  v_max_balance CONSTANT integer := 199;
BEGIN
  SELECT owner_id, is_paid_plan INTO v_owner_id, v_is_paid
  FROM public.restaurants WHERE id = p_restaurant_id;

  IF v_owner_id IS NULL OR (v_owner_id <> auth.uid() AND NOT public.is_admin()) THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  IF NOT v_is_paid THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  SELECT image_credits_balance, image_credits_last_free_grant
    INTO v_balance, v_last_grant
    FROM public.restaurants WHERE id = p_restaurant_id
    FOR UPDATE;

  IF v_last_grant IS NULL OR date_trunc('month', v_last_grant) < date_trunc('month', now()) THEN
    v_balance := LEAST(v_balance + v_free_amount, v_max_balance);
    UPDATE public.restaurants
      SET image_credits_balance = v_balance, image_credits_last_free_grant = now()
      WHERE id = p_restaurant_id;
  END IF;

  IF NOT p_consume THEN
    RETURN QUERY SELECT (v_balance > 0), v_balance;
    RETURN;
  END IF;

  IF v_balance <= 0 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  v_balance := v_balance - 1;
  UPDATE public.restaurants SET image_credits_balance = v_balance WHERE id = p_restaurant_id;
  RETURN QUERY SELECT true, v_balance;
END;
$$;

UPDATE public.image_credit_packs SET credits = 26 WHERE id = 'starter';
UPDATE public.image_credit_packs SET credits = 40 WHERE id = 'popular';
UPDATE public.image_credit_packs SET credits = 55 WHERE id = 'best_value';
