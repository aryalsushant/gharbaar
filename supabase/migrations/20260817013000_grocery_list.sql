-- What the house needs, before somebody goes shopping.
--
-- The ledger already catches the receipt afterwards. The coordination happens
-- before it, in a group chat nobody reads, which is why rice gets bought twice
-- and onions never.
--
-- Items are deleted once a shop is logged rather than kept as history. A
-- grocery list is a working document, and last month's onions are noise. The
-- expense keeps the record of what was actually bought.

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  note text not null default '',
  added_by uuid not null references auth.users (id) on delete cascade,
  -- Ticked off in the aisle, not yet paid for.
  in_basket boolean not null default false,
  created_at timestamptz not null default now()
);

create policy "grocery items readable by the household"
  on public.grocery_items for select to authenticated
  using (public.is_household_member());

create policy "grocery items addable by the household"
  on public.grocery_items for insert to authenticated
  with check (public.is_household_member() and added_by = (select auth.uid()));

-- Anybody can tick anything off, because whoever is standing in the shop is the
-- one holding the list.
create policy "grocery items tickable by the household"
  on public.grocery_items for update to authenticated
  using (public.is_household_member())
  with check (public.is_household_member());

create policy "grocery items removable by the household"
  on public.grocery_items for delete to authenticated
  using (public.is_household_member());

alter table public.grocery_items enable row level security;

create index grocery_items_created_at_idx on public.grocery_items (created_at);
