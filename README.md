# Gharbaar

घरबार, household. Six people, one kitchen, one ledger.

- **Groceries and bills** get logged once and split six ways in integer cents, so
  the shares always add back up to what was actually spent.
- **Cooking and cleaning** rotate a day at a time. Whoever cooks that night also
  cleans up, and somebody else confirms it was done. A missed night is left
  unconfirmed and nothing else happens: six friends do not need a penalty
  system, and no rule inside an app can decide whether dinner happened.
- **Birthdays** announce themselves the day before.

It runs in a browser and installs to a phone home screen as a PWA.

## Running it

Needs Node 20.19 or newer.

```sh
npm install
cp .env.example .env    # fill in from Supabase: Settings, API Keys
npm run dev
```

Then open http://localhost:5173.

The anon key belongs in the bundle and is not a secret. Row level security is
what protects the data: every table is readable only by an account that has
claimed one of the six roster seats.

## Supabase

The database is described by this repo, not by the dashboard.

```sh
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push        # applies supabase/migrations/
npx supabase config push    # applies supabase/config.toml
```

Be careful with `config push`. Any key absent from `config.toml` is filled in
with a CLI default rather than left alone, so it can change settings you never
touched. Read the diff it prints.

## Putting it online

Housemates cannot use `localhost`, and web push needs HTTPS, so this has to be
deployed before anyone else can touch it.

```sh
npx vercel          # first run links the project
npx vercel --prod
```

Two things Vercel needs that are not in the repo:

1. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in
   the project settings. `.env` is gitignored, and the build inlines these, so
   without them the deployed app throws on load.
2. Nothing else. The build is static.

Then point Supabase at the new origin, or password resets will send people to
localhost:

```toml
# supabase/config.toml
site_url = "https://your-app.vercel.app"
additional_redirect_urls = ["https://your-app.vercel.app", "http://localhost:5173"]
```

```sh
npx supabase config push
```

`vercel.json` rewrites unknown paths to `index.html`, which client-side routing
needs, while leaving real files alone. It also stops `sw.js` being cached, since
a cached service worker is a phone stuck on an old build forever.

## The six seats and their addresses

Each seat is reserved for one email address. Claiming Bipul's seat requires
being signed in as Bipul, checked inside `claim_identity()` rather than in the
screen, so calling the API directly does not get around it.

**The addresses are not in this repo, and must not be.** It is public, and they
belong to five other people. Keep the file outside the working tree:

```sh
npx supabase db query --linked -f ~/somewhere-private/seat-emails.sql
```

```sql
update public.roster set email = 'lowercase@example.com' where key = 'bipul';
```

Lowercase only. Gmail is case-insensitive, Postgres is not, and a capital there
locks somebody out of their own seat.

The `roster` table is not readable by any client role. Signing up is open to
anyone, so a readable roster would hand a stranger all six addresses. Everything
the app needs comes from `household_roster()`, which is SECURITY DEFINER and
masks the address to `b****@gmail.com`: enough to recognise your own seat,
useless for guessing somebody else's.

## The six seats

Signing up creates an account. It does not tell the app who you are. That
happens on the next screen, where you claim one of six names, and the unique
constraint on `profiles.roster_key` means only one account ever holds a name.

Until a seat is claimed, an account can read its own profile row and nothing
else. That is deliberate: the seat is the membership check every policy runs.

## Notifications on iPhone

Web push on iOS works only for a PWA that has been added to the home screen,
and only when launched from that icon. A Safari tab will never receive a
notification no matter what permission it was granted. Four of the six phones
here are iPhones, so this is a setup step, not a footnote: Share, then Add to
Home Screen, then open it from the icon.

Android and desktop have no such restriction.

## Checking it by hand

There is no test suite and no CI, by design. This is the checklist.

- [ ] Sign up, then claim a seat. The name you took shows as claimed for
      everybody else.
- [ ] Try to claim a name somebody already holds. It is refused rather than
      silently reassigned.
- [ ] Log an expense. Every housemate sees it and the balances move.
- [ ] Confirm somebody else's duty. Try to confirm your own, and watch the
      database refuse it rather than the button merely being hidden.
- [ ] Ask for cover on a night, and have somebody else take it. The two days
      trade and nobody else moves.
- [ ] Settle up with someone. Only the person being paid can record it.
- [ ] Swap a day. The two people trade, and clearing it puts both back.
- [ ] Install to a home screen and receive a notification there.
