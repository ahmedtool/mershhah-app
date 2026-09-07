-- ============================================================
-- BUSINESS & COMMUNICATION GATEWAY
-- Turns /support/[username] from one fixed ticket form into a set of
-- owner-toggleable request channels (contact, jobs, and later
-- franchise/wholesale/corporate/partnership/custom types), each gated
-- by plan and each writing into its own submissions shape.
--
-- support_tickets stays exactly as-is and keeps serving "Contact".
-- ============================================================

-- Which gateway services a restaurant has turned on, and their settings.
-- One row per built-in service_type (app-enforced); 'custom:<slug>' rows
-- are unbounded per restaurant. Mirrors activated_tools' "on/off + JSONB
-- config" shape, just keyed by service_type instead of tool_id.
create table if not exists public.business_gateway_services (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  service_type text not null,
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_gateway_services_restaurant_id_idx
  on public.business_gateway_services (restaurant_id);

-- Owner-authored job listings shown under the "Jobs" service.
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  title text not null,
  location text,
  employment_type text, -- 'full_time' | 'part_time'
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists job_postings_restaurant_id_idx
  on public.job_postings (restaurant_id);

-- Every submission that isn't "Contact": job applications (service_type
-- 'jobs', job_posting_id set, fields.cv_url) plus franchise/wholesale/
-- corporate/partnership/custom (job_posting_id null, fields holds the
-- dynamic answers keyed by the owner-configured field list).
create table if not exists public.business_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  service_type text not null,
  job_posting_id uuid references public.job_postings(id) on delete set null,
  name text,
  phone text,
  email text,
  fields jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists business_requests_restaurant_id_idx
  on public.business_requests (restaurant_id);

-- Numeric limit for the "1 job posting on free / unlimited on paid" rule —
-- follows the existing max_branches/max_menu_items/max_tools convention:
-- 0/unset = unlimited (read in hooks/useUser.tsx).
alter table public.plans
  add column if not exists max_job_postings integer default 0;

-- ============================================================
-- RLS
-- ============================================================
alter table public.business_gateway_services enable row level security;
alter table public.job_postings enable row level security;
alter table public.business_requests enable row level security;

create policy "business_gateway_services: owner" on public.business_gateway_services for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "business_gateway_services: public read enabled" on public.business_gateway_services for select using (
  is_enabled = true
);
create policy "business_gateway_services: admin full" on public.business_gateway_services for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "job_postings: owner" on public.job_postings for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "job_postings: public read active" on public.job_postings for select using (
  is_active = true
);
create policy "job_postings: admin full" on public.job_postings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "business_requests: insert any" on public.business_requests for insert with check (true);
create policy "business_requests: owner own" on public.business_requests for all using (
  restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
);
create policy "business_requests: admin full" on public.business_requests for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
