-- Two apartments, one dinner table.
--
-- Everybody eats together, so food stays split six ways. Electricity and
-- internet arrive per apartment and have nothing to do with the four people who
-- do not live there, so those split only among that apartment's residents.
--
-- The apartment is a property of the seat rather than of the person, because
-- the seats are fixed and so are the flats. It is copied onto the profile when
-- somebody claims their seat, which saves every screen a join to work out who
-- pays for the internet.

alter table public.roster add column if not exists apartment text;
alter table public.profiles add column if not exists apartment text;

update public.roster set apartment = 'D'  where key in ('suwan', 'chetan');
update public.roster set apartment = 'F7' where key in ('prastab', 'sushant', 'serene', 'bipul');

-- Anybody who already claimed a seat gets theirs backfilled.
update public.profiles p
set apartment = r.apartment
from public.roster r
where r.key = p.roster_key;

comment on column public.roster.apartment is
  'Which flat this seat lives in. Bills are split within an apartment, food across the house.';

-- An expense belongs to an apartment only when it is that apartment's bill.
-- Null means the whole house, which is every grocery run.
alter table public.expenses add column if not exists apartment text;

comment on column public.expenses.apartment is
  'The flat a bill belongs to, or null for anything the whole house shares.';

-- claim_identity carries the apartment across with the name.
create or replace function public.claim_identity(identity_key text)
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
      display_name = seat.display_name,
      apartment = seat.apartment
  where id = uid;
end;
$$;

revoke execute on function public.claim_identity(text) from public, anon;
grant execute on function public.claim_identity(text) to authenticated;
