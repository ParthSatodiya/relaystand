# What RelayStand is for

The tour. If you only want to install it, the [README](../README.md) is enough.

![The Payments team's week, Monday to Friday. Each bar is a task and its length
is how many days that task has been running; the hatched red one is blocked and
has run all five. Pressing the "blocked" chip dims everything
else.](media/week-grid.gif)

## The problem it solves

Most standups are run from memory. Someone says "still on the auth thing" for
the fourth morning running, and nobody notices it was the fourth, because
yesterday's meeting left no trace. The notes, if anyone takes them, are a flat
list per day with no thread between them.

RelayStand keeps the thread. An unfinished task walks itself to the next
standup carrying the date it first appeared, so "still on the auth thing" shows
up as a bar four days long, in amber, without anyone having to remember.

That is the whole idea. Everything below is a consequence of it.

## Who it is for

A technical team lead running a daily standup for somewhere between three and
fifteen developers, who already has a tracker — Jira, Linear, GitHub — and does
not want a second one.

It is **not** a task tracker. There is no backlog, no sprint, no estimate, no
assignee field beyond "whose row is this". A task here is a line someone says
out loud in a meeting, optionally with a link to the real ticket. If you are
tempted to plan work in it, plan it in your tracker and paste the link.

## The daily loop

**Morning, before the meeting.** Open the board. A day with no standup yet shows
**+ Start** in its column — on a phone, where the week grid would be five
unreadable columns, it is a **Start standup** button under the day's list
instead. Either way, every unfinished task from the last standup you held comes
across, with its original date intact, so a task raised on Monday still says
Monday on Thursday.

![Monday's column is empty and offers "+ Start". Pressing it fills the column
with every unfinished task from Friday, each already counting its age — 7d on the
blocked one, 4d and 5d on two others.](media/start-standup.gif)

**During the meeting.** Press **Run standup**. It gives you one person at a
time, arrow keys to move between them, and a timer running in the corner so a
fifteen-minute standup that has become forty says so. Mark things finished or
blocked as people speak.

**Any time.** Add a task to anyone's row (if you are the lead) or your own (if
you are not). Paste a Jira, GitHub or Linear URL onto it and it becomes a
labelled chip — `PROJ-1234`, `checkout#482` — not a wall of URL.

**Weekly.** Reports: who finished what, average days to done, and the tasks
that keep sliding, oldest first.

## Scenarios it was built for

### The skipped day

You did not stand up on Tuesday. On Wednesday, carry-forward reaches for the
**most recent standup before Wednesday** — Monday — not for "yesterday". Nothing
is lost to a day off, a public holiday, or a week where standup did not happen
on Thursday.

This is the behaviour most likely to break in a refactor, so `npm test` guards
it specifically.

### The task that keeps sliding

A task's bar grows a day each morning it comes across unfinished. At three days
it turns amber, at five it turns red. Those thresholds are `DRAGGING_DAYS` and
`STALLED_DAYS` in `src/lib/ui.ts` — one place, change them if your team's
rhythm differs.

The age is measured from `originDate`, the day the task first appeared, copied
forward unchanged. Reopening a finished task does not reset it, and neither does
handing it to someone else.

### Handing a task over

Reassign it and it keeps its age and its history. The bar does not restart under
the new name — which is the point, because a task that has been alive nine days
is nine days old no matter whose row it sits in now.

### Someone is away

Tick **On leave**. Their unfinished work stops carrying forward while they are
out, so the board does not fill with a week of untouched rows, and Reports
counts their absent days separately rather than reading them as zero output.

### Someone joins mid-week

Add them by name and **work email** on Members. The email is the identity: when
they first sign in with an account matching it, their row is theirs. Until then
you can enter their tasks for them, and nothing is lost in the handover.

### Looking back

The date on the board is a control. Open the picker and days that actually held
a standup carry a dot, so finding last Tuesday's is one click rather than a
guess. The status chips above the week filter it — press **Blocked** to see only
what was stuck.

![Reports over one week: finished count, average days to done and longest run
per person, then every still-running task oldest first — the blocked four-day one
at the top with its Jira number beside it.](media/reports.gif)

## Who can do what

Three roles, and they are deliberately few.

| Role | Can |
|---|---|
| **Org admin** | Everything in the organisation: create teams, approve join requests, read the audit log |
| **Team lead** | Everything on their team: anyone's tasks, the roster, start and delete a standup |
| **Member** | Their own tasks, and reads the whole board |
| **Observer** | Reads the board and the reports, writes nothing |

A developer can only touch tasks in their own row. That is enforced on the
server for every route, not in the interface — see `src/lib/perms.ts`.

## What it deliberately does not do

Worth saying, so nobody files an issue for a decision:

- **No notifications.** No email, no Slack, no daily nag. The board is where you
  look; it does not come to you.
- **No estimates, points, or burndown.** Days running is the only number, and it
  is measured, not entered.
- **No sub-tasks or dependencies.** A task is one line.
- **No comments thread.** One comment per task, overwritten. Discussion belongs
  in the ticket you linked to.
- **No mobile app.** The interface works down to 320px in a browser; that is the
  whole story.

## Where the data lives

One SQLite file. Everything — organisations, teams, standups, tasks, the audit
trail — is in it, on the `relaystand-data` volume in Docker or
`prisma/dev.db` locally. Copy that file and you have copied the instance.

There is no export in the interface yet. `sqlite3 relaystand.db .dump` is the
current answer, and a proper one is on the list.
