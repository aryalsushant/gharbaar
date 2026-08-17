# Gharbaar

Split expenses and split chores, for a household or any group.

- **Expenses** — log what someone paid, it divides equally across the group, and the
  balances tab shows who owes whom plus the shortest set of transfers that settles up.
- **Responsibilities** — pick who is in the rotation for a task and it assigns itself one
  person per day, forever, with no scheduler. Any day can be swapped to someone else.

Runs on iOS, Android and web from one codebase: Expo (React Native) + Expo Router, with
Supabase for Postgres, auth and row-level security.

## Setup

Requires Node 20.19.4 or newer (React Native 0.85 asks for it; older 20.x mostly works
but Metro will warn).

```sh
npm install
```

### Supabase

Create a personal access token at supabase.com under Account → Access Tokens, then:

```sh
export SUPABASE_ACCESS_TOKEN=sbp_...
./scripts/setup-supabase.sh
```

That creates the project, waits for it to boot, links this repo to it, applies
`supabase/migrations/`, and writes `.env`. If you would rather point at a project you
already have, skip the script and copy `.env.example` to `.env` yourself:

```sh
cp .env.example .env      # then fill in the URL and anon key
npx supabase link --project-ref <ref>
npx supabase db push
```

### Run it

```sh
npx expo start
```

Then press `w` for web, or scan the QR code with Expo Go on a phone. The project is
pinned to Expo SDK 54 precisely so the store build of Expo Go can run it — no development
build needed.

## Manual smoke test

There is no automated test suite; this is the checklist instead. Two accounts are needed,
so run web in a normal window and a private window, or web plus a simulator.

- [ ] Sign up as user A, then as user B.
- [ ] A creates a group. It appears in A's list.
- [ ] A opens Invite, generates a code, and B opens the link (or `/join/<code>`). B lands
      in the group and both see 2 members.
- [ ] A adds an expense. Both see it, and Balances shows one owing half and one owed half.
- [ ] Add a second expense paid by B and confirm the balances net off correctly.
- [ ] A creates a responsibility with both members. The assignee alternates day by day
      down the 14-day list.
- [ ] Mark a day done. Reload — it is still marked.
- [ ] Swap a day to the other person. The assignee changes and is tagged "swapped".
      Clear the swap and it returns to the computed person.
- [ ] Confirm web and at least one of iOS/Android run without crashing.

## Notes

- No CI and no test suite, by design — see `CLAUDE.md`.
- `.env` is gitignored. The anon key is safe in a client bundle; RLS is what protects the
  data, and every table is scoped to active membership of the row's group.
