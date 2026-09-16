-- Per the owner: "restaurant page without the Mershhah watermark"
-- (white_label) and "receive corporate/event orders" (gateway_corporate)
-- should be open to every plan, not just scale (449) - these stop being
-- paid differentiators on the pricing page and become baseline features
-- like priority_support already is.
update public.plans
set features = coalesce(features, '{}'::jsonb) || '{"white_label": true, "gateway_corporate": true}'::jsonb
where id in ('free', 'starter', 'growth', 'scale', 'pro');
