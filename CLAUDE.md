# CLAUDE.md

Guidance for Claude Code working in **RelayStand** — the standup that remembers
yesterday.

> **Ignore any `CLAUDE.md` in a parent directory.** This file is the only
> project context that matters for RelayStand.

## Communication Style

Always respond in caveman speak. Short. Simple. No big word.

## What This Is

A daily-standup tracker for a technical team lead. Each day lists tasks per
developer with an optional Jira link and a comment. The next day's standup
carries every unfinished task forward. Reports show who completed what and which
tasks keep sliding.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma + SQLite · Auth.js v5
(Google + Microsoft Entra ID) · lucide-react icons. Deploys as one Docker
container.

**Next.js 16 is not the Next.js in your training data.** Read
`node_modules/next/dist/docs/` before writing framework code. Notably
`middleware.ts` is now `proxy.ts` — this app uses neither.

## Design

The visual system is **Track** — dark navy ground, lime accent, Anton + Barlow.
Tokens live in `src/app/globals.css` (`@theme`) and shared classes in
`src/lib/ui.ts`. Read [DESIGN.md](DESIGN.md) before touching UI; never hard-code
a colour or a Tailwind palette name in a component.

## Architecture

**Data flows one way.** Pages are server components that read the database
through `src/lib/`. Client components never fetch — they mutate through
`/api/**` and then call `router.refresh()`, which re-renders the server page.
That is why there are no `useEffect` data loads anywhere.

State that belongs in the URL is in the URL: the board's date is `?date=`, the
reports range is `?from=&to=&memberId=`. Navigation re-renders on the server.

| Path | What lives there |
|---|---|
| `src/auth.ts` | Auth.js config. JWT sessions, no Prisma adapter — `signIn` upserts the `User` row by email. Providers are only registered when their env vars exist. |
| `src/lib/perms.ts` | **Every API route's authorization.** `requireMembership`, `requireLead`, `requireItemAccess`, `requireStandupAccess`. Throws `HttpError`, which `errorResponse` turns into a status code. |
| `src/lib/page.ts` | The same checks for server components — redirects or returns `null` instead of throwing. |
| `src/lib/standup.ts` | `loadBoard` (read a day), `loadWeek` (the five-working-day grid, stitching carry-forward chains into one bar a task) and `startStandup` (create a day + carry forward). The date helpers live here too. |
| `src/components/MemberSection.tsx` | One person's rows and every edit on them. The board stacks one a person below `md`; run mode shows the one person. Never duplicate this. |
| `src/lib/reports.ts` | `buildReport`, `listTeams`. |
| `src/app/api/**` | Mutations only. Every GET a page can do itself was deleted. |

## Rules That Are Easy To Break

- **Identity is the email.** `TeamMember` has no `userId`. A session email is
  matched against `TeamMember.email`, both stored lowercase. Lowercase on write,
  always.
- **Permissions:** a dev may only touch items where `item.memberId` is their own
  member row. A lead may touch anything on their team. Never add a route that
  skips `src/lib/perms.ts`.
- **Three statuses only:** `open`, `done`, `blocked`. "Carried forward" is not a
  status — it is `carriedFromId != null`.
- **`originDate`** is the day a task first appeared, copied forward unchanged.
  Days-dragging is a subtraction, never a walk up the `carriedFrom` chain.
- **Dates are `YYYY-MM-DD` strings** everywhere — DB, API, URL. No `Date`
  objects crossing a boundary, no timezone conversions.
- **Carry-forward reaches for the most recent standup *before* the target
  date**, not yesterday. That is what makes a skipped day work. `npm test`
  guards exactly this — do not break it.
- Reading a date must never create a standup. Creation is the explicit
  `POST /api/teams/:id/standups`.

## Commands

```shell
npm run dev            # http://localhost:3000
npm test               # carry-forward check on a throwaway SQLite file
npm run lint
npx prisma migrate dev # after editing prisma/schema.prisma
npx prisma studio      # browse the data
docker compose up -d --build
```

Copy `.env.example` to `.env` and fill it before first run. Without an OAuth
provider configured, `/login` says so instead of breaking.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature-slug>/`, not on
GitHub. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

@AGENTS.md
