-- Server-side daily usage cap for the Gemini fallback layer of the AI
-- assistant. One row per day; the edge function increments it and refuses
-- to call Gemini once the cap is hit, falling back to the local rule-based
-- reply instead. Global (not per-restaurant) since the goal is a single
-- hard ceiling on total spend risk, not per-tenant quotas.
create table if not exists public.ai_gemini_usage (
  usage_date date primary key default current_date,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_gemini_usage enable row level security;

-- No public policies at all: only the service role (used server-side by
-- the edge function) can read or write this table.
