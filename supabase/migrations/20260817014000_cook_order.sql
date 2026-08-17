-- The cooking order belongs to the roster, not to whoever signed up first.
--
-- Until now a housemate joining was appended to the end of the rotation, which
-- was fine when everybody arrived before it started and wrong the moment they
-- did not: the last two to claim a seat would have been stuck cooking last
-- forever, regardless of the order the house agreed.
--
-- Now the order is a property of the seat. Somebody claiming their seat in
-- three days still lands in the slot the house decided, and the sequence is the
-- same whoever signs up when.
--
-- Separate from sort_order, which is the order the six tiles appear on the way
-- in. Those are different questions and tying them together would mean not
-- being able to change one without the other.

alter table public.roster add column if not exists cook_order integer;

update public.roster set cook_order = 0 where key = 'prastab';
update public.roster set cook_order = 1 where key = 'chetan';
update public.roster set cook_order = 2 where key = 'bipul';
update public.roster set cook_order = 3 where key = 'serene';
update public.roster set cook_order = 4 where key = 'sushant';
update public.roster set cook_order = 5 where key = 'suwan';

comment on column public.roster.cook_order is
  'Position in the dinner rotation. Fixed, so joining late does not mean cooking last forever.';

drop function if exists public.household_roster();

create function public.household_roster()
returns table (
  key text,
  display_name text,
  sort_order integer,
  cook_order integer,
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
    r.cook_order,
    exists (select 1 from public.profiles p where p.roster_key = r.key),
    case
      when r.email is null then null
      else left(r.email, 1) || '****' || substring(r.email from position('@' in r.email))
    end
  from public.roster r
  order by r.sort_order;
$$;

revoke execute on function public.household_roster() from public, anon;
grant execute on function public.household_roster() to authenticated;
