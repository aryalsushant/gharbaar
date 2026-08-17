-- Ring the cook at five.
--
-- pg_cron runs on UTC and has no notion of daylight saving, so a fixed UTC hour
-- would deliver this at 5pm for half the year and 4pm for the other half. The
-- job therefore fires hourly and the function itself checks whether it is
-- currently 17:00 in America/Chicago, returning immediately when it is not.
-- Twenty-three wasted calls a day, in exchange for never being wrong in March
-- and November.
--
-- The shared secret is read from Vault at call time rather than written here.
-- This repo is public, and a migration containing the secret would hand anybody
-- the ability to notify the house at will.
--
-- Set it once, from outside the repo:
--   select vault.create_secret('<random>', 'cron_secret');
-- and give the Edge Function the same value:
--   npx supabase secrets set CRON_SECRET=<random>

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Re-running should not leave two jobs racing each other.
select cron.unschedule('cook-reminder')
where exists (select 1 from cron.job where jobname = 'cook-reminder');

select cron.schedule(
  'cook-reminder',
  '0 * * * *',
  $job$
  select net.http_post(
    url := 'https://ifzmvwxtjeartovlppvo.supabase.co/functions/v1/cook-reminder',
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
