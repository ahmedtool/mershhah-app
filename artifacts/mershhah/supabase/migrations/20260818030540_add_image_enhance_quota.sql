-- Monthly quota tracking for the free-tier image-quality-enhancer tool.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS image_enhance_monthly_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_enhance_last_reset timestamptz;

-- Server-side, atomic check-and-increment. Row-locked so concurrent calls
-- (double-click, multiple tabs) can't race past the free limit. Paid
-- restaurants (is_paid_plan = true) are always unlimited.
-- p_consume = false: read-only usage check (used to display remaining count).
-- p_consume = true: actually consumes one unit if allowed.
CREATE OR REPLACE FUNCTION public.check_image_enhance_usage(p_restaurant_id text, p_consume boolean DEFAULT false)
RETURNS TABLE(allowed boolean, remaining integer, is_unlimited boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_is_paid boolean;
  v_count integer;
  v_last_reset timestamptz;
  v_limit CONSTANT integer := 10;
BEGIN
  SELECT owner_id, is_paid_plan INTO v_owner_id, v_is_paid
  FROM public.restaurants WHERE id = p_restaurant_id;

  IF v_owner_id IS NULL OR (v_owner_id <> auth.uid() AND NOT public.is_admin()) THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  IF v_is_paid THEN
    RETURN QUERY SELECT true, -1, true;
    RETURN;
  END IF;

  SELECT image_enhance_monthly_count, image_enhance_last_reset
    INTO v_count, v_last_reset
    FROM public.restaurants WHERE id = p_restaurant_id
    FOR UPDATE;

  IF v_last_reset IS NULL OR now() - v_last_reset > interval '30 days' THEN
    v_count := 0;
    v_last_reset := now();
    UPDATE public.restaurants
      SET image_enhance_monthly_count = 0, image_enhance_last_reset = v_last_reset
      WHERE id = p_restaurant_id;
  END IF;

  IF NOT p_consume THEN
    RETURN QUERY SELECT (v_count < v_limit), GREATEST(v_limit - v_count, 0), false;
    RETURN;
  END IF;

  IF v_count >= v_limit THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  v_count := v_count + 1;
  UPDATE public.restaurants SET image_enhance_monthly_count = v_count WHERE id = p_restaurant_id;
  RETURN QUERY SELECT true, (v_limit - v_count), false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_image_enhance_usage(text, boolean) TO authenticated;

-- Defense in depth: block direct client writes to the quota columns so an
-- owner can't just UPDATE restaurants to reset their own count. Only this
-- SECURITY DEFINER function (which bypasses grants) can change them.
REVOKE UPDATE (image_enhance_monthly_count, image_enhance_last_reset)
  ON public.restaurants FROM authenticated, anon;
