-- Lets a hub visit be attributed to a specific branch (known only when the
-- visitor lands via a branch-specific link/QR, e.g. ?branch=<id>) instead of
-- just the generic qr_branch/link source split - needed for real per-branch
-- reports. ON DELETE SET NULL so a deleted branch's historical visits become
-- "general" instead of a dangling id, matching how offers.branch_id already
-- behaves on branch deletion.
alter table public.hub_visits add column if not exists branch_id text references public.branches(id) on delete set null;
create index if not exists idx_hub_visits_branch on public.hub_visits(branch_id);

-- Daily per-branch rollup, mirroring source_breakdown - written by the
-- aggregate-daily-analytics edge function so branch history survives past
-- hub_visits' retention-window purge.
alter table public.analytics_daily add column if not exists branch_breakdown jsonb not null default '{}'::jsonb;
