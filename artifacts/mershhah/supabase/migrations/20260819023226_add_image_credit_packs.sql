-- Purchasable image-enhancement credit packs (admin-editable, mirrors the
-- `tools` table pattern: cached StreamPay product id, active flag, order).
CREATE TABLE IF NOT EXISTS public.image_credit_packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  credits integer NOT NULL,
  price numeric NOT NULL,
  streampay_product_id text,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_credit_packs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'image_credit_packs_public_read') THEN
    CREATE POLICY "image_credit_packs_public_read" ON public.image_credit_packs
      FOR SELECT USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'image_credit_packs_admin_all') THEN
    CREATE POLICY "image_credit_packs_admin_all" ON public.image_credit_packs
      FOR ALL USING (public.is_admin());
  END IF;
END $$;

INSERT INTO public.image_credit_packs (id, name, credits, price, position) VALUES
  ('starter', 'بداية', 39, 19, 0),
  ('popular', 'الأكثر طلباً', 69, 29, 1),
  ('best_value', 'أفضل قيمة', 99, 39, 2)
ON CONFLICT (id) DO NOTHING;
