-- Bind each seat to an email address, so nobody can take somebody else's name.
--
-- Until now any signed-in account could claim any free seat, which meant the
-- first person to open the link could have become Bipul, on purpose or by
-- misreading the screen. With real money and $10 fines in the ledger, that is
-- not a thing to leave to good manners.
--
-- A seat with an email can only be claimed by an account whose own email
-- matches it. The check runs inside claim_identity(), which is SECURITY
-- DEFINER, so it cannot be skipped by calling the API directly.
--
-- The column is nullable on purpose. A seat with no email set behaves as
-- before, first come first served, which keeps the app usable before the
-- addresses have been filled in.
--
-- Worth being honest about the limit: this proves the address on the account,
-- not that the person owns the address, unless email confirmation is on. With
-- confirmations off, somebody who knows Bipul's address could sign up with it.
-- The two together are what make this airtight.

alter table public.roster add column if not exists email text unique;

comment on column public.roster.email is
  'Lowercase. When set, only an account with this email may claim the seat.';

create or replace function public.claim_identity(identity_key text, dob date)
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
      date_of_birth = dob
  where id = uid;
end;
$$;

revoke execute on function public.claim_identity(text, date) from public, anon;
grant execute on function public.claim_identity(text, date) to authenticated;

-- Show a masked hint on the claim screen, so people can tell which seat is
-- theirs without the roster becoming a list of everyone's email address.
--
-- Dropped rather than replaced: a create or replace cannot widen a function's
-- return type, and this one gains a column.
drop function if exists public.household_roster();

create function public.household_roster()
returns table (
  key text,
  display_name text,
  sort_order integer,
  claimed boolean,
  email_hint text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.key,
    r.display_name,
    r.sort_order,
    exists (select 1 from public.profiles p where p.roster_key = r.key),
    case
      when r.email is null then null
      -- b****@gmail.com: enough to recognise your own, useless for guessing.
      else left(r.email, 1) || '****' || substring(r.email from position('@' in r.email))
    end
  from public.roster r
  order by r.sort_order;
$$;

revoke execute on function public.household_roster() from public, anon;
grant execute on function public.household_roster() to authenticated;
