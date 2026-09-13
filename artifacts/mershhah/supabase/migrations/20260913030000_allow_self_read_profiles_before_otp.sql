-- Root cause of "account exists" / bounced-to-login on every fresh admin
-- sign-in (Google AND plain email OTP): "require_otp: profiles" is
-- RESTRICTIVE FOR ALL USING (public.otp_ok()), with no exception for an
-- admin reading their OWN row. otp_ok() is false for any admin who hasn't
-- completed the step-up OTP within the last hour - which is exactly the
-- state of EVERY admin right after signing in, before OtpGate ever gets a
-- chance to run. That means the very query resolvePostAuthRoute (and
-- useUser()) need to run first - "does a profile exist for me, and what's
-- my role" - was itself being blocked by the policy meant to gate access
-- AFTER that role is already known. A chicken-and-egg lockout, not a
-- timing race (confirmed live: auth.users has exactly one row for
-- ahmedsupsa@gmail.com with both 'email' and 'google' identities correctly
-- linked to it, and exactly one matching profiles row - so there was never
-- an actual duplicate/mismatched identity to explain the symptom).
--
-- Fix: an admin may always read/write their OWN profile row regardless of
-- otp_ok(). This does NOT reopen the privilege-escalation hole fixed
-- earlier (20260826055744) - prevent_self_privilege_escalation_trigger
-- still independently blocks a non-2FA'd session from changing its own
-- role/admin_permissions/account_status via UPDATE. It only stops the
-- self-read (and otherwise-harmless self-update of columns like
-- full_name/admin_notes) from being blocked before OTP, which is what
-- resolvePostAuthRoute/useUser()/OtpGate all need to even begin the OTP
-- flow. Every OTHER admin-only table (subscriptions, transactions,
-- invoices, restaurants, branches, menu_items, offers, discount_codes)
-- keeps blocking everything until OTP passes, unchanged - those are only
-- ever queried from pages already behind OtpGate.

DROP POLICY IF EXISTS "require_otp: profiles" ON public.profiles;
CREATE POLICY "require_otp: profiles" ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.otp_ok() OR id = auth.uid());
