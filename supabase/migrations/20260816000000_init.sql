-- Gharbaar: groups, expense splitting, and rotating responsibilities.
-- One migration: tables, helper functions, triggers, RLS policies, indexes.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '',
  split_type text not null default 'equal' check (split_type in ('equal')),
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_owed numeric(12, 2) not null,
  settled boolean not null default false,
  unique (expense_id, user_id)
);

create table public.responsibilities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  frequency text not null default 'daily' check (frequency in ('daily')),
  rotation_start_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.responsibility_members (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rotation_order integer not null,
  is_active boolean not null default true,
  unique (responsibility_id, user_id)
);

-- A manual swap for a single day. Takes priority over the computed assignee.
create table public.responsibility_overrides (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  date date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (responsibility_id, date)
);

create table public.responsibility_completions (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  date date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (responsibility_id, date)
);

-- ---------------------------------------------------------------------------
-- Helper functions
--
-- These are SECURITY DEFINER so they bypass RLS on the tables they read.
-- Without that, a group_members policy that itself queries group_members
-- recurses infinitely. Every policy below routes its membership check here.
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
      and m.is_active
  );
$$;

create or replace function public.shares_group_with(other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and mine.is_active
      and theirs.user_id = other_user
      and theirs.is_active
  );
$$;

create or replace function public.expense_group(eid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select e.group_id from public.expenses e where e.id = eid;
$$;

create or replace function public.responsibility_group(rid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select r.group_id from public.responsibilities r where r.id = rid;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Give every new auth user a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a group is its first member, otherwise the group policies
-- would immediately hide the row from the person who just made it.
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ---------------------------------------------------------------------------
-- Join-by-invite RPC
--
-- Joining is the one action a non-member must be able to take, so it runs
-- as SECURITY DEFINER with the code validated here. That keeps the
-- group_members INSERT policy closed to non-members.
-- ---------------------------------------------------------------------------

create or replace function public.join_group_with_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.group_invites;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into invite
  from public.group_invites i
  where i.invite_code = upper(trim(code))
  for update;

  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    raise exception 'invite expired' using errcode = 'P0003';
  end if;

  if invite.max_uses is not null and invite.uses_count >= invite.max_uses then
    raise exception 'invite already used up' using errcode = 'P0004';
  end if;

  -- Re-joining a group you are already in is a no-op, not an error, and it
  -- must not burn a use off the invite.
  if exists (
    select 1 from public.group_members m
    where m.group_id = invite.group_id and m.user_id = uid and m.is_active
  ) then
    return invite.group_id;
  end if;

  insert into public.group_members (group_id, user_id, role, is_active)
  values (invite.group_id, uid, 'member', true)
  on conflict (group_id, user_id) do update set is_active = true;

  update public.group_invites
  set uses_count = uses_count + 1
  where id = invite.id;

  return invite.group_id;
end;
$$;

-- Lets the join screen name the group before the user commits to joining.
create or replace function public.preview_invite(code text)
returns table (group_id uuid, group_name text, is_valid boolean)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.name,
    (i.expires_at is null or i.expires_at >= now())
      and (i.max_uses is null or i.uses_count < i.max_uses)
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  where i.invite_code = upper(trim(code));
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.responsibilities enable row level security;
alter table public.responsibility_members enable row level security;
alter table public.responsibility_overrides enable row level security;
alter table public.responsibility_completions enable row level security;

-- profiles: you, plus anyone you share an active group with.
create policy "profiles readable by self and groupmates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));

create policy "profiles insertable by self"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles updatable by self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- groups
create policy "groups readable by members"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "groups insertable by creator"
  on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "groups updatable by creator"
  on public.groups for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "groups deletable by creator"
  on public.groups for delete to authenticated
  using (created_by = (select auth.uid()));

-- group_members: members see the roster; only members add others.
-- Non-members join through join_group_with_code(), never through this policy.
create policy "members readable by members"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id));

create policy "members insertable by members"
  on public.group_members for insert to authenticated
  with check (public.is_group_member(group_id));

create policy "members updatable by members"
  on public.group_members for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "members removable by members"
  on public.group_members for delete to authenticated
  using (public.is_group_member(group_id));

-- group_invites
create policy "invites readable by members"
  on public.group_invites for select to authenticated
  using (public.is_group_member(group_id));

create policy "invites insertable by members"
  on public.group_invites for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = (select auth.uid()));

create policy "invites deletable by members"
  on public.group_invites for delete to authenticated
  using (public.is_group_member(group_id));

-- expenses
create policy "expenses readable by members"
  on public.expenses for select to authenticated
  using (public.is_group_member(group_id));

create policy "expenses insertable by members"
  on public.expenses for insert to authenticated
  with check (public.is_group_member(group_id));

create policy "expenses updatable by members"
  on public.expenses for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "expenses deletable by members"
  on public.expenses for delete to authenticated
  using (public.is_group_member(group_id));

-- expense_splits
create policy "splits readable by members"
  on public.expense_splits for select to authenticated
  using (public.is_group_member(public.expense_group(expense_id)));

create policy "splits insertable by members"
  on public.expense_splits for insert to authenticated
  with check (public.is_group_member(public.expense_group(expense_id)));

create policy "splits updatable by members"
  on public.expense_splits for update to authenticated
  using (public.is_group_member(public.expense_group(expense_id)))
  with check (public.is_group_member(public.expense_group(expense_id)));

create policy "splits deletable by members"
  on public.expense_splits for delete to authenticated
  using (public.is_group_member(public.expense_group(expense_id)));

-- responsibilities
create policy "responsibilities readable by members"
  on public.responsibilities for select to authenticated
  using (public.is_group_member(group_id));

create policy "responsibilities insertable by members"
  on public.responsibilities for insert to authenticated
  with check (public.is_group_member(group_id));

create policy "responsibilities updatable by members"
  on public.responsibilities for update to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "responsibilities deletable by members"
  on public.responsibilities for delete to authenticated
  using (public.is_group_member(group_id));

-- responsibility_members / overrides / completions all scope through the
-- parent responsibility's group.
create policy "rotation members readable by members"
  on public.responsibility_members for select to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "rotation members insertable by members"
  on public.responsibility_members for insert to authenticated
  with check (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "rotation members updatable by members"
  on public.responsibility_members for update to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)))
  with check (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "rotation members deletable by members"
  on public.responsibility_members for delete to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "overrides readable by members"
  on public.responsibility_overrides for select to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "overrides insertable by members"
  on public.responsibility_overrides for insert to authenticated
  with check (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "overrides updatable by members"
  on public.responsibility_overrides for update to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)))
  with check (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "overrides deletable by members"
  on public.responsibility_overrides for delete to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "completions readable by members"
  on public.responsibility_completions for select to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "completions insertable by members"
  on public.responsibility_completions for insert to authenticated
  with check (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "completions updatable by members"
  on public.responsibility_completions for update to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)))
  with check (public.is_group_member(public.responsibility_group(responsibility_id)));

create policy "completions deletable by members"
  on public.responsibility_completions for delete to authenticated
  using (public.is_group_member(public.responsibility_group(responsibility_id)));

-- ---------------------------------------------------------------------------
-- Indexes on every column the policies and screens filter by
-- ---------------------------------------------------------------------------

create index group_members_user_id_idx on public.group_members (user_id);
create index group_members_group_id_idx on public.group_members (group_id);
create index groups_created_by_idx on public.groups (created_by);
create index group_invites_group_id_idx on public.group_invites (group_id);
create index expenses_group_id_idx on public.expenses (group_id);
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index expense_splits_user_id_idx on public.expense_splits (user_id);
create index responsibilities_group_id_idx on public.responsibilities (group_id);
create index responsibility_members_responsibility_id_idx on public.responsibility_members (responsibility_id);
create index responsibility_overrides_responsibility_id_date_idx on public.responsibility_overrides (responsibility_id, date);
create index responsibility_completions_responsibility_id_date_idx on public.responsibility_completions (responsibility_id, date);
