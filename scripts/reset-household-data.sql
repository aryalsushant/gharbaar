-- Wipe everything the household has done, and free all six seats.
--
-- For testing before the house actually starts using this. Paste into the
-- Supabase SQL editor and run. It does NOT delete accounts: you stay signed in,
-- you just land back on the "which one are you?" screen with all six free.
--
-- After the six of you are really using it, this is a very destructive script.
-- It clears the ledger and the fines along with everything else.

begin;

-- The rota, and by cascade its members, swaps and sign-offs.
delete from public.responsibility_completions;
delete from public.responsibility_overrides;
delete from public.responsibility_members;
delete from public.swap_requests;
delete from public.responsibilities;

-- The money.
delete from public.expense_splits;
delete from public.expenses;
delete from public.penalties;

-- Free every seat. Accounts survive; they simply stop being anybody.
update public.profiles
set roster_key = null,
    date_of_birth = null;

commit;

-- Check: all six free, nothing owed, no rota.
select
  (select count(*) from public.profiles where roster_key is not null) as seats_taken,
  (select count(*) from public.responsibilities) as rotations,
  (select count(*) from public.expenses) as expenses,
  (select count(*) from public.penalties) as fines;
