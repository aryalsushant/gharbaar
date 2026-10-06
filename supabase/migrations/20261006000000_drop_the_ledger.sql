-- No more splitting costs in here.
--
-- The house settled on keeping money out of the app. The screens are gone, so
-- the tables behind them go too, rows and all, rather than sitting in the
-- database looking like a feature that still works.
--
-- This deletes every expense, every share of one and every settlement, and
-- there is no way back from it once pushed. Export them first if anybody wants
-- the history.
--
-- The notify triggers on expenses and settlements go with their tables. The
-- notify_household() function stays, because cover requests and taken covers
-- still use it.

drop table if exists public.expense_splits;
drop table if exists public.settlements;
drop table if exists public.expenses;
