import prisma from '@/lib/db';
import { pageMembership } from '@/lib/page';
import NoAccess from '@/components/NoAccess';
import Members from './Members';

export default async function MembersPage({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = Number((await params).teamId);
  const ctx = await pageMembership(teamId);
  if (!ctx) return <NoAccess />;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  // One groupBy, not a query a person: how much each of them has finished.
  const finished = await prisma.standupItem.groupBy({
    by: ['memberId'],
    where: { memberId: { in: members.map((m) => m.id) }, status: 'done' },
    _count: { _all: true },
  });
  const finishedBy = new Map(finished.map((f) => [f.memberId, f._count._all]));

  // You can only add someone who is already in the org, so the page offers
  // exactly those people and the mistake has nowhere to happen.
  const inOrg = await prisma.orgMember.findMany({
    where: {
      orgId: ctx.team.orgId,
      status: 'active',
      email: { notIn: members.filter((m) => m.isActive).map((m) => m.email) },
    },
    orderBy: { name: 'asc' },
    select: { email: true, name: true },
  });

  // Someone removed earlier is still offered here — adding them back restores
  // the row they already have, tasks and all.
  const removed = new Set(members.filter((m) => !m.isActive).map((m) => m.email));

  return (
    <Members
      teamId={teamId}
      teamName={ctx.team.name}
      isLead={ctx.isLead}
      myMemberId={ctx.member?.id ?? 0}
      members={members.map((m) => ({ ...m, finished: finishedBy.get(m.id) ?? 0 }))}
      addable={inOrg.map((p) => ({ ...p, returning: removed.has(p.email) }))}
      org={{ name: ctx.org.name, slug: ctx.org.slug }}
    />
  );
}
