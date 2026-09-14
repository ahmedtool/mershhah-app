-- The admin infrastructure page's "top subscribers by StreamPay usage"
-- card queries public.transactions directly from the browser. That table
-- carries the same RESTRICTIVE "require_otp: transactions" policy as
-- profiles/subscriptions/etc (see
-- 20260913010000_replace_jwt_hook_otp_check_with_live_db_check.sql) - an
-- admin whose step-up OTP verification is more than an hour old gets back
-- ZERO rows, silently, no error, indistinguishable from "no transactions
-- this month". The main StreamPay usage number on the same page doesn't
-- have this problem because it's computed server-side by the
-- sync-service-usage Edge Function with the service-role key, which
-- bypasses RLS entirely.
--
-- Fix: a SECURITY DEFINER RPC, same pattern as is_admin()/otp_ok() - it
-- bypasses RLS itself, and does its own explicit admin check internally
-- instead of relying on the OTP-gated policy, so it can never go quiet
-- just because the admin's OTP timer lapsed.
CREATE OR REPLACE FUNCTION public.get_top_transaction_subscribers(month_start timestamptz)
RETURNS TABLE(profile_id uuid, name text, amount numeric, tx_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    COALESCE(p.restaurant_name, p.full_name, '—'),
    SUM(t.amount),
    COUNT(*)
  FROM public.transactions t
  JOIN public.profiles p ON p.id = t.profile_id
  WHERE t.status = 'completed'
    AND t.created_at >= month_start
    AND public.is_admin()
  GROUP BY p.id, p.restaurant_name, p.full_name
  ORDER BY SUM(t.amount) DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_transaction_subscribers(timestamptz) TO authenticated;
