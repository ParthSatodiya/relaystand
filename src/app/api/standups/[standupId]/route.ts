import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, parseId, requireStandupAccess } from '@/lib/perms';

interface Context {
  params: Promise<{ standupId: string }>;
}

/** Standup-level notes — any member of the team can edit them. */
export async function PUT(req: NextRequest, context: Context) {
  try {
    const standupId = parseId((await context.params).standupId, 'standup ID');
    await requireStandupAccess(standupId);

    const { notes } = await req.json();
    if (typeof notes !== 'string') {
      return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
    }

    return NextResponse.json(
      await prisma.standup.update({ where: { id: standupId }, data: { notes } })
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** Deleting a day is a lead-only correction (a standup started by mistake). */
export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const standupId = parseId((await context.params).standupId, 'standup ID');
    const { isLead, user, team, standup } = await requireStandupAccess(standupId);
    if (!isLead) {
      return NextResponse.json({ error: 'Only a team lead can delete a standup' }, { status: 403 });
    }

    await prisma.standup.delete({ where: { id: standupId } });
    await logEvent({
      orgId: team.orgId,
      teamId: team.id,
      actor: { email: user.email, name: user.fullName },
      action: 'standup.deleted',
      summary: `Deleted the ${standup.date} standup for ${team.name}`,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
