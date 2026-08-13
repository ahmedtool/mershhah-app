-- Optional per-branch targeting for offers. NULL branch_id = applies to all
-- branches (unchanged default behavior). A visitor's branch is known only
-- when they land via a branch-specific link (?branch=<id>), e.g. a printed
-- QR code the owner copies from the branches page.
alter table public.offers
  add column if not exists branch_id text references public.branches(id) on delete set null;

create index if not exists idx_offers_branch_id on public.offers(branch_id);
