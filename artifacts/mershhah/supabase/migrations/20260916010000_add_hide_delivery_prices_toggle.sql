-- Lets an owner hide the per-app price shown on each delivery-app order
-- tile on the public menu (e.g. Keeta/HungerStation often mark items up,
-- and some owners don't want customers seeing that markup laid out next
-- to their own direct-order price). One switch for the whole restaurant,
-- and it only affects third-party delivery-app tiles - the restaurant's
-- own "direct order" tile always keeps showing its price, since that's
-- just the restaurant's real menu price either way.
alter table public.restaurants add column if not exists hide_delivery_prices boolean default false;
