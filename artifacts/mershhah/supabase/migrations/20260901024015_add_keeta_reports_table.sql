-- Persists every parsed Keeta report so an owner can browse past uploads
-- without re-uploading, per request. Stores both the computed summary
-- (jsonb, shape varies per report_type) and the raw file itself in
-- restaurant-assets - that bucket's existing RLS policies already scope
-- restaurants/{id}/... to that restaurant's real owner, so storing under
-- that same prefix inherits correct access control with no new storage
-- policy needed.

CREATE TABLE IF NOT EXISTS public.keeta_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text,
  period_from text,
  period_to text,
  row_count integer,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS keeta_reports_restaurant_type_idx
  ON public.keeta_reports (restaurant_id, report_type, created_at DESC);

ALTER TABLE public.keeta_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keeta_reports: owner full" ON public.keeta_reports
  FOR ALL
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r WHERE r.id = keeta_reports.restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r WHERE r.id = keeta_reports.restaurant_id AND r.owner_id = auth.uid()
    )
  );
