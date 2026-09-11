-- ============================================================
-- نظام كود التحقق (OTP) عند تسجيل الدخول — للمالك والأدمن فقط
-- ============================================================

CREATE TABLE IF NOT EXISTS public.login_otp_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  attempts integer default 0,
  verified_at timestamptz,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_login_otp_profile ON public.login_otp_codes(profile_id, created_at desc);

ALTER TABLE public.login_otp_codes ENABLE ROW LEVEL SECURITY;

-- No client-side access at all — only the edge functions (service role)
-- generate and verify codes. A user must never be able to read their own
-- pending code directly from the table.
DROP POLICY IF EXISTS "login_otp_service_only" ON public.login_otp_codes;
CREATE POLICY "login_otp_service_only" ON public.login_otp_codes
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');
