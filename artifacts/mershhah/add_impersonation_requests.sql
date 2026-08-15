-- Lets an admin request temporary, owner-approved access to a restaurant's
-- real owner dashboard (for support). Fixed 24h window from approval.
create table if not exists public.impersonation_requests (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete cascade,
  restaurant_id text references public.restaurants(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired')),
  reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  entered_at timestamptz,
  entry_count integer not null default 0
);

alter table public.impersonation_requests enable row level security;

-- Admin: full access (uses the SECURITY DEFINER helper - see
-- fix_profiles_admin_rls_recursion.sql - so this doesn't hit the same
-- self-reference recursion issue that broke profiles' own admin policy).
create policy "impersonation_requests: admin full" on public.impersonation_requests for all using (public.is_admin());

-- Owner: can see and decide on requests for their own restaurant.
create policy "impersonation_requests: owner read" on public.impersonation_requests for select using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "impersonation_requests: owner decide" on public.impersonation_requests for update using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);

create index if not exists idx_impersonation_requests_restaurant on public.impersonation_requests(restaurant_id);
create index if not exists idx_impersonation_requests_admin on public.impersonation_requests(admin_id);
