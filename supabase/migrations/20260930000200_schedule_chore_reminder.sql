-- Ring everybody about their own corner at eight.
--
-- Hourly, and the function returns immediately on 23 of those calls. The
-- reasoning is the cook reminder's: pg_cron has no notion of daylight saving,
-- so an hour pinned in UTC would arrive at seven for half the year, and the
-- only place that knows what time it is in the house is the function itself.
--
-- Twenty past the hour rather than on it, so this and the cook reminder are
-- never waiting on the same pg_net worker.
--
-- The shared secret is read from Vault at call time. This repo is public and a
-- migration carrying the secret would hand anybody the ability to notify the
-- house at will. It is the same cron_secret the cook reminder already uses, so
-- there is nothing new to set.

-- Re-running should not leave two jobs racing each other.
select cron.unschedule('chore-reminder')
where exists (select 1 from cron.job where jobname = 'chore-reminder');

select cron.schedule(
  'chore-reminder',
  '20 * * * *',
  $job$
  select net.http_post(
    url := 'https://ifzmvwxtjeartovlppvo.supabase.co/functions/v1/chore-reminder',
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
