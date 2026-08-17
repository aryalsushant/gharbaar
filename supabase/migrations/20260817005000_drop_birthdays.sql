-- Remove birthdays.
--
-- Six people who live together already know each other's birthdays. The feature
-- was paying for itself with a date picker on the one screen that should be
-- frictionless: the moment somebody opens the link for the first time.
--
-- Claiming a seat is now a single decision, which name is yours.

alter table public.profiles drop column date_of_birth;

-- The old two-argument version has to go rather than be replaced, since its
-- signature is part of its identity.
drop function if exists public.claim_identity(text, date);

create function public.claim_identity(identity_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  seat public.roster;
  my_email text := lower(trim((select auth.jwt() ->> 'email')));
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into seat from public.roster where key = identity_key;
  if not found then
    raise exception 'no such household member' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.roster_key = identity_key and p.id <> uid
  ) then
    raise exception 'that name is already taken' using errcode = 'P0004';
  end if;

  if seat.email is not null and seat.email <> my_email then
    raise exception 'this seat belongs to a different email address'
      using errcode = 'P0005';
  end if;

  update public.profiles
  set roster_key = identity_key,
      display_name = seat.display_name
  where id = uid;
end;
$$;

revoke execute on function public.claim_identity(text) from public, anon;
grant execute on function public.claim_identity(text) to authenticated;
