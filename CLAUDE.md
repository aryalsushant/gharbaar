# Gharbaar

Expense splitting and a rotating cook/clean duty for one household of six. A browser
app (Vite, React, TypeScript) that installs as a PWA, with Supabase for Postgres,
auth and RLS.

## Conventions

- **No AI attribution anywhere.** Not in commit messages, code comments, docs, or PR
  bodies. No "Co-Authored-By", no "Generated with", no mention of Claude or Anthropic.
  Enforced by the `attribution` key in `.claude/settings.json`.
- **No em dashes.** Anywhere. Product copy, comments, docs, commit messages.
- **Topic branch and a PR for every change**, never straight to `main`. Commits should
  be small and each one should stand on its own.
- **No test suite and no CI, by design.** Verify by running the app and walking the
  flow. The checklist in README.md is the smoke test.

## Layout

- `src/screens/` one file per screen. `App.tsx` holds the routing and the three gates.
- `src/lib/` `supabase.ts` (client), `auth.tsx` (session context), `db.ts` (every
  React Query hook and every Supabase call), `rotation.ts`, `balances.ts`.
- `src/styles.css` the whole design system, in CSS custom properties.
- `src/sw.ts` the service worker. Push handlers live here, not just caching.
- `supabase/migrations/` schema, RLS and RPCs. `supabase/config.toml` project settings.

## One household, not groups

There is a single house. `roster` holds six fixed rows, and a `profiles.roster_key`
claims one of them, uniquely. Membership is that claim and nothing else.

The three gates in `App.tsx` follow from it: no session goes to sign in, a session
without a claimed seat goes to claim one, and only then does the house open. The
middle gate is load-bearing, because an account without a seat can read its own
profile row and nothing else, so every other screen would render empty.

## Data model

`profiles` mirrors `auth.users` and carries `roster_key` and `date_of_birth`.
`expenses` has `expense_splits`, one row per person per expense. `responsibilities`
has `responsibility_members` (rotation order), `responsibility_overrides` (swaps) and
`responsibility_completions` (confirmations). `penalties` is its own ledger.
`push_subscriptions` holds one row per browser that granted permission.

## Rotation algorithm

`getAssignee()` in `src/lib/rotation.ts` is pure and has no scheduler behind it:

1. An override row for that exact date wins outright. That is the swap.
2. Otherwise `index = daysSinceRotationStart mod activeMemberCount`, over members
   sorted by `rotation_order`.

Because it is computed rather than stored, every device agrees on any date, past or
future, with no cron job. A swap is two override rows, which is why deferral was
chosen against: "cover for me and I will take your day" is expressible this way,
whereas "everyone slides down a day" would need a queue walk and stored history.

Dates are local-calendar `YYYY-MM-DD` keys. Never use `toISOString()` on them, it
shifts the day backwards for anyone west of UTC, which is all six of them.

## RLS

Every policy routes its check through `is_household_member()`, a `SECURITY DEFINER
STABLE` function. This is not optional: a policy on `profiles` that queries `profiles`
directly recurses infinitely. `auth.uid()` is always wrapped as `(select auth.uid())`
so the planner evaluates it once per query.

Two rules are enforced in policies rather than in the UI, so calling the API directly
does not get around them: a completion's `marked_by` may not equal the assignee, and a
penalty's `issued_by` may not equal the person being fined.

## Money

All split math is in integer cents (`src/lib/balances.ts`). Floating point splits do
not sum back to the total and the error compounds. `splitEqually` gives the leftover
pennies to the earliest shares.

Fines never enter the split math. A fine is owed to the house rather than to whoever
paid, so it lives in `penalties` and is reported separately.

## Notifications

Web push, through `src/sw.ts` and a VAPID key pair. On iOS a notification only ever
arrives for a PWA opened from the home screen; a Safari tab cannot receive one. Four
of the six are on iPhones, so the install step is part of the product.

## Secrets

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` live in `.env`, which is gitignored.
`.env.example` is the committed template. Anything prefixed `VITE_` is compiled into
the bundle, so Gemini keys and the VAPID private key go into Supabase Edge Function
secrets instead, never into a file here.
