-- One rotation per name, so it can create itself safely.
--
-- The rota used to be opened by somebody pressing a button, which meant exactly
-- one person ever created it. Now the app opens it on first load instead, and
-- six phones can reach that code path at the same moment. Without a constraint
-- that is six Dinner rotations, each with a different membership, and the board
-- showing whichever came back first.
--
-- With it, the losing inserts fail on the unique violation, which the client
-- treats as "somebody else got there first" and re-reads.

create unique index responsibilities_name_key on public.responsibilities (name);
