-- Add applications column to branches table
-- Each branch can have its own delivery app links

ALTER TABLE public.branches 
ADD COLUMN IF NOT EXISTS applications jsonb DEFAULT '[]'::jsonb;

-- Comment: applications is an array of objects like:
-- [{ id: "hunger", name: "هنجر", logo: "path/to/logo", value: "https://hunger.com/..." }]
