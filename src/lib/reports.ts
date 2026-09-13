import prisma from '@/lib/db';
import { daysDragging } from '@/lib/standup';

/**
 * Counting rule that matters: "completed" is every completion in the range (a
 * finished task is never carried, so it is counted once). "Still open" and
 * "blocked" are read off the LAST standup in the range — the current position —
 * because counting rows would score one dragging task once per day it dragged.
 */
export async function buildReport(
  teamId: number,
  from: string,
  to: string,
  memberId?: number | null
) {
  const [members, standups] = await Promise.all([
    prisma.teamMember.findMany({ where: { teamId }, orderBy: { name: 'asc' } }),
    prisma.standup.findMany({
      where: { teamId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
      include: { items: { include: { links: true } }, absences: true },
    }),
  ]);

  const latest = standups[standups.length - 1];
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const doneItems = standups.flatMap((s) =>
    s.items.filter((i) => i.status === 'done').map((i) => ({ ...i, date: s.date }))
  );

  const summary = members
    .map((member) => {
      const done = doneItems.filter((i) => i.memberId === member.id);
      const current = (latest?.items ?? []).filter((i) => i.memberId === member.id);
      const open = current.filter((i) => i.status === 'open');
      const blocked = current.filter((i) => i.status === 'blocked');
      const durations = done.map((i) => daysDragging(i.originDate, i.date));
      const ageing = [...open, ...blocked].map((i) => daysDragging(i.originDate, latest!.date));

      return {
        memberId: member.id,
        memberName: member.name,
        isActive: member.isActive,
        completed: done.length,
        stillOpen: open.length,
        blocked: blocked.length,
        absentDays: standups.filter((s) => s.absences.some((a) => a.memberId === member.id)).length,
        avgDaysToDone: durations.length
          ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
          : null,
        longestDragging: ageing.length ? Math.max(...ageing) : 0,
      };
    })
    .filter((r) => r.isActive || r.completed > 0 || r.stillOpen > 0 || r.blocked > 0);

  // Everything still unfinished, worst first — the "quietly rotting" list.
  const dragging = (latest?.items ?? [])
    .filter((i) => i.status !== 'done')
    .map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      links: i.links.map((l) => ({ url: l.url })),
      memberName: nameById.get(i.memberId) ?? 'Unknown',
      days: daysDragging(i.originDate, latest!.date),
    }))
    .sort((a, b) => b.days - a.days);

  const history = memberId
    ? {
        memberId,
        memberName: nameById.get(memberId) ?? 'Unknown',
        days: standups.map((s) => ({
          date: s.date,
          absent: s.absences.some((a) => a.memberId === memberId),
          items: s.items
            .filter((i) => i.memberId === memberId)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((i) => ({
              id: i.id,
              title: i.title,
              status: i.status,
              links: i.links.map((l) => ({ url: l.url })),
              carried: i.carriedFromId !== null,
              days: daysDragging(i.originDate, s.date),
            })),
        })),
      }
    : null;

  return {
    from,
    to,
    standupCount: standups.length,
    latestDate: latest?.date ?? null,
    summary,
    dragging,
    history,
    members: members.map((m) => ({ id: m.id, name: m.name, isActive: m.isActive })),
  };
}

/** The team cards on /teams, for one user. */
/**
 * Teams inside one org. An admin sees every team there, whether or not they
 * are on it; everyone else sees the ones they belong to.
 */
export async function listTeams(email: string, todayStr: string, orgId: number, isAdmin = false) {
  const teams = await prisma.team.findMany({
    where: { orgId, ...(isAdmin ? {} : { members: { some: { email, isActive: true } } }) },
    orderBy: { createdAt: 'asc' },
    include: {
      members: { where: { isActive: true } },
      standups: { where: { date: todayStr }, include: { items: true } },
    },
  });

  return teams.map((team) => {
    const standup = team.standups[0] ?? null;
    const count = (status: string) =>
      standup ? standup.items.filter((i) => i.status === status).length : 0;
    return {
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
      myRole: team.members.find((m) => m.email === email)?.role ?? (isAdmin ? 'lead' : 'member'),
      todayStandup: standup
        ? {
            date: standup.date,
            // What time the board opened — the team list says "held at 09:32".
            heldAt: standup.createdAt.toISOString(),
            totalItems: standup.items.length,
            doneItems: count('done'),
            openItems: count('open'),
            blockedItems: count('blocked'),
            longestDays: standup.items
              .filter((i) => i.status !== 'done')
              .reduce((worst, i) => Math.max(worst, daysDragging(i.originDate, standup.date)), 0),
          }
        : null,
    };
  });
}
