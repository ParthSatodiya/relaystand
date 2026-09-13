/**
 * The check that matters: carry-forward across a SKIPPED day.
 * Run with `npm test` — it builds a throwaway SQLite file, so it touches nothing real.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Imported inside before(), after DATABASE_URL points at the throwaway file.
type Lib = typeof import('@/lib/standup');
type Links = typeof import('@/lib/links');
type Access = typeof import('@/lib/access');
type Emails = typeof import('@/lib/emails');
type Audit = typeof import('@/lib/audit');
let prisma: (typeof import('@/lib/db'))['default'];
let startStandup: Lib['startStandup'];
let reopenItem: Lib['reopenItem'];
let assignItem: Lib['assignItem'];
let daysDragging: Lib['daysDragging'];
let taskLink: Links['taskLink'];
let teamContext: Access['teamContext'];
let parseRecipients: Emails['parseRecipients'];
let requireTeamMember: Access['requireTeamMember'];
let auditTeamFilter: Audit['auditTeamFilter'];

const dir = mkdtempSync(path.join(tmpdir(), 'standup-test-'));
let team: { id: number };
let user: { id: number };
let asha: { id: number };
let bo: { id: number };
let gone: { id: number };
let org: { id: number };

const MON = '2026-03-02';
const TUE = '2026-03-03'; // deliberately skipped
const WED = '2026-03-04';
const THU = '2026-03-05';

before(async () => {
  process.env.DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });

  prisma = (await import('@/lib/db')).default;
  ({ startStandup, daysDragging, reopenItem, assignItem } = await import('@/lib/standup'));
  ({ taskLink } = await import('@/lib/links'));
  ({ teamContext, requireTeamMember } = await import('@/lib/access'));
  ({ auditTeamFilter } = await import('@/lib/audit'));
  ({ parseRecipients } = await import('@/lib/emails'));

  user = await prisma.user.create({ data: { email: 'lead@company.com', fullName: 'Lead' } });
  org = await prisma.org.create({
    data: {
      name: 'Acme',
      slug: 'acme',
      createdBy: user.id,
      members: {
        create: [
          { email: 'lead@company.com', name: 'Lead', role: 'admin', status: 'active' },
          { email: 'asha@company.com', name: 'Asha', status: 'active' },
          { email: 'bo@company.com', name: 'Bo', status: 'active' },
          { email: 'gone@company.com', name: 'Gone', status: 'active' },
          { email: 'watcher@company.com', name: 'Watcher', status: 'active' },
          { email: 'pending@company.com', name: 'Pending', status: 'pending' },
        ],
      },
    },
  });
  team = await prisma.team.create({ data: { name: 'Platform', orgId: org.id, createdBy: user.id } });
  [asha, bo, gone] = await Promise.all(
    [
      { name: 'Asha', email: 'asha@company.com', role: 'lead' },
      { name: 'Bo', email: 'bo@company.com', role: 'member' },
      { name: 'Gone', email: 'gone@company.com', role: 'member', isActive: false },
    ].map((m) => prisma.teamMember.create({ data: { ...m, teamId: team.id } }))
  );
  await prisma.teamMember.create({
    data: { teamId: team.id, name: 'Watcher', email: 'watcher@company.com', role: 'observer' },
  });
});

after(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test('monday: three tasks, one already finished', async () => {
  const monday = await prisma.standup.create({
    data: { teamId: team.id, date: MON, createdBy: user.id },
  });
  await prisma.standupItem.createMany({
    data: [
      { standupId: monday.id, memberId: asha.id, title: 'Ship login', status: 'open', originDate: MON },
      { standupId: monday.id, memberId: asha.id, title: 'Review PR', status: 'done', originDate: MON },
      { standupId: monday.id, memberId: bo.id, title: 'Waiting on infra', status: 'blocked', originDate: MON },
      { standupId: monday.id, memberId: gone.id, title: 'Old work', status: 'open', originDate: MON },
    ],
  });
  assert.equal(await prisma.standupItem.count({ where: { standupId: monday.id } }), 4);
});

test('wednesday (tuesday skipped) carries monday forward, minus the finished one', async () => {
  const wed = await startStandup(team.id, WED, user.id);
  const items = await prisma.standupItem.findMany({
    where: { standupId: wed.id },
    include: { carriedFrom: { include: { standup: true } } },
  });

  assert.equal(
    await prisma.standup.count({ where: { teamId: team.id, date: TUE } }),
    0,
    'tuesday was never held'
  );
  assert.deepEqual(
    items.map((i) => i.title).sort(),
    ['Ship login', 'Waiting on infra'],
    'finished work must not carry, and a deactivated member must not carry'
  );

  const blocked = items.find((i) => i.title === 'Waiting on infra')!;
  assert.equal(blocked.status, 'blocked', 'a blocked task stays blocked');
  assert.equal(items.find((i) => i.title === 'Ship login')!.status, 'open');

  // Reached back over the skipped Tuesday to Monday.
  for (const item of items) {
    assert.equal(item.carriedFrom?.standup.date, MON);
    assert.equal(item.originDate, MON, 'origin date survives the hop');
  }
  assert.equal(daysDragging(MON, WED), 2);
});

test('finishing on wednesday stops the carry; the blocker keeps ageing', async () => {
  const wed = await prisma.standup.findUniqueOrThrow({
    where: { teamId_date: { teamId: team.id, date: WED } },
  });
  await prisma.standupItem.updateMany({
    where: { standupId: wed.id, title: 'Ship login' },
    data: { status: 'done' },
  });

  const thu = await startStandup(team.id, THU, user.id);
  const items = await prisma.standupItem.findMany({ where: { standupId: thu.id } });

  assert.deepEqual(items.map((i) => i.title), ['Waiting on infra']);
  assert.equal(items[0].originDate, MON);
  assert.equal(daysDragging(items[0].originDate, THU), 3, 'still counted from monday, not wednesday');
});

test('a day cannot be started twice', async () => {
  await assert.rejects(() => startStandup(team.id, THU, user.id), /already exists/);
});

test('a lead can reopen a task finished on an earlier day', async () => {
  const thu = await prisma.standup.findUniqueOrThrow({
    where: { teamId_date: { teamId: team.id, date: THU } },
  });
  const reviewPR = await prisma.standupItem.findFirstOrThrow({
    where: { title: 'Review PR', originDate: MON },
  });

  const back = await reopenItem(reviewPR.id, thu.id);
  assert.equal(back.standupId, thu.id);
  assert.equal(back.status, 'open');
  assert.equal(back.carriedFromId, reviewPR.id);
  assert.equal(back.originDate, MON, 'the clock runs on from when it was first raised');
  assert.equal(daysDragging(back.originDate, THU), 3);

  const original = await prisma.standupItem.findUniqueOrThrow({ where: { id: reviewPR.id } });
  assert.equal(original.status, 'done', 'monday still finished it — history is not rewritten');

  // Pressing it twice must not leave two copies on the board.
  const again = await reopenItem(reviewPR.id, thu.id);
  assert.equal(again.id, back.id);
  assert.equal(
    await prisma.standupItem.count({ where: { standupId: thu.id, carriedFromId: reviewPR.id } }),
    1
  );

  // Reopening something already on this day just un-finishes it, no copy.
  const sameDay = await reopenItem(back.id, thu.id);
  assert.equal(sameDay.id, back.id);
  assert.equal(await prisma.standupItem.count({ where: { standupId: thu.id } }), 2);
});

test('a task handed to another developer keeps its age and its history', async () => {
  const thu = await prisma.standup.findUniqueOrThrow({
    where: { teamId_date: { teamId: team.id, date: THU } },
  });
  const blocked = await prisma.standupItem.findFirstOrThrow({
    where: { standupId: thu.id, title: 'Waiting on infra' },
  });
  const ashaLast = await prisma.standupItem.findFirstOrThrow({
    where: { standupId: thu.id, memberId: asha.id },
    orderBy: { displayOrder: 'desc' },
  });

  const moved = await assignItem(blocked.id, asha.id);
  assert.equal(moved.memberId, asha.id);
  assert.equal(moved.status, 'blocked', 'handing it over does not un-block it');
  assert.equal(moved.originDate, MON, 'same task, so the clock keeps running');
  assert.equal(daysDragging(moved.originDate, THU), 3);
  assert.equal(moved.displayOrder, ashaLast.displayOrder + 1, 'lands at the end of the new list');

  // Monday still says it was Bo's — days are snapshots, not a live pointer.
  const monday = await prisma.standupItem.findFirstOrThrow({
    where: { title: 'Waiting on infra', standup: { date: MON } },
  });
  assert.equal(monday.memberId, bo.id);

  // Tomorrow carries it under its new owner.
  const fri = await startStandup(team.id, '2026-03-06', user.id);
  const carried = await prisma.standupItem.findFirstOrThrow({
    where: { standupId: fri.id, title: 'Waiting on infra' },
  });
  assert.equal(carried.memberId, asha.id);
});

test('a task cannot be handed to someone who has left the team', async () => {
  const thu = await prisma.standup.findUniqueOrThrow({
    where: { teamId_date: { teamId: team.id, date: THU } },
  });
  const item = await prisma.standupItem.findFirstOrThrow({ where: { standupId: thu.id } });
  await assert.rejects(() => assignItem(item.id, gone.id), /no longer on the team/);
  await assert.rejects(() => assignItem(item.id, 9999), /not on this team/);
});

test('the org is the outer gate, and an observer never writes', async () => {
  // A team lead is a lead.
  const lead = await teamContext('asha@company.com', team.id);
  assert.equal(lead.isLead, true);
  assert.equal(lead.canWrite, true);

  // An ordinary member writes, but only their own row is theirs.
  const member = await teamContext('bo@company.com', team.id);
  assert.equal(member.isLead, false);
  assert.equal(member.canWrite, true);

  // An observer reads and nothing else.
  const observer = await teamContext('watcher@company.com', team.id);
  assert.equal(observer.canWrite, false, 'an observer must never write');
  assert.equal(observer.isLead, false);

  // An org admin reaches a team they were never added to.
  const admin = await teamContext('lead@company.com', team.id);
  assert.equal(admin.member, null, 'not on the team');
  assert.equal(admin.isLead, true, 'but runs the org');

  // Still waiting on approval: nothing.
  await assert.rejects(
    () => teamContext('pending@company.com', team.id),
    /not a member of this organisation/
  );

  // Deactivated in the org: the team row no longer matters.
  await prisma.orgMember.update({
    where: { orgId_email: { orgId: org.id, email: 'bo@company.com' } },
    data: { status: 'deactivated' },
  });
  await assert.rejects(
    () => teamContext('bo@company.com', team.id),
    /not a member of this organisation/
  );
  await prisma.orgMember.update({
    where: { orgId_email: { orgId: org.id, email: 'bo@company.com' } },
    data: { status: 'active' },
  });

  // Restoring gives the same board back, untouched.
  const restored = await teamContext('bo@company.com', team.id);
  assert.equal(restored.member?.id, bo.id);

  // Somebody else's org sees nothing of ours.
  const other = await prisma.user.create({
    data: { email: 'outsider@other.com', fullName: 'Outsider' },
  });
  await prisma.org.create({
    data: {
      name: 'Other',
      slug: 'other',
      createdBy: other.id,
      members: { create: { email: other.email, name: 'Outsider', role: 'admin', status: 'active' } },
    },
  });
  await assert.rejects(
    () => teamContext('outsider@other.com', team.id),
    /not a member of this organisation/
  );
});

test('a pasted list of addresses becomes people with names', () => {
  const { recipients, invalid } = parseRecipients(
    `asha.menon@company.com, dev_raval@company.com; mei-lin@company.com
     Krishnamurthy B <krishnamurthy.b@company.com>
     ASHA.MENON@company.com
     p@n.com  bo+standup@company.com  not-an-address`
  );

  assert.deepEqual(
    recipients.map((r) => [r.email, r.name]),
    [
      ['krishnamurthy.b@company.com', 'Krishnamurthy B'], // the pasted name wins
      ['asha.menon@company.com', 'Asha Menon'],
      ['dev_raval@company.com', 'Dev Raval'],
      ['mei-lin@company.com', 'Mei Lin'],
      ['p@n.com', 'P'],
      ['bo+standup@company.com', 'Bo'], // the +tag is not part of anyone's name
    ],
    'commas, semicolons, spaces and newlines all separate; case-duplicates collapse'
  );
  assert.deepEqual(invalid, ['not-an-address']);
});

test('a link chip is labelled from its provider', () => {
  assert.deepEqual(taskLink('https://acme.atlassian.net/browse/PROJ-1234'), {
    url: 'https://acme.atlassian.net/browse/PROJ-1234',
    label: 'PROJ-1234',
    kind: 'jira',
  });
  assert.equal(taskLink('https://github.com/acme/checkout/pull/482')?.label, 'checkout#482');
  assert.equal(taskLink('https://github.com/acme/checkout/issues/17')?.label, 'checkout#17');
  assert.equal(taskLink('https://linear.app/acme/issue/abc')?.label, 'linear.app');
  assert.equal(taskLink(''), null);
  // Anything that is not http(s) never becomes an href.
  assert.equal(taskLink('javascript:alert(1)'), null);
});

test('a member id from the URL is only ever honoured on its own team', async () => {
  // Anyone signed in can start an org and a team, which makes them a lead —
  // so "is a lead" alone must never be enough to touch a member row.
  const mallory = await prisma.user.create({
    data: { email: 'mallory@evil.com', fullName: 'Mallory' },
  });
  const evilOrg = await prisma.org.create({
    data: {
      name: 'Evil',
      slug: 'evil',
      createdBy: mallory.id,
      members: { create: { email: mallory.email, name: 'Mallory', role: 'admin', status: 'active' } },
    },
  });
  const evilTeam = await prisma.team.create({
    data: {
      orgId: evilOrg.id,
      name: 'Evil Team',
      createdBy: mallory.id,
      members: { create: { email: mallory.email, name: 'Mallory', role: 'lead' } },
    },
  });

  // She is a genuine lead of her own team...
  const ctx = await teamContext('mallory@evil.com', evilTeam.id);
  assert.equal(ctx.isLead, true);

  // ...which buys her nothing against a member id belonging to ours.
  await assert.rejects(
    () => requireTeamMember(evilTeam.id, asha.id),
    /not on this team/,
    'a lead must not reach another team’s member row by id'
  );

  // Her own member row still resolves, and Asha still resolves on her own team.
  const mine = await requireTeamMember(team.id, asha.id);
  assert.equal(mine.id, asha.id);
  assert.equal(mine.isActive, true, 'the guard must not have touched the row');
});

test('the audit filter narrows to the teams you lead, and the URL cannot widen it', () => {
  const led = [1, 2];

  // A lead sees their own teams by default...
  assert.deepEqual(auditTeamFilter(false, null, led), { teamId: { in: led } });
  // ...may narrow to one of them...
  assert.deepEqual(auditTeamFilter(false, 2, led), { teamId: 2 });
  // ...and an id they do not lead falls back, it never replaces the restriction.
  assert.deepEqual(
    auditTeamFilter(false, 7, led),
    { teamId: { in: led } },
    'a ?teamId= outside your teams must not widen the query'
  );

  // An admin sees the whole org, or one team of it.
  assert.deepEqual(auditTeamFilter(true, null, []), {});
  assert.deepEqual(auditTeamFilter(true, 7, []), { teamId: 7 });
});
