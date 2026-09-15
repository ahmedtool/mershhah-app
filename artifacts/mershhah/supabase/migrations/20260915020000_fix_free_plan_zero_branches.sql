-- Fixes a real bug from the previous migration: max_branches = 0 has
-- always meant "unlimited" throughout this app (see the "0 = غير محدود"
-- hint text in the admin plan editor, and computeEntitlements() in
-- src/hooks/useUser.tsx) - setting free's max_branches to 0 to mean
-- "zero branches allowed" actually gave every free-plan restaurant
-- UNLIMITED branches, the opposite of intended (confirmed live: a free
-- account was able to create more than three branches).
--
-- Reverting the column to a normal, unambiguous value and instead adding
-- a features.branches_disabled flag - a narrow, explicit override that
-- computeEntitlements() now checks before falling back to the
-- 0-means-unlimited convention, so every other plan's use of that
-- convention (including "pro" and the dev test plan, both intentionally
-- unlimited via 0) is completely unaffected.
update public.plans
set max_branches = 1,
    features = coalesce(features, '{}'::jsonb) || '{"branches_disabled": true}'::jsonb
where id = 'free';

select id, name, max_branches, features from public.plans where id = 'free';
