import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvent } from '@/lib/audit';
import { normaliseDomain } from '@/lib/orgs';
import { errorResponse, HttpError, requireOrgAdmin } from '@/lib/perms';

interface Context {
  params: Promise<{ slug: string }>;
}

export async function PUT(req: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const { user, org } = await requireOrgAdmin(slug);

    const { name, emailDomain } = await req.json();
    const data: { name?: string; emailDomain?: string } = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw new HttpError(400, 'Organisation name cannot be empty');
      data.name = String(name).trim();
    }
    // Blank means invite-only: nobody finds this org by their email address.
    if (emailDomain !== undefined) data.emailDomain = normaliseDomain(emailDomain);

    const updated = await prisma.org.update({ where: { id: org.id }, data });
    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'org.updated',
      summary: `Updated ${updated.name}${
        data.emailDomain !== undefined
          ? ` — joining by email domain ${data.emailDomain ? `is open to @${data.emailDomain}` : 'is off'}`
          : ''
      }`,
    });
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}
