-- The six names, before anybody has signed in.
--
-- The flow now starts with the tiles: you see six people, tap yourself, and
-- only then give an email. That means the names have to be readable by a caller
-- with no session at all, which household_roster() deliberately is not.
--
-- So this is a second, smaller window onto the same table. It returns names and
-- nothing else: no addresses, not even the masked hint, and no indication of
-- who has already signed up. Six first names is what a visitor can learn, which
-- is roughly what they would learn from the front door.
--
-- household_roster() stays authenticated-only and keeps the masked hint, since
-- by the time it is called you have proved you own an inbox.

create or replace function public.public_roster()
returns table (key text, display_name text, sort_order integer)
language sql
security definer
stable
set search_path = public
as $$
  select r.key, r.display_name, r.sort_order
  from public.roster r
  order by r.sort_order;
$$;

grant execute on function public.public_roster() to anon, authenticated;
