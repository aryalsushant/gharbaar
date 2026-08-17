-- Asking somebody to take your night, rather than assigning it to them.
--
-- The swap already worked, but only in one direction: the person on duty could
-- put somebody else's name on their night without that person ever agreeing.
-- In a house that is not a swap, it is a volunteering.
--
-- So a request is its own row. Whoever cannot cook raises one, everybody sees
-- it, and it only becomes a swap when another person accepts.
--
-- There is no accepted_by column on purpose. Accepting writes the two override
-- rows and deletes the request, so the state is simply whether a request is
-- open. A row that records its own resolution is a second source of truth about
-- who is cooking, and the override rows are already that truth.

create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  date date not null,
  requested_by uuid not null references auth.users (id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  -- One open ask per night. Two people cannot both be trying to give away the
  -- same evening, and asking twice updates rather than stacks.
  unique (responsibility_id, date)
);

create policy "swap requests readable by the household"
  on public.swap_requests for select to authenticated
  using (public.is_household_member());

-- You can only ask on your own behalf. Raising "X cannot cook" for somebody
-- else is just the assignment problem wearing a different hat.
create policy "swap requests raised for yourself"
  on public.swap_requests for insert to authenticated
  with check (
    public.is_household_member()
    and requested_by = (select auth.uid())
  );

-- Deleted by the person who asked, when they can cook after all, and by
-- whoever accepts it, since accepting resolves it.
create policy "swap requests closable by the household"
  on public.swap_requests for delete to authenticated
  using (public.is_household_member());

alter table public.swap_requests enable row level security;

create index swap_requests_date_idx on public.swap_requests (date);
