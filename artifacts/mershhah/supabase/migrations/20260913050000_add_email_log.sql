-- Tracks every email mershhah sends through SNDR, since SNDR has no public
-- usage/quota API to poll (see the "استهلاك الخدمات" work). Populated by
-- the edge functions that already have DB access - the raw Supabase Auth
-- Hook (auth-send-email: signup/recovery/magic-link/invite/email-change/
-- reauthentication) is deliberately left uninstrumented for now since it's
-- the single most security-sensitive path in the app and currently has no
-- DB client at all; adding one is a separate, carefully-tested change.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  recipient text,
  subject text,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.email_log enable row level security;

drop policy if exists "email_log: admin full" on public.email_log;
create policy "email_log: admin full" on public.email_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
