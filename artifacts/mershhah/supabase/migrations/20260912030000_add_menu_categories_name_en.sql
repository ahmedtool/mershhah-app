-- Category names never had an English counterpart, unlike every other
-- translatable field in this schema (restaurants/branches/menu_items all
-- have name_en) - the public menu page always fell back to the Arabic
-- name when a visitor switched to English. Same field name/shape so the
-- existing name_en fallback pattern used everywhere else applies directly.
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS name_en text;
