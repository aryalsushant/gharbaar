-- Tell the house when something happens, rather than only at five o'clock.
--
-- Triggers rather than polling, and the row itself goes in the request body.
-- That distinction matters: a function that queried for "the latest expense"
-- would send two copies of one notification when two people log a bill in the
-- same second, and miss the other entirely.
--
-- Calls are fire and forget through pg_net, so a slow or failing Edge Function
-- can never block somebody adding an expense. A missed notification is a small
-- problem; a ledger that will not accept a receipt is a real one.
--
-- The shared secret comes from Vault, never from this file, because the repo is
-- public and the secret is the only thing standing between a stranger and the
-- ability to notify six phones.

create or replace function public.notify_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'cron_secret';

  if secret is null then
    return new; -- Nothing configured yet. Not a reason to fail the insert.
  end if;

  perform net.http_post(
    url := 'https://ifzmvwxtjeartovlppvo.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body := jsonb_build_object('kind', tg_argv[0], 'row', to_jsonb(new)),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists expenses_notify on public.expenses;
create trigger expenses_notify
  after insert on public.expenses
  for each row execute function public.notify_household('expense');

drop trigger if exists settlements_notify on public.settlements;
create trigger settlements_notify
  after insert on public.settlements
  for each row execute function public.notify_household('settlement');

drop trigger if exists swap_requests_notify on public.swap_requests;
create trigger swap_requests_notify
  after insert on public.swap_requests
  for each row execute function public.notify_household('swap_request');

-- An override row is written when somebody accepts a cover, two at a time. The
-- one for today or later is the night being taken; the other is the day handed
-- back, which the same two people already know about.
drop trigger if exists overrides_notify on public.responsibility_overrides;
create trigger overrides_notify
  after insert on public.responsibility_overrides
  for each row
  when (new.date >= current_date)
  execute function public.notify_household('swap_taken');
