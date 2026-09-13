import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logEvents } from '@/lib/audit';
import { isEmail, nameFromEmail, parseRecipients, type Recipient } from '@/lib/emails';
import { errorResponse, HttpError, requireOrgAdmin } from '@/lib/perms';

interface Context {
  params: Promise<{ slug: string }>;
}

/** What happened to each address, so the admin can see it rather than guess. */
type Outcome = 'added' | 'already' | 'deactivated' | 'invalid';

/**
 * Invite one person, or a whole pasted list. Either way they are in from the
 * moment they first sign in with that address.
 *   { name, email, role }   one person
 *   { emails, role }        a paste: commas, spaces, newlines, "Name <addr>"
 */
export async function POST(req: NextRequest, context: Context) {
  try {
    const { slug } = await context.params;
    const { user, org } = await requireOrgAdmin(slug);

    const { name, email, emails, role: rawRole } = await req.json();
    const role = rawRole === 'admin' ? 'admin' : 'member';

    let recipients: Recipient[] = [];
    const results: { email: string; name: string; outcome: Outcome }[] = [];

    if (typeof emails === 'string' && emails.trim()) {
      const parsed = parseRecipients(emails);
      recipients = parsed.recipients;
      for (const bad of parsed.invalid) results.push({ email: bad, name: '', outcome: 'invalid' });
      if (recipients.length === 0 && results.length === 0) {
        throw new HttpError(400, 'Paste at least one email address');
      }
    } else {
      const clean = String(email ?? '')
        .trim()
        .toLowerCase();
      if (!isEmail(clean)) throw new HttpError(400, 'Enter a work email address');
      recipients = [{ email: clean, name: String(name ?? '').trim() || nameFromEmail(clean) }];
    }

    const existing = await prisma.orgMember.findMany({
      where: { orgId: org.id, email: { in: recipients.map((r) => r.email) } },
      select: { email: true, status: true },
    });
    const statusOf = new Map(existing.map((e) => [e.email, e.status]));

    const fresh = recipients.filter((r) => {
      const status = statusOf.get(r.email);
      if (!status) return true;
      // Somebody an admin removed is not quietly let back in by a paste.
      results.push({
        ...r,
        outcome: status === 'deactivated' ? 'deactivated' : 'already',
      });
      return false;
    });

    if (fresh.length > 0) {
      await prisma.orgMember.createMany({
        data: fresh.map((r) => ({
          orgId: org.id,
          email: r.email,
          name: r.name,
          role,
          status: 'active',
        })),
      });
      await logEvents(
        fresh.map((r) => ({
          orgId: org.id,
          actor: { email: user.email, name: user.fullName },
          action: 'member.invited' as const,
          summary: `Invited ${r.name} (${r.email}) as ${role}`,
        }))
      );
      for (const r of fresh) results.push({ ...r, outcome: 'added' });
    }

    return NextResponse.json({
      added: fresh.length,
      results: results.sort((a, b) => a.outcome.localeCompare(b.outcome)),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
