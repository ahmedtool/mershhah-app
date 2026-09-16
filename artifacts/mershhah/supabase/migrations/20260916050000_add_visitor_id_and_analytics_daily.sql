-- Distinguishes repeat visits from the same browser: a random id generated
-- once client-side and persisted in localStorage (see src/lib/visitor-id.ts),
-- sent along with every hub_visits insert. It's a soft signal - a different
-- device/browser, private window, or cleared storage looks like a new
-- visitor - but it's the least invasive way to approximate "unique
-- visitors" without IP tracking (unreliable here: most visitors open the
-- QR link on mobile data behind carrier-grade NAT, so many unrelated
-- people can share one public IP at the same time).
alter table public.hub_visits add column if not exists visitor_id text;
create index if not exists idx_hub_visits_visitor on public.hub_visits(visitor_id);

-- Daily rollup so historical reports (a full year, eventually) never need
-- to scan the raw event tables - one row per restaurant per day, written by
-- the aggregate-daily-analytics edge function (see
-- schedule_analytics_aggregation.sql for the pg_cron job that runs it).
-- Raw hub_visits/page_events rows are purged by that same function once
-- they're older than its retention window, safely after being rolled up
-- here - menu_item_interactions is deliberately NOT purged yet, since the
-- reports page's per-item popularity/menu-engineering cards read it as an
-- all-time total with no rollup of their own.
create table if not exists public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  day date not null,
  visits_total integer not null default 0,
  visits_unique integer not null default 0,
  visits_qr integer not null default 0,
  visits_link integer not null default 0,
  source_breakdown jsonb not null default '{}'::jsonb,
  clicks_total integer not null default 0,
  event_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (restaurant_id, day)
);

alter table public.analytics_daily enable row level security;

-- No insert/update policy: only the edge function (service role, which
-- bypasses RLS entirely) ever writes to this table.
create policy "analytics_daily: owner read" on public.analytics_daily for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "analytics_daily: admin read" on public.analytics_daily for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create index if not exists idx_analytics_daily_restaurant_day on public.analytics_daily(restaurant_id, day desc);
