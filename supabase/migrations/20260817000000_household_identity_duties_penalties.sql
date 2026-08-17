-- Gharbaar: household roster, duty verification, penalties and push tokens.
--
-- Builds on 20260816000000_init.sql, which assumed an open-ended app where
-- anyone signs up with any name and invents their own responsibilities. This
-- house is six specific people, which changes three things:
--
--   1. Signing up means claiming one of six known identities, not typing a
--      free-form name. The roster lives here rather than only in the app so
--      the database can enforce that two accounts never claim the same person.
--   2. A duty is only done once somebody *else* says it is done. Self-marking
--      is refused at the policy level, not just hidden in the UI.
--   3. Missing a duty costs $10. That money is a separate ledger from
--      expenses, so grocery balances and fines can be shown apart from each
--      other and the split math in lib/balances.ts never sees a fine.

-- ---------------------------------------------------------------------------
-- The roster
--
-- Six rows, fixed. Photos are bundled in the app under assets/people/<key>.png
-- rather than stored here: they never change, so shipping them with the build
-- avoids a storage bucket, a public URL and a network round trip per avatar.
-- ---------------------------------------------------------------------------

create table public.roster (
  key text primary key,
  display_name text not null,
  sort_order integer not null unique
);

insert into public.roster (key, display_name, sort_order) values
  ('suwan',   'Suwan',   1),
  ('prastab', 'Prastab', 2),
  ('sushant', 'Sushant', 3),
  ('serene',  'Serene',  4),
  ('chetan',  'Chetan',  5),
  ('bipul',   'Bipul',   6);

alter table public.profiles
  add column roster_key text unique references public.roster (key),
  add column date_of_birth date;

comment on column public.profiles.roster_key is
  'Which of the six this account belongs to. Unique, so nobody can claim a name twice.';
comment on column public.profiles.date_of_birth is
  'Used only for the birthday reminder. Stored as a date, never a timestamp, so it cannot drift a day across timezones.';

-- ---------------------------------------------------------------------------
-- Identity claim
--
-- A new user has not joined a group yet, so the profiles RLS policy hides
-- every other profile from them and they cannot tell which names are still
-- free. Both of these are SECURITY DEFINER for exactly that reason. What they
-- expose is limited to the six first names and whether each is taken.
-- ---------------------------------------------------------------------------

create or replace function public.household_roster()
returns table (key text, display_name text, sort_order integer, claimed boolean)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.key,
    r.display_name,
    r.sort_order,
    exists (select 1 from public.profiles p where p.roster_key = r.key)
  from public.roster r
  order by r.sort_order;
$$;

create or replace function public.claim_identity(identity_key text, dob date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  name text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select display_name into name from public.roster where key = identity_key;
  if not found then
    raise exception 'no such household member' using errcode = 'P0002';
  end if;

  -- Claiming the identity you already hold is a no-op, not an error, so a
  -- half-finished sign-up can be retried without getting stuck.
  if exists (
    select 1 from public.profiles p
    where p.roster_key = identity_key and p.id <> uid
  ) then
    raise exception 'that name is already taken' using errcode = 'P0004';
  end if;

  update public.profiles
  set roster_key = identity_key,
      display_name = name,
      date_of_birth = dob
  where id = uid;
end;
$$;

create policy "roster readable by everyone signed in"
  on public.roster for select to authenticated
  using (true);

alter table public.roster enable row level security;

-- ---------------------------------------------------------------------------
-- Duty verification
--
-- The person on duty cannot be the one who says they did it. Enforcing that
-- in the policy rather than the screen means it holds even if somebody calls
-- the API directly.
-- ---------------------------------------------------------------------------

alter table public.responsibility_completions
  add column marked_by uuid references auth.users (id) on delete set null;

comment on column public.responsibility_completions.marked_by is
  'The housemate who confirmed it, never the person on duty. See the insert policy.';

drop policy "completions insertable by members" on public.responsibility_completions;

create policy "completions insertable by someone other than the assignee"
  on public.responsibility_completions for insert to authenticated
  with check (
    public.is_group_member(public.responsibility_group(responsibility_id))
    and marked_by = (select auth.uid())
    and marked_by <> user_id
  );

drop policy "completions updatable by members" on public.responsibility_completions;

create policy "completions updatable by someone other than the assignee"
  on public.responsibility_completions for update to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)))
  with check (
    public.is_group_member(public.responsibility_group(responsibility_id))
    and marked_by = (select auth.uid())
    and marked_by <> user_id
  );

-- ---------------------------------------------------------------------------
-- Penalties
--
-- Deliberately not an expenses row. A fine is owed to the house rather than to
-- whoever paid, it is never split, and it has to be reportable on its own.
-- Folding it into expenses would corrupt every balance calculation.
-- ---------------------------------------------------------------------------

create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  issued_by uuid not null references auth.users (id) on delete cascade,
  responsibility_id uuid references public.responsibilities (id) on delete set null,
  date date not null,
  amount numeric(12, 2) not null default 10.00 check (amount > 0),
  reason text not null default '',
  created_at timestamptz not null default now(),
  -- One fine per duty per night, so a bad evening cannot be charged twice.
  unique (responsibility_id, date),
  -- Nobody fines themselves.
  check (issued_by <> user_id)
);

create policy "penalties readable by members"
  on public.penalties for select to authenticated
  using (public.is_group_member(group_id));

create policy "penalties issuable by other members"
  on public.penalties for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and issued_by = (select auth.uid())
    and user_id <> (select auth.uid())
  );

-- Only the person who issued a fine can take it back, so a fine cannot be
-- quietly deleted by the person who owes it.
create policy "penalties revocable by the issuer"
  on public.penalties for delete to authenticated
  using (public.is_group_member(group_id) and issued_by = (select auth.uid()));

alter table public.penalties enable row level security;

-- ---------------------------------------------------------------------------
-- Web push subscriptions
--
-- One row per browser that has granted permission, because a person may add
-- the app to the home screen on a phone and also allow it on a laptop. The
-- endpoint is the natural key: the browser reissues it if permission is
-- revoked and re-granted, and a fresh grant should replace the dead row.
--
-- p256dh and auth are the subscription's public key and shared secret. They
-- are useless without the private VAPID key, which lives in an Edge Function
-- secret and never reaches the client.
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create policy "push subscriptions readable by owner"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push subscriptions insertable by owner"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "push subscriptions updatable by owner"
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push subscriptions deletable by owner"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- Expenses: room for the parsed receipt
--
-- category and items are filled by the Gemini pass over a receipt photo or a
-- typed line like "45 at Costco, milk eggs rice". Both stay nullable because a
-- hand-entered expense is still perfectly valid.
-- ---------------------------------------------------------------------------

alter table public.expenses
  add column category text,
  add column items jsonb;

comment on column public.expenses.items is
  'Line items as [{name, quantity, amount}] when a receipt was parsed. Null when entered by hand.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index penalties_group_id_idx on public.penalties (group_id);
create index penalties_user_id_idx on public.penalties (user_id);
create index penalties_date_idx on public.penalties (date);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index profiles_roster_key_idx on public.profiles (roster_key);
