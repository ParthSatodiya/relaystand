/**
 * Seeds a throwaway demo database for recording the docs GIFs.
 * Invented company, invented people, invented ticket numbers.
 *
 *   npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const url = process.env.DATABASE_URL;
if (!url || !url.includes('demo')) {
  throw new Error(`refusing to seed a database that is not the demo one: ${url}`);
}
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

// Monday-to-Friday of a fixed week, so the recording never drifts with the clock.
const MON = '2026-09-07';
const TUE = '2026-09-08';
const WED = '2026-09-09';
const THU = '2026-09-10';
const FRI = '2026-09-11';

const LEAD = 'rhea.kapadia@northwind.example';

async function main() {
  for (const t of ['standupItemLink', 'absence', 'standupItem', 'standup', 'teamMember', 'team', 'auditEvent', 'orgMember', 'org', 'user']) {
    await prisma[t].deleteMany();
  }

  const user = await prisma.user.create({
    data: { email: LEAD, fullName: 'Rhea Kapadia' },
  });

  const org = await prisma.org.create({
    data: {
      name: 'Northwind',
      slug: 'northwind',
      emailDomain: 'northwind.example',
      createdBy: user.id,
      members: {
        create: [
          { email: LEAD, name: 'Rhea Kapadia', role: 'admin', status: 'active' },
          { email: 'dev.raval@northwind.example', name: 'Dev Raval', status: 'active' },
          { email: 'mei.lin@northwind.example', name: 'Mei Lin', status: 'active' },
          { email: 'tom.okafor@northwind.example', name: 'Tom Okafor', status: 'active' },
        ],
      },
    },
  });

  const team = await prisma.team.create({
    data: {
      orgId: org.id,
      name: 'Payments',
      createdBy: user.id,
      members: {
        create: [
          { name: 'Rhea Kapadia', email: LEAD, role: 'lead' },
          { name: 'Dev Raval', email: 'dev.raval@northwind.example' },
          { name: 'Mei Lin', email: 'mei.lin@northwind.example' },
          { name: 'Tom Okafor', email: 'tom.okafor@northwind.example' },
        ],
      },
    },
    include: { members: true },
  });
  const m = Object.fromEntries(team.members.map((r) => [r.name.split(' ')[0], r.id]));

  const days = {};
  for (const date of [MON, TUE, WED, THU, FRI]) {
    days[date] = await prisma.standup.create({
      data: {
        teamId: team.id,
        date,
        createdBy: user.id,
        notes: date === FRI ? 'Release freeze from 16:00. Nothing new to staging after that.' : '',
      },
    });
  }

  let order = 0;
  /** Create one task and carry it forward across `dates`, ending in `endStatus`. */
  async function task({ member, title, comment = '', link, dates, endStatus = 'open' }) {
    const originDate = dates[0];
    let previous = null;
    for (const [i, date] of dates.entries()) {
      const last = i === dates.length - 1;
      const item = await prisma.standupItem.create({
        data: {
          standupId: days[date].id,
          memberId: member,
          title,
          comment: last ? comment : '',
          status: last ? endStatus : 'open',
          carriedFromId: previous,
          originDate,
          displayOrder: order++,
        },
      });
      if (link && last) await prisma.standupItemLink.create({ data: { itemId: item.id, url: link } });
      previous = item.id;
    }
  }

  // The point of the product: one task that has been running all week.
  await task({
    member: m.Dev,
    title: 'Retry logic for failed card captures',
    comment: 'Waiting on the gateway sandbox — raised with their support on Tuesday.',
    link: 'https://northwind.atlassian.net/browse/PAY-1187',
    dates: [MON, TUE, WED, THU, FRI],
    endStatus: 'blocked',
  });
  await task({
    member: m.Dev,
    title: 'Split the settlement job into batches',
    link: 'https://github.com/northwind/payments/pull/482',
    dates: [THU, FRI],
  });

  await task({
    member: m.Mei,
    title: 'Refund endpoint returns 500 on partial amounts',
    link: 'https://northwind.atlassian.net/browse/PAY-1203',
    dates: [WED, THU, FRI],
  });
  await task({ member: m.Mei, title: 'Review Tom’s webhook signing PR', dates: [FRI], endStatus: 'done' });
  await task({ member: m.Mei, title: 'Drop the unused currency table', dates: [MON, TUE], endStatus: 'done' });

  await task({
    member: m.Tom,
    title: 'Sign outgoing webhooks',
    link: 'https://github.com/northwind/payments/pull/479',
    dates: [TUE, WED, THU, FRI],
    endStatus: 'done',
  });
  await task({ member: m.Tom, title: 'Bump the SDK to 4.2', dates: [FRI], endStatus: 'done' });

  await task({ member: m.Rhea, title: 'Write up the chargeback flow for support', dates: [THU, FRI] });
  await task({ member: m.Rhea, title: 'Q4 capacity plan', dates: [MON, TUE, WED], endStatus: 'done' });

  // Tom took Wednesday off — his work stops carrying while he is away.
  await prisma.absence.create({ data: { standupId: days[WED].id, memberId: m.Tom } });

  const counts = {
    standups: await prisma.standup.count(),
    items: await prisma.standupItem.count(),
    members: await prisma.teamMember.count(),
  };
  console.log(
    `seeded ${JSON.stringify(counts)}\n` +
      `  org   /orgs/${org.slug}\n` +
      `  team  /teams/${team.id}?date=${FRI}`,
  );
}

main().finally(() => prisma.$disconnect());
