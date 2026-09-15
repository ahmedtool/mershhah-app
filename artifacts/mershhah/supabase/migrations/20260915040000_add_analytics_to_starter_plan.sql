-- Per the owner: smart analytics (ai_analysis) should be available from
-- the 149 SAR "starter" tier and up, not just growth/scale - only the free
-- plan should lack it.
update public.plans
set features = coalesce(features, '{}'::jsonb) || '{"ai_analysis": true}'::jsonb
where id = 'starter';
