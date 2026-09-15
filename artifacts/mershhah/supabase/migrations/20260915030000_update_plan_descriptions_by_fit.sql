-- Rewrites each active plan's description (already shown on /pricing right
-- under the plan name) to say who it actually fits, matching the
-- branch-count tiering: single-location owners, small multi-branch
-- operators, and larger chains.
update public.plans set description = 'لتجربة مرشح بدون بطاقة ائتمان' where id = 'free';
update public.plans set description = 'مثالية لمطعم أو مقهى بفرع واحد' where id = 'starter';
update public.plans set description = 'لمشاريع تتوسع بعدة فروع' where id = 'growth';
update public.plans set description = 'للسلاسل والمشاريع الكبيرة' where id = 'scale';
