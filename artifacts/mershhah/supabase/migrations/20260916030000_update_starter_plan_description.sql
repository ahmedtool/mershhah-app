-- The starter plan's description still said "بفرع واحد" (one branch),
-- now stale after raising its branch cap to 2.
update public.plans set description = 'مثالية لمطعم أو مقهى بفرع أو فرعين' where id = 'starter';
