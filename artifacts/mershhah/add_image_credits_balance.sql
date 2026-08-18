-- Replace the per-menu-item enhancement cap with a restaurant-wide shared
-- credit balance: 15 free credits granted once per calendar month (rolls
-- over, doesn't reset), purchasable top-up packs, hard cap of 199 total
-- balance at any time. Free (non-paid) plan always gets 0 - no grants, no
-- purchases, no access.

-- Drop the previous per-item quota machinery (superseded).
DROP FUNCTION IF EXISTS public.check_image_enhance_usage(text, boolean);
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS image_enhance_count;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS image_credits_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_credits_last_free_grant timestamptz;

-- Server-side, atomic check-and-increment for the shared restaurant balance.
-- Free plan (is_paid_plan = false): always 0, no exceptions.
-- Paid plan: grants 15 credits once per calendar month (capped so the total
-- never exceeds 199), then checks/consumes against the current balance.
-- p_consume = false: read-only check (used to display remaining balance).
-- p_consume = true: actually consumes one credit if allowed - called right
-- before running the AI model, since that's the expensive step.
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
  v_free_amount CONSTANT integer := 15;
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

  -- Grant the monthly free credits once per calendar month. Rolls over
  -- (never subtracted for being unused), just capped at the max balance.
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

GRANT EXECUTE ON FUNCTION public.check_image_enhance_usage(text, boolean) TO authenticated;

-- Defense in depth: only the SECURITY DEFINER function above can change the
-- balance/grant columns - an owner can't just UPDATE restaurants to top up
-- their own balance for free.
REVOKE UPDATE (image_credits_balance, image_credits_last_free_grant)
  ON public.restaurants FROM authenticated, anon;
