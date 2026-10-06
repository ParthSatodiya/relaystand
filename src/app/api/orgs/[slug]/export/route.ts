import { NextRequest, NextResponse } from 'next/server';
import { logEvent } from '@/lib/audit';
import { buildOrgExport } from '@/lib/export';
import { errorResponse, requireOrgAdmin } from '@/lib/perms';

interface Context {
  params: Promise<{ slug: string }>;
}

/** Everything the org owns, as a JSON download. Admins only. */
export async function GET(_req: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const { user, org } = await requireOrgAdmin(slug);

    // Built before the event is written, so an export never contains itself.
    const dump = await buildOrgExport(org.id);
    await logEvent({
      orgId: org.id,
      actor: { email: user.email, name: user.fullName },
      action: 'org.exported',
      summary: `Exported all ${org.name} data`,
    });

    return new NextResponse(JSON.stringify(dump, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${org.slug}-${dump.exportedAt.slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
