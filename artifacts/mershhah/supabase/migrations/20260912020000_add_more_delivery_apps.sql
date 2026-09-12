-- Adds an English name column to the global apps catalog (didn't exist
-- before - every other translatable entity in this schema has name_en,
-- this one was just missed), then seeds 7 more delivery platforms.
-- Skips jahez/hungerstation/toyou/keeta since those already exist.
-- No links/logos included per request - logos can be uploaded later from
-- /admin/applications, same as every existing app.

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS name_en text;

INSERT INTO public.applications (id, name, name_en, platform_id, category) VALUES
  ('noon_food', 'نون فود', 'Noon Food', 'noon_food', 'delivery'),
  ('thechefz', 'ذا شيفز', 'The Chefz', 'thechefz', 'delivery'),
  ('mrmandoob', 'مستر مندوب', 'Mr Mandoob', 'mrmandoob', 'delivery'),
  ('ananinja', 'نينجا', 'Ananinja', 'ananinja', 'delivery'),
  ('mrsool', 'مرسول', 'Mrsool', 'mrsool', 'delivery'),
  ('nana', 'نعناع', 'Nana', 'nana', 'delivery'),
  ('shgardi', 'شقردي', 'Shgardi', 'shgardi', 'delivery')
ON CONFLICT (id) DO NOTHING;

select id, name, name_en, category from public.applications order by name;
