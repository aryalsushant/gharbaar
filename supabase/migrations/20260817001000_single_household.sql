-- Collapse the group layer. There is one household, not many groups.
--
-- The original schema let anyone create any number of groups and invite people
-- into them, which is why every table carried a group_id and every policy went
-- through is_group_member(). This app is one house of six, so all of that was
-- ceremony around a constant. Removing it now costs nothing because no one has
-- signed up yet and every table is empty. Removing it later would mean
-- migrating live data.
--
-- Membership is now a much simpler question: have you claimed one of the six
-- roster identities? If yes you are in the house and you see everything. If no,
-- you can see your own profile row and nothing else, which is exactly the state
-- a half-finished sign-up should be in.

-- ---------------------------------------------------------------------------
-- Drop the policies that depend on the old helpers, before the helpers go
-- ---------------------------------------------------------------------------

drop policy if exists "profiles readable by self and groupmates" on public.profiles;

drop policy if exists "expenses readable by members" on public.expenses;
drop policy if exists "expenses insertable by members" on public.expenses;
drop policy if exists "expenses updatable by members" on public.expenses;
drop policy if exists "expenses deletable by members" on public.expenses;

drop policy if exists "splits readable by members" on public.expense_splits;
drop policy if exists "splits insertable by members" on public.expense_splits;
drop policy if exists "splits updatable by members" on public.expense_splits;
drop policy if exists "splits deletable by members" on public.expense_splits;

drop policy if exists "responsibilities readable by members" on public.responsibilities;
drop policy if exists "responsibilities insertable by members" on public.responsibilities;
drop policy if exists "responsibilities updatable by members" on public.responsibilities;
drop policy if exists "responsibilities deletable by members" on public.responsibilities;

drop policy if exists "rotation members readable by members" on public.responsibility_members;
drop policy if exists "rotation members insertable by members" on public.responsibility_members;
drop policy if exists "rotation members updatable by members" on public.responsibility_members;
drop policy if exists "rotation members deletable by members" on public.responsibility_members;

drop policy if exists "overrides readable by members" on public.responsibility_overrides;
drop policy if exists "overrides insertable by members" on public.responsibility_overrides;
drop policy if exists "overrides updatable by members" on public.responsibility_overrides;
drop policy if exists "overrides deletable by members" on public.responsibility_overrides;

drop policy if exists "completions readable by members" on public.responsibility_completions;
drop policy if exists "completions insertable by someone other than the assignee" on public.responsibility_completions;
drop policy if exists "completions updatable by someone other than the assignee" on public.responsibility_completions;
drop policy if exists "completions deletable by members" on public.responsibility_completions;

drop policy if exists "penalties readable by members" on public.penalties;
drop policy if exists "penalties issuable by other members" on public.penalties;
drop policy if exists "penalties revocable by the issuer" on public.penalties;

-- ---------------------------------------------------------------------------
-- Drop the group machinery
-- ---------------------------------------------------------------------------

drop trigger if exists on_group_created on public.groups;
drop function if exists public.handle_new_group();
drop function if exists public.join_group_with_code(text);
drop function if exists public.preview_invite(text);
drop function if exists public.expense_group(uuid);
drop function if exists public.responsibility_group(uuid);

alter table public.expenses drop column group_id;
alter table public.responsibilities drop column group_id;
alter table public.penalties drop column group_id;

drop table if exists public.group_invites;
drop table if exists public.group_members;
drop table if exists public.groups;

drop function if exists public.is_group_member(uuid);
drop function if exists public.shares_group_with(uuid);

-- ---------------------------------------------------------------------------
-- The one membership predicate everything now routes through
--
-- SECURITY DEFINER for the same reason is_group_member() was: a policy on
-- profiles that queries profiles recurses infinitely otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.roster_key is not null
  );
$$;

revoke execute on function public.is_household_member() from public, anon;
grant execute on function public.is_household_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Policies, rewritten around the household
-- ---------------------------------------------------------------------------

-- Your own row is always visible, otherwise you could never claim an identity
-- or read back what you just claimed.
create policy "profiles readable by self and the household"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_household_member());

create policy "expenses readable by the household"
  on public.expenses for select to authenticated
  using (public.is_household_member());

create policy "expenses insertable by the household"
  on public.expenses for insert to authenticated
  with check (public.is_household_member());

create policy "expenses updatable by the household"
  on public.expenses for update to authenticated
  using (public.is_household_member())
  with check (public.is_household_member());

create policy "expenses deletable by the household"
  on public.expenses for delete to authenticated
  using (public.is_household_member());

create policy "splits readable by the household"
  on public.expense_splits for select to authenticated
  using (public.is_household_member());

create policy "splits insertable by the household"
  on public.expense_splits for insert to authenticated
  with check (public.is_household_member());

create policy "splits updatable by the household"
  on public.expense_splits for update to authenticated
  using (public.is_household_member())
  with check (public.is_household_member());

create policy "splits deletable by the household"
  on public.expense_splits for delete to authenticated
  using (public.is_household_member());

create policy "responsibilities readable by the household"
  on public.responsibilities for select to authenticated
  using (public.is_household_member());

create policy "responsibilities insertable by the household"
  on public.responsibilities for insert to authenticated
  with check (public.is_household_member());

create policy "responsibilities updatable by the household"
  on public.responsibilities for update to authenticated
  using (public.is_household_member())
  with check (public.is_household_member());

create policy "responsibilities deletable by the household"
  on public.responsibilities for delete to authenticated
  using (public.is_household_member());

create policy "rotation members readable by the household"
  on public.responsibility_members for select to authenticated
  using (public.is_household_member());

create policy "rotation members insertable by the household"
  on public.responsibility_members for insert to authenticated
  with check (public.is_household_member());

create policy "rotation members updatable by the household"
  on public.responsibility_members for update to authenticated
  using (public.is_household_member())
  with check (public.is_household_member());

create policy "rotation members deletable by the household"
  on public.responsibility_members for delete to authenticated
  using (public.is_household_member());

create policy "overrides readable by the household"
  on public.responsibility_overrides for select to authenticated
  using (public.is_household_member());

create policy "overrides insertable by the household"
  on public.responsibility_overrides for insert to authenticated
  with check (public.is_household_member());

create policy "overrides updatable by the household"
  on public.responsibility_overrides for update to authenticated
  using (public.is_household_member())
  with check (public.is_household_member());

create policy "overrides deletable by the household"
  on public.responsibility_overrides for delete to authenticated
  using (public.is_household_member());

-- The assignee still cannot be the one who says it is done.
create policy "completions readable by the household"
  on public.responsibility_completions for select to authenticated
  using (public.is_household_member());

create policy "completions insertable by someone other than the assignee"
  on public.responsibility_completions for insert to authenticated
  with check (
    public.is_household_member()
    and marked_by = (select auth.uid())
    and marked_by <> user_id
  );

create policy "completions updatable by someone other than the assignee"
  on public.responsibility_completions for update to authenticated
  using (public.is_household_member())
  with check (
    public.is_household_member()
    and marked_by = (select auth.uid())
    and marked_by <> user_id
  );

create policy "completions deletable by the household"
  on public.responsibility_completions for delete to authenticated
  using (public.is_household_member());

-- Nobody fines themselves, and only the issuer can take a fine back.
create policy "penalties readable by the household"
  on public.penalties for select to authenticated
  using (public.is_household_member());

create policy "penalties issuable by another housemate"
  on public.penalties for insert to authenticated
  with check (
    public.is_household_member()
    and issued_by = (select auth.uid())
    and user_id <> (select auth.uid())
  );

create policy "penalties revocable by the issuer"
  on public.penalties for delete to authenticated
  using (public.is_household_member() and issued_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Corrections to comments the earlier migration left behind
-- ---------------------------------------------------------------------------

comment on table public.roster is
  'The six people in the house. Photos are uploaded by each person into the avatars bucket, not bundled with the app.';
