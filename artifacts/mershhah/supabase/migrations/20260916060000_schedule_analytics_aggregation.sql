-- Daily at 22:00 UTC (01:00 Riyadh) - well after the Saudi calendar day has
-- fully ended, so "yesterday" is complete when aggregate-daily-analytics
-- reads it.
--
-- Same vault-secret pattern as marketing-reminders-daily: the service role
-- key is stored once, directly against the live database, via
-- `select vault.create_secret('sb_secret_...', 'analytics_aggregation_service_key');`
-- run separately outside version control - never committed here. Use the
-- project's actual SUPABASE_SERVICE_ROLE_KEY value (Project Settings > API
-- > "API Keys" section) - on projects migrated to the new key format
-- that's the sb_secret_... key, NOT the legacy JWT-format service_role key
-- shown under "Legacy API Keys"; passing the wrong one here makes the
-- function's manual auth check fail with 401 even though the request
-- reaches it. The edge function itself must be deployed with
-- `supabase functions deploy aggregate-daily-analytics --no-verify-jwt`,
-- since the platform's own JWT-format gateway check would otherwise
-- reject an sb_secret_... value before the function code ever runs.
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
