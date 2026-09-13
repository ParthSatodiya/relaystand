import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { normaliseDomain, uniqueSlug } from '@/lib/orgs';
import { errorResponse, HttpError, requireUser } from '@/lib/perms';

/** Anyone signed in can start an org, and runs it. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { name, emailDomain } = await req.json();
    if (!String(name ?? '').trim()) throw new HttpError(400, 'Organisation name is required');

    const org = await prisma.org.create({
      data: {
        name: String(name).trim(),
        slug: await uniqueSlug(String(name)),
        emailDomain: normaliseDomain(emailDomain),
        createdBy: user.id,
        members: {
          create: { email: user.email, name: user.fullName, role: 'admin', status: 'active' },
        },
      },
    });

    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'org.created',
      summary: `Created ${org.name}`,
    });

    return NextResponse.json({ id: org.id, name: org.name, slug: org.slug });
  } catch (e) {
    return errorResponse(e);
  }
}
