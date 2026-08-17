-- Link cost calculations to a real menu item so the calculator can write
-- the computed cost back onto that item's size.
ALTER TABLE public.product_cost_calculations
  ADD COLUMN IF NOT EXISTS menu_item_id text REFERENCES public.menu_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_cost_calculations_menu_item_id ON public.product_cost_calculations(menu_item_id);
