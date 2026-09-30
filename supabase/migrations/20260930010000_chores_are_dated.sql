-- A round belongs to a day.
--
-- The first version of this got the shape wrong. It read the six jobs as a
-- permanent division of the kitchen, one each, the same every night, and so the
-- board asked the same six questions again every morning. They were a list for
-- one particular day: a clean up the house agreed to do, not a standing rota.
--
-- The difference matters more than a label. A daily question that nobody agreed
-- to is the thing people learn to ignore, and once they are ignoring it the
-- honest "not today" answer stops meaning anything.
--
-- So a chore carries the day it is for, and the board shows a round only on that
-- day. The six already in the table are dated to the day they were agreed. A
-- future round is another handful of rows with another date, and on every day
-- without one the board simply does not mention it.

alter table public.chores add column if not exists for_date date;

update public.chores set for_date = date '2026-09-30' where for_date is null;

alter table public.chores alter column for_date set not null;

-- The old constraint assumed one job per person forever. Dating it keeps the
-- seed idempotent while allowing the same job to come round again another day.
alter table public.chores drop constraint if exists chores_roster_key_title_key;

alter table public.chores
  add constraint chores_roster_key_title_for_date_key
  unique (roster_key, title, for_date);

create index if not exists chores_for_date_idx on public.chores (for_date);

comment on column public.chores.for_date is
  'The day this job is for. A round is the rows sharing one date, not a daily rota.';
