import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, HttpError, requireOrg } from '@/lib/perms';

/** Any active member of the org can start a team, and leads it. */
export async function POST(req: NextRequest) {
  try {
    const { name, orgId } = await req.json();
    if (!name?.trim()) throw new HttpError(400, 'Team name is required');
    if (!orgId) throw new HttpError(400, 'orgId is required');

    const { user, org, orgMember } = await requireOrg(Number(orgId));

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        orgId: org.id,
        createdBy: user.id,
        members: {
          create: { name: orgMember.name || user.fullName, email: user.email, role: 'lead' },
        },
      },
    });

    await logEvent({
      orgId: org.id,
      teamId: team.id,
      actor: { email: user.email, name: user.fullName },
      action: 'team.created',
      summary: `Created the team ${team.name}`,
    });

    return NextResponse.json({
      id: team.id,
      name: team.name,
      memberCount: 1,
      myRole: 'lead',
      todayStandup: null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
