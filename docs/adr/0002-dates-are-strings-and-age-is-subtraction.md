# ADR-0002: Dates are strings, and a task's age is a subtraction

- **Status:** Accepted — recorded retroactively.
- **Date:** 2026-10-07

## Context

A standup is a *day*, not an instant. Two separate things could go wrong:
timezone drift turning "Monday's standup" into Sunday for somebody, and the cost
of answering "how long has this been dragging?" for a task that has been copied
forward twenty times.

## Decision

**Dates are `YYYY-MM-DD` strings everywhere** — database, API, URL. No `Date`
object crosses a boundary and nothing is converted between zones.

**Each task carries `originDate`**, the day it first appeared, copied forward
unchanged. Age is `target − originDate`: a subtraction, never a walk up the
`carriedFrom` chain.

## Consequences

Good:

- A day is the same day for everyone reading it. Comparison and sorting are
  string operations.
- Days-dragging is O(1) regardless of chain length, and `carriedFrom` is free to
  be a display detail rather than load-bearing arithmetic.
- `originDate` survives reassignment and reopening, so the clock does not reset
  when a task changes hands.

Bad, and accepted:

- **The day rolls over at the server's local midnight.** A distributed team gets
  one shared boundary that is nobody's midnight but the server's. Known gap, not
  yet addressed.
- `originDate` is denormalised, so a bug that writes the wrong one is permanent
  for that task. It is never recomputed, which is also why it is trustworthy.
- Any future "pause the clock" feature cannot be expressed as a subtraction.
  That is a real constraint — see the three-status decision in
  [CONTEXT.md](../../CONTEXT.md).

## Guardrails

`npm test` pins carry-forward across a skipped day, and pins that days-dragging
stays anchored to the origin date after a reopen and after a handover.
