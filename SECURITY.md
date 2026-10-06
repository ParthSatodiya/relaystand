# Security

## Reporting a vulnerability

Please do not open a public issue.

Use GitHub's [private vulnerability reporting](https://github.com/ParthSatodiya/relaystand/security/advisories/new)
on this repository. It reaches the maintainer directly and keeps the report
private until there is something to upgrade to.

Tell us what you found, how to reproduce it, and what an attacker gets out of
it. A short note with a working reproduction beats a long one without. You will
get an acknowledgement within a week; if you don't, the report didn't arrive —
open a public issue saying only "sent a private report, no reply" and nothing
more.

Please give a reasonable window to ship a fix before disclosing. There is no
bounty — this is a side project.

## What is supported

The latest commit on `main`. There are no maintained release branches yet, so
"upgrade" means pull and rebuild.

## What RelayStand actually holds

Worth knowing before you assess it. A deployment stores work email addresses and
display names, task titles and comments, links pasted onto tasks, who finished
what and when, an organisation logo if one was uploaded, and an audit trail of
membership and task changes. No passwords — sign-in is delegated to Google or
Microsoft Entra. No payment data. No content from the linked systems, only the
URLs.

## Things you should get right when self-hosting

These are configuration, not bugs, and they are the ones people miss.

**Close sign-in.** This is the big one. A Google or Entra OAuth client in its
usual "any account" mode authenticates anybody, and anyone who signs in can
create their own organisation on your server. Joining an existing organisation
always needs an admin's approval, so your data is not exposed — but strangers
can sign up and squat.

Set at least one of these in `.env`:

```shell
AUTH_ALLOWED_DOMAINS="acme.com"
AUTH_ALLOWED_EMAILS="contractor@gmail.com"
```

Matches are exact: `acme.com` does not admit `mail.acme.com` or
`evil-acme.com`. With both empty the server logs a warning at boot and lets
anyone in. Belt and braces: set your Google OAuth client to **Internal** if you
have a Workspace, or your Entra registration to **single tenant**.

**Generate a real `AUTH_SECRET`.** `npx auth secret`, or
`openssl rand -base64 32`. It signs the session cookies. Never commit it, and
rotate it if it leaks — everyone is signed out, nothing else breaks.

**Terminate TLS in front of it.** The app speaks plain HTTP on port 3000 and
expects a reverse proxy. `AUTH_URL` must be the `https://` hostname people
actually browse to, or the OAuth callback and the session cookie will disagree.
Pass through `Host`, `X-Forwarded-Proto` and `X-Forwarded-Host`.

**Back up the volume.** Everything lives in one SQLite file on the
`relaystand-data` volume. Losing it loses the history, and a ransomware-shaped
bad day is a security problem too.

```shell
docker compose exec relaystand node scripts/backup.mjs /data/backups
```

That is SQLite's own `VACUUM INTO` — a consistent copy taken while the app keeps
serving, which `cp` on a live database is not. Copy the result off the host;
a backup sitting on the disk you are protecting against is not a backup.
Uploaded logos are files under `UPLOAD_DIR`, not rows, so they need the same
treatment.

Restoring one means stopping the app, putting the file back, and **deleting the
`-wal` and `-shm` sidecars** — a stale pair beside a restored database makes the
next open fail outright with `database disk image is malformed`. The exact
commands are in [README.md](README.md#restoring).

## Demo mode

`npm run demo` adds a password-less sign-in button. It requires **both**
`DEMO_MODE=1` and a non-production `NODE_ENV`, so a production build cannot
enable it whatever the environment says — the provider is never registered, the
callback answers `error=Configuration`, and no session is issued. Verified, and
`npm test` pins the gate.

It signs in as a user that already exists and creates nobody, so the sign-in
allowlist has nothing to decide and is skipped for that provider only.

Do not run `next dev` with `DEMO_MODE=1` on a reachable host. The banner in the
log says so every boot.

## Known limits

Stated plainly rather than discovered by surprise:

- **No rate limiting** on any route, including sign-in. Put it in the proxy if
  you are internet-facing.
- **An org admin can export the whole organisation** from Settings, in one
  click. That is deliberate — your data is yours — but it means an admin
  account is a bulk-egress account. The export is written to the audit log
  every time. There is no matching import, on purpose: an importer writes
  `OrgMember` rows, which would walk straight around the sign-in allowlist.
- **Removal is a soft delete.** Deactivating a member keeps their name, email
  and task history so past standups still read correctly. There is no
  self-service account deletion; an operator must edit the database.
- **Uploads are served by the app** from `UPLOAD_DIR`. Types are restricted to
  a three-entry image allowlist and size-capped, and stored filenames are
  generated by the server, never taken from the upload.
- **Single instance only.** SQLite plus local file storage means one container.
  There is no clustering story yet.

## What we have already checked

A whole-project review covered authorization on every API route and server
page, injection, XSS, path traversal in the file store, and the email-identity
model. Findings from it are fixed in `680bf12`. Every route authorizes through
`src/lib/perms.ts`, and a member id in a URL or a body is always scoped to its
team before it is used.
