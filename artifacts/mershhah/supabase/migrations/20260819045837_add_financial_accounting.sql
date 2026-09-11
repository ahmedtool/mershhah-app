-- Real accounting: track StreamPay's processing fee (which StreamPay's own
-- API does NOT expose per-transaction - only the card network used is
-- available), the AI image cost (COGS), and the free-grant subsidy, so
-- admin financials can show true net profit instead of just gross revenue.

-- Editable fee-rate card. Seeded from a real observed StreamPay example
-- (19 SAR charge -> 1.29 SAR fee on Visa/Mastercard, 1.03 SAR fee on Mada).
-- StreamPay doesn't publish these rates, so adjust here if the real
-- percentage turns out to differ - no code deploy needed.
CREATE TABLE IF NOT EXISTS public.payment_fee_rates (
  payment_method text PRIMARY KEY,
  fee_percent numeric NOT NULL,
  vat_percent numeric NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_fee_rates (payment_method, fee_percent) VALUES
  ('MADA', 5.42),
  ('VISA', 6.79),
  ('MASTERCARD', 6.79),
  ('AMEX', 6.79),
  ('APPLE_PAY', 6.79),
  ('SAMSUNG_PAY', 6.79),
  ('CARD', 6.79),
  ('PGW_CARD_UNSPECIFIED', 6.79),
  ('QURRAH', 6.79),
  ('BANK_TRANSFER', 0),
  ('CASH', 0)
ON CONFLICT (payment_method) DO NOTHING;

ALTER TABLE public.payment_fee_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payment_fee_rates_admin') THEN
    CREATE POLICY "payment_fee_rates_admin" ON public.payment_fee_rates FOR ALL USING (public.is_admin());
  END IF;
END $$;

-- Per-transaction breakdown: gross amount is already in `amount`.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS gateway_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_vat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric,
  ADD COLUMN IF NOT EXISTS cogs numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_grant_subsidy numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_profit numeric;
