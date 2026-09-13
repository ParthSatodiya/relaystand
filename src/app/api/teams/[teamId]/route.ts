import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, parseId, requireLead } from '@/lib/perms';

interface Context {
  params: Promise<{ teamId: string }>;
}

export async function PUT(req: NextRequest, context: Context) {
  try {
    const teamId = parseId((await context.params).teamId, 'team ID');
    const { user, team } = await requireLead(teamId);

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { name: name.trim() },
    });
    await logEvent({
      orgId: team.orgId,
      teamId,
      actor: { email: user.email, name: user.fullName },
      action: 'team.updated',
      summary: `Renamed ${team.name} to ${updated.name}`,
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const teamId = parseId((await context.params).teamId, 'team ID');
    const { user, team } = await requireLead(teamId);
    await prisma.team.delete({ where: { id: teamId } });
    await logEvent({
      orgId: team.orgId,
      actor: { email: user.email, name: user.fullName },
      action: 'team.deleted',
      summary: `Deleted the team ${team.name}`,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
