-- Raises the starter (149 SAR) plan's branch cap from 1 to 2, per the
-- owner's decision - a middle ground that opens the entry tier to small
-- 2-branch owners while still leaving a clear reason to upgrade to growth
-- (10 branches) for anyone past that.
update public.plans set max_branches = 2 where id = 'starter';
