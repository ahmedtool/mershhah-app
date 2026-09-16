-- Daily at 22:00 UTC (01:00 Riyadh) - well after the Saudi calendar day has
-- fully ended, so "yesterday" is complete when aggregate-daily-analytics
-- reads it.
--
-- Same vault-secret pattern as marketing-reminders-daily: the service role
-- key is stored once, directly against the live database, via
-- `select vault.create_secret('<service-role-key>', 'analytics_aggregation_service_key');`
-- run separately outside version control - never committed here.
select cron.schedule(
  'analytics-daily-aggregation',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://smmriycsboexindabanc.supabase.co/functions/v1/aggregate-daily-analytics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'analytics_aggregation_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
