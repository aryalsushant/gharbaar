-- Jobs beyond dinner.
--
-- The only rotation used to be Dinner, and it turned every day. The bins or a
-- bathroom turn by the week, so the check that pinned frequency to daily is
-- widened. Nothing else changes: the holder is still computed, never stored,
-- and a weekly job takes floor(daysSinceStart / 7) mod members where a daily
-- one takes daysSinceStart mod members.

alter table public.responsibilities
  drop constraint if exists responsibilities_frequency_check;

alter table public.responsibilities
  add constraint responsibilities_frequency_check
  check (frequency in ('daily', 'weekly'));
