import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, HttpError, parseId, requireLead } from '@/lib/perms';

const TEAM_ROLES = ['lead', 'member', 'observer'];

interface Context {
  params: Promise<{ teamId: string }>;
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const teamId = parseId((await context.params).teamId, 'team ID');
    const { user, team } = await requireLead(teamId);

    const { name, email, role } = await req.json();
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid work email is required' }, { status: 400 });
    }

    const clean = email.trim().toLowerCase();
    // You can only put someone on a team if they are in the org — otherwise the
    // org gate would bounce them off a board that lists their name.
    const inOrg = await prisma.orgMember.findUnique({
      where: { orgId_email: { orgId: team.orgId, email: clean } },
    });
    if (!inOrg || inOrg.status !== 'active') {
      const org = await prisma.org.findUniqueOrThrow({ where: { id: team.orgId } });
      throw new HttpError(
        400,
        inOrg?.status === 'pending'
          ? `${clean} is still waiting to be approved for ${org.name}`
          : `Invite ${clean} to ${org.name} first, on the organisation's people page`
      );
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_email: { teamId, email: clean } },
    });
    if (existing?.isActive) {
      return NextResponse.json({ error: 'That email is already on this team' }, { status: 409 });
    }
    // Removed earlier: the row is still there holding their old tasks, so adding
    // them again is a restore, not a second row the unique index would refuse.
    if (existing) {
      const restored = await prisma.teamMember.update({
        where: { id: existing.id },
        data: { isActive: true, role: TEAM_ROLES.includes(role) ? role : existing.role },
      });
      await logEvent({
        orgId: team.orgId,
        teamId,
        actor: { email: user.email, name: user.fullName },
        action: 'teammember.removed',
        summary: `Restored ${restored.name} to ${team.name} as ${restored.role}`,
      });
      return NextResponse.json(restored);
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        // Their org name unless the caller supplies one; leads can rename them
        // on this team afterwards.
        name: String(name ?? '').trim() || inOrg.name,
        email: clean,
        role: TEAM_ROLES.includes(role) ? role : 'member',
      },
    });
    await logEvent({
      orgId: team.orgId,
      teamId,
      actor: { email: user.email, name: user.fullName },
      action: 'teammember.added',
      summary: `Added ${member.name} to ${team.name} as ${member.role}`,
    });
    return NextResponse.json(member);
  } catch (e) {
    return errorResponse(e);
  }
}
