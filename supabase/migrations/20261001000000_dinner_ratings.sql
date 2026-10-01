-- Stars for the cook, instead of a yes.
--
-- "Did they cook and clean?" only ever had one answer anybody pressed, so it
-- recorded that dinner happened and nothing about how it went. A rating says
-- both: anybody who rates a night is also saying it happened, and the stars
-- say the rest. Cooking and cleaning are separate because they are separate
-- jobs, and a great meal left in a sink full of pans is two different scores.
--
-- One row per rater per night. Rating again changes your row rather than
-- adding a second, which is what the unique key is for.

create table public.dinner_ratings (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  -- Local calendar day, sent by the device, the same as a completion's date.
  date date not null,
  -- The cook being rated.
  user_id uuid not null references auth.users (id) on delete cascade,
  rated_by uuid not null references auth.users (id) on delete cascade,
  cooking smallint not null check (cooking between 1 and 5),
  cleaning smallint not null check (cleaning between 1 and 5),
  created_at timestamptz not null default now(),
  unique (responsibility_id, date, rated_by)
);

create index dinner_ratings_user_idx on public.dinner_ratings (user_id);

alter table public.dinner_ratings enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
--
-- Each person can read only their own ratings. Who gave which stars is
-- private on purpose: a two star night you have to put your name to is a
-- conversation nobody wants over breakfast, so it becomes a polite four, and
-- then every number means nothing. The house sees totals and averages through
-- dinner_rating_stats() below, never the rows.
-- ---------------------------------------------------------------------------

create policy "ratings readable by whoever gave them"
  on public.dinner_ratings for select to authenticated
  using (public.is_household_member() and rated_by = (select auth.uid()));

-- Same rule as a sign off, enforced here rather than by hiding the stars: the
-- cook cannot rate their own night, and nobody can rate in somebody else's name.
create policy "ratings givable by someone other than the cook"
  on public.dinner_ratings for insert to authenticated
  with check (
    public.is_household_member()
    and rated_by = (select auth.uid())
    and rated_by <> user_id
  );

create policy "ratings changeable by whoever gave them"
  on public.dinner_ratings for update to authenticated
  using (public.is_household_member() and rated_by = (select auth.uid()))
  with check (
    public.is_household_member()
    and rated_by = (select auth.uid())
    and rated_by <> user_id
  );

-- ---------------------------------------------------------------------------
-- The first rating signs the night off
--
-- The fairness count, the ticks on the week strip and the cook reminder all
-- read responsibility_completions, and they keep working unchanged because a
-- rating writes the sign off too. In the database rather than the client so
-- the two can never disagree, and so two people rating in the same second
-- both succeed: the second insert finds the night already signed off and
-- leaves it alone.
--
-- SECURITY DEFINER because the rater writes a completion row through it. The
-- completion insert policy would allow it anyway, since rated_by is the caller
-- and is not the cook, but a trigger should not depend on that staying true.
-- ---------------------------------------------------------------------------

create function public.sign_off_rated_dinner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.responsibility_completions (responsibility_id, date, user_id, marked_by)
  values (new.responsibility_id, new.date, new.user_id, new.rated_by)
  on conflict (responsibility_id, date) do nothing;
  return new;
end;
$$;

revoke execute on function public.sign_off_rated_dinner() from public, anon, authenticated;

create trigger dinner_ratings_sign_off
  after insert on public.dinner_ratings
  for each row execute function public.sign_off_rated_dinner();

-- ---------------------------------------------------------------------------
-- The stats, without the names
--
-- SECURITY DEFINER so it can read every row while the table policy shows each
-- person only their own, and it returns nothing but counts and averages per
-- cook. Membership is still checked, so an account without a seat gets an
-- empty answer rather than the house's scores.
-- ---------------------------------------------------------------------------

create function public.dinner_rating_stats()
returns table (user_id uuid, ratings bigint, cooking numeric, cleaning numeric)
language sql
security definer
stable
set search_path = public
as $$
  select r.user_id, count(*), avg(r.cooking), avg(r.cleaning)
  from public.dinner_ratings r
  where public.is_household_member()
  group by r.user_id;
$$;

revoke execute on function public.dinner_rating_stats() from public, anon;
grant execute on function public.dinner_rating_stats() to authenticated;

comment on table public.dinner_ratings is
  'One to five stars for cooking and cleaning, one row per rater per night. Readable only by the rater; the house sees dinner_rating_stats().';
