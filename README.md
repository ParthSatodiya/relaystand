# RelayStand

*The standup that remembers yesterday.*

Run a daily standup, carry unfinished work forward, and see who actually
finished what.

- **Daily board** — one section per developer, each task with an optional Jira
  link, a comment, and a status.
- **Carry forward, explicitly** — press *Start standup* and every unfinished
  task from the last standup you held comes across. Skip a day (or three) and it
  still reaches back to the last one that happened.
- **Devs update themselves** — a developer signs in and edits their own tasks. A
  lead edits anyone's on their team.
- **Reports** — completions per developer over a range, average days to done,
  and the tasks that have been dragging longest.

## Requirements

Node 22+, and a Google or Microsoft (Entra ID) OAuth app for sign-in.

## Local setup

```shell
npm install
cp .env.example .env      # then fill it in — see below
npx prisma migrate dev
npm run dev               # http://localhost:3000
```

### Filling in `.env`

```shell
npx auth secret           # writes AUTH_SECRET
```

Then add at least one provider. You only need one; both work side by side.

**Google** — Cloud Console → APIs & Services → Credentials → OAuth client ID
(Web application). Authorised redirect URI:
`http://localhost:3000/api/auth/callback/google`. Copy the client ID and secret
into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

**Microsoft / Outlook** — Azure Portal → Entra ID → App registrations → New
registration. Redirect URI:
`http://localhost:3000/api/auth/callback/microsoft-entra-id`. Copy the values
into `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, and set
`AUTH_MICROSOFT_ENTRA_ID_ISSUER` to
`https://login.microsoftonline.com/<tenant-id>/v2.0`.

## First run

1. Sign in. You become a user.
2. Create a team — you are its lead.
3. **Members** → add each developer by name and **work email**. That email is
   how they are matched when they sign in; until then you enter their tasks for
   them.
4. Back on the board, press **Start standup**.

## Deploying

One container, one SQLite file on a volume.

```shell
cp .env.example .env      # set AUTH_URL to the real hostname
docker compose up -d --build
```

`AUTH_URL` must match the host people browse to, and that host's callback URL
must be registered with Google/Microsoft. Migrations run automatically on
container start. `DATABASE_URL` is forced to the volume path — leave it alone in
compose.

To put it behind Nginx, proxy to port 3000 and pass through `Host`,
`X-Forwarded-Proto`, and `X-Forwarded-Host`.

## Tests

```shell
npm test
```

Covers the part worth covering: carry-forward across a skipped day, finished
tasks not carrying, deactivated members not carrying, blocked staying blocked,
and the days-dragging count staying anchored to the day a task first appeared.
