import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, HttpError, parseId, requireLead } from '@/lib/perms';

interface Context {
  params: Promise<{ teamId: string; memberId: string }>;
}

const TEAM_ROLES = ['lead', 'member', 'observer'];

export async function PUT(req: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const teamId = parseId(params.teamId, 'team ID');
    const memberId = parseId(params.memberId, 'member ID');
    const { user, team, member: me } = await requireLead(teamId);

    const existing = await prisma.teamMember.findFirst({ where: { id: memberId, teamId } });
    if (!existing) throw new HttpError(404, 'That member is not on this team');

    // The email is the identity: changing it would hand this person's history
    // to somebody else. Deactivate and add the new address instead.
    const { name, role, isActive } = await req.json();
    const data: Prisma.TeamMemberUpdateInput = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw new HttpError(400, 'Name cannot be empty');
      data.name = String(name).trim();
    }
    if (role !== undefined) {
      if (!TEAM_ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
      data.role = role;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    // Don't let the last lead demote or deactivate themselves out of the team.
    const losingLead = (data.role !== undefined && data.role !== 'lead') || data.isActive === false;
    if (losingLead && memberId === me?.id) {
      const leads = await prisma.teamMember.count({
        where: { teamId, role: 'lead', isActive: true },
      });
      if (leads <= 1) {
        return NextResponse.json(
          { error: 'Promote another lead before removing yourself' },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.teamMember.update({ where: { id: memberId }, data });

    const actor = { email: user.email, name: user.fullName };
    if (data.role !== undefined && data.role !== existing.role) {
      await logEvent({
        orgId: team.orgId,
        teamId,
        actor,
        action: 'teammember.role',
        summary: `Made ${updated.name} a ${data.role} on ${team.name}`,
      });
    }
    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      await logEvent({
        orgId: team.orgId,
        teamId,
        actor,
        action: 'teammember.removed',
        summary: `${data.isActive ? 'Restored' : 'Removed'} ${updated.name} ${
          data.isActive ? 'to' : 'from'
        } ${team.name}`,
      });
    }

    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Soft delete — past standups keep their history. */
export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const teamId = parseId(params.teamId, 'team ID');
    const memberId = parseId(params.memberId, 'member ID');
    const { user, team, member: me } = await requireLead(teamId);

    if (memberId === me?.id) {
      const leads = await prisma.teamMember.count({
        where: { teamId, role: 'lead', isActive: true },
      });
      if (leads <= 1) {
        return NextResponse.json(
          { error: 'Promote another lead before removing yourself' },
          { status: 409 }
        );
      }
    }

    const removed = await prisma.teamMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });
    await logEvent({
      orgId: team.orgId,
      teamId,
      actor: { email: user.email, name: user.fullName },
      action: 'teammember.removed',
      summary: `Removed ${removed.name} from ${team.name}`,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
