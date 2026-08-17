-- Remove fines.
--
-- The $10 needed a rule for who could issue one, and every rule had a hole. One
-- tap was open to abuse, a time gate only narrowed the window, and two
-- signatures fell to two people agreeing to be funny together. The honest
-- conclusion is that no rule inside an app can decide whether dinner happened,
-- and six friends do not need a penalty system to find out.
--
-- Sign-offs stay. Recording that somebody cooked is worth keeping; charging
-- them when they did not is what is going.
--
-- A missed night can still be settled in the ledger, where one housemate adds a
-- small expense split only with the person who skipped. That is the same money
-- with none of the machinery, and it requires two people to agree in the
-- ordinary way rather than by policy.

drop table if exists public.penalties;
