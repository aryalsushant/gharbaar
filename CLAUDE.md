# Gharbaar

Expense splitting + rotating household responsibilities. Expo (React Native) targeting
iOS, Android and web from one codebase, with Supabase for Postgres, auth and RLS.

## Conventions

- **No AI attribution anywhere.** Not in commit messages, code comments, docs, or PR
  bodies — no "Co-Authored-By", no "Generated with", no mention of Claude or Anthropic.
  Enforced by the `attribution` key in `.claude/settings.json`.
- **No test suite and no CI, by design.** Verify manually: run the app, walk the flow.
  The smoke test in README.md is the checklist.
- Expo SDK 54 specifically, because that is what the App Store build of Expo Go runs.
  Bumping past it means users need a development build.

## Layout

- `app/` — Expo Router file routes. `(auth)` group is public, `/join/[code]` is public
  (an invite must survive the trip through sign-up), everything else is gated in
  `app/_layout.tsx`.
- `lib/` — `supabase.ts` (client), `auth.tsx` (session context), `db.ts` (all React Query
  hooks and every Supabase call), `rotation.ts`, `balances.ts`, `invite.ts`.
- `components/ui.tsx` — the whole design system: Screen, Card, Field, Button, etc.
- `supabase/migrations/` — schema, RLS and RPCs in one migration.

## Data model

`profiles` mirrors `auth.users`. `groups` ← `group_members` (the membership join table
every RLS policy keys off) and `group_invites`. `expenses` ← `expense_splits` (one row per
person per expense). `responsibilities` ← `responsibility_members` (rotation order),
`responsibility_overrides` (manual swaps), `responsibility_completions`.

## Rotation algorithm

`getAssignee()` in `lib/rotation.ts` is pure and has no scheduler behind it:

1. An override row for that exact date wins outright — that is the swap feature.
2. Otherwise `index = daysSinceRotationStart mod activeMemberCount`, over members sorted
   by `rotation_order`.

Because it is a computation and not stored state, every device agrees on any date, past
or future, with no cron job. Dates are handled as local-calendar `YYYY-MM-DD` keys;
never use `toISOString()` for them, it shifts the day across timezones.

## RLS

Every policy routes its membership check through `is_group_member(gid)`, a
`SECURITY DEFINER STABLE` function. This is not optional: a policy on `group_members`
that queries `group_members` directly recurses infinitely. `auth.uid()` is always wrapped
as `(select auth.uid())` so the planner evaluates it once per query.

Joining is the one thing a non-member must do, so it goes through the
`join_group_with_code()` SECURITY DEFINER RPC, which validates expiry and use count
server-side. The `group_members` INSERT policy stays closed to non-members.

## Money

All split math is in integer cents (`lib/balances.ts`). Floating point splits do not sum
back to the expense total and the error compounds. `splitEqually` hands leftover pennies
to the earliest shares.

## Env

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` live in `.env`, which is
gitignored. `.env.example` is the committed template. `SUPABASE_ACCESS_TOKEN` is a
personal token for the CLI — shell env only, never a file.
