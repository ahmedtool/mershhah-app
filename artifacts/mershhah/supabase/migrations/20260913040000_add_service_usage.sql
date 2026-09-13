-- Manual-entry tracker for the "استهلاك الخدمات" admin page. Most third-party
-- providers (Supabase, Vercel, ...) don't expose their billing-quota usage
-- (e.g. "3.8GB used of a 5GB free tier") through any public API - that view
-- is dashboard-only. Rather than fake automation, this stores whatever an
-- admin last read off each provider's own billing page.
create table if not exists public.service_usage (
  id uuid primary key default gen_random_uuid(),
  -- Matches the hardcoded service list in /admin/infrastructure - not a
  -- free-form name, so the frontend can reliably join a row to its card.
  service_key text not null unique,
  plan text,
  usage_value numeric,
  usage_unit text,
  limit_value numeric,
  limit_unit text,
  cost_sar numeric,
  billing_cycle text,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.service_usage enable row level security;

drop policy if exists "service_usage: admin full" on public.service_usage;
create policy "service_usage: admin full" on public.service_usage
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
