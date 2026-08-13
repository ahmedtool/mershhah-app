-- Admin-managed shared product library (drinks, juices, desserts, sauces...).
-- Owners browse this catalog and copy an item into their own menu_items; the
-- copy is an independent snapshot (name/calories/image at add-time) - later
-- admin edits to the source row never retroactively affect items already added.
create table if not exists public.shared_menu_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  calories integer,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_menu_products enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'shared_menu_products_public_read') then
    create policy "shared_menu_products_public_read" on public.shared_menu_products for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'shared_menu_products_admin_write') then
    create policy "shared_menu_products_admin_write" on public.shared_menu_products for all using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;
end $$;

create index if not exists idx_shared_menu_products_category on public.shared_menu_products(category);
