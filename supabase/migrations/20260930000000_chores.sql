-- A standing chore per seat, answered once a day.
--
-- Dinner rotates because it is one job that moves. This is the opposite shape:
-- six jobs that never move, one per person, the same every night. Rotating
-- them would be wrong. The house divided the kitchen by agreement, and the
-- point of the division is that everybody knows which part is theirs without
-- having to look it up.
--
-- So the chore hangs off the seat, not off a person. Somebody claiming their
-- seat next month inherits the corner that belongs to it, and an account that
-- changes hands does not take the chore with it.
--
-- The answer is per calendar day and is the owner's own. That is the one place
-- this differs from a dinner sign off, which is deliberately somebody else's to
-- give: a missed night is a missed meal for five people and needs a witness,
-- whereas wiping your own counter is a thing you either did or did not, and
-- making five people police six small jobs every night is how an app gets
-- muted. The honest answer includes "not today", which is why the check is a
-- boolean rather than a row that only ever means yes.

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  roster_key text not null references public.roster (key) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  created_at timestamptz not null default now(),
  -- Re-running the seed must not hand somebody the same job twice.
  unique (roster_key, title)
);

create table public.chore_checks (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores (id) on delete cascade,
  -- Local calendar day, sent by the device. The house is all in one timezone
  -- and a UTC day would roll over at six in the evening for them.
  date date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  done boolean not null,
  created_at timestamptz not null default now(),
  -- One answer per chore per day. Changing your mind updates it.
  unique (chore_id, date)
);

create index chore_checks_date_idx on public.chore_checks (date);

-- ---------------------------------------------------------------------------
-- Whose chore is it
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER for the same reason as everything else here: the check
-- crosses from chore_checks into chores and profiles, and a policy that reads
-- those under the caller's own policies is both slower and a recursion waiting
-- to happen the next time profiles is touched.
create function public.owns_chore(chore uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.chores c
    join public.profiles p on p.roster_key = c.roster_key
    where c.id = chore
      and p.id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_chore(uuid) from public, anon;
grant execute on function public.owns_chore(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- The list itself is set in a migration and changed in a migration. There is no
-- insert, update or delete policy on purpose: a shared division of the kitchen
-- that any one person can quietly rewrite at midnight is not an agreement.
create policy "chores readable by the household"
  on public.chores for select to authenticated
  using (public.is_household_member());

create policy "chore checks readable by the household"
  on public.chore_checks for select to authenticated
  using (public.is_household_member());

-- Yours to answer, and only yours. Enforced here rather than by hiding the
-- buttons, so calling the API directly cannot tick somebody else off as done.
create policy "chore checks answerable by their owner"
  on public.chore_checks for insert to authenticated
  with check (
    public.is_household_member()
    and user_id = (select auth.uid())
    and public.owns_chore(chore_id)
  );

create policy "chore checks changeable by their owner"
  on public.chore_checks for update to authenticated
  using (public.is_household_member() and user_id = (select auth.uid()))
  with check (
    public.is_household_member()
    and user_id = (select auth.uid())
    and public.owns_chore(chore_id)
  );

create policy "chore checks clearable by their owner"
  on public.chore_checks for delete to authenticated
  using (public.is_household_member() and user_id = (select auth.uid()));

alter table public.chores enable row level security;
alter table public.chore_checks enable row level security;
