-- Adds per-delivery-app pricing to menu items, so an owner can set a
-- different price for the same dish on each delivery platform (e.g. Keeta,
-- Jahez, HungerStation) than the base price shown on the digital menu.
-- Keyed by the platform's id from the `applications` table (or a custom
-- app's id), e.g. {"hungerstation": 32, "jahez": 30}. Left blank/omitted
-- for a platform means "use the base price" on the public menu page.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS channel_prices jsonb NOT NULL DEFAULT '{}'::jsonb;
