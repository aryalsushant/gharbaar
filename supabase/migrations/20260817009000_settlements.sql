-- Recording that money actually changed hands.
--
-- The ledger could say "Suwan pays Bipul $12.50" but had no way to hear that he
-- did, so balances would have grown forever and the settle-up list would have
-- repeated the same advice every week.
--
-- Only the person who RECEIVED the money can record it, and that direction is
-- the entire security model. A payer recording their own payment is a claim
-- with an incentive behind it; a recipient recording one is an admission
-- against interest, since it reduces what they are owed. Nobody has a reason to
-- log money they did not get.
--
-- It is the same rule as duty sign-offs: the person who benefits is not the
-- person who confirms.

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  settled_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create policy "settlements readable by the household"
  on public.settlements for select to authenticated
  using (public.is_household_member());

create policy "settlements recorded by whoever was paid"
  on public.settlements for insert to authenticated
  with check (
    public.is_household_member()
    and to_user = (select auth.uid())
    and from_user <> (select auth.uid())
  );

-- Undoing a mistake is the recipient's job too, for the same reason.
create policy "settlements removable by whoever was paid"
  on public.settlements for delete to authenticated
  using (public.is_household_member() and to_user = (select auth.uid()));

alter table public.settlements enable row level security;

create index settlements_from_user_idx on public.settlements (from_user);
create index settlements_to_user_idx on public.settlements (to_user);
