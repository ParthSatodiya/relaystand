import { notFound } from 'next/navigation';
import { addDays, format } from 'date-fns';
import prisma from '@/lib/db';
import { pageOrg } from '@/lib/page';
import { AUDIT_ACTIONS, auditTeamFilter, type AuditAction } from '@/lib/audit';
import { dateParam, today } from '@/lib/standup';
import AppHeader from '@/components/AppHeader';
import AuditLog from './AuditLog';

const PAGE_SIZE = 200;

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ action?: string; from?: string; to?: string; teamId?: string }>;
}) {
  const ctx = await pageOrg((await params).slug);
  if (!ctx) notFound();

  // An admin sees the whole org. A team lead sees the teams they lead, and
  // nothing else — the log is not a back door into other people's teams.
  const led = await prisma.teamMember.findMany({
    where: { email: ctx.user.email, role: 'lead', isActive: true, team: { orgId: ctx.org.id } },
    select: { teamId: true },
  });
  const ledIds = led.map((t) => t.teamId);
  if (!ctx.isAdmin && ledIds.length === 0) notFound();

  const q = await searchParams;
  const from = dateParam(q.from, format(addDays(new Date(), -29), 'yyyy-MM-dd'));
  const to = dateParam(q.to, today());
  const teamId = q.teamId ? Number(q.teamId) : null;
  const action = q.action && q.action in AUDIT_ACTIONS ? (q.action as AuditAction) : null;

  const teamFilter = auditTeamFilter(ctx.isAdmin, teamId, ledIds);

  const events = await prisma.auditEvent.findMany({
    where: {
      orgId: ctx.org.id,
      ...teamFilter,
      ...(action ? { action } : {}),
      // Dates are YYYY-MM-DD strings everywhere else; the log is a timestamp,
      // so the range is inclusive of the whole "to" day.
      createdAt: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) },
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
  });

  const teams = await prisma.team.findMany({
    where: { orgId: ctx.org.id, ...(ctx.isAdmin ? {} : { id: { in: ledIds } }) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <AppHeader email={ctx.user.email} org={ctx.org} isAdmin={ctx.isAdmin} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <AuditLog
          actions={AUDIT_ACTIONS}
          slug={ctx.org.slug}
          scope={ctx.isAdmin ? 'org' : 'teams'}
          from={from}
          to={to}
          teams={teams}
          capped={events.length === PAGE_SIZE}
          events={events.map((e) => ({
            id: e.id,
            action: e.action,
            label: AUDIT_ACTIONS[e.action as AuditAction] ?? e.action,
            summary: e.summary,
            actorName: e.actorName,
            actorEmail: e.actorEmail,
            teamName: teams.find((t) => t.id === e.teamId)?.name ?? '',
            at: e.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
