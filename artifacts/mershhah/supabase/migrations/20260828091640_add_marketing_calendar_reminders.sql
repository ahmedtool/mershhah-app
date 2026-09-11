-- Lets an owner subscribe to a "remind me before this occasion" toggle on
-- the marketing calendar tool. Only occasions with a clean, computable
-- "D شهر" date (handled client-side in marketing-calendar-2025.ts) are
-- reminder-eligible - relative-phrase ("second Monday of January") and
-- variable-date (Ramadan, Eid) entries are excluded rather than guessed at.

CREATE TABLE IF NOT EXISTS public.marketing_calendar_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  occasion_key text NOT NULL,
  occasion_name text NOT NULL,
  occasion_month int NOT NULL CHECK (occasion_month BETWEEN 1 AND 12),
  occasion_day int NOT NULL CHECK (occasion_day BETWEEN 1 AND 31),
  last_sent_year int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, occasion_key)
);

ALTER TABLE public.marketing_calendar_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_calendar_reminders: owner full" ON public.marketing_calendar_reminders
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
