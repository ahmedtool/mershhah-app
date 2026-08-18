-- Replace the monthly-restaurant-level image-enhance quota with a per-product
-- lifetime cap: free plan gets none at all, paid plan gets 2 enhancements
-- per menu item (not a global monthly allowance).

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS image_enhance_count integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.check_image_enhance_usage(text, boolean);

-- Server-side, atomic check-and-increment scoped to one menu item.
-- Free plan (is_paid_plan = false): always 0 allowed, no exceptions.
-- Paid plan: up to 2 enhancements per menu item, ever.
-- p_consume = false: read-only check (used to display remaining count).
-- p_consume = true: actually consumes one unit if allowed - called right
-- before running the AI model, since that's the expensive step (not save).
CREATE OR REPLACE FUNCTION public.check_image_enhance_usage(p_menu_item_id text, p_consume boolean DEFAULT false)
RETURNS TABLE(allowed boolean, remaining integer, is_unlimited boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id text;
  v_owner_id uuid;
  v_is_paid boolean;
  v_count integer;
  v_limit CONSTANT integer := 2;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id FROM public.menu_items WHERE id = p_menu_item_id;
  IF v_restaurant_id IS NULL THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  SELECT owner_id, is_paid_plan INTO v_owner_id, v_is_paid
  FROM public.restaurants WHERE id = v_restaurant_id;

  IF v_owner_id IS NULL OR (v_owner_id <> auth.uid() AND NOT public.is_admin()) THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  -- Free plan: no access to this tool at all.
  IF NOT v_is_paid THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  SELECT image_enhance_count INTO v_count
    FROM public.menu_items WHERE id = p_menu_item_id
    FOR UPDATE;

  IF NOT p_consume THEN
    RETURN QUERY SELECT (v_count < v_limit), GREATEST(v_limit - v_count, 0), false;
    RETURN;
  END IF;

  IF v_count >= v_limit THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  v_count := v_count + 1;
  UPDATE public.menu_items SET image_enhance_count = v_count WHERE id = p_menu_item_id;
  RETURN QUERY SELECT true, (v_limit - v_count), false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_image_enhance_usage(text, boolean) TO authenticated;

-- Defense in depth: only the SECURITY DEFINER function above can change the
-- per-item counter - an owner can't just UPDATE menu_items to reset it.
REVOKE UPDATE (image_enhance_count) ON public.menu_items FROM authenticated, anon;

-- The old restaurant-level monthly counters are no longer used by anything.
ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS image_enhance_monthly_count,
  DROP COLUMN IF EXISTS image_enhance_last_reset;
