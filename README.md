# Gharbaar

घरबार, household. Six people, one kitchen, one ledger.

- **Groceries and bills** get logged once and split six ways in integer cents, so
  the shares always add back up to what was actually spent.
- **Cooking and cleaning** rotate a day at a time. Whoever cooks that night also
  cleans up, and somebody else confirms it was done. A missed night costs $10.
- **Fines are kept apart from the shopping.** Money owed to the house is not the
  same thing as money owed to whoever paid at the till, so the two never mix.
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
- [ ] Miss a night and take the $10. It lands in the fines column, not the
      grocery column.
- [ ] Swap a day. The two people trade, and clearing it puts both back.
- [ ] Install to a home screen and receive a notification there.
