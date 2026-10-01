-- Ask the house to rate the cook at half past nine.
--
-- Hourly, at half past, and the function returns immediately on 23 of those
-- calls. The reasoning is the cook reminder's: pg_cron has no notion of
-- daylight saving, so an hour pinned in UTC would arrive at half eight for half
-- the year, and the only place that knows what time it is in the house is the
-- function itself.
--
-- Half past also keeps it off the minute the cook reminder (on the hour) and
-- the chore reminder (twenty past) use, so none of them wait on the same
-- pg_net worker.
--
-- The shared secret is read from Vault at call time. This repo is public and a
-- migration carrying the secret would hand anybody the ability to notify the
-- house at will. It is the same cron_secret the other reminders already use, so
-- there is nothing new to set.

-- Re-running should not leave two jobs racing each other.
select cron.unschedule('rate-reminder')
where exists (select 1 from cron.job where jobname = 'rate-reminder');

select cron.schedule(
  'rate-reminder',
  '30 * * * *',
  $job$
  select net.http_post(
    url := 'https://ifzmvwxtjeartovlppvo.supabase.co/functions/v1/rate-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      )
    ),
    timeout_milliseconds := 20000
  );
  $job$
);
