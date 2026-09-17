-- Lets an owner dismiss a "missing info" warning on a branch (e.g. no
-- phone number, no opening hours) as "yes, on purpose" - the warning
-- stays hidden after that specific field is acknowledged, instead of
-- reappearing every time the branches page loads.
alter table public.branches add column if not exists acknowledged_warnings jsonb default '[]'::jsonb;
