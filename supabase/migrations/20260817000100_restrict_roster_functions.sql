-- Keep the household roster behind sign-in.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which meant
-- household_roster() would list all six names to anyone holding the
-- publishable key. That key ships inside the web bundle, so it is effectively
-- public. Nobody needs the roster before signing in: the claim step happens
-- after the account exists.
--
-- preview_invite() is deliberately left alone. The /join/<code> route has to
-- render the group's name for someone who has not signed up yet.

revoke execute on function public.household_roster() from public, anon;
grant execute on function public.household_roster() to authenticated;

revoke execute on function public.claim_identity(text, date) from public, anon;
grant execute on function public.claim_identity(text, date) to authenticated;
