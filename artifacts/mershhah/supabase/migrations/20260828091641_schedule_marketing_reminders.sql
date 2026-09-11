-- Daily cron (06:00 UTC / ~09:00 Riyadh) calling send-marketing-reminders.
--
-- The service role key the function checks against is NOT stored in this
-- file (or anywhere in git) - it's saved once, directly against the live
-- database, via `select vault.create_secret('<key>',
-- 'marketing_reminders_service_key');` run separately outside version
-- control. This job only reads it back through supabase_vault at execution
-- time, the standard pattern for giving pg_cron/pg_net access to a secret
-- without ever writing the plaintext value into a committed file.
select cron.schedule(
  'marketing-reminders-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://smmriycsboexindabanc.supabase.co/functions/v1/send-marketing-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'marketing_reminders_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
