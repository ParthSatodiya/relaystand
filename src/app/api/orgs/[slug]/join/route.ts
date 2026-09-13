import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { errorResponse, HttpError, requireUser } from '@/lib/perms';

interface Context {
  params: Promise<{ slug: string }>;
}

/**
 * Ask to join. Anyone signed in can ask for any org they know the name of —
 * asking gets you a row in the admin's queue, nothing more. A matching email
 * domain is a convenience for finding the org, never a way past the approval.
 */
export async function POST(_req: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const user = await requireUser();

    const org = await prisma.org.findUnique({ where: { slug } });
    if (!org) throw new HttpError(404, 'No organisation with that name');

    const existing = await prisma.orgMember.findUnique({
      where: { orgId_email: { orgId: org.id, email: user.email } },
    });
    if (existing?.status === 'active') throw new HttpError(409, `You are already in ${org.name}`);
    if (existing?.status === 'pending') {
      throw new HttpError(409, `You have already asked to join ${org.name}`);
    }
    if (existing?.status === 'deactivated') {
      throw new HttpError(403, `An admin removed you from ${org.name}. Ask them to restore you.`);
    }

    await prisma.orgMember.create({
      data: { orgId: org.id, email: user.email, name: user.fullName, status: 'pending' },
    });
    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'member.requested',
      summary: `${user.fullName} asked to join`,
    });

    return NextResponse.json({ status: 'pending', org: { name: org.name, slug: org.slug } });
  } catch (e) {
    return errorResponse(e);
  }
}
