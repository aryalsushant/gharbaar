-- The kitchen, divided.
--
-- Written down as the house agreed it, in the words the house used, including
-- the ones that are not English. A chore nobody recognises as theirs is a
-- chore that gets argued about, and "ghoti ghoti safa garne" is unambiguous to
-- everyone who has to do it in a way that a tidied up translation would not be.
--
-- Seeded by seat rather than by account, so this holds whoever is sitting in it.

insert into public.chores (roster_key, title) values
  ('serene',   'Wash all the dishes on the left side of the sink'),
  ('prastab',  'Wash all the dishes on the right side of the sink'),
  ('bipul',    'Wash all the dishes on top of the stove and the kitchen counter'),
  ('suwan',    'Stove area ra kitchen top area ghoti ghoti safa garne'),
  ('chetan',   'Trash can waripari sab fohor clear garne, living room samma floor sweep garne'),
  ('sushant',  'Sabai trash baira falera trash bag replace garne, bathroom sink ra toilet bowl safa garne')
on conflict (roster_key, title) do nothing;
