-- Real, ownable menu categories (replacing implicit free-text strings that
-- had no controllable display order). menu_items.category stays as a
-- denormalized text mirror of the linked category's name, so every existing
-- consumer (public menu page grouping, MenuTable, reports) keeps working
-- unchanged while category_id becomes the real source of truth going forward.
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text references public.restaurants(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.menu_categories enable row level security;

create policy "menu_categories: public read" on public.menu_categories for select using (true);
create policy "menu_categories: owner manage" on public.menu_categories for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "menu_categories: admin full" on public.menu_categories for all using (public.is_admin());

create index if not exists idx_menu_categories_restaurant on public.menu_categories(restaurant_id);

alter table public.menu_items add column if not exists category_id uuid references public.menu_categories(id) on delete set null;
create index if not exists idx_menu_items_category_id on public.menu_items(category_id);
