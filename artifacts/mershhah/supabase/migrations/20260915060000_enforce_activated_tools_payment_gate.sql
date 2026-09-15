-- The store's gate was UI-only: activated_tools' RLS policy
-- ("activated_tools_owner_all") only checks profile_id = auth.uid(), so
-- anyone signed in could call supabase.from('activated_tools').upsert(...)
-- directly for ANY tool_id - including a paid, independently-purchased
-- add-on that's only meant to unlock via a real StreamPay payment
-- (confirmed by the streampay-webhook, which is the only other writer and
-- runs with the service-role key). This closes that gap server-side, so a
-- paid tool genuinely cannot be activated without paying for it - not just
-- hidden behind a disabled button in the UI.
CREATE OR REPLACE FUNCTION public.enforce_activated_tools_payment_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tool RECORD;
  v_email text;
  v_is_paid boolean;
BEGIN
  -- Only a status of 'active' actually grants access - deactivation
  -- (status = 'cancelled') and any other field-only update pass through.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- The webhook writes with the service-role key, which has no auth.uid()
  -- at all - this trigger only needs to gate a self-service write where the
  -- caller is activating a row under their own profile_id.
  IF auth.uid() IS DISTINCT FROM NEW.profile_id THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.profile_id;
  IF v_email = 'ahmednasmhi@gmail.com' THEN
    RETURN NEW; -- team/test account - every paid tool unlocked, same as the UI bypass
  END IF;

  SELECT * INTO v_tool FROM public.tools WHERE id = NEW.tool_id;
  IF v_tool.type IS DISTINCT FROM 'paid' THEN
    RETURN NEW; -- genuinely free tool
  END IF;

  IF COALESCE(v_tool.billing_type, 'plan') = 'addon' THEN
    RAISE EXCEPTION 'This tool is purchased separately - activate it through checkout.';
  END IF;

  -- billing_type = 'plan': bundled with an active paid subscription, no
  -- separate charge - but still requires the restaurant to actually be on
  -- one (mirrors restaurants.is_paid_plan, flipped true by the same webhook
  -- on a real subscription payment).
  SELECT is_paid_plan INTO v_is_paid FROM public.restaurants WHERE owner_id = NEW.profile_id;
  IF v_is_paid IS NOT TRUE THEN
    RAISE EXCEPTION 'An active paid plan is required to activate this tool.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_activated_tools_payment_gate ON public.activated_tools;
CREATE TRIGGER trg_enforce_activated_tools_payment_gate
  BEFORE INSERT OR UPDATE ON public.activated_tools
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activated_tools_payment_gate();
