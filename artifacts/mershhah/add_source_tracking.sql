-- ============================================================
-- تتبع مصادر التقييمات + أحداث الصفحة
-- انسخ هذا الكود كاملاً في Supabase > SQL Editor > Run
-- ============================================================

-- 1. إضافة أعمدة المصدر لل reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS source text DEFAULT 'direct';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS source_detail text;

-- 2. جدول أحداث الصفحة (تتبع النقرات والتفاعلات)
CREATE TABLE IF NOT EXISTS public.page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id text REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_detail text,
  device_type text,
  created_at timestamptz DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert page events"
    ON public.page_events FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can view own restaurant events"
    ON public.page_events FOR SELECT
    USING (
      restaurant_id IN (
        SELECT r.id FROM public.restaurants r
        JOIN public.profiles p ON r.owner_id = p.id
        WHERE p.id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_page_events_restaurant ON public.page_events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_page_events_type ON public.page_events(event_type);
CREATE INDEX IF NOT EXISTS idx_page_events_created ON public.page_events(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_source ON public.reviews(source);

-- 5. تحديث التقييمات الحالية
UPDATE public.reviews SET source = 'direct' WHERE source IS NULL;
