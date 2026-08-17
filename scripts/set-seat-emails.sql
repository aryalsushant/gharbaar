-- Reserve each seat for one email address.
--
-- Run this in the Supabase SQL editor BEFORE sending anyone the link. Once a
-- seat has an email on it, only an account signed in with that exact address
-- can claim it, enforced inside claim_identity() rather than in the screen.
--
-- Lowercase everything. Gmail treats addresses case-insensitively, Postgres
-- does not, and a capital letter here would lock somebody out of their own seat.
--
-- Leaving a seat null keeps the old behaviour for that person: anybody may
-- claim it. Fine while you are still testing, not fine once the link is out.

update public.roster set email = 'suwan@example.com'   where key = 'suwan';
update public.roster set email = 'prastab@example.com' where key = 'prastab';
update public.roster set email = 'sushant@example.com' where key = 'sushant';
update public.roster set email = 'serene@example.com'  where key = 'serene';
update public.roster set email = 'chetan@example.com'  where key = 'chetan';
update public.roster set email = 'bipul@example.com'   where key = 'bipul';

-- Check: every seat spoken for, and no typos.
select key, display_name, email,
       (select count(*) from public.profiles p where p.roster_key = roster.key) as claimed_by
from public.roster
order by sort_order;
