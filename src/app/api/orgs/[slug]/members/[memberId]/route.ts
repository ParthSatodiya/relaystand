import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent, type AuditAction } from '@/lib/audit';
import { assertNotLastAdmin } from '@/lib/orgs';
import { errorResponse, HttpError, parseId, requireOrgAdmin } from '@/lib/perms';

interface Context {
  params: Promise<{ slug: string; memberId: string }>;
}

/** Approve, reject, promote, deactivate, restore or rename — all admin work. */
export async function PUT(req: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const memberId = parseId(params.memberId, 'member ID');
    const { user, org } = await requireOrgAdmin(params.slug);

    const member = await prisma.orgMember.findFirst({ where: { id: memberId, orgId: org.id } });
    if (!member) throw new HttpError(404, 'That person is not in this organisation');

    const { role, status, name } = await req.json();
    const data: { role?: string; status?: string; name?: string } = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw new HttpError(400, 'Name cannot be empty');
      data.name = String(name).trim();
    }
    if (role !== undefined) {
      if (!['admin', 'member'].includes(role)) throw new HttpError(400, 'Invalid role');
      data.role = role;
    }
    if (status !== undefined) {
      if (!['active', 'deactivated'].includes(status)) throw new HttpError(400, 'Invalid status');
      data.status = status;
    }

    // An org with no admin is an org nobody can run.
    if (data.role === 'member' || data.status === 'deactivated') {
      await assertNotLastAdmin(org.id, member.id);
    }

    const updated = await prisma.orgMember.update({ where: { id: member.id }, data });
    const actor = { email: user.email, name: user.fullName };
    const log = (action: AuditAction, summary: string) =>
      logEvent({ orgId: org.id, actor, action, summary });

    if (data.name && data.name !== member.name) {
      await log('member.renamed', `Renamed ${member.name} to ${data.name}`);
    }
    if (data.role && data.role !== member.role) {
      await log('member.role', `Made ${updated.name} an org ${data.role}`);
    }
    if (data.status && data.status !== member.status) {
      if (member.status === 'pending' && data.status === 'active') {
        await log('member.approved', `Approved ${updated.name} (${updated.email})`);
      } else {
        await log(
          data.status === 'active' ? 'member.restored' : 'member.deactivated',
          `${data.status === 'active' ? 'Restored' : 'Deactivated'} ${updated.name}`
        );
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Rejecting a join request removes the row — they can ask again later. */
export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const memberId = parseId(params.memberId, 'member ID');
    const { user, org } = await requireOrgAdmin(params.slug);

    const member = await prisma.orgMember.findFirst({ where: { id: memberId, orgId: org.id } });
    if (!member) throw new HttpError(404, 'That person is not in this organisation');
    if (member.status !== 'pending') {
      throw new HttpError(400, 'Deactivate them instead — this only turns down a request');
    }

    await prisma.orgMember.delete({ where: { id: member.id } });
    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'member.rejected',
      summary: `Turned down ${member.name} (${member.email})`,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
