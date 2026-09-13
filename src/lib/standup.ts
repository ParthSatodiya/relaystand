import { differenceInCalendarDays, format, getDay, parseISO, subDays } from 'date-fns';
import prisma from '@/lib/db';
import { HttpError } from '@/lib/http';

export const STATUSES = ['open', 'done', 'blocked'] as const;
export type Status = (typeof STATUSES)[number];

export function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dates are YYYY-MM-DD strings end to end — no Date objects, no timezone traps. */
export function requireDate(value: unknown, what = 'date'): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new HttpError(400, `${what} must be YYYY-MM-DD`);
  }
  return value;
}

/** A `?date=` query param, or today when it is missing or malformed. */
export function dateParam(value: unknown, fallback = today()): string {
  return typeof value === 'string' && DATE_RE.test(value) ? value : fallback;
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function daysDragging(originDate: string, onDate: string): number {
  if (!originDate) return 0;
  return differenceInCalendarDays(parseISO(onDate), parseISO(originDate));
}

/**
 * The whole board for one date: every member with their items, or null if no
 * standup was held. Reading a date never creates anything — see POST.
 */
export async function loadBoard(teamId: number, date: string) {
  const standup = await prisma.standup.findUnique({
    where: { teamId_date: { teamId, date } },
    include: { items: { include: { links: true } }, absences: true },
  });
  if (!standup) return null;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    orderBy: { name: 'asc' },
  });
  const absent = new Set(standup.absences.map((a) => a.memberId));

  const rows = members
    .map((member) => {
      const items = standup.items
        .filter((i) => i.memberId === member.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        // Named rather than spread: the row's standupId/originDate/timestamps
        // are server business and would otherwise ride along to the browser.
        .map((i) => ({
          id: i.id,
          title: i.title,
          comment: i.comment,
          status: i.status,
          carriedFromId: i.carriedFromId,
          links: i.links.map((l) => ({ url: l.url })),
          daysDragging: daysDragging(i.originDate, date),
        }));
      // Keep a deactivated member visible on days they still have items.
      if (!member.isActive && items.length === 0) return null;
      return {
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        isActive: member.isActive,
        isAbsent: absent.has(member.id),
        items,
      };
    })
    .filter((m) => m !== null);

  return {
    id: standup.id,
    teamId: standup.teamId,
    date: standup.date,
    notes: standup.notes,
    createdBy: standup.createdBy,
    members: rows,
  };
}

/** Saturday and Sunday never take a column of their own. */
function isWeekend(date: string) {
  const day = getDay(parseISO(date));
  return day === 0 || day === 6;
}

/**
 * The columns of the week grid: the last `count` working days ending at
 * `endDate`, plus any weekend that actually held a standup — a team that stood
 * up on a Saturday should still see it. Pure, so the test can pin it.
 */
export function weekColumns(endDate: string, standupDates: Iterable<string>, count = 5) {
  const held = new Set(standupDates);
  const columns: string[] = [];
  // A run of five working days spans at most seven days; twenty is slack for a
  // long holiday without turning this into an unbounded walk.
  for (let back = 0; back < 20 && columns.length < count; back++) {
    const date = format(subDays(parseISO(endDate), back), 'yyyy-MM-dd');
    if (!isWeekend(date) || held.has(date)) columns.push(date);
  }
  return columns.reverse();
}

/**
 * The week grid: every column, and one bar a task per person spanning the days
 * that task has been on the board.
 *
 * Carry-forward writes a fresh row each day, so the rows are stitched back into
 * one bar by following `carriedFromId` inside the window. A chain whose parent
 * sits before the first column is marked `startsBefore`, and the bar runs off
 * the left edge rather than lying about when the task began.
 */
export async function loadWeek(teamId: number, endDate: string, count = 5) {
  const recent = await prisma.standup.findMany({
    where: { teamId, date: { lte: endDate } },
    orderBy: { date: 'desc' },
    take: 20,
    select: { date: true },
  });
  const columns = weekColumns(endDate, recent.map((r) => r.date), count);

  const [standups, members] = await Promise.all([
    prisma.standup.findMany({
      where: { teamId, date: { in: columns } },
      include: {
        items: { orderBy: { displayOrder: 'asc' }, include: { links: true } },
        absences: true,
      },
    }),
    prisma.teamMember.findMany({ where: { teamId }, orderBy: { name: 'asc' } }),
  ]);

  const dateOf = new Map(standups.flatMap((s) => s.items.map((i) => [i.id, s.date])));
  const inWindow = (id: number | null): id is number => id !== null && dateOf.has(id);
  const items = standups.flatMap((s) => s.items);
  const byId = new Map(items.map((i) => [i.id, i]));

  /** The oldest row of this task still inside the window. */
  function root(id: number) {
    let at = id;
    while (inWindow(byId.get(at)!.carriedFromId)) at = byId.get(at)!.carriedFromId!;
    return at;
  }

  const chains = new Map<number, typeof items>();
  for (const item of items) {
    const key = root(item.id);
    const bucket = chains.get(key);
    if (bucket) bucket.push(item);
    else chains.set(key, [item]);
  }

  const index = new Map(columns.map((date, i) => [date, i]));
  const bars = [...chains.entries()].map(([key, rows]) => {
    const sorted = rows.sort((a, b) => dateOf.get(a.id)!.localeCompare(dateOf.get(b.id)!));
    const latest = sorted[sorted.length - 1];
    const latestDate = dateOf.get(latest.id)!;
    return {
      // The newest row is the one a click should open: it holds today's status.
      id: latest.id,
      standupId: latest.standupId,
      memberId: latest.memberId,
      title: latest.title,
      comment: latest.comment,
      status: latest.status,
      links: latest.links.map((l) => ({ url: l.url })),
      from: index.get(dateOf.get(sorted[0].id)!)!,
      to: index.get(latestDate)!,
      date: latestDate,
      startsBefore: byId.get(key)!.carriedFromId !== null,
      daysDragging: daysDragging(latest.originDate, latestDate),
    };
  });

  const heldOn = new Set(standups.map((s) => s.date));
  const absent = new Map(
    standups.flatMap((s) => s.absences.map((a) => [`${a.memberId}:${s.date}`, true]))
  );

  return {
    columns: columns.map((date) => ({ date, held: heldOn.has(date), weekend: isWeekend(date) })),
    members: members
      .map((member) => ({
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        isActive: member.isActive,
        absentOn: columns.filter((date) => absent.has(`${member.id}:${date}`)),
        bars: bars.filter((b) => b.memberId === member.id),
      }))
      // A removed person stays visible on the days they still have work.
      .filter((m) => m.isActive || m.bars.length > 0),
  };
}

/**
 * The standup days either side of `date`, so the board's arrows can skip the
 * gaps. Two seeks rather than the team's whole history, which the client would
 * otherwise carry around to read two values out of.
 */
export async function neighbourDates(teamId: number, date: string) {
  const [prev, next] = await Promise.all([
    prisma.standup.findFirst({
      where: { teamId, date: { lt: date } },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
    prisma.standup.findFirst({
      where: { teamId, date: { gt: date } },
      orderBy: { date: 'asc' },
      select: { date: true },
    }),
  ]);
  return { prev: prev?.date ?? null, next: next?.date ?? null };
}

/** How many tasks each member finished on the standup before this date. */
export async function doneCountsBefore(teamId: number, date: string) {
  const previous = await prisma.standup.findFirst({
    where: { teamId, date: { lt: date } },
    orderBy: { date: 'desc' },
    select: { id: true },
  });
  if (!previous) return {};

  const rows = await prisma.standupItem.groupBy({
    by: ['memberId'],
    where: { standupId: previous.id, status: 'done' },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.memberId, r._count._all]));
}

/** What got marked done on the standup before this date — for the "since last time" strip. */
export async function previousCompleted(teamId: number, date: string) {
  const previous = await prisma.standup.findFirst({
    where: { teamId, date: { lt: date } },
    orderBy: { date: 'desc' },
    include: { items: { where: { status: 'done' }, include: { links: true } } },
  });
  if (!previous || previous.items.length === 0) return null;

  return {
    date: previous.date,
    items: previous.items.map((i) => ({
      id: i.id,
      memberId: i.memberId,
      title: i.title,
      links: i.links.map((l) => ({ url: l.url })),
    })),
  };
}

/**
 * Create the standup for `date` and pull forward everything unfinished from the
 * most recent standup *before* it. Reaching for "most recent before" rather than
 * "yesterday" is what makes a skipped day work: skip Tuesday and Wednesday's
 * standup carries Monday's items.
 */
export async function startStandup(teamId: number, date: string, userId: number) {
  const existing = await prisma.standup.findUnique({
    where: { teamId_date: { teamId, date } },
  });
  if (existing) throw new HttpError(409, 'A standup already exists for that date');

  const previous = await prisma.standup.findFirst({
    where: { teamId, date: { lt: date } },
    orderBy: { date: 'desc' },
    include: {
      items: { orderBy: [{ memberId: 'asc' }, { displayOrder: 'asc' }], include: { links: true } },
    },
  });

  const activeMemberIds = new Set(
    (await prisma.teamMember.findMany({ where: { teamId, isActive: true }, select: { id: true } })).map(
      (m) => m.id
    )
  );

  const carried = (previous?.items ?? []).filter(
    (i) => i.status !== 'done' && activeMemberIds.has(i.memberId)
  );

  return prisma.$transaction(async (tx) => {
    const standup = await tx.standup.create({
      data: { teamId, date, createdBy: userId, notes: '' },
    });

    // One create per item rather than createMany: the links ride along as a
    // nested create, which createMany cannot do.
    for (const [index, item] of carried.entries()) {
      await tx.standupItem.create({
        data: {
          standupId: standup.id,
          memberId: item.memberId,
          title: item.title,
          comment: item.comment,
          // A blocked task stays blocked; anything else lands as open.
          status: item.status === 'blocked' ? 'blocked' : 'open',
          carriedFromId: item.id,
          originDate: item.originDate || previous!.date,
          displayOrder: index,
          links: { create: item.links.map((l) => ({ url: l.url })) },
        },
      });
    }

    return standup;
  });
}

/**
 * Put a finished task back on the board for `standupId` — the lead reviewed it
 * and it was not done after all.
 *
 * The original stays `done`: it *was* finished that day, and the reports count
 * what happened, not what we wish had. What comes back is a carried copy, so
 * the day count runs on from when the task was first raised rather than today.
 */
export async function reopenItem(itemId: number, standupId: number) {
  const item = await prisma.standupItem.findUnique({
    where: { id: itemId },
    include: { links: true, standup: true },
  });
  if (!item) throw new HttpError(404, 'Item not found');

  const standup = await prisma.standup.findUnique({ where: { id: standupId } });
  if (!standup) throw new HttpError(404, 'Standup not found');
  if (standup.teamId !== item.standup.teamId) {
    throw new HttpError(400, 'That task belongs to another team');
  }

  // Finished on the day you are looking at: nothing to copy, just un-finish it.
  if (item.standupId === standupId) {
    return prisma.standupItem.update({
      where: { id: item.id },
      data: { status: 'open' },
      include: { links: true },
    });
  }

  // Reopening twice is the same as reopening once.
  const already = await prisma.standupItem.findFirst({
    where: { standupId, carriedFromId: item.id },
    include: { links: true },
  });
  if (already) return already;

  const last = await prisma.standupItem.findFirst({
    where: { standupId, memberId: item.memberId },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  return prisma.standupItem.create({
    data: {
      standupId,
      memberId: item.memberId,
      title: item.title,
      comment: item.comment,
      status: 'open',
      carriedFromId: item.id,
      originDate: item.originDate || item.standup.date,
      displayOrder: last ? last.displayOrder + 1 : 0,
      links: { create: item.links.map((l) => ({ url: l.url })) },
    },
    include: { links: true },
  });
}

/**
 * Hand a task to someone else on the team. It stays the same task — same
 * originDate, same carriedFrom, same status — so the day count keeps running
 * and tomorrow's carry-forward picks it up under its new owner. Earlier days
 * are untouched: the reports still credit whoever held it then.
 */
export async function assignItem(itemId: number, memberId: number) {
  const item = await prisma.standupItem.findUnique({
    where: { id: itemId },
    include: { standup: true },
  });
  if (!item) throw new HttpError(404, 'Item not found');
  if (item.memberId === memberId) return item;

  const target = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId: item.standup.teamId },
  });
  if (!target) throw new HttpError(404, 'That member is not on this team');
  // Carry-forward skips deactivated members, so this task would quietly
  // disappear at the next standup.
  if (!target.isActive) throw new HttpError(400, `${target.name} is no longer on the team`);

  // The old displayOrder belongs to the old list; land at the end of the new one.
  const last = await prisma.standupItem.findFirst({
    where: { standupId: item.standupId, memberId },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  return prisma.standupItem.update({
    where: { id: itemId },
    data: { memberId, displayOrder: last ? last.displayOrder + 1 : 0 },
  });
}
