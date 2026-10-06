# RelayStand — domain glossary

The words this project uses, and the ones it deliberately doesn't. When code, a
commit message, an issue title or a test name touches a concept below, use the
term as defined here rather than a synonym.

Read with [CLAUDE.md](CLAUDE.md) (how the code is arranged) and
[DESIGN.md](DESIGN.md) (how it looks). Decisions that were argued out live in
[docs/adr/](docs/adr/).

## The shape of things

```
Org ─┬─ OrgMember      (membership of the company, by email)
     └─ Team ─┬─ TeamMember   (a person on this team, by email)
              └─ Standup      (one team, one day)
                   └─ Task     (one line of work, for one member)
                        └─ Link (a URL on that task)
```

## Terms

**Org** — a company or workspace. Owns teams and the audit trail. Lives at
`/orgs/<slug>`. Say *org* or *organisation*, not "workspace" or "tenant".

**Org member** — somebody's membership of an org, keyed on their email. Role is
`admin` or `member`. Status is `pending` (asked to join, waiting on an admin),
`active`, or `deactivated`. An org member can exist before that person has ever
signed in.

**Team** — a group inside an org that holds one standup a day.

**Team member** — a person on a team. Role is `lead`, `member`, or `observer`;
an observer reads and writes nothing. Not the same thing as a *user*.

**User** — somebody who has actually signed in. Joined to a team member by
email, never by a foreign key. See
[ADR-0001](docs/adr/0001-identity-is-the-work-email.md).

**Standup** — one team's one day, unique on `(teamId, date)`. It is created
explicitly; reading a date never creates one.

**Task** — one line of work, belonging to one team member on one standup. The
database model is `StandupItem` and the code says `item`; **the user-facing
word is always "task"**. Both are correct in their place — don't write "item" in
UI copy, don't rename the model in code.

**Status** — exactly three: `open`, `done`, `blocked`. On screen they read
*running*, *finished*, *blocked* (`statusLabel` in `src/lib/ui.ts`). There is no
fourth, and "carried forward" is not one of them.

**Carry forward** — copying every unfinished task from the most recent standup
*before* the target date onto a new one. Not "from yesterday": reaching further
back is what makes a skipped day work.

**Carried from** — `carriedFromId`, the link from a copy to the task it came
from. A task is carried forward if this is set. Again: not a status.

**Origin date** — `originDate`, the day a task first appeared, copied forward
unchanged for the life of the task. Never recomputed.

**Days dragging** — how long a task has been alive: a subtraction,
`target − originDate`. Never a walk up the carried-from chain. See
[ADR-0002](docs/adr/0002-dates-are-strings-and-age-is-subtraction.md).

**Dragging / stalled** — the two age thresholds that colour a task amber then
red, at 3 and 5 days (`DRAGGING_DAYS`, `STALLED_DAYS` in `src/lib/ui.ts`).
"Stalled" is about age. "Blocked" is a status someone chose. Different things.

**Absence** — a team member marked away for one standup day.

**Board** — the single-day screen at `/teams/<id>?date=`, one section per member.

**Week grid** — the five-working-day view on the board. One **lane** per member,
one **bar** per task, bar length is days running.

**Run mode** — the focused view of one person, opened by clicking a person or a
task. Beware: `useRun()` in `src/lib/useRun.ts` is unrelated — that is the
mutate-then-refresh helper every client component uses. Two different "run"s.

**Audit event** — a row written at the moment something happened, with its
summary composed on write, so the log page stays a dumb list.

## Words we don't use

- **Ticket** — a *link* on a task, pointing at Jira or Linear. RelayStand is not
  a tracker and does not own tickets. Don't call a task a ticket.
- **Sprint, backlog, story, epic** — not concepts here. The unit is a day.
- **Workspace, tenant** — say *org*.
- **Blocker** — the status is *blocked*. A blocked task, not a blocker.
- **Assignee, owner** — tasks belong to a *team member*.
- **Carried-forward status** — see above. It is a link, not a status.
