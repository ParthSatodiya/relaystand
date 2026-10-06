# ADR-0003: The data export is one-way

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

An org admin can download everything their organisation owns as JSON
(`GET /api/orgs/<slug>/export`). The obvious next question is whether there
should be an import to match it.

## Decision

No import endpoint. The export is an **egress** format: for reading, for taking
elsewhere, for proving nothing is locked in. Restoring a server is a database
snapshot (`scripts/backup.mjs`), not this file.

## Consequences

Good:

- The export can stay a dumb nested read. It owes nothing to a round-trip.
- No id-remapping layer, no collision rules for an org slug that already exists,
  no partial-import semantics to get subtly wrong.
- **No allowlist bypass.** An importer writes `OrgMember` rows, which is exactly
  what `AUTH_ALLOWED_DOMAINS` and `AUTH_ALLOWED_EMAILS` exist to control. An
  import endpoint would walk straight around the one gate protecting a
  self-hosted instance.

Bad, and accepted:

- The JSON cannot restore anything. It deliberately carries no `User` rows, so
  `createdBy` points at ids that are not in the file.
- Moving an org between two servers is not supported. Copy the database.

## Revisit when

Someone needs to merge two instances, or to split one org onto its own server.
At that point the thing to build is an org-level migration tool with its own
authorization story — not an import button on a settings page.
