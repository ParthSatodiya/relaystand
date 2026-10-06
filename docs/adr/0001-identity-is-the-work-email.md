# ADR-0001: Identity is the work email

- **Status:** Accepted — recorded retroactively; this describes code that
  already shipped.
- **Date:** 2026-10-07

## Context

Auth.js owns provider identity (Google, Microsoft Entra). A team lead needs to
add someone to a team and enter tasks for them *before* that person has ever
signed in — on day one nobody has. So the row that represents "a person on this
team" cannot depend on a login having happened.

## Decision

`TeamMember` and `OrgMember` are keyed on the person's **work email**, stored
lowercase. Neither has a `userId` foreign key. At request time the session email
is matched against those rows.

`User` exists only as the record of someone who has signed in; `signIn` upserts
it by email. Nothing joins to it by id.

## Consequences

Good:

- A lead can build the whole team before anyone logs in, and the rows are
  waiting when they do.
- Provider-agnostic. Adding GitHub or Okta later changes nothing here.
- No account-linking table, no orphaned identities.

Bad, and accepted:

- **Changing someone's email is a data migration**, not a profile edit. There is
  no self-service for it.
- Two accounts with different addresses for the same human are two people.
- Case and whitespace bugs become identity bugs. The guard is a rule, not a
  type: **lowercase on write, always.**

## Guardrails

`src/lib/access.ts` resolves every email-keyed lookup. `CLAUDE.md` and
`CONTRIBUTING.md` both state the lowercase rule because it is invisible until it
breaks.
