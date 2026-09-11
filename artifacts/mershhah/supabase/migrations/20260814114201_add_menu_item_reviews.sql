-- Per-menu-item ratings, independent of the restaurant-level reviews table.
create table if not exists public.menu_item_reviews (
  id text primary key default gen_random_uuid()::text,
  menu_item_id text references public.menu_items(id) on delete cascade,
  restaurant_id text references public.restaurants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_visible boolean default true,
  created_at timestamptz default now()
);

alter table public.menu_item_reviews enable row level security;

-- Mirrors the existing "reviews" table policies exactly.
create policy "menu_item_reviews: public insert" on public.menu_item_reviews for insert with check (true);
create policy "menu_item_reviews: public read" on public.menu_item_reviews for select using (true);
create policy "menu_item_reviews: owner manage" on public.menu_item_reviews for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "menu_item_reviews: admin full" on public.menu_item_reviews for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create index if not exists idx_menu_item_reviews_item_id on public.menu_item_reviews(menu_item_id);
create index if not exists idx_menu_item_reviews_restaurant_id on public.menu_item_reviews(restaurant_id);
