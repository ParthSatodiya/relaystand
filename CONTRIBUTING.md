# Contributing to RelayStand

Thanks for taking a look. Setup, deployment and the first-run walkthrough all
live in [README.md](README.md) — start there, then come back for the parts a
newcomer usually trips over.

## The four commands

```shell
npm run dev            # http://localhost:3000
npm test               # carry-forward check on a throwaway SQLite file
npm run lint
npx prisma migrate dev # after editing prisma/schema.prisma
```

## Rules that are easy to break

These are load-bearing. A change that violates one will look fine and be wrong.

- **Identity is the email.** `TeamMember` has no `userId`. A session email is
  matched against `TeamMember.email`, both stored lowercase. Lowercase on write,
  always.
- **Every API route authorizes through `src/lib/perms.ts`** —
  `requireMembership`, `requireLead`, `requireItemAccess`, `requireStandupAccess`.
  Server components use the equivalents in `src/lib/page.ts`. Never add a route
  that skips them, and never key a write on a client-supplied id without scoping
  it to the caller's team.
- **Three statuses only:** `open`, `done`, `blocked`. "Carried forward" is not a
  status — it is `carriedFromId != null`.
- **Dates are `YYYY-MM-DD` strings** everywhere: database, API, URL. No `Date`
  objects crossing a boundary, no timezone conversions.
- **Carry-forward reaches for the most recent standup _before_ the target date**,
  not yesterday. That is what makes a skipped day work, and `npm test` guards
  exactly this. Do not break it.
- **Reading a date must never create a standup.** Creation is the explicit
  `POST /api/teams/:id/standups`.
- **Data flows one way.** Pages are server components that read through
  `src/lib/`. Client components mutate via `/api/**` then call
  `router.refresh()`. There are no `useEffect` data loads, and there should
  stay none.

## Demo data

```shell
npm run seed:demo      # builds prisma/demo.db — a fictional team, one week
```

An invented company with four people and a week of standups, including a task
blocked since Monday and someone off on the Wednesday. It writes to
`prisma/demo.db`, never to your `dev.db`, and refuses to run against any
database whose path does not say `demo`.

It is what the GIFs in `docs/media/` were recorded from, so re-record against it
and the screens stay consistent.

```shell
npm run demo          # seeds it, then serves it with a password-less sign-in
```

`npm run demo` is `seed:demo` plus `DEMO_MODE=1`, which adds a Credentials
provider that signs you in as the seeded lead. It is gated on
`NODE_ENV !== 'production'` as well, so it cannot reach a real build — see
`demoMode()` in `src/lib/signup.ts`, and the test that pins it.

## Touching the UI

Read [DESIGN.md](DESIGN.md) first. Colour and font tokens live in
`src/app/globals.css` (`@theme`), shared classes in `src/lib/ui.ts`. Never
hard-code a hex or a Tailwind palette name in a component.

## Pull requests

- One concern per PR.
- `npm run lint` and `npm test` green. CI runs both, plus a build.
- Logic worth a test gets one, in the style of `src/lib/standup.test.ts`: node's
  own test runner against a throwaway SQLite file. No frameworks.
- Say what you changed and why. A short PR body beats a long one.

## Reporting a security issue

Please do not open a public issue. See [SECURITY.md](SECURITY.md) — it has the
private reporting link, what the app stores, and the limits we already know
about.
