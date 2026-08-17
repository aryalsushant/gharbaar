-- Stop the roster table being readable, so the addresses on it are not.
--
-- The old policy was `for select to authenticated using (true)`, which is fine
-- for six names and a disaster once those rows carry email addresses: signing
-- up is open to anybody, so any stranger with an account could have selected
-- the whole table and walked off with all six.
--
-- RLS is row level, not column level, so a policy cannot hide one column. The
-- fix is to take the table away from clients entirely. Nothing needs it:
-- household_roster() is SECURITY DEFINER, so it still reads the table as the
-- owner and returns only what the claim screen should see, with the address
-- masked to b****@gmail.com.
--
-- claim_identity() compares the full address inside the database and never
-- returns it, which is the whole point: the client asks "am I allowed this
-- seat" and gets yes or no, never the answer key.

drop policy if exists "roster readable by everyone signed in" on public.roster;

revoke all on table public.roster from anon, authenticated;

-- Belt and braces: if a future migration adds a policy back by accident, the
-- grant is still gone, and a policy without a grant grants nothing.
comment on table public.roster is
  'The six people in the house. Not client readable: go through household_roster(), which masks the email. Photos are bundled at public/people/<key>.jpg.';
