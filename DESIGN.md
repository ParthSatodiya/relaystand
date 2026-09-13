# DESIGN.md — Track

The visual system for RelayStand. One palette, two typefaces, one idea: **a bar's
length is time, its fill is state.** Read this before adding a screen.

Where it lives:

| Thing | File |
|---|---|
| Colour and font tokens | `src/app/globals.css` (`@theme`) |
| Shared class strings, pills, day thresholds, lane width | `src/lib/ui.ts` |
| Fonts loaded | `src/app/layout.tsx` (`next/font`) |

Nothing hard-codes a colour. If you find yourself typing a hex or a Tailwind
palette name (`gray-200`, `indigo-600`) in a component, stop — use a token.

## Colour

| Token | Hex | What it is for |
|---|---|---|
| `track` | `#0d2540` | The page ground. Everything sits on this. |
| `raised` | `#123152` | Anything on the ground: cards, inputs, menus, the header. |
| `line` | `rgba(233,243,255,.16)` | Borders you are meant to see: cards, inputs, buttons. |
| `line-soft` | `rgba(233,243,255,.07)` | Rules between rows in a list or table. |
| `chalk` | `#e9f3ff` | Text. 13.81:1 on `track`, 11.80:1 on `raised`. |
| `dim` | `#8fb0cd` | Secondary text. 6.83:1 on `track`, 5.84:1 on `raised` — the lightest text allowed, at any size. |
| `baton` | `#c9f24a` | The accent: finished work, the page you are on, the primary action. |
| `baton-ink` | `#0d2540` | Text sitting on a `baton` fill. Never `chalk` on `baton`. |
| `stall` | `#ff6f5e` | Blocked, destructive, errors. |
| `stall-ink` | `#0d2540` | Text sitting on a `stall` fill. 5.67:1. Never borrow `baton-ink` for this. |
| `warn` | `#f5b93f` | Dragging, away, waiting on someone. |

Rules:

- **One baton per screen.** Lime marks the current page and finished work. It is
  not decoration — if two unrelated things are lime, one of them is wrong.
- **Semantic colour is not the accent.** `stall` and `warn` mean something is
  wrong or slipping. Never use them to make a page look livelier.
- **Never rely on hue alone.** Finished is a *solid fill*, running is an
  *outline*, blocked is *hatched* (`.hatch`). The three read apart in greyscale
  and for red-green colour blindness. Keep it that way.
- Faint chalk (`chalk/8`, `chalk/10`) is for rules and lane grounds only — never
  for words.

Other palettes were considered (Ghost, Foundry, Drafting, Harbour); Track won.
Do not mix them in.

## Type

Two faces, both from `next/font`:

- **Anton** — display only. Headings, the wordmark, big numbers. Always
  uppercase, tight leading. Use the `.display` class or `ui.h1` / `ui.h2`.
  Never for a sentence.
- **Barlow** — everything else: body, labels, buttons, table cells.

Scale (Tailwind sizes):

| Role | Class | Notes |
|---|---|---|
| Page title | `ui.h1` (`display text-3xl sm:text-4xl`) | One per page. |
| Section heading | `ui.h2` (`display text-sm tracking-[0.11em]`) | Sits on a rule. |
| Person name on a shared screen | `display text-3xl sm:text-4xl` | Run-standup mode only. |
| Body | default (`text-sm` / `text-base`) | Max ~65 characters a line. |
| Label above a field | `ui.label` | Uppercase, `0.13em` tracking, `dim`. |
| A number that matters | `display` + `tabular-nums` | Day counts, totals. |

Every column of digits gets `tabular-nums`. No exceptions — dates and day counts
jitter without it.

## The lane

The one idea worth protecting. A task's bar is drawn from the day it **first
appeared** (`originDate`), not from yesterday.

```
finished   ████████████        solid baton
running    ──────────────      outline / chalk-30 fill
blocked    ▨▨▨▨▨▨▨▨▨▨▨▨        .hatch + stall border, reason written on the bar
```

- Width comes from `laneWidth(days)` in `ui.ts`: 10% a day, capped at 100%, floor
  8% so a one-day task is still visible. One ancient task must not flatten the rest.
- Day counts are coloured by `daysTone(days)`: `dim` under 3 days, `warn` at 3,
  `stall` at 5 and over. Thresholds live in `DRAGGING_DAYS` / `STALLED_DAYS` —
  change them there, nowhere else.
- The same three shapes appear on the board, the reports, the team list and the
  org picker. A person should learn them once.

### The week grid

The board's desk view (`src/components/WeekGrid.tsx`, fed by `loadWeek`): one row
a person, one bar a task, drawn across the last five **working** days. A weekend
only takes a column if the team actually stood up on it.

- Columns carry three states: held (plain), **today** (`bg-baton/8`), and no
  standup held (`bg-chalk/4`, labelled under the date). Weekends are simply
  absent rather than greyed, so five columns always mean five days of work.
- Carry-forward writes a new row a day, so bars are stitched back together by
  following `carriedFromId` inside the window. A task older than the window keeps
  a `warn` left edge instead of pretending it began at the first column.
- The grid is for reading. The only edits on it are finishing a task on today's
  column, a quick add a person, and starting a day that was never held; title,
  comment, links, order, status and away all live in run mode, which a click on
  any person or bar opens.
- **The date is the control.** The board's title *is* the stepper: arrows either
  side, and pressing the date opens the day picker (`src/components/DayPicker.tsx`)
  — our own, not the native one, because only ours can say which days the team
  stood up on: a lime dot for held, coral when that day had something blocked, a
  ring on today, future days disabled. `Today` is a small chip beside it, always
  rendered and disabled on the day itself.
- **Run standup is the board's one baton control** — a primary button beside the
  day's figures, which starts at the top. In the grid, a person's mark turns into
  a ▶ on hover to start on them instead: what a lead reaches for when someone has
  to leave early. One button for the meeting, one gesture a person; no second
  whole-team control. On a day with no standup the button goes outlined and dim
  rather than faded, because dimming a baton fill turns it olive.
- **The day's figures are the week's filter.** Finished, running and blocked are
  three chips; pressing one narrows the grid. No chip pressed and every chip
  pressed mean the same thing — show everything — so there is no separate clear
  control. Excluded bars **fade rather than hide**, so rows keep their height and
  nobody moves under the pointer.
- **The arrows walk working days.** Back from Monday is Friday — unless the team
  actually stood up on that weekend, which makes it a stop in either direction,
  so the held days are read from both sides of the day on screen.
- **Today sits left of the arrows and is always there**, disabled on the day
  itself. A control that disappears moves everything beside it, and the date
  field should not travel under the pointer between two clicks. The day you are
  viewing always earns a column, weekend or not, so picking a Saturday from the
  date field is how you start a weekend standup.
- A day with no standup carries **+ Start** in its own column, in the row under
  the grid. There is no separate empty-state panel: the action belongs to the day
  it starts, so Tuesday can be started without leaving Thursday.
- A bar's title truncates; the full title and its comment ride in the `title`
  attribute, so hovering tells you the rest.
- Below `md` the grid is hidden and the day's list takes over — five columns on a
  phone is unreadable, and a lead on a phone wants today, not the week.

### The tab mark

The favicon is the lane, and it carries one bit: **does this board need someone.**
`src/components/TabMark.tsx` swaps in the coral mark (`public/icon-alert.svg`)
while the board on screen has a blocked task, or an unfinished one running
`STALLED_DAYS` or longer; otherwise the tab keeps the lime mark
(`src/app/icon.svg`). It follows the **date being viewed**, so paging back to an
old day never raises a false alarm, and it restores the default on the way out.

Two states, deliberately. A tab icon is 16px next to five other tabs — it can say
"look at me" or nothing, and a third colour there means neither.

## Layout

- Page width `max-w-6xl`, content padding `px-4 py-6`. Side gutter never below
  16px.
- Lay out siblings with flex/grid and `gap`, not margins.
- Borders and rules carry the structure; keep radius small (`rounded`,
  `rounded-md`). Not everything is a card — a list of rows separated by
  `divide-line-soft` beats a stack of boxes. The board, the team list, the org
  picker, the roster and the reports are all rules on the page ground; cards are
  kept for things that really are one object, like the sign-in panel.
- A page opens with its numbers: a four-cell strip (`border-y`, Anton figures)
  before any detail, so the day reads in one look.
- An uploaded image (an org logo) sits on a chalk plate — logos are drawn for
  white paper and vanish into the dark ground otherwise.
- Tables and lane grids scroll inside their own `overflow-x-auto`; the page body
  never scrolls sideways.
- Phone width (~400px) is a supported size, not an afterthought: rows wrap, the
  email in the header drops, the date stepper takes its own line.

## Building a new screen

Every screen in the app is the same four bands, in this order. Follow it and a
new page looks like it was always there.

```
┌────────────────────────────────────────────────────────────┐
│ Row 1  wordmark · org ▾ · / team ▾            email · out  │  AppHeader
├────────────────────────────────────────────────────────────┤
│ Row 2  Board 9 ● Reports  Members 6  Run standup           │  TeamNav (team pages only)
├────────────────────────────────────────────────────────────┤
│ TITLE IN ANTON                        [ controls for it ]  │  page header
│ one line of dim text saying what this is                   │
│────────────────────────────────────────────────────────────│
│  RUNNING │ FINISHED │ BLOCKED │ LONGEST   ← the numbers     │  strip (border-y)
│    3     │    2     │    1    │   9d                       │
│────────────────────────────────────────────────────────────│
│ SECTION HEADING                       note about the rule  │  ui.h2 on a border-b
│ row ...................................................... │  border-b border-line-soft
│ row ...................................................... │
└────────────────────────────────────────────────────────────┘
```

**Page header.** `<h1 className={ui.h1}>` with the changing half in `text-baton`
(`Teams in <span class="text-baton">Twinntax</span>`), a `mt-2` line of `text-dim`
underneath saying what the page is for, and the page's controls — date stepper,
range fields, one primary action — on the right of the same flex row
(`flex flex-wrap items-end justify-between gap-4`).

**The numbers.** If the screen has a summary, it is a `<dl>` strip of two to four
cells with `border-y border-line`, each cell `px-4 py-3.5`, `ui.label` over a
`display text-3xl tabular-nums` figure, cells split by `border-l border-line-soft`.
Never big number *cards*.

**Sections.** `mt-9` between sections. Heading is `ui.h2` sitting on
`border-b border-line pb-2.5`, with any explanatory note as `text-xs text-dim` at
the right end of that same rule. Rows below it are `border-b border-line-soft`
with `py-3.5` (dense lists) or `py-4`–`py-5` (rows with a lane bar).

**The standard row** is a three-part grid: who or what it is, the lane, then the
state or action.

```
md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]
│ name + meta          │ lane bar + counts    │ time / button │
```

Below `md` it collapses to one column — so keep the three parts readable stacked,
and never let the lane be the only thing carrying meaning.

**Forms** are a stack (`space-y-4`) under a section rule: `ui.label`, then
`ui.input` at `w-full` inside its own `<div>`, help text as `mt-1 text-xs text-dim`,
and the submit button last, left-aligned. An inline add form (add a task, add a
member) is instead one `flex flex-wrap items-end gap-3` line ending in the button.

**Spacing rhythm.** `mt-2` title → lede, `mt-5`/`mt-6` block → block, `mt-9`
section → section, `gap-4` inside a row, `gap-2`/`gap-3` between controls. Pick
from that set rather than inventing a value.

**When a card is allowed.** `ui.card` is for something that really is one object
lifted off the page: the sign-in panel, a menu, the editing state of a row. Lists,
rosters, reports and boards are rules on the ground. If two cards ever sit side by
side doing the same job, they should have been rows.

**Before you call a screen done**

- It opens with its numbers, not with detail.
- Every count is `tabular-nums`; every day count goes through `daysTone`.
- Finished / running / blocked read apart without colour (fill, outline, hatch).
- One primary action, in baton; everything else ghost or subtle.
- 400px wide: rows wrap, nothing clips, the body does not scroll sideways.
- Tab, and watch the focus ring go where you expect.
- Empty state says what to do next; error says what to fix.

## Components

Use `ui.*` rather than re-typing classes:

| Recipe | Token |
|---|---|
| Card / panel | `ui.card` |
| Field | `ui.input` + `ui.label` |
| Primary action | `ui.btn ui.btnPrimary` — baton fill, ink text |
| Secondary | `ui.btn ui.btnGhost` — outline, goes baton on hover |
| Quiet action in a row | `ui.btn ui.btnSubtle` + `ui.rowAction` |
| Destructive | `ui.btn ui.btnDanger` (confirm first, in place) |
| Status | `pill` + `statusPill[status]`, labelled by `statusLabel[status]` |
| An org's logo | `OrgMark` — initials on baton, or the uploaded logo on a chalk plate |
| Nothing here yet | `ui.empty` — say what to do next, with the action in the panel |
| Something went wrong | `ui.error` — what happened and how to fix it |

## Navigation

Two rows, and the second only exists inside a team:

- **Row one** — wordmark, organisation switcher, team switcher, then the signed-in
  email and sign out on the right. Both switchers are native `<details>`: they
  open, close and take keyboard focus without client JavaScript.
- **Row two** — the team's *places*: Board, Reports, Members. Nothing else goes
  here. Running the standup is an action that belongs to a day, so it lives on
  the board beside that day, not in a row of management pages.

A count on a tab is data about the page, not part of its name: it sits in its own
chip (`bg-chalk/10`, baton-tinted on the open tab) and turns `stall` when
something on that page is blocked. Never append a bare number to a label.

## Writing

- Say what the control does: "Start standup", then the board says it started.
- Name things the way the team says them out loud: *running*, *finished*,
  *blocked*, *carried*, *away* — not *active*, *completed*, *inactive*. The
  database still says `open`/`done`; `statusLabel` in `ui.ts` is the one place
  that translates, so no screen ever prints a schema word.
- Errors explain the fix ("Promote another lead before removing yourself"), never
  apologise and never say "something went wrong".
- Empty states are an invitation, not a shrug.
- Sentence case everywhere except `ui.label` and headings, which are uppercase by
  the typeface, not by the words.

## The floor

Not optional, not up for redesign:

- Visible keyboard focus (`focus-visible:outline-baton`) on every control.
- `dim` is the lightest text. Anything fainter is a rule, not a word.
- Hit areas at least 24px; row actions that hide on hover stay visible on touch.
- Respect `prefers-reduced-motion`; motion only answers an action (a menu
  opening, a row saving), never ambient.
- Colour is never the only signal — fill, outline and hatch carry the state too.

## Adding to the system

1. Reach for an existing token. If none fits, ask whether the screen really needs
   a new colour, or a new *shape*.
2. If it is genuinely new, add it to `@theme` in `globals.css` with a comment
   saying what it is for, and add a row to the table above.
3. Repeated markup belongs in `ui.ts`, not copied into a second component.
