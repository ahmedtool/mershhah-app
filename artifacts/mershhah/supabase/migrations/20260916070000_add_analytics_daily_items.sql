-- Per-item companion to analytics_daily: one row per (restaurant, menu
-- item, day) interaction count. Without this, purging old
-- menu_item_interactions rows would silently break the reports page's
-- "most engaged items" / menu-engineering cards, which read that table as
-- an all-time total with no date filter at all. With it, those cards can
-- sum this rollup (all history) plus today's not-yet-aggregated raw rows
-- and get the same all-time number they always have, while the raw table
-- itself stays bounded.
--
-- Also doubles as new capability on its own: it's what lets the "reports
-- by period" section show a top-items leaderboard for any period, not just
-- an all-time list - something the raw table alone can't answer without
-- scanning everything.
create table if not exists public.analytics_daily_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  menu_item_id text not null references public.menu_items(id) on delete cascade,
  day date not null,
  interactions integer not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, menu_item_id, day)
);

alter table public.analytics_daily_items enable row level security;

-- No insert/update policy: only the edge function (service role, which
-- bypasses RLS entirely) ever writes to this table.
create policy "analytics_daily_items: owner read" on public.analytics_daily_items for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "analytics_daily_items: admin read" on public.analytics_daily_items for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create index if not exists idx_analytics_daily_items_restaurant_day on public.analytics_daily_items(restaurant_id, day desc);
create index if not exists idx_analytics_daily_items_item on public.analytics_daily_items(menu_item_id);
