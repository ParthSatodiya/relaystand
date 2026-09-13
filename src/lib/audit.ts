import prisma from '@/lib/db';

/**
 * The log is written at the time of the act, summary and all, so the page that
 * reads it stays a dumb list — an event from six months ago still reads the way
 * it did then, whatever the code does now.
 */
export const AUDIT_ACTIONS = {
  'org.created': 'Organisation created',
  'org.updated': 'Organisation settings changed',
  'member.invited': 'Member invited',
  'member.requested': 'Join requested',
  'member.approved': 'Join approved',
  'member.rejected': 'Join rejected',
  'member.role': 'Organisation role changed',
  'member.deactivated': 'Member deactivated',
  'member.restored': 'Member restored',
  'member.renamed': 'Member renamed',
  'team.created': 'Team created',
  'team.updated': 'Team renamed',
  'team.deleted': 'Team deleted',
  'teammember.added': 'Added to a team',
  'teammember.role': 'Team role changed',
  'teammember.removed': 'Removed from a team',
  'standup.deleted': 'Standup deleted',
  'task.reassigned': 'Task handed over',
  'task.reopened': 'Task reopened',
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** One row per thing that happened, written in a single insert. */
export async function logEvents(
  events: {
    orgId: number;
    teamId?: number | null;
    actor: { email: string; name: string };
    action: AuditAction;
    summary: string;
  }[]
) {
  if (events.length === 0) return;
  await prisma.auditEvent.createMany({
    data: events.map((e) => ({
      orgId: e.orgId,
      teamId: e.teamId ?? null,
      actorEmail: e.actor.email,
      actorName: e.actor.name,
      action: e.action,
      summary: e.summary,
    })),
  });
}

export async function logEvent(event: {
  orgId: number;
  teamId?: number | null;
  actor: { email: string; name: string };
  action: AuditAction;
  summary: string;
}) {
  await prisma.auditEvent.create({
    data: {
      orgId: event.orgId,
      teamId: event.teamId ?? null,
      actorEmail: event.actor.email,
      actorName: event.actor.name,
      action: event.action,
      summary: event.summary,
    },
  });
}
