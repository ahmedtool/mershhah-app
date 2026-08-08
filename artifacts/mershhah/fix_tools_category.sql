-- Fix tools category check constraint to accept any text
ALTER TABLE public.tools DROP CONSTRAINT IF EXISTS tools_category_check;

-- Allow any category text (not just the 3 fixed ones)
ALTER TABLE public.tools ADD CONSTRAINT tools_category_check CHECK (category IS NOT NULL AND length(category) > 0);
